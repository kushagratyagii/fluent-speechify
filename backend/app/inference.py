from __future__ import annotations

from collections import Counter
from pathlib import Path

import numpy as np
import torch

from app.config import settings
from app.schemas import AnalyzeResponse, ClipPrediction, DisfluencyBreakdown
from ml.model import DISFLUENCY_TYPES, StammerDetectionModel, severity_bucket


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
                    fluency_confidence=round(confidence, 4),
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
            model_version=settings.model_version,
            warnings=warnings,
        )


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