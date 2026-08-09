"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { DayActivity } from "@/types";
import { fromDateKey, toDateKey } from "@/utils/date";

/**
 * Sequential single-hue heatmap: one hue, light to dark by magnitude. Empty
 * days use the neutral surface so "none" never reads as a low value.
 */
const STEPS = [
  "bg-primary/15",
  "bg-primary/35",
  "bg-primary/55",
  "bg-primary/75",
  "bg-primary",
];

function stepFor(minutes: number, peak: number): string | null {
  if (minutes <= 0) return null;
  const ratio = minutes / Math.max(peak, 1);
  const index = Math.min(STEPS.length - 1, Math.floor(ratio * STEPS.length));
  return STEPS[index];
}

export function PracticeCalendar({ days }: { days: DayActivity[] }) {
  const peak = Math.max(1, ...days.map((d) => d.minutes));
  const todayKey = toDateKey();

  // Pad the front so the first column starts on a Monday.
  const leadingBlanks = useMemo(() => {
    if (days.length === 0) return 0;
    const first = fromDateKey(days[0].date);
    return (first.getDay() + 6) % 7;
  }, [days]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1.5">
        {["M", "T", "W", "T", "F", "S", "S"].map((label, i) => (
          <span
            key={`${label}-${i}`}
            className="text-center text-[10px] font-medium text-muted-foreground"
          >
            {label}
          </span>
        ))}

        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}

        {days.map((day) => {
          const step = stepFor(day.minutes, peak);
          return (
            <div
              key={day.date}
              title={`${day.date}: ${day.minutes} min`}
              className={cn(
                "aspect-square rounded-md border border-transparent transition-colors",
                step ?? "bg-muted",
                day.date === todayKey && "border-primary",
              )}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        <span>Less</span>
        <span className="size-3 rounded-sm bg-muted" />
        {STEPS.map((step) => (
          <span key={step} className={cn("size-3 rounded-sm", step)} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
