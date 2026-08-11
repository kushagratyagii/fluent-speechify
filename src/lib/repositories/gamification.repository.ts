import { StorageKeys } from "@/lib/db/keys";
import { getStorage } from "@/lib/db/storage";
import { requireCurrentAccountId } from "@/lib/repositories/account.repository";
import type { Achievement, Streak } from "@/types";

const EMPTY_STREAK: Streak = { current: 0, longest: 0, lastPracticeDate: null };

export const streakRepository = {
  async get(): Promise<Streak> {
    const accountId = await requireCurrentAccountId();
    return (await getStorage().get<Streak>(StorageKeys.streak(accountId))) ?? EMPTY_STREAK;
  },

  async save(streak: Streak): Promise<Streak> {
    const accountId = await requireCurrentAccountId();
    await getStorage().set(StorageKeys.streak(accountId), streak);
    return streak;
  },
};

/** Stores unlock timestamps only; titles and copy come from the catalogue. */
export const achievementRepository = {
  async getUnlocks(): Promise<Record<string, string>> {
    const accountId = await requireCurrentAccountId();
    return (
      (await getStorage().get<Record<string, string>>(
        StorageKeys.achievements(accountId),
      )) ?? {}
    );
  },

  async saveUnlocks(unlocks: Record<string, string>): Promise<void> {
    const accountId = await requireCurrentAccountId();
    await getStorage().set(StorageKeys.achievements(accountId), unlocks);
  },
};

export type { Achievement };
