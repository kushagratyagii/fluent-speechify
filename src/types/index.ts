export type Difficulty = "beginner" | "intermediate" | "advanced";

export type Severity = "mild" | "moderate" | "severe";

export type SpeechDifficulty =
  | "stammering"
  | "cluttering"
  | "pronunciation"
  | "lisp"
  | "slow_speech"
  | "confidence";

export type SpeakingSituation =
  | "family"
  | "friends"
  | "phone_calls"
  | "office"
  | "interviews"
  | "public_speaking";

export type Goal =
  | "speak_fluently"
  | "reduce_stammering"
  | "improve_confidence"
  | "better_pronunciation"
  | "prepare_interviews";

export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

/**
 * Local-only auth identity. This is intentionally simple: the password is
 * hashed with the browser's Web Crypto API (SHA-256 + a random per-account
 * salt) rather than sent to a server, because there is no server. This is
 * NOT production-grade auth — it stops a shared computer from casually
 * reading a plaintext password in devtools, nothing more. Swapping this for
 * real auth (Supabase, NextAuth, etc.) only touches auth.service.ts.
 */
export interface Account {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Profile {
  id: string;
  name: string;
  age: number | null;
  gender: Gender | null;
  preferredLanguage: string;
  nativeLanguage: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface Assessment {
  id: string;
  profileId: string;
  difficulties: SpeechDifficulty[];
  severity: Severity;
  situations: SpeakingSituation[];
  goals: Goal[];
  createdAt: string;
}

export type ExerciseCategoryId =
  | "breathing"
  | "relaxation"
  | "oral_motor"
  | "sound_practice"
  | "fluency_shaping"
  | "reading"
  | "speaking"
  | "confidence";

export interface ExerciseCategory {
  id: ExerciseCategoryId;
  name: string;
  description: string;
  /** Tailwind accent token used by cards and icons. */
  accent: string;
  icon: string;
}

/** Renderer keys map an exercise to its interactive player component. */
export type ExercisePlayerKind =
  | "breathing"
  | "guided"
  | "reading"
  | "repetition"
  | "mirror";

export interface DifficultyConfig {
  /** Total exercise length in seconds. */
  durationSeconds: number;
  /** Breathing phase lengths, only used by the breathing player. */
  pattern?: { inhale: number; hold: number; exhale: number; holdOut?: number };
  /** Words per minute target, only used by reading players. */
  wpm?: number;
  /** Seconds each item stays on screen, used by the repetition player. */
  itemSeconds?: number;
  /** Repetitions per item, used by the repetition player. */
  reps?: number;
}

export interface Exercise {
  id: string;
  slug: string;
  title: string;
  summary: string;
  categoryId: ExerciseCategoryId;
  player: ExercisePlayerKind;
  /** Base XP awarded for a full completion, scaled by difficulty. */
  baseXp: number;
  instructions: string[];
  difficulties: Record<Difficulty, DifficultyConfig>;
  /** Player-specific payload (reading passages, syllable lists, steps...). */
  content?: ExerciseContent;
  /** Phase 1 exercises are unlocked; later-phase entries stay previewable. */
  phase: 1 | 2;
}

export interface ReadingPassage {
  id: string;
  title: string;
  kind: "paragraph" | "story" | "quote" | "article" | "tongue_twister";
  difficulty: Difficulty;
  sentences: string[];
}

export interface GuidedStep {
  label: string;
  seconds: number;
  detail: string;
}

export interface ExerciseContent {
  items?: string[];
  passages?: ReadingPassage[];
  steps?: GuidedStep[];
  tips?: string[];
}

export type DisfluencyType =
  | "block"
  | "prolongation"
  | "sound_repetition"
  | "word_repetition"
  | "interjection";

export interface DisfluencyBreakdown {
  block: number;
  prolongation: number;
  sound_repetition: number;
  word_repetition: number;
  interjection: number;
}

export interface SpeechAnalysisClip {
  startSeconds: number;
  endSeconds: number;
  fluent: boolean;
  fluencyConfidence: number;
  disfluencyTypes: DisfluencyBreakdown;
  severityScore: number;
}

/** Result of sending a session's recording to the analysis backend. */
export interface SpeechAnalysis {
  durationSeconds: number;
  clips: SpeechAnalysisClip[];
  overallFluentRatio: number;
  overallSeverityScore: number;
  overallSeverityBucket: Severity;
  dominantDisfluencyType: DisfluencyType | null;
  modelVersion: string;
  warnings: string[];
}

export interface ExerciseSession {
  id: string;
  profileId: string;
  exerciseId: string;
  difficulty: Difficulty;
  /** Seconds actually practiced, not the scheduled duration. */
  durationSeconds: number;
  completed: boolean;
  xpEarned: number;
  startedAt: string;
  endedAt: string;
  /** Present only if the user opted in to recording and analysis succeeded. */
  analysis?: SpeechAnalysis;
}

export interface DailyPlanItem {
  exerciseId: string;
  difficulty: Difficulty;
  /** Scheduled seconds, used for the "today" time estimate. */
  durationSeconds: number;
}

export interface DailyPlan {
  id: string;
  profileId: string;
  /** ISO date, yyyy-mm-dd, in the user's local timezone. */
  date: string;
  items: DailyPlanItem[];
  createdAt: string;
}

export interface Streak {
  current: number;
  longest: number;
  /** ISO date of the most recent day with a completed session. */
  lastPracticeDate: string | null;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Null while locked. */
  unlockedAt: string | null;
}

export interface LevelInfo {
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  totalXp: number;
}

export interface ProgressStats {
  totalSessions: number;
  /** Kept alongside minutes so short sessions do not display as "0 min". */
  totalSeconds: number;
  totalMinutes: number;
  totalXp: number;
  exercisesCompleted: number;
  averageSessionMinutes: number;
  streak: Streak;
  level: LevelInfo;
}

export interface DayActivity {
  date: string;
  minutes: number;
  sessions: number;
  xp: number;
}

export interface SessionSummary {
  sessionIds: string[];
  durationSeconds: number;
  exercisesCompleted: number;
  xpEarned: number;
  streak: Streak;
  newAchievements: Achievement[];
  level: LevelInfo;
  /** Present only if the user opted in to recording and analysis succeeded. */
  analysis?: SpeechAnalysis;
}
