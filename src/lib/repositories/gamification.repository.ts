import { StorageKeys } from "@/lib/db/keys";
import { getStorage } from "@/lib/db/storage";
import type { Achievement, Streak } from "@/types";

const EMPTY_STREAK: Streak = { current: 0, longest: 0, lastPracticeDate: null };

export const streakRepository = {
  async get(): Promise<Streak> {
    return (await getStorage().get<Streak>(StorageKeys.streak)) ?? EMPTY_STREAK;
  },

  async save(streak: Streak): Promise<Streak> {
    await getStorage().set(StorageKeys.streak, streak);
    return streak;
  },
};

/** Stores unlock timestamps only; titles and copy come from the catalogue. */
export const achievementRepository = {
  async getUnlocks(): Promise<Record<string, string>> {
    return (
      (await getStorage().get<Record<string, string>>(
        StorageKeys.achievements,
      )) ?? {}
    );
  },

  async saveUnlocks(unlocks: Record<string, string>): Promise<void> {
    await getStorage().set(StorageKeys.achievements, unlocks);
  },
};

export type { Achievement };
