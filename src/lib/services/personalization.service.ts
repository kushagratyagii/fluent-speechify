import { personalizationRepository } from "@/lib/repositories/personalization.repository";
import type {
  DifficultWord,
  SpeechAnalysis,
  SpeechPersonalizationProfile,
} from "@/types";

const TREND_EPSILON = 0.03;

function calculateTrend(
  previousScore: number | null,
  currentScore: number,
): DifficultWord["trend"] {
  if (previousScore === null) {
    return "stable";
  }

  if (currentScore < previousScore - TREND_EPSILON) {
    return "improving";
  }

  if (currentScore > previousScore + TREND_EPSILON) {
    return "worsening";
  }

  return "stable";
}

export const personalizationService = {
  async recordAnalysis(
    analysis: SpeechAnalysis,
  ): Promise<SpeechPersonalizationProfile> {
    const profile = await personalizationRepository.get();

    const recordedAt = new Date().toISOString();

    // ---------------------------------------------------------
    // 1. Store severity history
    // ---------------------------------------------------------

    profile.severityHistory.push({
      score: analysis.overallSeverityScore,
      recordedAt,
    });

    // ---------------------------------------------------------
    // 2. Update difficult-word history
    // ---------------------------------------------------------

    for (const target of analysis.targetWords) {
      const word = target.word.trim().toLowerCase();

      if (!word) {
        continue;
      }

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

      existing.trend = calculateTrend(
        previousAverage,
        target.score,
      );
    }

    // ---------------------------------------------------------
    // 3. Update dominant disfluency patterns
    // ---------------------------------------------------------

    if (analysis.dominantDisfluencyType) {
      const pattern = analysis.dominantDisfluencyType;

      if (!profile.dominantPatterns.includes(pattern)) {
        profile.dominantPatterns.push(pattern);
      }
    }

    // Keep the profile reasonably small.
    profile.severityHistory =
      profile.severityHistory.slice(-100);

    profile.difficultWords =
      profile.difficultWords
        .sort((a, b) => {
          if (b.timesDetected !== a.timesDetected) {
            return b.timesDetected - a.timesDetected;
          }

          return b.averageScore - a.averageScore;
        })
        .slice(0, 50);

    return personalizationRepository.save(profile);
  },

  async getProfile(): Promise<SpeechPersonalizationProfile> {
    return personalizationRepository.get();
  },
};