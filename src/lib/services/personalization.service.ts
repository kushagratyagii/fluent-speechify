import { personalizationRepository } from "@/lib/repositories/personalization.repository";
import type {
  DifficultWord,
  SpeechAnalysis,
  SpeechPersonalizationProfile,
} from "@/types";

const TREND_EPSILON = 0.03;

type PersonalizedExercise = NonNullable<
  SpeechAnalysis["personalizedExercise"]
>;

export type PersistentSpeechPersonalizationProfile =
  SpeechPersonalizationProfile & {
    personalizedExercise?: PersonalizedExercise;
  };

function calculateTrend(
  previousScore: number | null,
  currentScore: number,
): DifficultWord["trend"] {
  if (previousScore === null) return "stable";
  if (currentScore < previousScore - TREND_EPSILON) return "improving";
  if (currentScore > previousScore + TREND_EPSILON) return "worsening";
  return "stable";
}

export const personalizationService = {
  async recordAnalysis(
    analysis: SpeechAnalysis,
  ): Promise<SpeechPersonalizationProfile> {
    const profile =
      (await personalizationRepository.get()) as
        PersistentSpeechPersonalizationProfile;

    const recordedAt = new Date().toISOString();

    if (analysis.personalizedExercise) {
      profile.personalizedExercise = analysis.personalizedExercise;
    }

    profile.severityHistory.push({
      score: analysis.overallSeverityScore,
      recordedAt,
    });

    for (const target of analysis.targetWords ?? []) {
      const word = target.word.trim().toLowerCase();
      if (!word) continue;

      const existing = profile.difficultWords.find(
        (item) => item.word.toLowerCase() === word,
      );

      if (!existing) {
        profile.difficultWords.push({
          word,
          timesDetected: 1,
          averageScore: target.score,
          lastDetectedAt: recordedAt,
          trend: "stable",
        });
        continue;
      }

      const previousAverage = existing.averageScore;
      existing.timesDetected += 1;
      existing.averageScore =
        (previousAverage * (existing.timesDetected - 1) +
          target.score) /
        existing.timesDetected;
      existing.lastDetectedAt = recordedAt;
      existing.trend = calculateTrend(previousAverage, target.score);
    }

    if (analysis.dominantDisfluencyType) {
      const pattern = analysis.dominantDisfluencyType;
      if (!profile.dominantPatterns.includes(pattern)) {
        profile.dominantPatterns.push(pattern);
      }
    }

    profile.severityHistory = profile.severityHistory.slice(-100);
    profile.difficultWords = profile.difficultWords
      .sort((a, b) => {
        if (b.timesDetected !== a.timesDetected) {
          return b.timesDetected - a.timesDetected;
        }
        return b.averageScore - a.averageScore;
      })
      .slice(0, 50);

    return personalizationRepository.save(profile);
  },

  async getProfile(): Promise<PersistentSpeechPersonalizationProfile> {
    return (await personalizationRepository.get()) as
      PersistentSpeechPersonalizationProfile;
  },
};
