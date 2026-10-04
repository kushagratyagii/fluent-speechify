import { personalizationService } from "@/lib/services/personalization.service";
import { getExerciseById } from "@/data/exercises";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { gamificationService } from "@/lib/services/gamification.service";
import type {
  Difficulty,
  ExerciseSession,
  SessionSummary,
  SpeechAnalysis,
} from "@/types";
import { toDateKey } from "@/utils/date";

export interface CompleteSessionInput {
  exerciseId: string;
  difficulty: Difficulty;
  /** Seconds the user actually practised. */
  elapsedSeconds: number;
  /** Scheduled length, used to work out the completion ratio for XP. */
  targetSeconds: number;
  startedAt: string;
  /** Result of an optional recording, if the user opted in and analysis succeeded. */
  analysis?: SpeechAnalysis;
}

/** Anything shorter than this is treated as an accidental start, not a session. */
const MIN_CREDITED_SECONDS = 10;

export const sessionService = {
  /**
   * Persists a finished exercise run and rolls all derived state forward:
   * XP, streak and achievements. Returns the summary the UI shows next.
   */
  async complete(input: CompleteSessionInput): Promise<SessionSummary | null> {
    const exercise = getExerciseById(input.exerciseId);
    if (!exercise) throw new Error(`Unknown exercise: ${input.exerciseId}`);
    if (input.elapsedSeconds < MIN_CREDITED_SECONDS) return null;

    const ratio =
      input.targetSeconds > 0
        ? Math.min(1, input.elapsedSeconds / input.targetSeconds)
        : 1;
    const completed = ratio >= 0.9;
    const xpEarned = gamificationService.calculateXp(
      exercise.baseXp,
      input.difficulty,
      ratio,
    );

    const endedAt = new Date().toISOString();
    const session: ExerciseSession = {
      id: `sess_${Date.now().toString(36)}`,
      profileId: "local",
      exerciseId: input.exerciseId,
      difficulty: input.difficulty,
      durationSeconds: Math.round(input.elapsedSeconds),
      completed,
      xpEarned,
      startedAt: input.startedAt,
      endedAt,
      analysis: input.analysis,
    };

    await sessionRepository.create(session);
    if (input.analysis) {
      await personalizationService.recordAnalysis(input.analysis);
    }

    const dateKey = toDateKey(new Date(endedAt));
    const streak = completed
      ? await gamificationService.recordPracticeDay(dateKey)
      : await gamificationService.getStreak();

    const allSessions = await sessionRepository.list();
    const newAchievements = await gamificationService.evaluateAchievements(
      allSessions,
      streak,
    );
    const totalXp = allSessions.reduce((sum, s) => sum + s.xpEarned, 0);

    return {
      sessionIds: [session.id],
      durationSeconds: session.durationSeconds,
      exercisesCompleted: completed ? 1 : 0,
      xpEarned,
      streak,
      newAchievements,
      level: gamificationService.getLevel(totalXp),
      analysis: input.analysis,
    };
  },

  async listAll(): Promise<ExerciseSession[]> {
    return sessionRepository.list();
  },

  async getById(id: string): Promise<ExerciseSession | null> {
    const rows = await sessionRepository.list();
    return rows.find((s) => s.id === id) ?? null;
  },
};
