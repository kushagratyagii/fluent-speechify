import { StorageKeys } from "@/lib/db/keys";
import { getStorage } from "@/lib/db/storage";
import { requireCurrentAccountId } from "@/lib/repositories/account.repository";
import type { SpeechPersonalizationProfile } from "@/types";

const createEmptyProfile = (
  accountId: string,
): SpeechPersonalizationProfile => ({
  userId: accountId,
  difficultWords: [],
  severityHistory: [],
  dominantPatterns: [],
});

export const personalizationRepository = {
  async get(): Promise<SpeechPersonalizationProfile> {
    const accountId = await requireCurrentAccountId();

    const profile = await getStorage().get<SpeechPersonalizationProfile>(
      StorageKeys.personalization(accountId),
    );

    return profile ?? createEmptyProfile(accountId);
  },

  async save(
    profile: SpeechPersonalizationProfile,
  ): Promise<SpeechPersonalizationProfile> {
    const accountId = await requireCurrentAccountId();

    await getStorage().set(
      StorageKeys.personalization(accountId),
      profile,
    );

    return profile;
  },

  async clear(): Promise<void> {
    const accountId = await requireCurrentAccountId();

    await getStorage().remove(
      StorageKeys.personalization(accountId),
    );
  },
};