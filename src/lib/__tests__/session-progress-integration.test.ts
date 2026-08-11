import { beforeEach, describe, expect, it } from "vitest";
import { sessionService } from "@/lib/services/session.service";
import { progressService } from "@/lib/services/progress.service";
import { planService } from "@/lib/services/plan.service";
import { authService } from "@/lib/services/auth.service";
import { profileRepository, assessmentRepository } from "@/lib/repositories/profile.repository";
import { toDateKey } from "@/utils/date";
import type { Assessment, Profile } from "@/types";

const PROFILE: Profile = {
  id: "local",
  name: "Asha Verma",
  age: 24,
  gender: "female",
  preferredLanguage: "en",
  nativeLanguage: "hi",
  country: "IN",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const ASSESSMENT: Assessment = {
  id: "assess_1",
  profileId: "local",
  difficulties: ["stammering"],
  severity: "mild",
  situations: ["office"],
  goals: ["reduce_stammering"],
  createdAt: new Date().toISOString(),
};

describe("session -> progress -> plan integration", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    // Practice data is scoped to the signed-in account, so every test needs
    // one — this mirrors AppShell's real auth gate.
    await authService.signUp({ name: "Asha Verma", email: "asha@example.com", password: "password123" });
  });

  it("does not credit a session shorter than 10 seconds", async () => {
    const result = await sessionService.complete({
      exerciseId: "ex-deep-breathing",
      difficulty: "beginner",
      elapsedSeconds: 5,
      targetSeconds: 120,
      startedAt: new Date().toISOString(),
    });
    expect(result).toBeNull();

    const stats = await progressService.getStats();
    expect(stats.totalSessions).toBe(0);
  });

  it("persists a completed session and rolls XP, streak and stats forward", async () => {
    const summary = await sessionService.complete({
      exerciseId: "ex-deep-breathing",
      difficulty: "beginner",
      elapsedSeconds: 120, // full beginner duration -> 100% completion
      targetSeconds: 120,
      startedAt: new Date().toISOString(),
    });

    expect(summary).not.toBeNull();
    expect(summary!.exercisesCompleted).toBe(1);
    expect(summary!.xpEarned).toBe(20); // baseXp 20 * beginner(1) * ratio(1)
    expect(summary!.streak.current).toBe(1);

    // A fresh read of progressService (as a reloaded page would do) must see
    // the same numbers purely from what's stored in localStorage.
    const stats = await progressService.getStats();
    expect(stats.totalSessions).toBe(1);
    expect(stats.exercisesCompleted).toBe(1);
    expect(stats.totalXp).toBe(20);
    expect(stats.streak.current).toBe(1);
  });

  it("marks a partially completed session as not-done and awards proportional XP", async () => {
    const summary = await sessionService.complete({
      exerciseId: "ex-deep-breathing",
      difficulty: "beginner",
      elapsedSeconds: 60, // half of the 120s target -> below the 90% completion bar
      targetSeconds: 120,
      startedAt: new Date().toISOString(),
    });

    expect(summary!.exercisesCompleted).toBe(0);
    expect(summary!.xpEarned).toBe(10); // proportional XP still awarded
    // An incomplete session should not start a streak.
    expect(summary!.streak.current).toBe(0);
  });

  it("reflects a completed exercise in today's plan status", async () => {
    await profileRepository.save(PROFILE);
    await assessmentRepository.save(ASSESSMENT);

    const before = await planService.getTodayStatus();
    expect(before.completedCount).toBe(0);

    const firstItem = before.items[0];
    await sessionService.complete({
      exerciseId: firstItem.exerciseId,
      difficulty: firstItem.difficulty,
      elapsedSeconds: firstItem.durationSeconds,
      targetSeconds: firstItem.durationSeconds,
      startedAt: new Date().toISOString(),
    });

    const after = await planService.getTodayStatus();
    expect(after.completedCount).toBe(1);
    expect(after.items.find((i) => i.exerciseId === firstItem.exerciseId)?.completed).toBe(true);
  });

  it("generates the same plan again on the same day (deterministic, not re-rolled)", async () => {
    await profileRepository.save(PROFILE);
    await assessmentRepository.save(ASSESSMENT);

    const dateKey = toDateKey();
    const first = await planService.getOrCreateForDate(dateKey);
    const second = await planService.getOrCreateForDate(dateKey);
    expect(second.items.map((i) => i.exerciseId)).toEqual(
      first.items.map((i) => i.exerciseId),
    );
  });

  it("keeps each account's practice data completely separate", async () => {
    // Asha (signed up in beforeEach) completes a session.
    await sessionService.complete({
      exerciseId: "ex-deep-breathing",
      difficulty: "beginner",
      elapsedSeconds: 120,
      targetSeconds: 120,
      startedAt: new Date().toISOString(),
    });
    expect((await progressService.getStats()).totalXp).toBe(20);

    // A second account, on the same device, must start completely fresh —
    // this is the exact bug report: a new sign-up must not inherit another
    // account's XP/streak/history.
    await authService.logout();
    await authService.signUp({ name: "Rohan", email: "rohan@example.com", password: "password123" });
    const rohanStats = await progressService.getStats();
    expect(rohanStats.totalXp).toBe(0);
    expect(rohanStats.totalSessions).toBe(0);
    expect(rohanStats.streak.current).toBe(0);

    // And logging back into Asha's account must still show her own data.
    await authService.logout();
    await authService.login({ email: "asha@example.com", password: "password123" });
    expect((await progressService.getStats()).totalXp).toBe(20);
  });
});
