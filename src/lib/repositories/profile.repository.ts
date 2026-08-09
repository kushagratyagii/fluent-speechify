import { StorageKeys } from "@/lib/db/keys";
import { getStorage } from "@/lib/db/storage";
import type { Assessment, Profile } from "@/types";

export const profileRepository = {
  async get(): Promise<Profile | null> {
    return getStorage().get<Profile>(StorageKeys.profile);
  },

  async save(profile: Profile): Promise<Profile> {
    await getStorage().set(StorageKeys.profile, profile);
    return profile;
  },

  async clear(): Promise<void> {
    await getStorage().remove(StorageKeys.profile);
  },
};

export const assessmentRepository = {
  async get(): Promise<Assessment | null> {
    return getStorage().get<Assessment>(StorageKeys.assessment);
  },

  async save(assessment: Assessment): Promise<Assessment> {
    await getStorage().set(StorageKeys.assessment, assessment);
    return assessment;
  },

  async clear(): Promise<void> {
    await getStorage().remove(StorageKeys.assessment);
  },
};
