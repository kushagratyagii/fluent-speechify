from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    precision_recall_fscore_support,
)
from torch.utils.data import DataLoader

from ml.dataset import SEP28kDataset, collate_fn
from ml.model import DISFLUENCY_TYPES, StammerDetectionModel


@torch.no_grad()
def evaluate(model, loader, device) -> dict:
    """
    Evaluate on the held-out test split.

    Label convention used by the training pipeline:
      fluent=1 -> fluent
      fluent=0 -> stuttered

    For the primary binary metrics, stuttered is treated as the positive
    class (1). Disfluency-type metrics are calculated only on stuttered
    clips because type labels are undefined for fluent clips.
    """
    model.eval()

    all_fluent_true: list[int] = []
    all_fluent_pred: list[int] = []
    all_type_true: list[list[int]] = []
    all_type_pred: list[list[int]] = []
    all_sev_true: list[float] = []
    all_sev_pred: list[float] = []

    for batch in loader:
        input_values = batch["input_values"].to(device)
        attention_mask = batch["attention_mask"].to(device)

        out = model(input_values, attention_mask)

        fluent_true = batch["fluent"].cpu().round().int()
        fluent_pred = (
            torch.sigmoid(out.fluency_logit).cpu() > 0.5
        ).int()

        all_fluent_true.extend(fluent_true.tolist())
        all_fluent_pred.extend(fluent_pred.tolist())

        all_type_true.extend(
            batch["type_labels"].cpu().round().int().tolist()
        )
        all_type_pred.extend(
            (torch.sigmoid(out.type_logits).cpu() > 0.5).int().tolist()
        )

        all_sev_true.extend(batch["severity"].cpu().tolist())
        all_sev_pred.extend(
            (torch.sigmoid(out.severity_raw).cpu() * 100).tolist()
        )

    if not all_fluent_true:
        raise ValueError("The test split produced no predictions.")

    # Convert fluent labels to stuttered labels:
    # original 0 (stuttered) -> 1, original 1 (fluent) -> 0.
    stutter_true = [1 - value for value in all_fluent_true]
    stutter_pred = [1 - value for value in all_fluent_pred]

    accuracy = accuracy_score(stutter_true, stutter_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(
        stutter_true,
        stutter_pred,
        average="binary",
        pos_label=1,
        zero_division=0,
    )

    matrix = confusion_matrix(
        stutter_true,
        stutter_pred,
        labels=[0, 1],
    )

    # Type labels are meaningful only for clips marked as stuttered
    # in the ground truth, matching the masked type loss in train.py.
    stuttered_indices = [
        i for i, fluent_label in enumerate(all_fluent_true)
        if fluent_label == 0
    ]

    type_results: dict[str, dict[str, float]] = {}

    if stuttered_indices:
        type_true = [
            all_type_true[i] for i in stuttered_indices
        ]
        type_pred = [
            all_type_pred[i] for i in stuttered_indices
        ]

        type_precision, type_recall, type_f1, _ = (
            precision_recall_fscore_support(
                type_true,
                type_pred,
                average=None,
                zero_division=0,
            )
        )

        for index, name in enumerate(DISFLUENCY_TYPES):
            type_results[name] = {
                "precision": float(type_precision[index]),
                "recall": float(type_recall[index]),
                "f1": float(type_f1[index]),
            }

    severity_mae = mean_absolute_error(
        all_sev_true,
        all_sev_pred,
    )

    results = {
        "test_samples": len(all_fluent_true),
        "ground_truth_stuttered_samples": len(stuttered_indices),
        "fluency_detection": {
            "positive_class": "stuttered",
            "accuracy": float(accuracy),
            "precision": float(precision),
            "recall": float(recall),
            "f1": float(f1),
            "confusion_matrix": {
                "labels": ["fluent", "stuttered"],
                "matrix": matrix.tolist(),
            },
        },
        "disfluency_types_on_ground_truth_stuttered_clips": type_results,
        "severity": {
            "mae": float(severity_mae),
            "scale": "0-100",
        },
    }

    print("\n========== TEST SET EVALUATION ==========")
    print(f"Test samples: {results['test_samples']}")
    print(
        "Ground-truth stuttered samples: "
        f"{results['ground_truth_stuttered_samples']}"
    )
    print("\nFluency detection (positive class: stuttered)")
    print(f"  Accuracy : {accuracy:.4f}")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall   : {recall:.4f}")
    print(f"  F1-score : {f1:.4f}")
    print("\nConfusion matrix (rows=true, columns=predicted)")
    print("                 Pred fluent  Pred stuttered")
    print(f"True fluent      {matrix[0][0]:11d}  {matrix[0][1]:14d}")
    print(f"True stuttered   {matrix[1][0]:11d}  {matrix[1][1]:14d}")

    print("\nDisfluency type metrics (ground-truth stuttered clips only)")
    if type_results:
        for name, scores in type_results.items():
            print(
                f"  {name:<18} "
                f"precision={scores['precision']:.4f} "
                f"recall={scores['recall']:.4f} "
                f"f1={scores['f1']:.4f}"
            )
    else:
        print("  No ground-truth stuttered clips found in the test split.")

    print(f"\nSeverity MAE: {severity_mae:.2f} (0-100 scale)")
    print("=========================================\n")

    return results


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Evaluate a trained checkpoint on the held-out test split."
    )
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--checkpoint", type=Path, required=True)
    ap.add_argument("--batch_size", type=int, default=16)
    ap.add_argument(
        "--output",
        type=Path,
        default=Path("ml/test_results.json"),
        help="Path where the test metrics JSON will be saved.",
    )
    args = ap.parse_args()

    if not args.manifest.exists():
        raise FileNotFoundError(f"Manifest not found: {args.manifest}")
    if not args.checkpoint.exists():
        raise FileNotFoundError(f"Checkpoint not found: {args.checkpoint}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Evaluation device: {device}")

    test_ds = SEP28kDataset(args.manifest, "test")
    loader = DataLoader(
        test_ds,
        batch_size=args.batch_size,
        shuffle=False,
        collate_fn=collate_fn,
    )

    model = StammerDetectionModel().to(device)
    state_dict = torch.load(
        args.checkpoint,
        map_location=device,
    )
    model.load_state_dict(state_dict)

    results = evaluate(model, loader, device)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(results, indent=2),
        encoding="utf-8",
    )
    print(f"Saved evaluation results to: {args.output}")


if __name__ == "__main__":
    main()
