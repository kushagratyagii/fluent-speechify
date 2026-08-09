from __future__ import annotations

from pathlib import Path

import pandas as pd
import torch
import torchaudio
from torch.utils.data import Dataset

from ml.model import DISFLUENCY_TYPES, SAMPLE_RATE

CLIP_SECONDS = 3
CLIP_SAMPLES = CLIP_SECONDS * SAMPLE_RATE


class SEP28kDataset(Dataset):
    """
    Reads manifest.csv rows for a given split and returns
    (waveform, fluent, type_labels, severity).

    Every clip is forced to exactly CLIP_SAMPLES: SEP-28k clips are already
    ~3s, but real-world audio (and any resampling rounding) can be off by a
    handful of samples, so we pad/truncate defensively rather than assume it.
    """

    def __init__(self, manifest_path: Path, split: str):
        df = pd.read_csv(manifest_path)
        self.df = df[df["split"] == split].reset_index(drop=True)
        if len(self.df) == 0:
            raise ValueError(f"No rows for split={split!r} in {manifest_path}")

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int):
        row = self.df.iloc[idx]
        waveform, sr = torchaudio.load(row["filepath"])
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)  # stereo -> mono
        if sr != SAMPLE_RATE:
            waveform = torchaudio.functional.resample(waveform, sr, SAMPLE_RATE)
        waveform = waveform.squeeze(0)

        if waveform.shape[0] < CLIP_SAMPLES:
            pad = CLIP_SAMPLES - waveform.shape[0]
            waveform = torch.nn.functional.pad(waveform, (0, pad))
        else:
            waveform = waveform[:CLIP_SAMPLES]

        type_labels = torch.tensor([row[t] for t in DISFLUENCY_TYPES], dtype=torch.float32)
        fluent = torch.tensor(row["fluent"], dtype=torch.float32)
        severity = torch.tensor(row["severity"], dtype=torch.float32)
        return waveform, fluent, type_labels, severity


def collate_fn(batch):
    waveforms, fluent, types, severity = zip(*batch)
    waveforms = torch.stack(waveforms)  # all fixed-length, no padding mask needed
    attention_mask = torch.ones_like(waveforms, dtype=torch.long)
    return {
        "input_values": waveforms,
        "attention_mask": attention_mask,
        "fluent": torch.stack(fluent),
        "type_labels": torch.stack(types),
        "severity": torch.stack(severity),
    }
