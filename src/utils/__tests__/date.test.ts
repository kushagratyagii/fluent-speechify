import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatClock,
  formatDuration,
  fromDateKey,
  lastNDays,
  startOfWeek,
  toDateKey,
} from "@/utils/date";

describe("toDateKey / fromDateKey", () => {
  it("round-trips a date through a key without a timezone shift", () => {
    const date = new Date(2026, 0, 15); // Jan 15 2026, local time
    const key = toDateKey(date);
    expect(key).toBe("2026-01-15");
    expect(toDateKey(fromDateKey(key))).toBe(key);
  });

  it("pads single-digit months and days", () => {
    expect(toDateKey(new Date(2026, 2, 4))).toBe("2026-03-04");
  });
});

describe("addDays / daysBetween", () => {
  it("adds and subtracts days correctly", () => {
    const start = fromDateKey("2026-01-30");
    expect(toDateKey(addDays(start, 3))).toBe("2026-02-02");
    expect(toDateKey(addDays(start, -30))).toBe("2025-12-31");
  });

  it("counts whole days between two keys", () => {
    expect(daysBetween("2026-01-01", "2026-01-02")).toBe(1);
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
    expect(daysBetween("2026-01-05", "2026-01-01")).toBe(-4);
  });
});

describe("startOfWeek", () => {
  it("returns the Monday of the given week", () => {
    // Thursday Jan 15 2026 -> Monday Jan 12 2026
    const monday = startOfWeek(new Date(2026, 0, 15));
    expect(toDateKey(monday)).toBe("2026-01-12");
  });

  it("returns the same date when already Monday", () => {
    const monday = startOfWeek(new Date(2026, 0, 12));
    expect(toDateKey(monday)).toBe("2026-01-12");
  });
});

describe("lastNDays", () => {
  it("returns n days ending on the given date, oldest first", () => {
    const days = lastNDays(3, new Date(2026, 0, 15));
    expect(days).toEqual(["2026-01-13", "2026-01-14", "2026-01-15"]);
  });
});

describe("formatDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(90)).toBe("1m 30s");
    expect(formatDuration(120)).toBe("2m");
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(3900)).toBe("1h 5m");
  });

  it("never goes negative", () => {
    expect(formatDuration(-10)).toBe("0s");
  });
});

describe("formatClock", () => {
  it("formats mm:ss with leading zeros", () => {
    expect(formatClock(5)).toBe("00:05");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(600)).toBe("10:00");
  });
});
