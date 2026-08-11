import { StorageKeys } from "@/lib/db/keys";
import { getStorage } from "@/lib/db/storage";
import { requireCurrentAccountId } from "@/lib/repositories/account.repository";
import type { Assessment, Profile } from "@/types";

export const profileRepository = {
  async get(): Promise<Profile | null> {
    const accountId = await requireCurrentAccountId();
    return getStorage().get<Profile>(StorageKeys.profile(accountId));
  },

  async save(profile: Profile): Promise<Profile> {
    const accountId = await requireCurrentAccountId();
    await getStorage().set(StorageKeys.profile(accountId), profile);
    return profile;
  },

  async clear(): Promise<void> {
    const accountId = await requireCurrentAccountId();
    await getStorage().remove(StorageKeys.profile(accountId));
  },
};

export const assessmentRepository = {
  async get(): Promise<Assessment | null> {
    const accountId = await requireCurrentAccountId();
    return getStorage().get<Assessment>(StorageKeys.assessment(accountId));
  },

  async save(assessment: Assessment): Promise<Assessment> {
    const accountId = await requireCurrentAccountId();
    await getStorage().set(StorageKeys.assessment(accountId), assessment);
    return assessment;
  },

  async clear(): Promise<void> {
    const accountId = await requireCurrentAccountId();
    await getStorage().remove(StorageKeys.assessment(accountId));
  },
};
