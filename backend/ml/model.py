"""
Multi-task stammering detection model.

Backbone:  pretrained Wav2Vec2 (facebook/wav2vec2-base) audio encoder.
Heads:
  - fluency_head   : 1 logit  -> P(clip contains a disfluency)
  - type_head      : 5 logits -> per-type disfluency probabilities
                      [block, prolongation, sound_rep, word_rep, interjection]
  - severity_head   : 1 scalar -> continuous severity in [0, 100]

The three heads share the same pooled Wav2Vec2 embedding. They're trained
jointly (see train.py) but can be read independently at inference time.

This module has ZERO FastAPI/serving concerns on purpose: app/model.py wraps
this class for inference so the architecture definition has exactly one
source of truth for both training and serving.
"""

from __future__ import annotations

from dataclasses import dataclass

import torch
import torch.nn as nn
from transformers import Wav2Vec2Model

DISFLUENCY_TYPES = [
    "block",
    "prolongation",
    "sound_repetition",
    "word_repetition",
    "interjection",
]

SAMPLE_RATE = 16_000  # Wav2Vec2's expected input rate


@dataclass
class StammerModelOutput:
    fluency_logit: torch.Tensor  # (batch,)
    type_logits: torch.Tensor  # (batch, 5)
    severity_raw: torch.Tensor  # (batch,) pre-sigmoid, scale to 0-100 at inference


class StammerDetectionModel(nn.Module):
    def __init__(
        self,
        backbone_name: str = "facebook/wav2vec2-base",
        freeze_backbone_layers: int = 10,
        hidden_dim: int = 256,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.backbone = Wav2Vec2Model.from_pretrained(backbone_name)

        # Freeze the bottom N transformer layers so a modest, non-augmented
        # SEP-28k-sized dataset (~28k three-second clips) doesn't overfit /
        # doesn't require multi-GPU training. Top layers + heads stay trainable.
        if freeze_backbone_layers > 0:
            self.backbone.feature_extractor._freeze_parameters()
            for layer in self.backbone.encoder.layers[:freeze_backbone_layers]:
                for p in layer.parameters():
                    p.requires_grad = False

        emb_dim = self.backbone.config.hidden_size

        self.shared = nn.Sequential(
            nn.Linear(emb_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
        )
        self.fluency_head = nn.Linear(hidden_dim, 1)
        self.type_head = nn.Linear(hidden_dim, len(DISFLUENCY_TYPES))
        self.severity_head = nn.Linear(hidden_dim, 1)

    def forward(self, input_values: torch.Tensor, attention_mask: torch.Tensor | None = None) -> StammerModelOutput:
        """
        input_values: (batch, num_samples) float32 waveform at SAMPLE_RATE
        attention_mask: (batch, num_samples), 1 for real samples, 0 for padding
        """
        out = self.backbone(input_values=input_values, attention_mask=attention_mask)
        hidden = out.last_hidden_state  # (batch, time, emb_dim)

        if attention_mask is not None:
            # Wav2Vec2 downsamples time; recompute a feature-level mask via
            # the model's own helper so mean-pooling ignores padded frames.
            feat_mask = self.backbone._get_feature_vector_attention_mask(
                hidden.shape[1], attention_mask
            )
            mask = feat_mask.unsqueeze(-1).to(hidden.dtype)
            pooled = (hidden * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1)
        else:
            pooled = hidden.mean(dim=1)

        shared = self.shared(pooled)
        return StammerModelOutput(
            fluency_logit=self.fluency_head(shared).squeeze(-1),
            type_logits=self.type_head(shared),
            severity_raw=self.severity_head(shared).squeeze(-1),
        )


def severity_bucket(score_0_100: float) -> str:
    """Maps the continuous severity score onto the frontend's Severity type."""
    if score_0_100 < 20:
        return "mild"
    if score_0_100 < 55:
        return "moderate"
    return "severe"
