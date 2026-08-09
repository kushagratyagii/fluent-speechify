import {
  achievementDefinitions,
  type AchievementContext,
} from "@/data/achievements";
import {
  achievementRepository,
  streakRepository,
} from "@/lib/repositories/gamification.repository";
import type {
  Achievement,
  Difficulty,
  ExerciseSession,
  LevelInfo,
  Streak,
} from "@/types";
import { daysBetween, toDateKey } from "@/utils/date";

const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  beginner: 1,
  intermediate: 1.35,
  advanced: 1.75,
};

const LEVEL_TITLES = [
  "Getting Started",
  "Finding the Breath",
  "Steady Speaker",
  "Confident Voice",
  "Fluent Flow",
  "Speech Athlete",
  "Master of Pace",
];

/** Level n requires 100 * n XP, so total XP for level n is 50n(n+1). */
function xpForLevel(level: number): number {
  return 100 * level;
}

export const gamificationService = {
  /**
   * XP scales with difficulty and with how much of the exercise was actually
   * completed, so bailing out after ten seconds does not pay the full amount.
   */
  calculateXp(
    baseXp: number,
    difficulty: Difficulty,
    completionRatio: number,
  ): number {
    const ratio = Math.max(0, Math.min(1, completionRatio));
    const raw = baseXp * DIFFICULTY_MULTIPLIER[difficulty] * ratio;
    return Math.max(ratio > 0 ? 1 : 0, Math.round(raw));
  },

  getLevel(totalXp: number): LevelInfo {
    let level = 1;
    let remaining = totalXp;
    while (remaining >= xpForLevel(level)) {
      remaining -= xpForLevel(level);
      level += 1;
    }
    return {
      level,
      title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
      xpIntoLevel: remaining,
      xpForNextLevel: xpForLevel(level),
      totalXp,
    };
  },

  /**
   * Rolls the streak forward for a practice day. Same-day repeats are a no-op,
   * a next-day session increments, and any larger gap restarts at one.
   */
  advanceStreak(streak: Streak, dateKey: string): Streak {
    if (streak.lastPracticeDate === dateKey) return streak;

    const gap = streak.lastPracticeDate
      ? daysBetween(streak.lastPracticeDate, dateKey)
      : null;
    const current = gap === 1 ? streak.current + 1 : 1;

    return {
      current,
      longest: Math.max(streak.longest, current),
      lastPracticeDate: dateKey,
    };
  },

  /** A streak is only alive if the last practice was today or yesterday. */
  normalizeStreak(streak: Streak, today = toDateKey()): Streak {
    if (!streak.lastPracticeDate) return streak;
    const gap = daysBetween(streak.lastPracticeDate, today);
    if (gap <= 1) return streak;
    return { ...streak, current: 0 };
  },

  async getStreak(): Promise<Streak> {
    const stored = await streakRepository.get();
    const normalized = this.normalizeStreak(stored);
    if (normalized.current !== stored.current) {
      await streakRepository.save(normalized);
    }
    return normalized;
  },

  async recordPracticeDay(dateKey: string): Promise<Streak> {
    const current = this.normalizeStreak(await streakRepository.get(), dateKey);
    return streakRepository.save(this.advanceStreak(current, dateKey));
  },

  /** Returns the full catalogue with unlock timestamps applied. */
  async listAchievements(): Promise<Achievement[]> {
    const unlocks = await achievementRepository.getUnlocks();
    return achievementDefinitions.map<Achievement>((def) => ({
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      unlockedAt: unlocks[def.id] ?? null,
    }));
  },

  /** Evaluates the catalogue and persists any newly earned achievements. */
  async evaluateAchievements(
    sessions: ExerciseSession[],
    streak: Streak,
  ): Promise<Achievement[]> {
    const unlocks = await achievementRepository.getUnlocks();
    const ctx: AchievementContext = {
      sessions,
      streak,
      totalMinutes: Math.round(
        sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60,
      ),
      totalXp: sessions.reduce((sum, s) => sum + s.xpEarned, 0),
      distinctExercises: new Set(sessions.map((s) => s.exerciseId)),
    };

    const now = new Date().toISOString();
    const newlyUnlocked: Achievement[] = [];

    for (const def of achievementDefinitions) {
      if (unlocks[def.id]) continue;
      if (!def.isEarned(ctx)) continue;
      unlocks[def.id] = now;
      newlyUnlocked.push({
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        unlockedAt: now,
      });
    }

    if (newlyUnlocked.length > 0) {
      await achievementRepository.saveUnlocks(unlocks);
    }
    return newlyUnlocked;
  },
};
