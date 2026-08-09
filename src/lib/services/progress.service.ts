import { getExerciseById } from "@/data/exercises";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { gamificationService } from "@/lib/services/gamification.service";
import type { DayActivity, ExerciseSession, ProgressStats } from "@/types";
import { lastNDays, startOfWeek, toDateKey } from "@/utils/date";

function groupByDay(sessions: ExerciseSession[]): Map<string, DayActivity> {
  const map = new Map<string, DayActivity>();
  for (const s of sessions) {
    const key = toDateKey(new Date(s.endedAt));
    const entry = map.get(key) ?? { date: key, minutes: 0, sessions: 0, xp: 0 };
    entry.minutes += s.durationSeconds / 60;
    entry.sessions += 1;
    entry.xp += s.xpEarned;
    map.set(key, entry);
  }
  for (const entry of map.values()) {
    entry.minutes = Math.round(entry.minutes * 10) / 10;
  }
  return map;
}

function fillRange(days: string[], byDay: Map<string, DayActivity>): DayActivity[] {
  return days.map(
    (date) => byDay.get(date) ?? { date, minutes: 0, sessions: 0, xp: 0 },
  );
}

export const progressService = {
  async getStats(): Promise<ProgressStats> {
    const sessions = await sessionRepository.list();
    const streak = await gamificationService.getStreak();
    const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
    const totalXp = sessions.reduce((sum, s) => sum + s.xpEarned, 0);

    return {
      totalSessions: sessions.length,
      totalSeconds,
      totalMinutes: Math.round(totalSeconds / 60),
      totalXp,
      exercisesCompleted: sessions.filter((s) => s.completed).length,
      averageSessionMinutes:
        sessions.length === 0
          ? 0
          : Math.round((totalSeconds / sessions.length / 60) * 10) / 10,
      streak,
      level: gamificationService.getLevel(totalXp),
    };
  },

  /** Monday-first activity for the current week. */
  async getCurrentWeek(): Promise<DayActivity[]> {
    const sessions = await sessionRepository.list();
    const byDay = groupByDay(sessions);
    const monday = startOfWeek();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return toDateKey(d);
    });
    return fillRange(days, byDay);
  },

  async getLastDays(n: number): Promise<DayActivity[]> {
    const sessions = await sessionRepository.list();
    return fillRange(lastNDays(n), groupByDay(sessions));
  },

  /** Minutes per exercise, sorted, for the breakdown list. */
  async getExerciseBreakdown() {
    const sessions = await sessionRepository.list();
    const totals = new Map<string, { minutes: number; count: number }>();
    for (const s of sessions) {
      const entry = totals.get(s.exerciseId) ?? { minutes: 0, count: 0 };
      entry.minutes += s.durationSeconds / 60;
      entry.count += 1;
      totals.set(s.exerciseId, entry);
    }
    return [...totals.entries()]
      .map(([exerciseId, v]) => ({
        exerciseId,
        title: getExerciseById(exerciseId)?.title ?? exerciseId,
        minutes: Math.round(v.minutes * 10) / 10,
        count: v.count,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  },
};
