"use client";

import { useEffect, useState } from "react";
import { Clock, Dumbbell, Flame, Timer, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/features/dashboard/stat-tiles";
import {
  PracticeBarChart,
  dayOfMonthLabel,
  weekdayLabel,
} from "./practice-charts";
import { PracticeCalendar } from "./practice-calendar";
import { ProgressSkeleton } from "./progress-skeleton";
import { cn } from "@/lib/utils";
import { progressService } from "@/lib/services/progress.service";
import { useAppData } from "@/hooks/use-app-data";
import type { DayActivity } from "@/types";
import { formatDuration } from "@/utils/date";

type Range = "week" | "month";

interface Breakdown {
  exerciseId: string;
  title: string;
  minutes: number;
  count: number;
}

export function ProgressView() {
  const { stats } = useAppData();
  const [range, setRange] = useState<Range>("week");
  const [week, setWeek] = useState<DayActivity[]>([]);
  const [month, setMonth] = useState<DayActivity[]>([]);
  const [breakdown, setBreakdown] = useState<Breakdown[]>([]);

  useEffect(() => {
    void Promise.all([
      progressService.getCurrentWeek(),
      progressService.getLastDays(35),
      progressService.getExerciseBreakdown(),
    ]).then(([w, m, b]) => {
      setWeek(w);
      setMonth(m);
      setBreakdown(b);
    });
  }, []);

  if (!stats) return <ProgressSkeleton />;

  const chartData = range === "week" ? week : month;
  const peakMinutes = Math.max(0, ...breakdown.map((b) => b.minutes));

  return (
    <PageContainer>
      <PageHeader
        title="Progress"
        subtitle="Every completed session, tracked over time."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Total practice"
          value={formatDuration(stats.totalSeconds)}
          icon={<Clock className="size-4" />}
        />
        <StatTile
          label="Exercises done"
          value={stats.exercisesCompleted}
          icon={<Dumbbell className="size-4" />}
        />
        <StatTile
          label="Average session"
          value={stats.averageSessionMinutes}
          unit="min"
          icon={<Timer className="size-4" />}
        />
        <StatTile
          label="Current streak"
          value={stats.streak.current}
          unit="days"
          icon={<Flame className="size-4" />}
          warm={stats.streak.current > 0}
        />
        <StatTile
          label="Longest streak"
          value={stats.streak.longest}
          unit="days"
          icon={<Trophy className="size-4" />}
          warm={stats.streak.longest > 0}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Minutes practised</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {range === "week" ? "This week, by day" : "The last 35 days"}
            </p>
          </div>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(["week", "month"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                  range === option
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <PracticeBarChart
            data={chartData}
            labelFormatter={range === "week" ? weekdayLabel : dayOfMonthLabel}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Practice calendar</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Last five weeks
            </p>
          </CardHeader>
          <CardContent>
            <PracticeCalendar days={month} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Where your time goes</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Minutes per exercise
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {breakdown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Complete an exercise to see the breakdown.
              </p>
            ) : (
              breakdown.map((row) => (
                <div key={row.exerciseId} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{row.title}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {row.minutes} min · {row.count}×
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${(row.minutes / Math.max(peakMinutes, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
