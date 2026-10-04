/**
 * Single source of truth for storage keys, mirroring future table names.
 *
 * Per-account data (profile, assessment, sessions, streak, etc.) is
 * namespaced under `account:{id}:...` so multiple accounts can share one
 * device/browser without seeing each other's practice data. The account
 * directory and the "who's currently logged in" pointer are the only
 * un-namespaced keys, since they exist to answer "which account" in the
 * first place.
 *
 * The `legacy*` keys are the pre-auth, un-namespaced locations this app
 * used before accounts existed. They're only read once, during the very
 * first sign-up on a device, to migrate any practice data created before
 * this feature shipped — see `auth.service.ts`.
 */
export const StorageKeys = {
  accounts: "accounts:all",
  authSession: "auth:session",

  profile: (accountId: string) => `account:${accountId}:profile`,
  assessment: (accountId: string) => `account:${accountId}:assessment`,
  sessions: (accountId: string) => `account:${accountId}:exercise_sessions`,
  dailyPlan: (accountId: string, date: string) =>
    `account:${accountId}:daily_plan:${date}`,
  streak: (accountId: string) => `account:${accountId}:streak`,
  achievements: (accountId: string) => `account:${accountId}:achievements`,
  activeSession: (accountId: string) => `account:${accountId}:active_session`,
  personalization: (accountId: string) =>
    `account:${accountId}:speech_personalization`,
  

  legacyProfile: "profiles:current",
  legacyAssessment: "assessments:current",
  legacySessions: "exercise_sessions",
  legacyDailyPlan: (date: string) => `daily_plans:${date}`,
  legacyStreak: "streaks:current",
  legacyAchievements: "achievements:current",
  legacyActiveSession: "session_runs:active",
} as const;
