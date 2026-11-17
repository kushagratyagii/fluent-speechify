
from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from langchain_openai import ChatOpenAI

from app import audio
from app.config import settings
from app.inference import get_predictor, load_predictor, personalize_audio
from app.schemas import AnalyzeResponse, HealthResponse


logger = logging.getLogger("fluent.backend")
logging.basicConfig(level=logging.INFO)

_model_load_error: str | None = None


# ---------------------------------------------------------
# AI PASSAGE SCHEMAS
# ---------------------------------------------------------

class PassageRequest(BaseModel):
    mode: str
    target_words: list[str] = Field(default_factory=list)
    difficulty: str = "beginner"


class PassageResponse(BaseModel):
    title: str
    sentences: list[str]
    vocabulary: list[str]


# ---------------------------------------------------------
# APPLICATION LIFESPAN
# ---------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model_load_error

    try:
        load_predictor()
        logger.info("Model loaded: %s", settings.model_version)
    except Exception as e:
        _model_load_error = str(e)
        logger.error("Model failed to load: %s", e)

    yield


app = FastAPI(
    title="Fluent Stammering Analysis API",
    version="1.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# REQUEST SIZE MIDDLEWARE
# ---------------------------------------------------------

@app.middleware("http")
async def reject_oversized_uploads(request: Request, call_next):
    content_length = request.headers.get("content-length")

    if content_length and int(content_length) > settings.max_upload_bytes:
        return JSONResponse(
            status_code=413,
            content={"detail": "Upload exceeds max size"},
        )

    return await call_next(request)


# ---------------------------------------------------------
# HEALTH CHECK
# ---------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if _model_load_error is None else "degraded",
        model_loaded=_model_load_error is None,
        model_version=(
            settings.model_version
            if _model_load_error is None
            else None
        ),
    )


# ---------------------------------------------------------
# SPEECH ANALYSIS
# ---------------------------------------------------------

@app.post(
    "/v1/analyze",
    response_model=AnalyzeResponse,
    responses={
        400: {"description": "Bad or unusable audio"},
        503: {"description": "Model not loaded"},
    },
)
async def analyze(
    audio_file: UploadFile = File(
        ...,
        description="Recorded exercise audio, any browser-recordable format",
    ),
    session_id: str | None = Form(
        default=None,
        description="Optional ExerciseSession.id to echo back for correlation",
    ),
    personalization_history: str | None = Form(
        default=None,
        description="Recent personalization history as a JSON array",
    ),
) -> AnalyzeResponse:

    if _model_load_error is not None:
        raise HTTPException(
            status_code=503,
            detail="Model is not loaded on this instance",
        )

    history: list[dict] = []

    if personalization_history:
        try:
            parsed = json.loads(personalization_history)

            if isinstance(parsed, list):
                history = [
                    item
                    for item in parsed
                    if isinstance(item, dict)
                ]

        except json.JSONDecodeError:
            logger.warning(
                "Ignoring invalid personalization history JSON"
            )

    raw_bytes = await audio_file.read()

    if not raw_bytes:
        raise HTTPException(
            status_code=400,
            detail="Empty upload",
        )

    suffix = (
        Path(audio_file.filename or "clip.webm").suffix
        or ".webm"
    )

    wav_path: Path | None = None

    try:
        try:
            wav_path = audio.decode_to_wav(
                raw_bytes,
                suffix=suffix,
            )
        except RuntimeError as e:
            raise HTTPException(
                status_code=500,
                detail=str(e),
            ) from e
        except audio.AudioValidationError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e),
            ) from e

        try:
            samples, warnings = audio.load_and_validate(wav_path)
        except audio.AudioValidationError as e:
            raise HTTPException(
                status_code=400,
                detail=str(e),
            ) from e

        chunks = audio.chunk_audio(samples)

        predictor = get_predictor()
        clip_predictions = predictor.predict_chunks(chunks)

        transcript, target_words, exercise = personalize_audio(
            wav_path=wav_path,
            clips=clip_predictions,
            duration_seconds=len(samples) / audio.SAMPLE_RATE,
            warnings=warnings,
            personalization_history=history,
        )

        return predictor.aggregate(
            clip_predictions,
            duration_seconds=len(samples) / audio.SAMPLE_RATE,
            session_id=session_id,
            warnings=warnings,
            transcript=transcript,
            target_words=target_words,
            personalized_exercise=exercise,
        )

    finally:
        if wav_path is not None:
            wav_path.unlink(missing_ok=True)


# ---------------------------------------------------------
# AI DAILY PASSAGE + PERSONALIZED PARA
# ---------------------------------------------------------

@app.post(
    "/v1/generate-passage",
    response_model=PassageResponse,
)
async def generate_passage(
    payload: PassageRequest,
) -> PassageResponse:

    if payload.mode not in {"daily", "personalized"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid passage mode",
        )

    if payload.difficulty not in {
        "beginner",
        "intermediate",
        "advanced",
    }:
        raise HTTPException(
            status_code=400,
            detail="Invalid difficulty",
        )

    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="OpenAI API key is not configured",
        )

    target_words = [
        word.strip()
        for word in payload.target_words
        if isinstance(word, str) and word.strip()
    ][:8]

    if payload.mode == "personalized" and not target_words:
        raise HTTPException(
            status_code=400,
            detail="Target words are required for personalized passages",
        )

    try:
        llm = ChatOpenAI(
            model=settings.openai_model,
            api_key=settings.openai_api_key,
            temperature=0.7,
            max_tokens=700,
        )

        structured_llm = llm.with_structured_output(
            PassageResponse
        )

        target_text = (
            ", ".join(target_words)
            if target_words
            else "No specific target words"
        )

        base_prompt = f"""
You are an expert educational writing assistant creating
reading passages for a speech-practice application.

MODE: {payload.mode}
DIFFICULTY: {payload.difficulty}
TARGET WORDS: {target_text}

STRICT REQUIREMENTS:

1. Write a complete passage of 100 to 150 words.
2. The sentences array must contain the complete passage.
3. Aim for approximately 120 words.
4. Include 4 to 6 useful vocabulary words in the vocabulary array.
5. Write natural, grammatically correct English.
6. Use comfortable sentence lengths suitable for reading aloud.
7. Adapt sentence complexity to the requested difficulty.

DIFFICULTY GUIDANCE:

Beginner:
- Simple everyday vocabulary.
- Short sentences.
- Familiar situations.

Intermediate:
- Moderate vocabulary.
- Varied sentence structures.
- Natural conversational flow.

Advanced:
- Richer vocabulary.
- More varied sentence structures.
- More complex but readable ideas.

MODE GUIDANCE:

Daily:
- Create an original, interesting passage.
- Introduce useful vocabulary naturally.
- Do not use target words as a requirement.

Personalized:
- Naturally incorporate the supplied target words.
- Do not force words into unnatural sentences.
- Build a coherent passage around them.

IMPORTANT:
- Return the complete passage, not a summary.
- Do not return only 3 or 4 short sentences.
- Do not include medical claims or diagnoses.
- Do not mention AI or speech analysis in the passage.
- Return a title, sentences array and vocabulary array.
"""

        # Retry once if the model returns a passage below 100 words.
        for attempt in range(2):

            prompt = base_prompt

            if attempt == 1:
                prompt += """
YOUR PREVIOUS RESPONSE WAS TOO SHORT.

Generate a substantially longer passage this time.
The combined sentences MUST contain at least 110 words.
Count the words before returning your response.
Do not shorten the passage.
"""

            result = await structured_llm.ainvoke(prompt)

            sentences = [
                sentence.strip()
                for sentence in result.sentences
                if sentence.strip()
            ]

            word_count = len(" ".join(sentences).split())

            logger.info(
                "Passage generation attempt %s: %s words",
                attempt + 1,
                word_count,
            )

            if 100 <= word_count <= 150:
                return PassageResponse(
                    title=result.title.strip(),
                    sentences=sentences,
                    vocabulary=result.vocabulary[:6],
                )

        raise HTTPException(
            status_code=502,
            detail=(
                "AI could not generate a passage within "
                "the required 100-150 word range. Please retry."
            ),
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception("Passage generation failed")

        raise HTTPException(
            status_code=502,
            detail="AI passage generation failed. Please retry.",
        ) from e
