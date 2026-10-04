from __future__ import annotations

from collections import Counter
from pathlib import Path

import numpy as np
import torch

from app.config import settings
from app.personalization import SpeechPersonalizer
from app.schemas import (
    AnalyzeResponse,
    ClipPrediction,
    DisfluencyBreakdown,
    PersonalizedExercise,
    TargetWord,
)
from ml.model import (
    DISFLUENCY_TYPES,
    StammerDetectionModel,
    severity_bucket,
)


class StammerPredictor:
    """Loaded once at process startup and reused across requests."""

    def __init__(self, checkpoint_path: str, device: str):
        self.device = torch.device(device)

        self.model = StammerDetectionModel()

        state = torch.load(
            checkpoint_path,
            map_location=self.device,
        )

        self.model.load_state_dict(state)
        self.model.to(self.device)
        self.model.eval()

    @torch.no_grad()
    def predict_chunks(
        self,
        chunks: list[tuple[np.ndarray, float, float]],
    ) -> list[ClipPrediction]:

        batch = torch.tensor(
            np.stack([c[0] for c in chunks]),
            dtype=torch.float32,
        ).to(self.device)

        attention_mask = torch.ones_like(
            batch,
            dtype=torch.long,
        )

        out = self.model(batch, attention_mask)

        # Fluency head:
        # 1 = fluent
        # 0 = stuttered
        fluency_prob = (
            torch.sigmoid(out.fluency_logit)
            .cpu()
            .numpy()
        )

        # Multi-label disfluency probabilities
        type_probs = (
            torch.sigmoid(out.type_logits)
            .cpu()
            .numpy()
        )

        # Severity score: 0-100
        severity = (
            torch.sigmoid(out.severity_raw)
            .cpu()
            .numpy()
            * 100
        )

        predictions: list[ClipPrediction] = []

        for i, (_, start, end) in enumerate(chunks):

            # IMPORTANT:
            # Training target:
            # fluent = 1
            # stuttered = 0
            #
            # Therefore probability >= 0.5 means fluent.
            fluent = bool(fluency_prob[i] >= 0.5)

            confidence = float(
                fluency_prob[i]
                if fluent
                else 1 - fluency_prob[i]
            )

            predictions.append(
                ClipPrediction(
                    start_seconds=round(start, 2),
                    end_seconds=round(end, 2),
                    fluent=fluent,
                    fluency_confidence=round(
                        confidence,
                        4,
                    ),
                    disfluency_types=DisfluencyBreakdown(
                        **{
                            t: round(
                                float(type_probs[i][j]),
                                4,
                            )
                            for j, t in enumerate(DISFLUENCY_TYPES)
                        }
                    ),
                    severity_score=round(
                        float(severity[i]),
                        1,
                    ),
                )
            )

        return predictions

    def aggregate(
        self,
        clips: list[ClipPrediction],
        duration_seconds: float,
        session_id: str | None,
        warnings: list[str],
        transcript: str | None = None,
        target_words: list[TargetWord] | None = None,
        personalized_exercise: PersonalizedExercise | None = None,
    ) -> AnalyzeResponse:

        if not clips:
            raise ValueError(
                "aggregate() called with no clips"
            )

        # Percentage of all clips that were classified as fluent.
        fluent_ratio = (
            sum(1 for c in clips if c.fluent)
            / len(clips)
        )

        # Only stuttered clips contribute to severity
        # and dominant disfluency type.
        stuttered_clips = [
            c for c in clips
            if not c.fluent
        ]

        if stuttered_clips:
            overall_severity = round(
                sum(
                    c.severity_score
                    for c in stuttered_clips
                )
                / len(stuttered_clips),
                1,
            )
        else:
            overall_severity = 0.0

        # Determine the dominant disfluency type
        # using only clips classified as stuttered.
        dominant_type = None

        if stuttered_clips:
            votes = Counter()

            for c in stuttered_clips:
                breakdown = c.disfluency_types.model_dump()

                top_type = max(
                    breakdown,
                    key=breakdown.get,
                )

                # Only accept reasonably confident
                # disfluency predictions.
                if breakdown[top_type] >= 0.5:
                    votes[top_type] += 1

            if votes:
                dominant_type = votes.most_common(1)[0][0]

        return AnalyzeResponse(
            session_id=session_id,
            duration_seconds=round(
                duration_seconds,
                2,
            ),
            clips=clips,
            overall_fluent_ratio=fluent_ratio,
            overall_severity_score=overall_severity,
            overall_severity_bucket=severity_bucket(
                overall_severity
            ),
            dominant_disfluency_type=dominant_type,
            transcript=transcript,
            target_words=target_words or [],
            personalized_exercise=personalized_exercise,
            model_version=settings.model_version,
            warnings=warnings,
        )


# -------------------------------------------------------------------
# Global model instances
# -------------------------------------------------------------------

_personalizer: SpeechPersonalizer | None = None
_predictor: StammerPredictor | None = None


def get_predictor() -> StammerPredictor:
    if _predictor is None:
        raise RuntimeError(
            "Model not loaded yet -- "
            "get_predictor() called before "
            "startup completed"
        )

    return _predictor


def load_predictor() -> StammerPredictor:
    global _predictor

    checkpoint = Path(
        settings.model_checkpoint_path
    )

    if not checkpoint.exists():
        raise FileNotFoundError(
            f"No model checkpoint at {checkpoint}. "
            "Run ml/train.py first, or point "
            "FLUENT_MODEL_CHECKPOINT_PATH at an "
            "existing checkpoint."
        )

    _predictor = StammerPredictor(
        str(checkpoint),
        settings.inference_device,
    )

    return _predictor


def get_personalizer() -> SpeechPersonalizer:
    """
    Lazy-load Whisper so an unavailable transcription
    dependency does not prevent the core analysis API
    from starting.
    """

    global _personalizer

    if _personalizer is None:
        _personalizer = SpeechPersonalizer(
            model_size=settings.whisper_model_size,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )

    return _personalizer


def personalize_audio(
    wav_path: Path,
    clips: list[ClipPrediction],
    duration_seconds: float,
    warnings: list[str],
    personalization_history: list[dict] | None = None,
) -> tuple[
    str | None,
    list[TargetWord],
    PersonalizedExercise | None,
]:
    """
    Transcribe the recording and infer candidate difficult words.

    The word localization is an inference heuristic, not word-level
    ground truth: the trained SEP-28k model predicts at clip level,
    so we expose candidate words rather than claiming certainty.
    """

    if duration_seconds > settings.personalization_max_seconds:
        warnings.append(
            f"Personalization was limited to the first "
            f"{settings.personalization_max_seconds}s "
            "of this recording."
        )

    try:
        personalizer = get_personalizer()

        words = personalizer.transcribe(wav_path)

        if not words:
            warnings.append(
                "No speech words were detected for personalization."
            )
            return None, [], None

        # Full transcript
        transcript = " ".join(
            word.word
            for word in words
        )

        # Find candidate difficult words
        targets = personalizer.find_target_words(
            words,
            clips,
        )

        # Generate personalized exercise
        exercise_data = personalizer.generate_exercise(
            targets,
            personalization_history=personalization_history or [],
        )
        syllable_items = personalizer.generate_syllable_exercise(
    [
        target.word
        for target in targets[:5]
        if target.word.strip()
    ]
)

        exercise_data["syllable_items"] = syllable_items

        exercise = PersonalizedExercise(
            **exercise_data
        )

        return (
            transcript,
            [
                TargetWord(
                    **target.__dict__
                )
                for target in targets
            ],
            exercise,
        )

    except Exception as exc:
        # Personalization is optional.
        # Never break the main speech analysis pipeline.
        warnings.append(
            f"Personalization unavailable: {exc}"
        )

        return None, [], None