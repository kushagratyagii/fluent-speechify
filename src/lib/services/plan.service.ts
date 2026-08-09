import { activeExercises, getExerciseById } from "@/data/exercises";
import { planRepository } from "@/lib/repositories/plan.repository";
import { profileService } from "@/lib/services/profile.service";
import { sessionRepository } from "@/lib/repositories/session.repository";
import type {
  Assessment,
  DailyPlan,
  DailyPlanItem,
  Difficulty,
  Exercise,
  Goal,
  SpeechDifficulty,
} from "@/types";
import { toDateKey } from "@/utils/date";

const PLAN_SIZE = 4;

/**
 * Which exercises each answer pushes towards. Weights are additive, so an
 * exercise matching several answers rises to the top of the plan.
 */
const DIFFICULTY_WEIGHTS: Record<SpeechDifficulty, Partial<Record<string, number>>> =
  {
    stammering: {
      "ex-deep-breathing": 3,
      "ex-diaphragmatic-breathing": 3,
      "ex-slow-reading": 2,
      "ex-syllable-practice": 2,
    },
    cluttering: {
      "ex-slow-reading": 3,
      "ex-deep-breathing": 2,
      "ex-word-repetition": 2,
    },
    pronunciation: {
      "ex-syllable-practice": 3,
      "ex-word-repetition": 3,
      "ex-mirror-practice": 2,
    },
    lisp: {
      "ex-syllable-practice": 3,
      "ex-mirror-practice": 3,
      "ex-word-repetition": 2,
    },
    slow_speech: {
      "ex-loud-reading": 3,
      "ex-word-repetition": 2,
      "ex-relaxation": 1,
    },
    confidence: {
      "ex-mirror-practice": 3,
      "ex-loud-reading": 3,
      "ex-relaxation": 2,
    },
  };

const GOAL_WEIGHTS: Record<Goal, Partial<Record<string, number>>> = {
  speak_fluently: { "ex-slow-reading": 2, "ex-deep-breathing": 2 },
  reduce_stammering: {
    "ex-diaphragmatic-breathing": 2,
    "ex-syllable-practice": 2,
  },
  improve_confidence: { "ex-mirror-practice": 2, "ex-loud-reading": 2 },
  better_pronunciation: { "ex-word-repetition": 2, "ex-syllable-practice": 2 },
  prepare_interviews: { "ex-mirror-practice": 2, "ex-loud-reading": 2 },
};

/** Deterministic per-day jitter so the plan varies but never mid-day. */
function daySeed(dateKey: string): number {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) % 100_000;
  }
  return hash;
}

function scoreExercises(
  assessment: Assessment | null,
  dateKey: string,
): Exercise[] {
  const seed = daySeed(dateKey);
  const scored = activeExercises.map((exercise, index) => {
    let score = 1;
    if (assessment) {
      for (const d of assessment.difficulties) {
        score += DIFFICULTY_WEIGHTS[d]?.[exercise.id] ?? 0;
      }
      for (const g of assessment.goals) {
        score += GOAL_WEIGHTS[g]?.[exercise.id] ?? 0;
      }
    }
    // Rotate the tie-breaker daily so equal-scoring exercises take turns.
    score += ((seed + index * 7) % 5) / 10;
    return { exercise, score };
  });

  return scored.sort((a, b) => b.score - a.score).map((s) => s.exercise);
}

export const planService = {
  /** Returns today's plan, generating and persisting it on first read. */
  async getOrCreateForDate(dateKey = toDateKey()): Promise<DailyPlan> {
    const existing = await planRepository.getByDate(dateKey);
    if (existing) return existing;

    const assessment = await profileService.getAssessment();
    const difficulty: Difficulty = assessment
      ? profileService.recommendedDifficulty(assessment.severity)
      : "beginner";

    const ranked = scoreExercises(assessment, dateKey).slice(0, PLAN_SIZE);
    const items: DailyPlanItem[] = ranked.map((exercise) => ({
      exerciseId: exercise.id,
      difficulty,
      durationSeconds: exercise.difficulties[difficulty].durationSeconds,
    }));

    return planRepository.save({
      id: `plan_${dateKey}`,
      profileId: assessment?.profileId ?? "local",
      date: dateKey,
      items,
      createdAt: new Date().toISOString(),
    });
  },

  /** Marks plan items done by matching them against today's saved sessions. */
  async getTodayStatus(dateKey = toDateKey()) {
    const [plan, sessions] = await Promise.all([
      this.getOrCreateForDate(dateKey),
      sessionRepository.listByDate(dateKey),
    ]);

    const completedIds = new Set(
      sessions.filter((s) => s.completed).map((s) => s.exerciseId),
    );

    const items = plan.items.map((item) => ({
      ...item,
      exercise: getExerciseById(item.exerciseId)!,
      completed: completedIds.has(item.exerciseId),
    }));

    const completedCount = items.filter((i) => i.completed).length;

    return {
      plan,
      items,
      completedCount,
      totalCount: items.length,
      /** First unfinished item — powers the "continue session" button. */
      nextItem: items.find((i) => !i.completed) ?? null,
      minutesPracticed: Math.round(
        sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60,
      ),
      plannedMinutes: Math.round(
        plan.items.reduce((sum, i) => sum + i.durationSeconds, 0) / 60,
      ),
    };
  },
};

export type TodayStatus = Awaited<ReturnType<typeof planService.getTodayStatus>>;
