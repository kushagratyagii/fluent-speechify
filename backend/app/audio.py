"""
Turns an uploaded audio file (whatever format the browser's MediaRecorder
produced -- typically audio/webm;codecs=opus, sometimes audio/mp4 on Safari)
into fixed-length 16kHz mono chunks the model can consume.

Decoding goes through ffmpeg rather than soundfile/librosa directly: those
libraries can't reliably read webm/opus, which is what most browsers record
by default, so trying to torchaudio.load() the raw upload will work on some
machines and silently fail on others depending on installed codecs. ffmpeg
must be installed on the host running this service (see backend/README.md).
"""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

SAMPLE_RATE = 16_000
CLIP_SECONDS = 3
CLIP_SAMPLES = CLIP_SECONDS * SAMPLE_RATE
HOP_SECONDS = 2  # 1s overlap between consecutive windows so a disfluency
# that straddles a chunk boundary is still fully visible in at least one window
HOP_SAMPLES = HOP_SECONDS * SAMPLE_RATE

MIN_DURATION_SECONDS = 1.0
MAX_DURATION_SECONDS = 10 * 60  # reject absurdly long uploads before they hit the model
SILENCE_RMS_THRESHOLD = 0.001
CLIPPING_SAMPLE_FRACTION_THRESHOLD = 0.001  # >0.1% of samples at full scale


class AudioValidationError(Exception):
    """Raised for problems that should surface as a 4xx to the client."""


def decode_to_wav(raw_bytes: bytes, suffix: str = ".webm") -> Path:
    """Writes raw_bytes to disk and shells out to ffmpeg to produce a
    16kHz mono wav. Returns the wav path; caller is responsible for cleanup."""
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as src:
        src.write(raw_bytes)
        src_path = Path(src.name)

    dst_path = src_path.with_suffix(".wav")
    try:
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", str(src_path), "-ac", "1", "-ar", str(SAMPLE_RATE), str(dst_path)],
            capture_output=True,
            timeout=60,
        )
    except FileNotFoundError as e:
        raise RuntimeError("ffmpeg is not installed on this host") from e
    finally:
        src_path.unlink(missing_ok=True)

    if result.returncode != 0 or not dst_path.exists():
        stderr_tail = result.stderr.decode(errors="ignore")[-500:]
        raise AudioValidationError(f"Could not decode uploaded audio: {stderr_tail}")

    return dst_path


def load_and_validate(wav_path: Path) -> tuple[np.ndarray, list[str]]:
    warnings: list[str] = []
    audio, sr = sf.read(wav_path, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if sr != SAMPLE_RATE:
        # decode_to_wav already resamples via ffmpeg; this only triggers if
        # load_and_validate is ever called on a file that bypassed it.
        raise AudioValidationError(f"Expected {SAMPLE_RATE}Hz audio, got {sr}Hz")

    duration = len(audio) / SAMPLE_RATE
    if duration < MIN_DURATION_SECONDS:
        raise AudioValidationError(f"Recording is only {duration:.2f}s; need at least {MIN_DURATION_SECONDS}s")
    if duration > MAX_DURATION_SECONDS:
        raise AudioValidationError(f"Recording is {duration:.0f}s, exceeds the {MAX_DURATION_SECONDS}s limit")

    rms = float(np.sqrt(np.mean(audio**2)))
    if rms < SILENCE_RMS_THRESHOLD:
        warnings.append("Audio is near-silent -- check microphone input before trusting these results")

    clipped_fraction = float(np.mean(np.abs(audio) > 0.999))
    if clipped_fraction > CLIPPING_SAMPLE_FRACTION_THRESHOLD:
        warnings.append("Audio shows signs of clipping -- results may be less reliable")

    return audio, warnings


def chunk_audio(audio: np.ndarray) -> list[tuple[np.ndarray, float, float]]:
    """Splits audio into overlapping CLIP_SECONDS windows.
    Returns list of (waveform, start_seconds, end_seconds).
    The final window is zero-padded rather than dropped, so a recording
    shorter than one full window (but >= MIN_DURATION_SECONDS) still yields
    exactly one chunk instead of zero."""
    total = len(audio)
    if total <= CLIP_SAMPLES:
        padded = np.pad(audio, (0, CLIP_SAMPLES - total))
        return [(padded, 0.0, total / SAMPLE_RATE)]

    chunks = []
    start = 0
    while start < total:
        end = start + CLIP_SAMPLES
        window = audio[start:end]
        if len(window) < CLIP_SAMPLES:
            window = np.pad(window, (0, CLIP_SAMPLES - len(window)))
        chunks.append((window, start / SAMPLE_RATE, min(end, total) / SAMPLE_RATE))
        if end >= total:
            break
        start += HOP_SAMPLES
    return chunks
