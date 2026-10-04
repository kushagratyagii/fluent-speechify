# Fluent Speechify — Speech Analysis Backend

FastAPI-based speech analysis service for Fluent Speechify.

The backend receives recorded speech from the Next.js application, performs automatic speech analysis using a Wav2Vec2-based multi-task model, transcribes speech using faster-whisper, extracts potential practice words, and generates personalized speech exercises.

> **Important:** This service provides automated practice feedback. It is not a clinically validated stuttering diagnostic system.

---

## Architecture

```text
Audio
  │
  ▼
FastAPI
  │
  ├── Audio decoding / preprocessing
  │
  ├── Wav2Vec2
  │      ├── Fluency classification
  │      ├── Disfluency type
  │      └── Severity estimate
  │
  ├── faster-whisper
  │      ├── Transcript
  │      └── Word timestamps
  │
  └── Personalization
         ├── Target words
         ├── Personalized passage
         └── Syllable practice
```

---

## Project Structure

```text
backend/
│
├── app/
│   ├── main.py              # FastAPI routes
│   ├── inference.py         # Audio inference pipeline
│   ├── personalization.py   # Personalized exercise generation
│   ├── schemas.py           # Pydantic request/response models
│   └── ...
│
├── ml/
│   ├── model.py             # Multi-task Wav2Vec2 model
│   ├── dataset.py           # Dataset handling
│   ├── prepare_sep28k.py    # Dataset preparation
│   ├── train.py             # Training
│   ├── evaluate.py          # Evaluation
│   └── ...
│
├── tests/
├── requirements.txt
└── README.md
```

---

# 1. Setup

From the repository root:

```powershell
cd backend
```

Create a virtual environment:

```powershell
python -m venv .venv
```

Activate it on Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

For macOS/Linux:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## FFmpeg

FFmpeg may be required for decoding browser-recorded audio formats such as WebM/Opus.

### macOS

```bash
brew install ffmpeg
```

### Debian / Ubuntu

```bash
sudo apt-get install ffmpeg
```

### Windows

Install FFmpeg and make sure `ffmpeg` is available on the system `PATH`.

Verify:

```bash
ffmpeg -version
```

---

# 2. Model

The speech-analysis model is based on pretrained:

```text
facebook/wav2vec2-base
```

The architecture contains multiple prediction heads:

```text
Wav2Vec2
    │
    ▼
Shared speech representation
    │
    ├── Fluency head
    │      fluent / stuttered
    │
    ├── Disfluency type head
    │      block
    │      prolongation
    │      sound repetition
    │      word repetition
    │      interjection
    │
    └── Severity head
           0–100 score
```

The backend currently loads the configured checkpoint during application startup.

---

# 3. SEP-28k

The training pipeline is designed around the SEP-28k dataset.

The dataset contains labeled speech clips associated with stuttering/disfluency events.

The expected preparation flow is:

```bash
git clone https://github.com/apple/ml-stuttering-events-dataset

cd ml-stuttering-events-dataset
pip install -r requirements.txt

python download_audio.py
python extract_clips.py

cd ..
```

Prepare the backend manifest:

```bash
python -m ml.prepare_sep28k \
  --labels_csv ml-stuttering-events-dataset/SEP-28k_labels.csv \
  --clips_dir ml-stuttering-events-dataset/clips \
  --out ml/manifest.csv
```

Training:

```bash
python -m ml.train \
  --manifest ml/manifest.csv \
  --epochs 15 \
  --out ml/checkpoints
```

Evaluation:

```bash
python -m ml.evaluate \
  --manifest ml/manifest.csv \
  --checkpoint ml/checkpoints/best.pt
```

> The model should be evaluated carefully before making claims about clinical performance. SEP-28k does not perfectly represent the microphone conditions, demographics, accents, languages, or speaking environments of Fluent Speechify users.

---

# 4. Run the API

The backend can be started with:

```powershell
uvicorn app.main:app --reload
```

Default address:

```text
http://127.0.0.1:8000
```

Swagger documentation:

```text
http://127.0.0.1:8000/docs
```

If a custom checkpoint is required:

```powershell
$env:FLUENT_MODEL_CHECKPOINT_PATH="ml/checkpoints/best.pt"
```

CORS for local frontend development:

```powershell
$env:FLUENT_CORS_ALLOW_ORIGINS='["http://localhost:3000"]'
```

Then:

```powershell
uvicorn app.main:app --reload --port 8000
```

---

# 5. Health Check

```http
GET /health
```

Example:

```json
{
  "status": "ok",
  "model_loaded": true,
  "model_version": "sep28k-v1"
}
```

The frontend checks this endpoint before enabling speech analysis.

---

# 6. Speech Analysis API

## `POST /v1/analyze`

The endpoint accepts multipart form data.

### Fields

| Field | Required | Description |
|---|---|---|
| `audio_file` | Yes | Recorded audio such as WebM, MP4, or WAV |
| `session_id` | No | Frontend session identifier |
| `personalization_history` | No | Recent personalization history as a JSON array |

Example request conceptually:

```text
POST /v1/analyze
Content-Type: multipart/form-data
```

---

## Response

The response follows `AnalyzeResponse` in:

```text
app/schemas.py
```

Important fields include:

```text
session_id
duration_seconds
clips
overall_fluent_ratio
overall_severity_score
overall_severity_bucket
dominant_disfluency_type
transcript
target_words
personalized_exercise
model_version
warnings
```

Each clip contains:

```text
start_seconds
end_seconds
fluent
fluency_confidence
disfluency_types
severity_score
```

---

# 7. Personalization

The personalization pipeline lives in:

```text
app/personalization.py
```

The system uses detected target words and recent personalization history to generate adaptive practice material.

A personalized exercise has the structure:

```json
{
  "title": "Personalized Speech Practice",
  "text": "...",
  "target_words": [
    "first",
    "finally"
  ],
  "syllable_items": [
    "fi",
    "nal",
    "ly",
    "con",
    "ti",
    "nue"
  ]
}
```

The frontend uses:

```text
personalizedExercise.targetWords
```

for Word Repetition and:

```text
personalizedExercise.syllableItems
```

for Syllable Practice.

---

## OpenAI personalization

OpenAI integration is optional.

If:

```env
OPENAI_API_KEY=...
```

is available, the personalization service can use the configured LLM path.

Example:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=your_model_here
```

The API key must remain server-side and must never be exposed through the Next.js client.

If the key is unavailable, the backend uses local fallback logic so the application remains usable during development.

---

# 8. Target Words

Potential target words are derived from the relationship between:

- speech-analysis windows
- transcription timestamps
- non-fluent predictions

These are **practice candidates**, not confirmed word-level stuttering locations.

The frontend deliberately communicates this distinction to the user.

---

# 9. Syllable Generation

The backend currently supports personalized syllable practice through:

```python
generate_syllable_exercise()
```

The local fallback uses a lightweight heuristic syllabification method.

This is intended to generate useful practice material, not phonological ground truth.

For example, a target word may produce:

```text
finally
↓
fi · nal · ly
```

When an LLM is available, the personalization layer can be extended to produce richer structured syllable practice.

---

# 10. Frontend Integration

The Next.js frontend communicates with this backend through:

```text
src/lib/services/analysis.service.ts
```

Configure the frontend endpoint with:

```env
NEXT_PUBLIC_ANALYSIS_API_URL=http://localhost:8000
```

The frontend sends recorded audio to:

```text
POST /v1/analyze
```

and maps the snake_case API response into the frontend's camelCase domain types.

---

# 11. Development Commands

Start the server:

```powershell
uvicorn app.main:app --reload
```

Run tests:

```powershell
pytest
```

Inspect the API:

```text
http://127.0.0.1:8000/docs
```

Health check:

```text
http://127.0.0.1:8000/health
```

---

# 12. Known Limitations

### Clip-level model

The core Wav2Vec2 model is primarily clip/window based. It does not provide perfect word-level stuttering localization.

### Heuristic severity

The severity score is an automated heuristic for in-app feedback and is not a validated clinical severity measure.

### Dataset mismatch

SEP-28k consists of adult podcast speech and may not represent every Fluent Speechify user, accent, language, age group, microphone, or recording environment.

### CPU latency

Wav2Vec2 inference can be computationally expensive on CPU, particularly for longer recordings.

### No streaming analysis yet

The current architecture analyzes completed recordings. It is not a true low-latency streaming speech-analysis system.

### API security

The analysis endpoint should not be exposed publicly without appropriate:

- Authentication
- Authorization/session scoping
- Rate limiting
- Audio privacy controls
- Production CORS configuration

### Privacy

Voice recordings are sensitive data. A production deployment should define explicit retention, deletion, encryption, access-control, and consent policies.

---

# 13. Production Checklist

Before public deployment:

- [ ] Add authentication/session scoping
- [ ] Add rate limiting
- [ ] Configure production CORS
- [ ] Secure uploaded audio handling
- [ ] Define audio retention/deletion policy
- [ ] Protect all API secrets
- [ ] Validate model performance on representative users
- [ ] Evaluate inference latency
- [ ] Consider GPU/model optimization
- [ ] Validate the system independently of clinical diagnosis claims

---

## Relationship to the Main Project

The root `README.md` documents the complete Fluent Speechify application.

This file documents only the Python/FastAPI speech-analysis service.

```text
Fluent Speechify
│
├── README.md
│      Complete application
│
└── backend/
       README.md
       Speech-analysis service
```