from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_checkpoint_path: str = "ml/best.pt"
    model_version: str = "sep28k-v1"

    cors_allow_origins: list[str] = ["http://localhost:3000"]
    max_upload_bytes: int = 25 * 1024 * 1024
    inference_device: str = "cpu"

    # Personalization / transcription layer.
    # "base" is a good CPU-friendly starting point for local development.
    whisper_model_size: str = "base"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    personalization_max_seconds: int = 180

    class Config:
        env_prefix = "FLUENT_"
        env_file = ".env"


settings = Settings()
