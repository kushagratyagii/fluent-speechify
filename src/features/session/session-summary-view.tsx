"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { CheckCircle2, Clock, Flame, Home, Repeat, Zap } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/features/dashboard/stat-tiles";
import { lastSummary } from "@/features/exercises/session-store";
import { AnalysisCard } from "./analysis-card";
import { useAppData } from "@/hooks/use-app-data";
import type { SessionSummary } from "@/types";
import { formatDuration } from "@/utils/date";

export function SessionSummaryView() {
  const router = useRouter();
  const { today } = useAppData();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // sessionStorage is only readable after mount. `consume` is idempotent for
    // this page load, so re-running the effect cannot wipe the summary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSummary(lastSummary.consume());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded && !summary) router.replace("/dashboard");
  }, [loaded, summary, router]);

  if (!summary) return null;

  const levelProgress =
    (summary.level.xpIntoLevel / summary.level.xpForNextLevel) * 100;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-10 sm:px-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <span className="grid size-16 place-items-center rounded-full bg-primary/15 text-primary">
          <CheckCircle2 className="size-8" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          {summary.exercisesCompleted > 0
            ? "Session complete"
            : "Session logged"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {summary.exercisesCompleted > 0
            ? "Nice work. Your streak and XP are updated."
            : "Partial sessions still earn XP — come back and finish it later."}
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Duration"
          value={formatDuration(summary.durationSeconds)}
          icon={<Clock className="size-4" />}
        />
        <StatTile
          label="Exercises done"
          value={summary.exercisesCompleted}
          icon={<CheckCircle2 className="size-4" />}
        />
        <StatTile
          label="XP earned"
          value={`+${summary.xpEarned}`}
          icon={<Zap className="size-4" />}
          accent
        />
        <StatTile
          label="Streak"
          value={summary.streak.current}
          unit={summary.streak.current === 1 ? "day" : "days"}
          icon={<Flame className="size-4" />}
          accent={summary.streak.current > 0}
        />
      </div>

      <Card>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              Level {summary.level.level} · {summary.level.title}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {summary.level.xpIntoLevel} / {summary.level.xpForNextLevel} XP
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${levelProgress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </CardContent>
      </Card>

      {summary.analysis ? <AnalysisCard analysis={summary.analysis} /> : null}

      {summary.newAchievements.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            New achievement{summary.newAchievements.length > 1 ? "s" : ""}
          </h2>
          {summary.newAchievements.map((achievement, i) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
            >
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="flex items-center gap-3">
                  <span className="text-2xl">{achievement.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{achievement.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {achievement.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : null}

      {today && today.nextItem ? (
        <Card className="border-primary/25">
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                Next in today&apos;s plan
              </p>
              <p className="text-sm font-medium">
                {today.nextItem.exercise.title}
              </p>
            </div>
            <ButtonLink
              size="lg"
              href={`/exercises/${today.nextItem.exercise.slug}?difficulty=${today.nextItem.difficulty}`}
            >
              <Repeat className="size-4" />
              Keep going
            </ButtonLink>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-center gap-3">
        <ButtonLink variant="outline" size="lg" href="/dashboard">
          <Home className="size-4" />
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
