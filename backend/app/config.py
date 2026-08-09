from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Path to the trained checkpoint (ml/train.py's output). The service
    # will not start without one -- see app/main.py's startup check.
    model_checkpoint_path: str = "ml/best.pt"
    model_version: str = "sep28k-v1"

    # Match this to whatever the Next.js app runs on in each environment.
    # "*" is deliberately NOT the default: this endpoint accepts uploaded
    # audio of the user's own voice, so open CORS is a bigger deal than usual.
    cors_allow_origins: list[str] = ["http://localhost:3000"]

    max_upload_bytes: int = 25 * 1024 * 1024  # 25MB, generous for a few minutes of compressed speech
    inference_device: str = "cpu"  # set to "cuda" if the host has a GPU

    class Config:
        env_prefix = "FLUENT_"
        env_file = ".env"


settings = Settings()
