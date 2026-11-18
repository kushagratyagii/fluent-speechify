
import os
import json
import spaces
import base64
from pathlib import Path

import numpy as np
import torch
from openai import OpenAI
from gradio import Server
from huggingface_hub import hf_hub_download

from model import StammerDetectionModel, severity_bucket
import audio


# ---------- Configuration ----------
MODEL_REPO = "kushagratyagii/fluent-stammer-model"
MODEL_VERSION = "sep28k-v1"
OPENAI_MODEL = "gpt-4.1-mini"

SAMPLE_RATE = 16000
MAX_AUDIO_SECONDS = 60
BATCH_SIZE = 8

device = "cuda"

DISFLUENCY_TYPES = [
    "block",
    "prolongation",
    "sound_repetition",
    "word_repetition",
    "interjection",
]


# ---------- Load speech model ----------
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


# ---------- OpenAI client ----------
def get_openai_client():
    api_key = os.environ.get("OPENAI_API_KEY")

    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured.")

    return OpenAI(api_key=api_key)


# ---------- Gradio API ----------
app = Server(
    title="Fluent Speech API",
    description="AI-powered speech fluency analysis and personalized reading passages.",
    version="1.1.0",
)


# ---------- GPU inference ----------
@spaces.GPU(duration=60)
def run_model(chunks):
    predictions = []

    with torch.inference_mode():
        for start in range(0, len(chunks), BATCH_SIZE):
            batch_chunks = chunks[start:start + BATCH_SIZE]

            values = np.stack([
                item[0] for item in batch_chunks
            ])

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

            fluency_probs = (
                torch.sigmoid(output.fluency_logit)
                .cpu()
                .numpy()
            )

            type_probs = (
                torch.sigmoid(output.type_logits)
                .cpu()
                .numpy()
            )

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


# ---------- Health endpoint ----------
@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": True,
        "model_version": MODEL_VERSION,
    }


# ---------- Speech analysis endpoint ----------
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
        raw_bytes = base64.b64decode(
            audio_base64,
            validate=True,
        )
    except Exception:
        raise ValueError("Invalid base64 audio data.")

    if not raw_bytes:
        raise ValueError("The uploaded audio is empty.")

    wav_path = None

    try:
        wav_path = audio.decode_to_wav(
            raw_bytes,
            suffix=".webm",
        )

        waveform, warnings = audio.load_and_validate(wav_path)

        duration = len(waveform) / SAMPLE_RATE

        if duration > MAX_AUDIO_SECONDS:
            raise ValueError(
                f"Audio must be shorter than {MAX_AUDIO_SECONDS} seconds."
            )

        chunks = audio.chunk_audio(waveform)

        if not chunks:
            raise ValueError("No audio chunks could be generated.")

        clips = run_model(chunks)

        fluent_clips = [
            clip for clip in clips if clip["fluent"]
        ]

        stuttered_clips = [
            clip for clip in clips if not clip["fluent"]
        ]

        fluent_ratio = len(fluent_clips) / len(clips)

        severity = (
            float(np.mean([
                clip["severity_score"]
                for clip in stuttered_clips
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
                type_counts[strongest] = (
                    type_counts.get(strongest, 0) + 1
                )

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
                "Transcription is currently unavailable in this demo."
            ],
        }

    finally:
        if wav_path and Path(wav_path).exists():
            Path(wav_path).unlink(missing_ok=True)


# ---------- Daily personalized passage endpoint ----------
@app.api(
    name="generate_passage",
    description="Generate a fresh reading passage using AI.",
    concurrency_limit=2,
    time_limit=60,
)
def generate_passage(
    difficulty: str = "beginner",
    target_words_json: str = "[]",
):

    allowed_difficulties = [
        "beginner",
        "intermediate",
        "advanced",
    ]

    difficulty = difficulty.lower().strip()

    if difficulty not in allowed_difficulties:
        raise ValueError(
            "Difficulty must be beginner, intermediate, or advanced."
        )

    try:
        target_words = json.loads(target_words_json)
    except (TypeError, json.JSONDecodeError):
        target_words = []

    if not isinstance(target_words, list):
        target_words = []

    target_words = [
        str(word).strip()[:40]
        for word in target_words[:10]
        if isinstance(word, str) and word.strip()
    ]

    word_instruction = (
        ", ".join(target_words)
        if target_words
        else "Choose useful everyday speaking vocabulary."
    )

    client = get_openai_client()

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        temperature=0.9,
        max_tokens=500,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert speech-language therapy assistant. "
                    "Create original, encouraging reading passages for "
                    "people practising fluent speech. Never diagnose or "
                    "make medical claims. Return valid JSON only."
                ),
            },
            {
                "role": "user",
                "content": f"""
Create a completely fresh reading passage.

Difficulty: {difficulty}

Target vocabulary: {word_instruction}

Requirements:
- Create an original, natural and engaging passage.
- Use short, easy-to-read sentences.
- Make the passage suitable for aloud reading practice.
- Avoid tongue twisters and unnecessarily difficult wording.
- Include target vocabulary naturally when provided.
- Do not repeat generic passages.
- Keep the passage approximately 80-120 words for beginner,
  120-160 words for intermediate, and 150-200 words for advanced.

Return JSON in exactly this structure:
{{
    "title": "A suitable short title",
    "sentences": [
        "First sentence.",
        "Second sentence."
    ],
    "vocabulary": [
        "word1",
        "word2"
    ]
}}
""",
            },
        ],
    )

    content = response.choices[0].message.content

    if not content:
        raise ValueError("AI returned an empty passage.")

    try:
        passage = json.loads(content)
    except json.JSONDecodeError:
        raise ValueError("AI returned an invalid passage format.")

    title = passage.get("title")
    sentences = passage.get("sentences")
    vocabulary = passage.get("vocabulary")

    if (
        not isinstance(title, str)
        or not isinstance(sentences, list)
        or not isinstance(vocabulary, list)
    ):
        raise ValueError("AI returned an incomplete passage.")

    return {
        "title": title,
        "sentences": sentences,
        "vocabulary": vocabulary,
    }


# ---------- Hugging Face launch ----------
demo = app

if __name__ == "__main__":
    demo.launch(ssr_mode=False)
