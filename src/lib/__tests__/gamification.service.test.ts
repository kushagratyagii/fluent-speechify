import { describe, expect, it } from "vitest";
import { gamificationService } from "@/lib/services/gamification.service";
import type { Streak } from "@/types";

describe("calculateXp", () => {
  it("scales with difficulty multiplier", () => {
    const beginner = gamificationService.calculateXp(100, "beginner", 1);
    const intermediate = gamificationService.calculateXp(100, "intermediate", 1);
    const advanced = gamificationService.calculateXp(100, "advanced", 1);
    expect(beginner).toBe(100);
    expect(intermediate).toBe(135);
    expect(advanced).toBe(175);
  });

  it("scales with completion ratio", () => {
    expect(gamificationService.calculateXp(100, "beginner", 0.5)).toBe(50);
    expect(gamificationService.calculateXp(100, "beginner", 0)).toBe(0);
  });

  it("awards at least 1 xp for any non-zero completion", () => {
    expect(gamificationService.calculateXp(1, "beginner", 0.01)).toBeGreaterThanOrEqual(1);
  });

  it("clamps completion ratio to [0, 1]", () => {
    expect(gamificationService.calculateXp(100, "beginner", 5)).toBe(100);
    expect(gamificationService.calculateXp(100, "beginner", -1)).toBe(0);
  });
});

describe("getLevel", () => {
  it("starts at level 1 with 0 xp", () => {
    const level = gamificationService.getLevel(0);
    expect(level.level).toBe(1);
    expect(level.xpIntoLevel).toBe(0);
    expect(level.xpForNextLevel).toBe(100);
  });

  it("advances a level once the threshold for level n (100n) is reached", () => {
    const level = gamificationService.getLevel(100);
    expect(level.level).toBe(2);
    expect(level.xpIntoLevel).toBe(0);
  });

  it("carries remaining xp into the current level", () => {
    const level = gamificationService.getLevel(150);
    expect(level.level).toBe(2);
    expect(level.xpIntoLevel).toBe(50);
    expect(level.xpForNextLevel).toBe(200);
  });

  it("never reports a title past the defined list", () => {
    const level = gamificationService.getLevel(100_000);
    expect(level.title).toBeTruthy();
  });
});

describe("advanceStreak", () => {
  const base: Streak = { current: 0, longest: 0, lastPracticeDate: null };

  it("starts a new streak at 1 on the first practice day", () => {
    const next = gamificationService.advanceStreak(base, "2026-01-01");
    expect(next).toEqual({ current: 1, longest: 1, lastPracticeDate: "2026-01-01" });
  });

  it("increments on a consecutive day", () => {
    const day1 = gamificationService.advanceStreak(base, "2026-01-01");
    const day2 = gamificationService.advanceStreak(day1, "2026-01-02");
    expect(day2.current).toBe(2);
    expect(day2.longest).toBe(2);
  });

  it("is a no-op for a repeated same-day practice", () => {
    const day1 = gamificationService.advanceStreak(base, "2026-01-01");
    const again = gamificationService.advanceStreak(day1, "2026-01-01");
    expect(again).toBe(day1);
  });

  it("resets to 1 after a gap, but keeps the longest record", () => {
    const day1 = gamificationService.advanceStreak(base, "2026-01-01");
    const day2 = gamificationService.advanceStreak(day1, "2026-01-02");
    const day3 = gamificationService.advanceStreak(day2, "2026-01-03");
    // Skip several days
    const resumed = gamificationService.advanceStreak(day3, "2026-01-10");
    expect(resumed.current).toBe(1);
    expect(resumed.longest).toBe(3);
  });
});

describe("normalizeStreak", () => {
  it("keeps a streak alive if last practice was today", () => {
    const streak: Streak = { current: 5, longest: 5, lastPracticeDate: "2026-01-10" };
    expect(gamificationService.normalizeStreak(streak, "2026-01-10").current).toBe(5);
  });

  it("keeps a streak alive if last practice was yesterday", () => {
    const streak: Streak = { current: 5, longest: 5, lastPracticeDate: "2026-01-09" };
    expect(gamificationService.normalizeStreak(streak, "2026-01-10").current).toBe(5);
  });

  it("resets a stale streak (gap of 2+ days) to zero, keeping longest", () => {
    const streak: Streak = { current: 5, longest: 5, lastPracticeDate: "2026-01-01" };
    const normalized = gamificationService.normalizeStreak(streak, "2026-01-10");
    expect(normalized.current).toBe(0);
    expect(normalized.longest).toBe(5);
  });

  it("leaves a never-practiced streak untouched", () => {
    const streak: Streak = { current: 0, longest: 0, lastPracticeDate: null };
    expect(gamificationService.normalizeStreak(streak, "2026-01-10")).toBe(streak);
  });
});
