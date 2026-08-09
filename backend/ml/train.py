"""
Trains StammerDetectionModel on manifest.csv (see prepare_sep28k.py).

Usage:
    python -m ml.train --manifest ml/manifest.csv --epochs 15 --out ml/checkpoints

Loss = fluency BCE + type BCE (masked to stuttered clips only, since a
"fluent" clip has no meaningful disfluency type) + severity MSE.
Class imbalance: SEP-28k is roughly 60/40 fluent/stuttered but individual
disfluency types are much rarer (e.g. blocks), so pos_weight is computed
from the training split rather than hardcoded.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from torch.utils.data import DataLoader
from tqdm import tqdm

from ml.dataset import SEP28kDataset, collate_fn
from ml.model import DISFLUENCY_TYPES, StammerDetectionModel


def compute_pos_weight(dataset: SEP28kDataset) -> torch.Tensor:
    counts = dataset.df[DISFLUENCY_TYPES].sum()
    total = len(dataset.df)
    # Standard BCEWithLogitsLoss pos_weight = negatives / positives, clamped
    # so a type with zero positive examples in-split doesn't divide by zero.
    weights = [(total - c) / max(c, 1) for c in counts]
    return torch.tensor(weights, dtype=torch.float32)


def run_epoch(model, loader, device, optimizer=None, pos_weight=None):
    is_train = optimizer is not None
    model.train(is_train)

    fluency_loss_fn = torch.nn.BCEWithLogitsLoss()
    type_loss_fn = torch.nn.BCEWithLogitsLoss(pos_weight=pos_weight, reduction="none")
    severity_loss_fn = torch.nn.MSELoss()

    total_loss = 0.0
    for batch in tqdm(loader, leave=False):
        input_values = batch["input_values"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        fluent = batch["fluent"].to(device)
        type_labels = batch["type_labels"].to(device)
        severity = batch["severity"].to(device) / 100.0  # normalize to 0-1

        with torch.set_grad_enabled(is_train):
            out = model(input_values, attention_mask)

            l_fluency = fluency_loss_fn(out.fluency_logit, fluent)

            # Only backprop type loss where the clip actually has a
            # disfluency -- a fluent clip's "type" is undefined, not
            # all-zero-with-confidence.
            stuttered_mask = (fluent == 0).float().unsqueeze(-1)
            l_type_raw = type_loss_fn(out.type_logits, type_labels)
            l_type = (l_type_raw * stuttered_mask).sum() / stuttered_mask.sum().clamp(min=1)

            l_severity = severity_loss_fn(torch.sigmoid(out.severity_raw), severity)

            loss = l_fluency + l_type + l_severity

        if is_train:
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

        total_loss += loss.item()

    return total_loss / len(loader)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--epochs", type=int, default=15)
    ap.add_argument("--batch_size", type=int, default=16)
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--out", type=Path, default=Path("ml/checkpoints"))
    ap.add_argument("--freeze_backbone_layers", type=int, default=10)
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    train_ds = SEP28kDataset(args.manifest, "train")
    val_ds = SEP28kDataset(args.manifest, "val")
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, collate_fn=collate_fn, num_workers=4)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, collate_fn=collate_fn, num_workers=4)

    pos_weight = compute_pos_weight(train_ds).to(device)

    model = StammerDetectionModel(freeze_backbone_layers=args.freeze_backbone_layers).to(device)
    optimizer = torch.optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=args.lr)

    best_val = float("inf")
    history = []
    for epoch in range(args.epochs):
        train_loss = run_epoch(model, train_loader, device, optimizer, pos_weight)
        val_loss = run_epoch(model, val_loader, device, None, pos_weight)
        history.append({"epoch": epoch, "train_loss": train_loss, "val_loss": val_loss})
        print(f"epoch {epoch}: train={train_loss:.4f} val={val_loss:.4f}")

        if val_loss < best_val:
            best_val = val_loss
            torch.save(model.state_dict(), args.out / "best.pt")

    torch.save(model.state_dict(), args.out / "last.pt")
    (args.out / "history.json").write_text(json.dumps(history, indent=2))
    print(f"Best val loss {best_val:.4f}. Checkpoints in {args.out}")


if __name__ == "__main__":
    main()
