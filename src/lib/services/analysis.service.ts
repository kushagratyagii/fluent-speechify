import type {
  DisfluencyBreakdown,
  Severity,
  SpeechAnalysis,
  SpeechAnalysisClip,
} from "@/types";

/**
 * Base URL of the FastAPI backend (backend/app/main.py). Must be set via
 * NEXT_PUBLIC_ANALYSIS_API_URL for production builds -- it's a client-side
 * fetch, so the var has to be public and baked in at build time, same as
 * any other Next.js NEXT_PUBLIC_* value. Falls back to the local dev
 * server so `npm run dev` works against `uvicorn app.main:app --reload`
 * with zero config.
 */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_ANALYSIS_API_URL ?? "http://localhost:8000";

/** The backend is a separate optional service -- give up well before the
 * user would notice the UI hanging, rather than blocking the save flow. */
const ANALYZE_TIMEOUT_MS = 30_000;
const HEALTH_TIMEOUT_MS = 3_000;

export class AnalysisUnavailableError extends Error {}

interface RawClipPrediction {
  start_seconds: number;
  end_seconds: number;
  fluent: boolean;
  fluency_confidence: number;
  disfluency_types: DisfluencyBreakdown;
  severity_score: number;
}

interface RawAnalyzeResponse {
  session_id: string | null;
  duration_seconds: number;
  clips: RawClipPrediction[];
  overall_fluent_ratio: number;
  overall_severity_score: number;
  overall_severity_bucket: Severity;
  dominant_disfluency_type: string | null;
  model_version: string;
  warnings: string[];
}

function toClip(raw: RawClipPrediction): SpeechAnalysisClip {
  return {
    startSeconds: raw.start_seconds,
    endSeconds: raw.end_seconds,
    fluent: raw.fluent,
    fluencyConfidence: raw.fluency_confidence,
    disfluencyTypes: raw.disfluency_types,
    severityScore: raw.severity_score,
  };
}

function toAnalysis(raw: RawAnalyzeResponse): SpeechAnalysis {
  return {
    durationSeconds: raw.duration_seconds,
    clips: raw.clips.map(toClip),
    overallFluentRatio: raw.overall_fluent_ratio,
    overallSeverityScore: raw.overall_severity_score,
    overallSeverityBucket: raw.overall_severity_bucket,
    dominantDisfluencyType:
      (raw.dominant_disfluency_type as SpeechAnalysis["dominantDisfluencyType"]) ??
      null,
    modelVersion: raw.model_version,
    warnings: raw.warnings,
  };
}

export const analysisService = {
  /**
   * Cheap readiness check. Call this before showing the mic toggle as
   * enabled -- there's no point letting the user opt in to a recording
   * that can never be analyzed because the backend isn't deployed yet or
   * hasn't finished loading its checkpoint.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      const res = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return false;
      const body = (await res.json()) as { model_loaded: boolean };
      return body.model_loaded;
    } catch {
      // Network error, timeout, backend not deployed -- all the same to
      // the caller: analysis isn't available right now.
      return false;
    }
  },

  /**
   * Uploads a recorded clip for analysis. Throws AnalysisUnavailableError
   * on any failure (network, timeout, non-2xx, bad audio) -- callers
   * should catch this and continue the session save without analysis
   * rather than let the whole session fail because the ML service is down.
   */
  async analyze(audioBlob: Blob, sessionId?: string): Promise<SpeechAnalysis> {
    const form = new FormData();
    const extension = audioBlob.type.includes("mp4") ? "mp4" : "webm";
    form.append("audio_file", audioBlob, `session.${extension}`);
    if (sessionId) form.append("session_id", sessionId);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE_URL}/v1/analyze`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new AnalysisUnavailableError(
          detail?.detail ?? `Analysis failed with status ${res.status}`,
        );
      }

      const raw = (await res.json()) as RawAnalyzeResponse;
      return toAnalysis(raw);
    } catch (err) {
      if (err instanceof AnalysisUnavailableError) throw err;
      throw new AnalysisUnavailableError(
        err instanceof Error ? err.message : "Analysis request failed",
      );
    } finally {
      clearTimeout(timeout);
    }
  },
};
