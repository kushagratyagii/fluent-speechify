import {
  assessmentRepository,
  profileRepository,
} from "@/lib/repositories/profile.repository";
import type {
  Assessment,
  Difficulty,
  Goal,
  Profile,
  Severity,
} from "@/types";
import type { ProfileInput, AssessmentInput } from "@/lib/validations/profile";

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const profileService = {
  async getProfile(): Promise<Profile | null> {
    return profileRepository.get();
  },

  async getAssessment(): Promise<Assessment | null> {
    return assessmentRepository.get();
  },

  async isOnboarded(): Promise<boolean> {
    const [profile, assessment] = await Promise.all([
      profileRepository.get(),
      assessmentRepository.get(),
    ]);
    return Boolean(profile && assessment);
  },

  async saveProfile(input: ProfileInput): Promise<Profile> {
    const existing = await profileRepository.get();
    const now = new Date().toISOString();
    return profileRepository.save({
      id: existing?.id ?? id("prof"),
      name: input.name.trim(),
      age: input.age ?? null,
      gender: input.gender ?? null,
      preferredLanguage: input.preferredLanguage,
      nativeLanguage: input.nativeLanguage,
      country: input.country,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  },

  async saveAssessment(input: AssessmentInput): Promise<Assessment> {
    const profile = await profileRepository.get();
    const existing = await assessmentRepository.get();
    return assessmentRepository.save({
      id: existing?.id ?? id("asmt"),
      profileId: profile?.id ?? "local",
      difficulties: input.difficulties,
      severity: input.severity,
      situations: input.situations,
      goals: input.goals,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
  },

  /** Severity drives the starting difficulty of every generated plan. */
  recommendedDifficulty(severity: Severity): Difficulty {
    if (severity === "severe") return "beginner";
    if (severity === "moderate") return "intermediate";
    return "advanced";
  },

  goalLabel(goal: Goal): string {
    return GOAL_LABELS[goal];
  },
};

export const GOAL_LABELS: Record<Goal, string> = {
  speak_fluently: "Speak more fluently",
  reduce_stammering: "Reduce stammering",
  improve_confidence: "Improve confidence",
  better_pronunciation: "Better pronunciation",
  prepare_interviews: "Prepare for interviews",
};
