"""
Turns the SEP-28k label CSVs into a single training manifest (manifest.csv)
that dataset.py reads.

--- Getting the data (do this OUTSIDE this repo, on a machine with internet) ---
SEP-28k ships labels only; the underlying podcast audio is copyrighted, so
Apple distributes a downloader + clip-extraction script instead of raw audio:

    git clone https://github.com/apple/ml-stuttering-events-dataset
    cd ml-stuttering-events-dataset
    pip install -r requirements.txt
    python download_audio.py            # pulls the source podcast episodes
    python extract_clips.py             # slices them into 3s clips per label row

That produces:
  - SEP-28k_labels.csv  (or SEP-28k-Episodes.csv, depending on repo version)
      columns include: Show, EpId, ClipId, Start, Stop, Unsure,
      PoorAudioQuality, Prolongation, Block, SoundRep, WordRep,
      DifficultToUnderstand, Interjection, NoStutteredWords, NaturalPause,
      Music, NoSpeech
      -> each disfluency column is an integer 0-3: how many of the 3
         annotators marked that label on the clip.
  - clips/<Show>_<EpId>_<ClipId>.wav   -- one 3-second clip per label row

Point --labels_csv and --clips_dir at those outputs.

--- What this script does ---
1. Drops rows Apple flags as unusable (PoorAudioQuality, Music, NoSpeech,
   DifficultToUnderstand, or Unsure >= 2).
2. Builds multi-hot disfluency labels using a majority vote (count >= 2 of 3
   annotators).
3. Derives a severity proxy in [0, 100] from annotator agreement across all
   disfluency columns, since SEP-28k has no direct severity/SSI score:
       severity = 100 * (sum of disfluency counts) / (5 types * 3 annotators)
   This is a heuristic, not a clinical severity measure -- flag this to
   whoever reviews the model before it's used in the app.
4. Writes manifest.csv with: filepath, fluent (0/1), block, prolongation,
   sound_repetition, word_repetition, interjection, severity
5. Splits by Show (not by clip) into train/val/test so the same podcast
   speaker's voice doesn't leak across splits.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

DISFLUENCY_COLS = {
    "Block": "block",
    "Prolongation": "prolongation",
    "SoundRep": "sound_repetition",
    "WordRep": "word_repetition",
    "Interjection": "interjection",
}
EXCLUDE_IF_ANY = ["PoorAudioQuality", "Music", "NoSpeech", "DifficultToUnderstand"]


def build_manifest(labels_csv: Path, clips_dir: Path) -> pd.DataFrame:
    df = pd.read_csv(labels_csv)

    for col in EXCLUDE_IF_ANY:
        if col in df.columns:
            df = df[df[col] == 0]
    if "Unsure" in df.columns:
        df = df[df["Unsure"] < 2]

    rows = []
    for _, r in df.iterrows():
        fname = f"{r['Show']}_{r['EpId']}_{r['ClipId']}.wav"
        fpath = clips_dir / fname
        if not fpath.exists():
            continue  # extraction script may have skipped a corrupt clip

        majority = {out: int(r[src] >= 2) for src, out in DISFLUENCY_COLS.items()}
        total_possible = len(DISFLUENCY_COLS) * 3
        total_marked = sum(int(r[src]) for src in DISFLUENCY_COLS)
        severity = round(100 * total_marked / total_possible, 1)
        fluent = int(sum(majority.values()) == 0)

        rows.append({"filepath": str(fpath), "fluent": fluent, **majority, "severity": severity, "show": r["Show"]})

    return pd.DataFrame(rows)


def split_by_show(df: pd.DataFrame, val_frac: float = 0.1, test_frac: float = 0.1, seed: int = 13) -> pd.DataFrame:
    shows = df["show"].drop_duplicates().sample(frac=1.0, random_state=seed).tolist()
    n = len(shows)
    n_test = max(1, int(n * test_frac))
    n_val = max(1, int(n * val_frac))
    test_shows = set(shows[:n_test])
    val_shows = set(shows[n_test : n_test + n_val])

    def split(show: str) -> str:
        if show in test_shows:
            return "test"
        if show in val_shows:
            return "val"
        return "train"

    df = df.copy()
    df["split"] = df["show"].map(split)
    return df


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels_csv", type=Path, required=True)
    ap.add_argument("--clips_dir", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=Path(__file__).parent / "manifest.csv")
    args = ap.parse_args()

    manifest = build_manifest(args.labels_csv, args.clips_dir)
    manifest = split_by_show(manifest)
    manifest.to_csv(args.out, index=False)

    print(f"Wrote {len(manifest)} rows to {args.out}")
    print(manifest["split"].value_counts())
    print("Fluent / stuttered balance:")
    print(manifest["fluent"].value_counts(normalize=True))


if __name__ == "__main__":
    main()
