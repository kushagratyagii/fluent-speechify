import type { ExerciseSession, Streak } from "@/types";

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Evaluated after every completed session. */
  isEarned: (ctx: AchievementContext) => boolean;
}

export interface AchievementContext {
  sessions: ExerciseSession[];
  streak: Streak;
  totalMinutes: number;
  totalXp: number;
  /** Distinct exercise ids the user has completed at least once. */
  distinctExercises: Set<string>;
}

export const achievementDefinitions: AchievementDefinition[] = [
  {
    id: "first-session",
    title: "First Words",
    description: "Complete your first exercise.",
    icon: "🎤",
    isEarned: ({ sessions }) => sessions.length >= 1,
  },
  {
    id: "streak-3",
    title: "Three in a Row",
    description: "Practise three days in a row.",
    icon: "🔥",
    isEarned: ({ streak }) => streak.current >= 3 || streak.longest >= 3,
  },
  {
    id: "streak-7",
    title: "Week Strong",
    description: "Practise seven days in a row.",
    icon: "⚡",
    isEarned: ({ streak }) => streak.current >= 7 || streak.longest >= 7,
  },
  {
    id: "streak-30",
    title: "Month of Practice",
    description: "Practise thirty days in a row.",
    icon: "🏆",
    isEarned: ({ streak }) => streak.current >= 30 || streak.longest >= 30,
  },
  {
    id: "minutes-60",
    title: "One Hour In",
    description: "Practise for sixty minutes in total.",
    icon: "⏱️",
    isEarned: ({ totalMinutes }) => totalMinutes >= 60,
  },
  {
    id: "minutes-300",
    title: "Five Hours In",
    description: "Practise for three hundred minutes in total.",
    icon: "🕰️",
    isEarned: ({ totalMinutes }) => totalMinutes >= 300,
  },
  {
    id: "sessions-25",
    title: "Regular",
    description: "Complete twenty-five exercises.",
    icon: "📈",
    isEarned: ({ sessions }) => sessions.length >= 25,
  },
  {
    id: "all-rounder",
    title: "All Rounder",
    description: "Try every exercise at least once.",
    icon: "🧭",
    isEarned: ({ distinctExercises }) => distinctExercises.size >= 8,
  },
  {
    id: "breath-master",
    title: "Breath Master",
    description: "Complete ten breathing exercises.",
    icon: "🌬️",
    isEarned: ({ sessions }) =>
      sessions.filter(
        (s) =>
          s.exerciseId === "ex-deep-breathing" ||
          s.exerciseId === "ex-diaphragmatic-breathing",
      ).length >= 10,
  },
  {
    id: "advanced-run",
    title: "Level Up",
    description: "Complete an exercise on Advanced difficulty.",
    icon: "🚀",
    isEarned: ({ sessions }) => sessions.some((s) => s.difficulty === "advanced"),
  },
];
