import type {
  DifficultyConfig,
  Exercise,
  ReadingPassage,
} from "@/types";
import type { useExerciseTimer } from "@/hooks/use-exercise-timer";

export interface PlayerProps {
  exercise: Exercise;
  config: DifficultyConfig;
  timer: ReturnType<typeof useExerciseTimer>;

  /**
   * Optional personalized passage for Loud Reading.
   */
  personalizedPassage?: ReadingPassage;

  /**
   * Optional words/syllables generated from previous speech analysis.
   * Used by repetition-based exercises.
   */
  personalizedItems?: string[];
}