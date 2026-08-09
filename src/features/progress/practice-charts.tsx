"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DayActivity } from "@/types";
import { fromDateKey } from "@/utils/date";

const AXIS_STYLE = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
} as const;

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DayActivity & { label: string } }[];
}) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{day.label}</p>
      <p className="mt-1 text-muted-foreground">
        <span className="tabular-nums text-popover-foreground">
          {day.minutes}
        </span>{" "}
        min · {day.sessions} session{day.sessions === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/**
 * One measure (minutes), one series — so no legend, one hue, and the value
 * lives in the tooltip rather than on every bar.
 */
export function PracticeBarChart({
  data,
  labelFormatter,
  height = 220,
}: {
  data: DayActivity[];
  labelFormatter: (date: string) => string;
  height?: number;
}) {
  const rows = data.map((d) => ({ ...d, label: labelFormatter(d.date) }));
  const empty = rows.every((r) => r.minutes === 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={AXIS_STYLE}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          {/* Floor the scale at 5 minutes so a single short session does not
              produce a misleading full-height bar or a fractional axis. */}
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={AXIS_STYLE}
            width={44}
            allowDecimals={false}
            domain={[0, (max: number) => Math.max(5, Math.ceil(max))]}
            unit="m"
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          />
          <Bar dataKey="minutes" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {rows.map((row) => (
              <Cell
                key={row.date}
                fill={row.minutes > 0 ? "var(--primary)" : "var(--muted)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {empty ? (
        <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          No practice logged yet
        </p>
      ) : null}
    </div>
  );
}

export function weekdayLabel(dateKey: string): string {
  return fromDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

export function dayOfMonthLabel(dateKey: string): string {
  return String(fromDateKey(dateKey).getDate());
}
