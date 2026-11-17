
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
   * Optional AI-generated daily passage for Slow Reading.
   * Includes vocabulary and words from previous speech sessions.
   */
  dailyPassage?: ReadingPassage;

  /**
   * Optional words/syllables generated from previous speech analysis.
   * Used by repetition-based exercises.
   */
  personalizedPassage?: ReadingPassage;
  personalizedItems?: string[];

}
