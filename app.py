import os
import spaces
import base64
import tempfile
from pathlib import Path

import numpy as np
import torch

from gradio import Server
from huggingface_hub import hf_hub_download

from model import StammerDetectionModel, severity_bucket
import audio


# ---------- Configuration ----------
MODEL_REPO = "kushagratyagii/fluent-stammer-model"
MODEL_VERSION = "sep28k-v1"
SAMPLE_RATE = 16000
MAX_AUDIO_SECONDS = 60
BATCH_SIZE = 8

device = "cuda"

# ---------- Load model ----------
checkpoint_path = hf_hub_download(
    repo_id=MODEL_REPO,
    filename="best.pt",
    token=os.environ.get("HF_TOKEN"),
)

model = StammerDetectionModel()
state_dict = torch.load(
    checkpoint_path,
    map_location="cpu",
    weights_only=True,
)
model.load_state_dict(state_dict)
model.to(device)
model.eval()

DISFLUENCY_TYPES = [
    "block",
    "prolongation",
    "sound_repetition",
    "word_repetition",
    "interjection",
]

app = Server(
    title="Fluent Speech API",
    description="AI-powered speech fluency analysis API",
    version="1.0.0",
)


# ---------- GPU inference ----------
@spaces.GPU(duration=60)
def run_model(chunks):
    predictions = []

    with torch.inference_mode():
        for start in range(0, len(chunks), BATCH_SIZE):
            batch_chunks = chunks[start : start + BATCH_SIZE]

            values = np.stack([item[0] for item in batch_chunks])
            input_values = torch.tensor(
                values,
                dtype=torch.float32,
                device=device,
            )
            attention_mask = torch.ones_like(
                input_values,
                dtype=torch.long,
            )

            output = model(
                input_values=input_values,
                attention_mask=attention_mask,
            )

            fluency_probs = torch.sigmoid(output.fluency_logit).cpu().numpy()
            type_probs = torch.sigmoid(output.type_logits).cpu().numpy()
            severity_scores = (
                torch.sigmoid(output.severity_raw) * 100
            ).cpu().numpy()

            for i, (_, start_sec, end_sec) in enumerate(batch_chunks):
                probability = float(fluency_probs[i])
                is_fluent = probability >= 0.5

                predictions.append({
                    "start_seconds": float(start_sec),
                    "end_seconds": float(end_sec),
                    "fluent": bool(is_fluent),
                    "fluency_confidence": float(
                        probability if is_fluent else 1 - probability
                    ),
                    "disfluency_types": {
                        name: float(type_probs[i][j])
                        for j, name in enumerate(DISFLUENCY_TYPES)
                    },
                    "severity_score": float(severity_scores[i]),
                })

    return predictions


# ---------- API endpoints ----------
@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": True,
        "model_version": MODEL_VERSION,
    }


@app.api(
    name="analyze",
    description="Analyze an audio recording for speech disfluencies.",
    concurrency_limit=1,
    time_limit=180,
)
def analyze(audio_base64: str, session_id: str = ""):
    if not audio_base64:
        raise ValueError("No audio was provided.")

    try:
        raw_bytes = base64.b64decode(audio_base64, validate=True)
    except Exception:
        raise ValueError("Invalid base64 audio data.")

    if not raw_bytes:
        raise ValueError("The uploaded audio is empty.")

    suffix = ".webm"
    wav_path = None

    try:
        wav_path = audio.decode_to_wav(raw_bytes, suffix=suffix)
        waveform, warnings = audio.load_and_validate(wav_path)

        duration = len(waveform) / SAMPLE_RATE
        if duration > MAX_AUDIO_SECONDS:
            raise ValueError(
                f"Demo deployment currently supports audio up to "
                f"{MAX_AUDIO_SECONDS} seconds."
            )

        chunks = audio.chunk_audio(waveform)
        if not chunks:
            raise ValueError("No audio chunks could be generated.")

        clips = run_model(chunks)

        fluent_clips = [clip for clip in clips if clip["fluent"]]
        stuttered_clips = [clip for clip in clips if not clip["fluent"]]

        fluent_ratio = len(fluent_clips) / len(clips)

        severity = (
            float(np.mean([
                clip["severity_score"] for clip in stuttered_clips
            ]))
            if stuttered_clips else 0.0
        )

        type_counts = {}
        for clip in stuttered_clips:
            strongest = max(
                clip["disfluency_types"],
                key=clip["disfluency_types"].get,
            )
            if clip["disfluency_types"][strongest] >= 0.5:
                type_counts[strongest] = type_counts.get(strongest, 0) + 1

        dominant_type = (
            max(type_counts, key=type_counts.get)
            if type_counts else None
        )

        return {
            "session_id": session_id or "demo-session",
            "duration_seconds": float(duration),
            "clips": clips,
            "overall_fluent_ratio": float(fluent_ratio),
            "overall_severity_score": severity,
            "overall_severity_bucket": severity_bucket(severity),
            "dominant_disfluency_type": dominant_type,
            "transcript": None,
            "target_words": [],
            "personalized_exercise": None,
            "model_version": MODEL_VERSION,
            "warnings": warnings + [
                "Transcription and personalized exercises are disabled in this demo deployment."
            ],
        }

    finally:
        if wav_path and Path(wav_path).exists():
            Path(wav_path).unlink(missing_ok=True)


# Hugging Face Spaces expects this variable.
demo = app

if __name__ == "__main__":
    demo.launch(ssr_mode=False)

