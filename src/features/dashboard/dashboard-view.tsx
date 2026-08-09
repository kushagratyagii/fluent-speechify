"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  Play,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/page-header";
import { StatTile, WeekStrip } from "@/features/dashboard/stat-tiles";
import { useAppData } from "@/hooks/use-app-data";
import { GOAL_LABELS } from "@/lib/services/profile.service";
import { progressService } from "@/lib/services/progress.service";
import type { DayActivity } from "@/types";
import { WEEKDAY_LABELS, formatDuration } from "@/utils/date";

const DIFFICULTY_LABEL = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const;

export function DashboardView() {
  const { profile, assessment, today, stats } = useAppData();
  const [week, setWeek] = useState<DayActivity[]>([]);

  useEffect(() => {
    void progressService.getCurrentWeek().then(setWeek);
  }, [today]);

  if (!profile || !today || !stats) return null;

  const firstName = profile.name.split(" ")[0];
  const allDone = today.completedCount === today.totalCount;
  const nextExercise = today.nextItem?.exercise;
  const primaryGoal = assessment?.goals[0];

  return (
    <PageContainer>
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{greeting()}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {firstName}, {allDone ? "today is done." : "ready to practise?"}
        </h1>
      </header>

      {/* Continue / start session */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="overflow-hidden border-primary/25 bg-linear-to-br from-primary/10 to-transparent">
          <CardContent className="flex flex-wrap items-center justify-between gap-5">
            <div className="min-w-0 space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                {allDone ? "Session complete" : "Next up"}
              </p>
              <p className="text-lg font-semibold">
                {allDone
                  ? "You finished every exercise today"
                  : nextExercise?.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {allDone
                  ? "Practise more if you like — extra sessions still earn XP."
                  : nextExercise?.summary}
              </p>
            </div>

            <ButtonLink
              size="lg"
              className="shrink-0"
              href={
                nextExercise
                  ? `/exercises/${nextExercise.slug}?difficulty=${today.nextItem?.difficulty}`
                  : "/exercises"
              }
            >
              <Play className="size-4" />
              {allDone ? "Practise again" : "Continue session"}
            </ButtonLink>
          </CardContent>
        </Card>
      </motion.div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Current streak"
          value={stats.streak.current}
          unit={stats.streak.current === 1 ? "day" : "days"}
          icon={<Flame className="size-4" />}
          accent={stats.streak.current > 0}
        />
        <StatTile
          label="Practised today"
          value={today.minutesPracticed}
          unit="min"
          icon={<Clock className="size-4" />}
        />
        <StatTile
          label="Level"
          value={stats.level.level}
          unit={stats.level.title}
          icon={<Trophy className="size-4" />}
        />
        <StatTile
          label="Total XP"
          value={stats.totalXp}
          unit="xp"
          icon={<Zap className="size-4" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Today's plan */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Today&apos;s exercises</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {today.completedCount} of {today.totalCount} done ·{" "}
                {today.plannedMinutes} min planned
              </p>
            </div>
            <Badge variant={allDone ? "default" : "secondary"}>
              {Math.round((today.completedCount / today.totalCount) * 100)}%
            </Badge>
          </CardHeader>

          <CardContent className="space-y-2">
            {today.items.map((item, index) => (
              <motion.div
                key={item.exerciseId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.25 }}
              >
                <Link
                  href={`/exercises/${item.exercise.slug}?difficulty=${item.difficulty}`}
                  className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-accent/40"
                >
                  <span
                    className={
                      item.completed
                        ? "grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"
                        : "grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
                    }
                  >
                    {item.completed ? (
                      <CheckCircle2 className="size-5" />
                    ) : (
                      <Play className="size-4" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.exercise.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDuration(item.durationSeconds)} ·{" "}
                      {DIFFICULTY_LABEL[item.difficulty]}
                    </span>
                  </span>

                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {/* Weekly progress */}
          <Card>
            <CardHeader>
              <CardTitle>This week</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {week.reduce((sum, d) => sum + d.minutes, 0).toFixed(0)} minutes
                practised
              </p>
            </CardHeader>
            <CardContent>
              {week.length > 0 ? (
                <WeekStrip days={week} labels={WEEKDAY_LABELS} />
              ) : null}
            </CardContent>
          </Card>

          {/* Upcoming goal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="size-4 text-primary" />
                Your goal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">
                {primaryGoal ? GOAL_LABELS[primaryGoal] : "Build a daily habit"}
              </p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Level {stats.level.level}</span>
                  <span>
                    {stats.level.xpIntoLevel} / {stats.level.xpForNextLevel} XP
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(stats.level.xpIntoLevel / stats.level.xpForNextLevel) * 100}%`,
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Longest streak {stats.streak.longest} days ·{" "}
                {formatDuration(stats.totalSeconds)} practised in total
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
