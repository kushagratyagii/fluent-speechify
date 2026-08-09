import { notFound } from "next/navigation";
import { exercises, getExerciseBySlug } from "@/data/exercises";
import { ExerciseRunner } from "@/features/exercises/exercise-runner";
import type { Difficulty } from "@/types";

const VALID_DIFFICULTIES: Difficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
];

export function generateStaticParams() {
  return exercises.map((exercise) => ({ slug: exercise.slug }));
}

export default async function ExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ difficulty?: string }>;
}) {
  const { slug } = await params;
  const { difficulty } = await searchParams;

  const exercise = getExerciseBySlug(slug);
  if (!exercise) notFound();

  const initialDifficulty = VALID_DIFFICULTIES.includes(
    difficulty as Difficulty,
  )
    ? (difficulty as Difficulty)
    : "beginner";

  return (
    <ExerciseRunner exercise={exercise} initialDifficulty={initialDifficulty} />
  );
}
