import type { DifficultyConfig, Exercise } from "@/types";
import type { useExerciseTimer } from "@/hooks/use-exercise-timer";

export interface PlayerProps {
  exercise: Exercise;
  config: DifficultyConfig;
  timer: ReturnType<typeof useExerciseTimer>;
}
