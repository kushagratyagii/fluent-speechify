
import { Client } from "@gradio/client";

import type {
  DisfluencyBreakdown,
  Severity,
  SpeechAnalysis,
  SpeechAnalysisClip,
} from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_ANALYSIS_API_URL ??
  "https://kushagratyagii-fluent-speech-api.hf.space";

const ANALYZE_TIMEOUT_MS = 180_000;
const HEALTH_TIMEOUT_MS = 5_000;

export class AnalysisUnavailableError extends Error { }

interface RawClipPrediction {
  start_seconds: number;
  end_seconds: number;
  fluent: boolean;
  fluency_confidence: number;
  disfluency_types: DisfluencyBreakdown;
  severity_score: number;
}

interface RawTargetWord {
  word: string;
  score: number;
  evidence_count: number;
}

interface RawPersonalizedExercise {
  title: string;
  text: string;
  target_words: string[];
  syllable_items?: string[];
  personalized_content?: Record<string, {
    items?: string[];
    passages?: Array<{
      id: string;
      title: string;
      kind: "paragraph" | "story" | "quote" | "article" | "tongue_twister";
      difficulty: "beginner" | "intermediate" | "advanced";
      sentences: string[];
    }>;
    steps?: Array<{ label: string; seconds: number; detail: string }>;
    tips?: string[];
  }>;
}

interface RawAnalyzeResponse {
  session_id: string | null;
  duration_seconds: number;
  clips: RawClipPrediction[];
  overall_fluent_ratio: number;
  overall_severity_score: number;
  overall_severity_bucket: Severity;
  dominant_disfluency_type: string | null;
  transcript: string | null;
  target_words: RawTargetWord[];
  personalized_exercise: RawPersonalizedExercise | null;
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
    transcript: raw.transcript,
    targetWords: (raw.target_words ?? []).map((word) => ({
      word: word.word,
      score: word.score,
      evidenceCount: word.evidence_count,
    })),
    personalizedExercise: raw.personalized_exercise
      ? {
        title: raw.personalized_exercise.title,
        text: raw.personalized_exercise.text,
        targetWords: raw.personalized_exercise.target_words ?? [],
        syllableItems: raw.personalized_exercise.syllable_items ?? [],
        personalizedContent: raw.personalized_exercise.personalized_content ?? {},
      }
      : null,
    modelVersion: raw.model_version,
    warnings: raw.warnings ?? [],
  };
}

// Reuse one Gradio connection instead of reconnecting for every recording.
let gradioClient: Awaited<ReturnType<typeof Client.connect>> | null = null;

async function getGradioClient() {
  if (!gradioClient) {
    gradioClient = await Client.connect(API_BASE_URL);
  }
  return gradioClient;
}

// Convert browser audio into the Base64 string expected by the Space.
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";

  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, i + chunkSize),
    );
  }

  return btoa(binary);
}

export interface GeneratedPassage {
  title: string;
  sentences: string[];
  vocabulary: string[];
}

export interface PersonalizationHistoryItem {
  targetWords: string[];
  personalizedText: string;
  dominantDisfluencyType: string | null;
  severityScore: number;
}

export const analysisService = {
  async checkHealth(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      HEALTH_TIMEOUT_MS,
    );

    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal,
      });

      if (!response.ok) return false;

      const body = await response.json();

      return body.status === "ok" && body.model_loaded === true;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  },

  async analyze(
    audioBlob: Blob,
    sessionId?: string,
    personalizationHistory: PersonalizationHistoryItem[] = [],
  ): Promise<SpeechAnalysis> {
    // Personalization is not enabled in the current demo Space.
    void personalizationHistory;

    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      if (!audioBlob || audioBlob.size === 0) {
        throw new AnalysisUnavailableError("The audio recording is empty.");
      }

      const audioBase64 = await blobToBase64(audioBlob);
      const client = await getGradioClient();

      const prediction = client.predict("/analyze", {
        audio_base64: audioBase64,
        session_id: sessionId ?? "",
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new AnalysisUnavailableError(
            "Analysis timed out. Please try a shorter recording.",
          )),
          ANALYZE_TIMEOUT_MS,
        );
      });

      const result = await Promise.race([
        prediction,
        timeoutPromise,
      ]);

      const responseData = result.data as unknown as RawAnalyzeResponse[];
      const raw = responseData?.[0];

      if (!raw || !Array.isArray(raw.clips)) {
        throw new AnalysisUnavailableError(
          "The speech analysis service returned an invalid response.",
        );
      }

      return toAnalysis(raw);
    } catch (error) {
      if (error instanceof AnalysisUnavailableError) {
        throw error;
      }

      throw new AnalysisUnavailableError(
        error instanceof Error
          ? error.message
          : "Speech analysis failed.",
      );
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  },

  async generatePassage(input: {
    difficulty: "beginner" | "intermediate" | "advanced";
    targetWords?: string[];
  }): Promise<GeneratedPassage> {
    try {
      const client = await Client.connect(API_BASE_URL);

      const result = await client.predict("/generate_passage", {
        difficulty: input.difficulty,
        target_words_json: JSON.stringify(input.targetWords ?? []),
      });

      const data = (result.data as any[])[0];
      return typeof data === "string" ? JSON.parse(data) : data;
    } catch (error) {
      console.error("Passage generation failed:", error);
      throw new AnalysisUnavailableError(
        "Passage generation is temporarily unavailable.",
      );
    }
  },
}