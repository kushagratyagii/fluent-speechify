import type {
  Gender,
  Goal,
  Severity,
  SpeakingSituation,
  SpeechDifficulty,
} from "@/types";

export interface ProfileInput {
  name: string;
  age: number | null;
  gender: Gender | null;
  preferredLanguage: string;
  nativeLanguage: string;
  country: string;
}

export interface AssessmentInput {
  difficulties: SpeechDifficulty[];
  severity: Severity;
  situations: SpeakingSituation[];
  goals: Goal[];
}

export type ValidationErrors<T> = Partial<Record<keyof T, string>>;

export function validateProfile(input: ProfileInput): ValidationErrors<ProfileInput> {
  const errors: ValidationErrors<ProfileInput> = {};
  if (!input.name.trim()) errors.name = "Please enter your name.";
  else if (input.name.trim().length > 60) errors.name = "That name is too long.";
  if (input.age !== null && (input.age < 3 || input.age > 110)) {
    errors.age = "Enter an age between 3 and 110.";
  }
  if (!input.preferredLanguage) errors.preferredLanguage = "Pick a language.";
  if (!input.nativeLanguage) errors.nativeLanguage = "Pick a language.";
  if (!input.country) errors.country = "Pick a country.";
  return errors;
}

export function validateAssessment(
  input: AssessmentInput,
): ValidationErrors<AssessmentInput> {
  const errors: ValidationErrors<AssessmentInput> = {};
  if (input.difficulties.length === 0) {
    errors.difficulties = "Select at least one difficulty.";
  }
  if (input.goals.length === 0) errors.goals = "Select at least one goal.";
  return errors;
}

export function hasErrors(errors: Record<string, unknown>): boolean {
  return Object.keys(errors).length > 0;
}
