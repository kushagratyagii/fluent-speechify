from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import audio
from app.config import settings
from app.inference import get_predictor, load_predictor
from app.schemas import AnalyzeResponse, HealthResponse

logger = logging.getLogger("fluent.backend")
logging.basicConfig(level=logging.INFO)

_model_load_error: str | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model_load_error
    try:
        load_predictor()
        logger.info("Model loaded: %s", settings.model_version)
    except Exception as e:  # noqa: BLE001 -- deliberately broad: we want the
        # service to still come up and report /health as unhealthy rather
        # than crash-loop when the checkpoint isn't in place yet (e.g. first
        # deploy before training has finished).
        _model_load_error = str(e)
        logger.error("Model failed to load: %s", e)
    yield


app = FastAPI(title="Fluent Stammering Analysis API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.middleware("http")
async def reject_oversized_uploads(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.max_upload_bytes:
        return JSONResponse(status_code=413, content={"detail": "Upload exceeds max size"})
    return await call_next(request)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if _model_load_error is None else "degraded",
        model_loaded=_model_load_error is None,
        model_version=settings.model_version if _model_load_error is None else None,
    )


@app.post(
    "/v1/analyze",
    response_model=AnalyzeResponse,
    responses={400: {"description": "Bad or unusable audio"}, 503: {"description": "Model not loaded"}},
)
async def analyze(
    audio_file: UploadFile = File(..., description="Recorded exercise audio, any browser-recordable format"),
    session_id: str | None = Form(default=None, description="Optional ExerciseSession.id to echo back for correlation"),
) -> AnalyzeResponse:
    if _model_load_error is not None:
        raise HTTPException(status_code=503, detail="Model is not loaded on this instance")

    raw_bytes = await audio_file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty upload")

    suffix = Path(audio_file.filename or "clip.webm").suffix or ".webm"
    wav_path: Path | None = None
    try:
        try:
            wav_path = audio.decode_to_wav(raw_bytes, suffix=suffix)
        except RuntimeError as e:
            # ffmpeg missing is an operator problem, not a client problem
            raise HTTPException(status_code=500, detail=str(e)) from e
        except audio.AudioValidationError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        try:
            samples, warnings = audio.load_and_validate(wav_path)
        except audio.AudioValidationError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        chunks = audio.chunk_audio(samples)
        predictor = get_predictor()
        clip_predictions = predictor.predict_chunks(chunks)
        response = predictor.aggregate(
            clip_predictions,
            duration_seconds=len(samples) / audio.SAMPLE_RATE,
            session_id=session_id,
            warnings=warnings,
        )
        return response
    finally:
        if wav_path is not None:
            wav_path.unlink(missing_ok=True)
