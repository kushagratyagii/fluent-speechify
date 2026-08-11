"use client";

import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toDateKey } from "@/utils/date";

export function StatTile({
  label,
  value,
  unit,
  icon,
  accent,
  warm,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  accent?: boolean;
  /** Reserved for the streak/XP "spark" moments — use sparingly. */
  warm?: boolean;
}) {
  return (
    <Card
      className={cn(
        "gap-0 p-4",
        accent && !warm && "border-primary/30 bg-primary/5",
        warm && "border-warm/30 bg-warm/8",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        {icon ? (
          <span className={warm ? "text-warm" : "text-muted-foreground"}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-heading text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </span>
        {unit ? (
          <span className="text-xs text-muted-foreground">{unit}</span>
        ) : null}
      </div>
    </Card>
  );
}

/** Seven small bars, Monday-first, sized against the week's best day. */
export function WeekStrip({
  days,
  labels,
}: {
  days: { date: string; minutes: number }[];
  labels: string[];
}) {
  const peak = Math.max(1, ...days.map((d) => d.minutes));
  const todayKey = toDateKey();

  return (
    <div className="flex items-end gap-2">
      {days.map((day, i) => {
        const ratio = day.minutes / peak;
        const isToday = day.date === todayKey;
        return (
          <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-20 w-full items-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(6, ratio * 100)}%` }}
                transition={{ duration: 0.45, delay: i * 0.04, ease: "easeOut" }}
                className={cn(
                  "w-full rounded-md",
                  day.minutes > 0
                    ? "bg-primary"
                    : "bg-muted",
                  isToday && "ring-2 ring-primary/40 ring-offset-1 ring-offset-card",
                )}
                title={`${labels[i]}: ${day.minutes} min`}
              />
            </div>
            <span
              className={cn(
                "text-[10px] font-medium",
                isToday ? "text-primary" : "text-muted-foreground",
              )}
            >
              {labels[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
