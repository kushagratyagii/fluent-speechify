import os
import json
import spaces
import base64
import tempfile
from pathlib import Path

import numpy as np
import torch
from faster_whisper import WhisperModel
from openai import OpenAI

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
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

device = "cuda"
_whisper_model = None

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


# ---------- Personalization ----------
def get_whisper_model():
    """Load Whisper only when a recording is analyzed."""
    global _whisper_model
    if _whisper_model is None:
        _whisper_model = WhisperModel(
            WHISPER_MODEL_SIZE,
            device="cpu",
            compute_type="int8",
        )
    return _whisper_model


def transcribe_words(wav_path):
    model = get_whisper_model()
    segments, _ = model.transcribe(
        str(wav_path),
        word_timestamps=True,
        vad_filter=True,
    )
    words = []
    for segment in segments:
        for item in (segment.words or []):
            word = (item.word or "").strip().strip(".,!?;:\"'()[]{}")
            if word:
                words.append({
                    "word": word,
                    "start": float(item.start),
                    "end": float(item.end),
                })
    return words


def find_target_words(words, clips, limit=5):
    candidates = {}
    for word in words:
        key = word["word"].lower()
        if len(key) < 4:
            continue
        evidence = []
        for clip in clips:
            overlap = min(word["end"], clip["end_seconds"]) - max(
                word["start"], clip["start_seconds"]
            )
            if overlap > 0 and not clip["fluent"]:
                score = (
                    0.6 * (clip["severity_score"] / 100.0)
                    + 0.4 * (1.0 - clip["fluency_confidence"])
                )
                evidence.append(score)
        if evidence:
            current = candidates.get(key)
            score = sum(evidence) / len(evidence)
            if current is None:
                candidates[key] = {
                    "word": word["word"],
                    "score": score,
                    "evidence_count": len(evidence),
                }
            else:
                current["score"] = max(current["score"], score)
                current["evidence_count"] += len(evidence)
    return sorted(
        candidates.values(),
        key=lambda item: (item["evidence_count"], item["score"]),
        reverse=True,
    )[:limit]


def generate_personalized_passage(target_words):
    if not target_words:
        return {
            "title": "Personalized Speech Practice",
            "text": (
                "Choose a few words that feel challenging to say. "
                "Read them slowly, then use each one in a short sentence. "
                "Focus on clear pronunciation and smooth transitions. "
                "Keep a comfortable pace and pause whenever you need to."
            ),
            "target_words": [],
        }

    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        try:
            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                temperature=0.3,
                max_tokens=180,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Write a supportive English reading passage for speech practice. "
                            "Return 3-5 complete, grammatically correct sentences and 40-80 words. "
                            "Use simple everyday English, a coherent situation, and include every "
                            "provided target word naturally or explicitly as a quoted practice word. "
                            "Do not diagnose or criticize the reader."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            "Create a personalized passage using these target words: "
                            + ", ".join(target_words)
                            + ". Return only the passage text."
                        ),
                    },
                ],
            )
            passage = (response.choices[0].message.content or "").strip()
            if passage:
                return {
                    "title": "Your Personalized Passage",
                    "text": passage,
                    "target_words": target_words,
                }
        except Exception as exc:
            print(f"Personalized passage generation fallback: {exc}")

    quoted = ", ".join(f"“{word.lower()}”" for word in target_words)
    return {
        "title": "Personalized Speech Practice",
        "text": (
            f"Today, I practised the words {quoted}. "
            "I read each word slowly and then used it in a short sentence. "
            "I focused on clear pronunciation and smooth transitions "
            "between words. I kept a steady pace and paused between sentences."
        ),
        "target_words": target_words,
    }


@app.api(
    name="generate_passage",
    description="Generate a reading passage for the selected difficulty and target words.",
    concurrency_limit=2,
    time_limit=60,
)
def generate_passage(
    difficulty: str = "beginner",
    target_words_json: str = "[]",
):
    allowed = {"beginner", "intermediate", "advanced"}
    level = (difficulty or "beginner").lower().strip()
    if level not in allowed:
        level = "beginner"

    try:
        target_words = json.loads(target_words_json or "[]")
        if not isinstance(target_words, list):
            target_words = []
        target_words = [
            str(word).strip()[:40]
            for word in target_words
            if str(word).strip()
        ][:8]
    except (TypeError, ValueError, json.JSONDecodeError):
        target_words = []

    sentences = None
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        try:
            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                temperature=0.4,
                max_tokens=220,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Create a short, supportive English reading passage for speech practice. "
                            "Return valid JSON only with keys title, sentences, vocabulary. "
                            "sentences must be an array of 4 to 6 complete sentences; "
                            "vocabulary must be an array of the target words used. "
                            "Use the requested difficulty and never diagnose the reader."
                        ),
                    },
                    {
                        "role": "user",
                        "content": json.dumps({
                            "difficulty": level,
                            "target_words": target_words,
                        }),
                    },
                ],
                response_format={"type": "json_object"},
            )
            payload = json.loads(response.choices[0].message.content or "{}")
            generated = payload.get("sentences")
            if isinstance(generated, list) and generated:
                sentences = [str(item).strip() for item in generated if str(item).strip()]
                title = str(payload.get("title") or "Daily Reading Passage")
                vocabulary = payload.get("vocabulary", target_words)
                if not isinstance(vocabulary, list):
                    vocabulary = target_words
                return {
                    "title": title,
                    "sentences": sentences[:8],
                    "vocabulary": [str(word) for word in vocabulary][:8],
                }
        except Exception as exc:
            print(f"Daily passage generation fallback: {exc}")

    # Deterministic fallback keeps the existing endpoint usable without an API key.
    level_text = {
        "beginner": "I take my time and speak one sentence at a time.",
        "intermediate": "I stay relaxed, connect each thought clearly, and keep a steady pace.",
        "advanced": "I express detailed ideas with confidence, clarity, and natural pauses.",
    }[level]
    practice = (
        "Today I will practise " + ", ".join(target_words) + ". "
        if target_words else ""
    )
    return {
        "title": "Daily Reading Passage",
        "sentences": [
            practice + "I choose a comfortable pace and focus on each word.",
            level_text,
            "I pause when I need to, breathe naturally, and continue without rushing.",
            "Every practice session is an opportunity to become more comfortable speaking.",
        ],
        "vocabulary": target_words,
    }


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

        transcript = None
        target_words = []
        personalized_exercise = None
        try:
            recognized_words = transcribe_words(wav_path)
            transcript = " ".join(item["word"] for item in recognized_words)
            target_words = find_target_words(recognized_words, clips)
            personalized_exercise = generate_personalized_passage(
                [item["word"] for item in target_words]
            )
        except Exception as exc:
            warnings.append(f"Personalization unavailable: {exc}")

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
            "transcript": transcript,
            "target_words": target_words,
            "personalized_exercise": personalized_exercise,
            "model_version": MODEL_VERSION,
            "warnings": warnings,
        }

    finally:
        if wav_path and Path(wav_path).exists():
            Path(wav_path).unlink(missing_ok=True)


# Hugging Face Spaces expects this variable.
demo = app

if __name__ == "__main__":
    demo.launch(ssr_mode=False)

