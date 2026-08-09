"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { planService, type TodayStatus } from "@/lib/services/plan.service";
import { profileService } from "@/lib/services/profile.service";
import { progressService } from "@/lib/services/progress.service";
import type { Assessment, Profile, ProgressStats } from "@/types";

interface AppData {
  ready: boolean;
  error: string | null;
  profile: Profile | null;
  assessment: Assessment | null;
  today: TodayStatus | null;
  stats: ProgressStats | null;
  onboarded: boolean;
  refresh: () => Promise<void>;
}

const AppDataContext = createContext<AppData | null>(null);

/**
 * Single client-side load of everything the shell needs. All reads go through
 * services, so swapping the storage adapter for an API client later touches
 * nothing in this file.
 */
export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [today, setToday] = useState<TodayStatus | null>(null);
  const [stats, setStats] = useState<ProgressStats | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);

      const [nextProfile, nextAssessment] = await Promise.all([
        profileService.getProfile(),
        profileService.getAssessment(),
      ]);
      setProfile(nextProfile);
      setAssessment(nextAssessment);

      // The plan is only meaningful once the assessment exists.
      if (nextProfile && nextAssessment) {
        const [nextToday, nextStats] = await Promise.all([
          planService.getTodayStatus(),
          progressService.getStats(),
        ]);
        setToday(nextToday);
        setStats(nextStats);
      } else {
        setToday(null);
        setStats(await progressService.getStats());
      }
      setReady(true);
    } catch (err) {
      // Storage can throw in private-browsing modes, when quota is exceeded,
      // or when a stored record no longer matches the expected shape after
      // an update. Surface it instead of leaving the shell stuck loading.
      console.error("Failed to load app data", err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong loading your data.",
      );
      setReady(true);
    }
  }, []);

  useEffect(() => {
    // Bootstrap read from device storage — an external system that is only
    // reachable after mount, so the state has to be filled in from an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const value = useMemo<AppData>(
    () => ({
      ready,
      error,
      profile,
      assessment,
      today,
      stats,
      onboarded: Boolean(profile && assessment),
      refresh,
    }),
    [ready, error, profile, assessment, today, stats, refresh],
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}
