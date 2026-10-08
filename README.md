# Fluent — Speech Therapy Practice

### AI-Enabled Personalized Speech Practice Platform

Fluent Speechify is an AI-assisted speech therapy practice platform designed to help users build a consistent speaking-practice habit through guided exercises, speech analysis, and personalized practice content.

The platform combines a Next.js frontend with a FastAPI-based speech analysis service powered by a multi-task Wav2Vec2 model. After an optional voice recording, the system analyzes fluency patterns, estimates disfluency type and severity, identifies possible practice words, and generates personalized exercises for subsequent sessions.

> **Important:** Fluent Speechify is an educational/practice tool, not a clinical diagnostic system. Speech-analysis results are automated estimates and should not be treated as a clinician's assessment.

---

## ✨ Features

### 🎯 Guided Speech Exercises

The application currently provides multiple interactive exercises with beginner, intermediate, and advanced difficulty levels:

- **Deep Breathing** — guided inhale/hold/exhale breathing
- **Diaphragmatic Breathing** — step-based breathing guidance
- **Slow Reading** — paced reading with sentence highlighting
- **Syllable Practice** — repeated syllable practice with a visual rhythm
- **Word Repetition** — personalized word repetition based on previous analysis
- **Mirror Practice** — live camera-based speaking practice
- **Loud Reading** — stories, quotes, articles, and tongue twisters
- **Relaxation** — guided jaw, tongue, lip, and neck exercises

---

## 🤖 AI Speech Analysis

For supported exercises, users can optionally enable voice analysis.

The backend processes recorded speech using a multi-task Wav2Vec2 model and provides:

- Fluency classification
- Disfluency type probabilities
- Severity estimation
- Overall fluency ratio
- Dominant disfluency pattern
- Speech transcript
- Potential practice words
- Personalized speech exercises

The current model uses:

- **Wav2Vec2** for speech representation and disfluency analysis
- **faster-whisper** for transcription and word timestamps
- **FastAPI** for serving the analysis pipeline

The analysis service is intentionally separated from the frontend so that the ML backend can be developed and deployed independently.

---

## 🧠 Personalized Practice

One of the main features of Fluent Speechify is that practice can adapt based on previous speech analysis.

The system can use previously detected practice words to generate:

### Personalized Loud Reading

Instead of always presenting the same passage, the system can generate a passage containing relevant target words.

### Personalized Word Repetition

Words identified during previous speech analysis can become the next Word Repetition targets.

### Personalized Syllable Practice

The backend generates syllable practice items from personalized target words.

The frontend receives these as structured `syllableItems`, so syllable generation is handled by the backend rather than being guessed by the browser.

When an OpenAI API key is not configured, the backend uses a local deterministic fallback so the personalization pipeline remains functional during development.

---

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────┐
│              Next.js Frontend               │
│                                             │
│  Exercises · Dashboard · Progress · Auth   │
│  Recording · Personalized Practice UI       │
└──────────────────────┬──────────────────────┘
                       │
                       │ HTTP / multipart audio
                       ▼
┌─────────────────────────────────────────────┐
│              FastAPI Backend                │
│                                             │
│  /health                                    │
│  /v1/analyze                                │
│                                             │
│  Audio decoding                             │
│  Whisper transcription                      │
│  Wav2Vec2 analysis                          │
│  Target-word extraction                     │
│  Personalization                            │
└──────────────────────┬──────────────────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
      Speech Analysis      Personalization
       Wav2Vec2 +           OpenAI / local
       Whisper              fallback
```

---

## 📁 Project Structure

```text
fluent-speechify/
│
├── src/
│   ├── app/                 # Next.js routes
│   ├── components/          # Shared UI components
│   ├── features/
│   │   ├── exercises/       # Exercise players and runner
│   │   ├── session/         # Analysis and session UI
│   │   ├── dashboard/
│   │   ├── progress/
│   │   ├── gamification/
│   │   └── profile/
│   ├── data/                # Exercise catalogue and content
│   ├── hooks/               # Client-side hooks
│   ├── lib/
│   │   ├── services/        # Application services
│   │   ├── repositories/    # Data access
│   │   └── db/              # Local storage adapter
│   ├── types/               # Shared TypeScript types
│   └── utils/
│
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   ├── inference.py     # Audio analysis pipeline
│   │   ├── personalization.py
│   │   ├── schemas.py
│   │   └── ...
│   ├── ml/
│   │   ├── model.py
│   │   ├── train.py
│   │   ├── evaluate.py
│   │   └── ...
│   ├── tests/
│   ├── requirements.txt
│   └── README.md
│
├── package.json
└── README.md
```

---

## 🚀 Running the Project Locally

Fluent Speechify consists of two services.

### 1. Frontend

From the project root:

```bash
npm install
npm run dev
```

Frontend:

```text
http://localhost:3000
```

Production build:

```bash
npm run build
```

---

### 2. Backend

Open a second terminal:

```bash
cd backend
```

Create/activate the Python virtual environment.

#### Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Start FastAPI:

```powershell
uvicorn app.main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

Swagger API documentation:

```text
http://127.0.0.1:8000/docs
```

Health check:

```text
http://127.0.0.1:8000/health
```

---

## 🔑 Environment Variables

### Frontend

Create `.env.local` in the project root if the backend is not running on the default URL:

```env
NEXT_PUBLIC_ANALYSIS_API_URL=http://localhost:8000
```

The application defaults to:

```text
http://localhost:8000
```

so local development normally requires no frontend environment variable.

### Backend

Optional environment variables include:

```env
FLUENT_MODEL_CHECKPOINT_PATH=ml/checkpoints/best.pt
FLUENT_CORS_ALLOW_ORIGINS=["http://localhost:3000"]

OPENAI_API_KEY=your_key_here
OPENAI_MODEL=your_model_here
```

The OpenAI key is used only by the backend and must never be exposed in the browser.

If an OpenAI key is unavailable, personalization falls back to the local implementation.

---

## 🔬 Speech Analysis Pipeline

A recorded exercise follows approximately this pipeline:

```text
Browser recording
       ↓
Audio upload
       ↓
FastAPI
       ↓
Audio decoding / preprocessing
       ↓
Wav2Vec2 analysis
       ↓
Clip-level fluency + disfluency predictions
       ↓
Whisper transcription
       ↓
Word timestamps
       ↓
Potential practice-word extraction
       ↓
Personalization
       ↓
Personalized exercise
```

The Wav2Vec2 model currently operates primarily on audio clips/windows. Therefore, practice-word locations are heuristic associations between speech windows and transcript timestamps rather than exact ground-truth stutter locations.

---

## 📊 Current Project Status

| Feature | Status |
|---|---|
| Local account / login flow | ✅ |
| Onboarding | ✅ |
| Initial assessment | ✅ |
| Personalized daily plan | ✅ |
| Interactive exercise system | ✅ |
| Multiple difficulty levels | ✅ |
| Session tracking | ✅ |
| Progress dashboard | ✅ |
| XP / levels / achievements | ✅ |
| Optional microphone recording | ✅ |
| FastAPI speech-analysis service | ✅ |
| Wav2Vec2 speech model | ✅ |
| Whisper transcription | ✅ |
| Target-word extraction | ✅ |
| Personalized Loud Reading | ✅ |
| Personalized Word Repetition | ✅ |
| Personalized Syllable Practice | ✅ |
| OpenAI-powered personalization | 🟡 Optional |
| Production authentication | ⏳ |
| Cloud persistence | ⏳ |
| Real-time streaming analysis | ⏳ |
| Clinical validation | ⏳ |

---

## ⚠️ Limitations

### Not a clinical diagnostic system

The analysis scores are automated estimates intended for practice feedback and progress tracking. They are not equivalent to a clinician-administered stuttering assessment.

### Target words are approximate

Potential practice words are inferred from overlapping speech-analysis windows and transcription timestamps. They should not be interpreted as confirmed locations of stuttering.

### Dataset limitations

The speech model is based on the SEP-28k dataset. Dataset characteristics may not fully represent the diversity of real users, accents, microphones, environments, ages, or speaking styles.

### CPU inference

Wav2Vec2 inference can be relatively slow on CPU, especially for longer recordings. Production deployment may benefit from GPU inference or model optimization.

### No production auth for the analysis API

The analysis endpoint should not be exposed publicly without appropriate authentication, rate limiting, session scoping, and privacy controls.

---

## 🧪 Development

Frontend checks:

```bash
npm run build
npm run lint
npm test
```

Backend:

```bash
cd backend
pytest
```

The frontend and backend are intentionally separated so either side can evolve independently.

---

## 🛠️ Tech Stack

### Frontend

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Motion
- Recharts

### Backend

- Python
- FastAPI
- Pydantic
- PyTorch
- Hugging Face Transformers
- Wav2Vec2
- faster-whisper
- librosa / audio processing tools

### AI / ML

- Wav2Vec2
- Whisper
- SEP-28k
- Optional OpenAI integration
- Local personalization fallback

---

## 🎓 Project Context

Fluent Speechify is being developed as a final-year engineering project exploring how speech analytics, machine learning, and personalized digital exercises can support structured speaking practice.

The goal is not to replace professional speech therapy, but to provide a consistent practice environment with measurable and adaptive feedback.

---

## 📌 Future Work

- Real-time speech analysis
- Improved word-level disfluency alignment
- More robust personalization
- Clinical/user validation
- Better multilingual support
- Production authentication
- Cloud persistence
- Therapist-facing dashboard
- Personalized therapy programs
- Model optimization for low-latency inference