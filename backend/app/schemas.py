from __future__ import annotations

from pydantic import BaseModel, Field


class DisfluencyBreakdown(BaseModel):
    block: float = Field(ge=0, le=1)
    prolongation: float = Field(ge=0, le=1)
    sound_repetition: float = Field(ge=0, le=1)
    word_repetition: float = Field(ge=0, le=1)
    interjection: float = Field(ge=0, le=1)


class ClipPrediction(BaseModel):
    """Prediction for one ~3s analysis window inside the uploaded audio."""

    start_seconds: float
    end_seconds: float
    fluent: bool
    fluency_confidence: float = Field(ge=0, le=1, description="Model's confidence in the fluent/stuttered call")
    disfluency_types: DisfluencyBreakdown
    severity_score: float = Field(ge=0, le=100)


class AnalyzeResponse(BaseModel):
    session_id: str | None = Field(default=None, description="Echoes the caller's exercise-session id, if provided")
    duration_seconds: float
    clips: list[ClipPrediction]

    # Aggregated across all clips in the recording, for a single summary card.
    overall_fluent_ratio: float = Field(ge=0, le=1, description="Fraction of clips classified as fluent")
    overall_severity_score: float = Field(ge=0, le=100)
    overall_severity_bucket: str = Field(description='"mild" | "moderate" | "severe"')
    dominant_disfluency_type: str | None = Field(
        default=None, description="Most frequent disfluency type across stuttered clips, or null if none"
    )

    model_version: str
    warnings: list[str] = Field(default_factory=list, description="e.g. low audio volume, clip too short, clipping detected")


class ErrorResponse(BaseModel):
    detail: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str | None = None
