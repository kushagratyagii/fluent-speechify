# Fluent — Stammering Analysis Backend

Multi-task audio model (fluent/stuttered + disfluency type + severity) served
behind FastAPI. Lives alongside the Next.js frontend but is a separate
Python service — deploy and scale it independently.

```
backend/
  ml/     training pipeline (data prep, dataset, model definition, train, evaluate)
  app/    FastAPI service (config, audio decoding, inference, routes)
  tests/  pytest suite for the API layer
```

## 1. Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

You also need **ffmpeg** on the host (used to decode whatever format the
browser's `MediaRecorder` produces — typically webm/opus):

```bash
# macOS
brew install ffmpeg
# Debian/Ubuntu
apt-get install ffmpeg
```

## 2. Get the data and train

This has to happen on a machine with internet access and ideally a GPU —
neither is available in the environment this backend was scaffolded in, so
none of this has actually been run yet. Budget real time for it.

```bash
# 1. Pull SEP-28k's labels + audio-extraction scripts (separate repo, Apple's)
git clone https://github.com/apple/ml-stuttering-events-dataset
cd ml-stuttering-events-dataset && pip install -r requirements.txt
python download_audio.py      # downloads the source podcast episodes
python extract_clips.py       # slices them into ~28k 3-second labeled clips
cd ..

# 2. Build the manifest this repo's dataset.py expects
python -m ml.prepare_sep28k \
  --labels_csv ml-stuttering-events-dataset/SEP-28k_labels.csv \
  --clips_dir ml-stuttering-events-dataset/clips \
  --out ml/manifest.csv

# 3. Train
python -m ml.train --manifest ml/manifest.csv --epochs 15 --out ml/checkpoints

# 4. Check it's actually good before shipping it
python -m ml.evaluate --manifest ml/manifest.csv --checkpoint ml/checkpoints/best.pt
```

Read the warning at the top of `ml/evaluate.py` before trusting the numbers:
SEP-28k is adult podcast audio, not phone-mic recordings of this app's actual
user base (the onboarding flow collects age, native language, and country —
this dataset doesn't represent that spread well, especially children and
non-native speakers). Treat the first trained model as a baseline to
validate against real users, not a finished clinical tool.

## 3. Run the service

```bash
export FLUENT_MODEL_CHECKPOINT_PATH=ml/checkpoints/best.pt
export FLUENT_CORS_ALLOW_ORIGINS='["http://localhost:3000"]'
uvicorn app.main:app --reload --port 8000
```

`GET /health` reports `model_loaded: false` and `status: "degraded"` if the
checkpoint isn't found yet — the process still starts so you can iterate on
the API without a trained model blocking you, but `/v1/analyze` returns 503
until a checkpoint is in place.

## 4. API

### `POST /v1/analyze`

`multipart/form-data`:
| field | required | notes |
|---|---|---|
| `audio_file` | yes | any browser-recordable format (webm/opus, mp4, wav...) |
| `session_id` | no | your `ExerciseSession.id`, echoed back for correlation |

Response — see `app/schemas.py::AnalyzeResponse` for the full shape. Key
fields: `clips[]` (one prediction per ~3s window, 1s overlap), and an
aggregate `overall_severity_bucket` (`"mild" | "moderate" | "severe"`,
matching the frontend's existing `Severity` type) plus
`dominant_disfluency_type` for a single summary line.

`warnings[]` can include near-silence or clipping detection — surface these
in the UI rather than showing a confident result on unusable audio.

### `GET /health`
`{ status, model_loaded, model_version }` — poll this before enabling the
"analyze" button in the UI, or you'll show users a 503 mid-session.

## 5. Known gaps / things to decide before this ships

- **No auth on `/v1/analyze` yet.** The frontend has no auth either right
  now (per the main README), but this endpoint accepts audio of someone's
  voice — don't deploy it publicly without at least session-scoping.
- **No rate limiting.** Wav2Vec2 inference on CPU is not free; a single
  client hammering this endpoint will degrade it for everyone. Put a rate
  limiter (e.g. slowapi, or at the reverse-proxy level) in front before
  production traffic.
- **CPU-only inference is slow.** Expect noticeably higher latency than a
  toy `curl` test suggests once real multi-minute recordings hit it. If
  "near real-time" streaming feedback (your stated Phase 2 goal) is coming,
  budget for GPU inference or a much smaller/distilled model — this
  architecture is not designed for low-latency streaming as-is.
- **Frontend recording is wired up** (`src/hooks/use-audio-recorder.ts`,
  `src/lib/services/analysis.service.ts`, mic toggle + inline/summary result
  cards in the reading and repetition players). It's untrained-model-tested
  only — end-to-end behavior (real audio, real latency, CORS from the actual
  deployed frontend origin) hasn't been verified since no checkpoint exists
  yet. Set `NEXT_PUBLIC_ANALYSIS_API_URL` in the frontend's `.env.local` to
  point at this service, and make sure `FLUENT_CORS_ALLOW_ORIGINS` here
  includes that frontend's actual origin (not just `localhost:3000`) once
  deployed anywhere else.
- **Severity score is a heuristic**, not a validated clinical measure (see
  `ml/prepare_sep28k.py`). If this app is meant to inform anything beyond
  in-app progress tracking, that gap matters — don't present it as
  equivalent to a clinician's stuttering severity assessment.
