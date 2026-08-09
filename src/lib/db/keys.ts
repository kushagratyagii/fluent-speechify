/** Single source of truth for storage keys, mirroring future table names. */
export const StorageKeys = {
  profile: "profiles:current",
  assessment: "assessments:current",
  sessions: "exercise_sessions",
  dailyPlan: (date: string) => `daily_plans:${date}`,
  streak: "streaks:current",
  achievements: "achievements:current",
  activeSession: "session_runs:active",
} as const;
