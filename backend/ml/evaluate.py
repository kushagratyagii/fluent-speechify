"""
Evaluates a trained checkpoint on the test split.

Usage:
    python -m ml.evaluate --manifest ml/manifest.csv --checkpoint ml/checkpoints/best.pt

Reports:
  - fluency accuracy / precision / recall / F1 (fluent vs stuttered)
  - per-disfluency-type F1 (block, prolongation, sound_rep, word_rep, interjection)
  - severity MAE (0-100 scale)

Read these numbers before deploying anything: SEP-28k is podcast audio, not
therapy-app audio recorded on phone mics in quiet/noisy home environments,
and it skews toward adult, largely English speakers. Expect real-world
accuracy to be lower than the test-split numbers here, especially for
child voices, non-native accents, and second languages -- this app's own
profile fields (age, nativeLanguage, country) suggest a user base this
dataset does not fully represent. Treat this as a first pass, not a
clinical-grade classifier.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import torch
from sklearn.metrics import f1_score, mean_absolute_error, precision_recall_fscore_support
from torch.utils.data import DataLoader

from ml.dataset import SEP28kDataset, collate_fn
from ml.model import DISFLUENCY_TYPES, StammerDetectionModel


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    all_fluent_true, all_fluent_pred = [], []
    all_type_true, all_type_pred = [], []
    all_sev_true, all_sev_pred = [], []

    for batch in loader:
        out = model(batch["input_values"].to(device), batch["attention_mask"].to(device))

        all_fluent_true += batch["fluent"].tolist()
        all_fluent_pred += (torch.sigmoid(out.fluency_logit).cpu() > 0.5).float().tolist()

        all_type_true += batch["type_labels"].tolist()
        all_type_pred += (torch.sigmoid(out.type_logits).cpu() > 0.5).float().tolist()

        all_sev_true += batch["severity"].tolist()
        all_sev_pred += (torch.sigmoid(out.severity_raw).cpu() * 100).tolist()

    precision, recall, f1, _ = precision_recall_fscore_support(
        all_fluent_true, all_fluent_pred, average="binary", zero_division=0
    )
    print(f"Fluency  precision={precision:.3f} recall={recall:.3f} f1={f1:.3f}")

    type_f1 = f1_score(all_type_true, all_type_pred, average=None, zero_division=0)
    for name, score in zip(DISFLUENCY_TYPES, type_f1):
        print(f"  {name:<18} f1={score:.3f}")

    mae = mean_absolute_error(all_sev_true, all_sev_pred)
    print(f"Severity MAE: {mae:.2f} (0-100 scale)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--checkpoint", type=Path, required=True)
    ap.add_argument("--batch_size", type=int, default=16)
    args = ap.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    test_ds = SEP28kDataset(args.manifest, "test")
    loader = DataLoader(test_ds, batch_size=args.batch_size, collate_fn=collate_fn)

    model = StammerDetectionModel().to(device)
    model.load_state_dict(torch.load(args.checkpoint, map_location=device))
    evaluate(model, loader, device)


if __name__ == "__main__":
    main()
