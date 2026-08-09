"""
Runs without a real checkpoint or ffmpeg by monkeypatching the model-load
step and the ffmpeg decode step. Covers the paths that don't need a real
model: unhealthy-until-loaded, upload validation, and the aggregate() logic
against a hand-built prediction list.

Run with: pytest backend/tests -v
"""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import main
from app.schemas import ClipPrediction, DisfluencyBreakdown


def make_clip(fluent: bool, top_type: str = "block", severity: float = 10.0) -> ClipPrediction:
    types = {t: 0.05 for t in ["block", "prolongation", "sound_repetition", "word_repetition", "interjection"]}
    if not fluent:
        types[top_type] = 0.9
    return ClipPrediction(
        start_seconds=0,
        end_seconds=3,
        fluent=fluent,
        fluency_confidence=0.9,
        disfluency_types=DisfluencyBreakdown(**types),
        severity_score=severity,
    )


def test_health_before_model_loaded():
    main._model_load_error = "no checkpoint"  # simulate a fresh deploy pre-training
    client = TestClient(main.app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "degraded"
    assert resp.json()["model_loaded"] is False


def test_analyze_rejects_when_model_not_loaded():
    main._model_load_error = "no checkpoint"
    client = TestClient(main.app)
    resp = client.post("/v1/analyze", files={"audio_file": ("clip.webm", b"not empty", "audio/webm")})
    assert resp.status_code == 503


def test_analyze_rejects_empty_upload():
    main._model_load_error = None  # pretend model IS loaded to reach the empty-file check
    client = TestClient(main.app)
    resp = client.post("/v1/analyze", files={"audio_file": ("clip.webm", b"", "audio/webm")})
    assert resp.status_code == 400
    main._model_load_error = "no checkpoint"  # restore


def test_aggregate_picks_dominant_type_and_bucket():
    from app.inference import StammerPredictor

    predictor = object.__new__(StammerPredictor)  # skip __init__, don't need a real model for aggregate()
    clips = [make_clip(True), make_clip(False, "block", 70), make_clip(False, "block", 80)]
    response = predictor.aggregate(clips, duration_seconds=9.0, session_id="sess-1", warnings=[])

    assert response.dominant_disfluency_type == "block"
    assert response.overall_severity_bucket == "severe"
    assert response.overall_fluent_ratio == pytest.approx(1 / 3)
    assert response.session_id == "sess-1"


def test_aggregate_raises_on_no_clips():
    from app.inference import StammerPredictor

    predictor = object.__new__(StammerPredictor)
    with pytest.raises(ValueError):
        predictor.aggregate([], duration_seconds=0, session_id=None, warnings=[])


def test_chunk_audio_short_clip_yields_one_padded_chunk():
    from app import audio

    short = np.random.uniform(-0.1, 0.1, size=audio.SAMPLE_RATE * 1).astype("float32")  # 1s of audio
    chunks = audio.chunk_audio(short)
    assert len(chunks) == 1
    assert len(chunks[0][0]) == audio.CLIP_SAMPLES


def test_chunk_audio_long_clip_has_overlap():
    from app import audio

    long = np.random.uniform(-0.1, 0.1, size=audio.SAMPLE_RATE * 7).astype("float32")  # 7s
    chunks = audio.chunk_audio(long)
    assert len(chunks) >= 3  # 3 windows at 2s hop cover 7s with 1s overlap each
    for _, start, end in chunks:
        assert end - start <= audio.CLIP_SECONDS + 0.01
