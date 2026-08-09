"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { gamificationService } from "@/lib/services/gamification.service";
import { useAppData } from "@/hooks/use-app-data";
import type { Achievement } from "@/types";

export function AchievementsView() {
  const { stats } = useAppData();
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    void gamificationService.listAchievements().then(setAchievements);
  }, [stats]);

  const unlocked = achievements.filter((a) => a.unlockedAt);
  const locked = achievements.filter((a) => !a.unlockedAt);

  return (
    <PageContainer>
      <PageHeader
        title="Achievements"
        subtitle={`${unlocked.length} of ${achievements.length} unlocked`}
      />

      {stats ? (
        <Card className="border-primary/25 bg-linear-to-br from-primary/10 to-transparent">
          <CardHeader>
            <CardTitle>
              Level {stats.level.level} · {stats.level.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats.totalXp} XP earned in total</span>
              <span className="tabular-nums">
                {stats.level.xpIntoLevel} / {stats.level.xpForNextLevel} XP to
                level {stats.level.level + 1}
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
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        {[...unlocked, ...locked].map((achievement, i) => {
          const isUnlocked = Boolean(achievement.unlockedAt);
          return (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.25), duration: 0.25 }}
            >
              <Card
                className={cn(
                  "h-full gap-0 p-4",
                  isUnlocked
                    ? "border-primary/30 bg-primary/5"
                    : "border-dashed bg-muted/20",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-xl text-xl",
                      isUnlocked ? "bg-primary/15" : "bg-muted",
                    )}
                  >
                    {isUnlocked ? (
                      achievement.icon
                    ) : (
                      <Lock className="size-4 text-muted-foreground" />
                    )}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        !isUnlocked && "text-muted-foreground",
                      )}
                    >
                      {achievement.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {achievement.description}
                    </p>
                    {achievement.unlockedAt ? (
                      <p className="pt-1 text-[11px] text-primary">
                        Unlocked{" "}
                        {new Date(achievement.unlockedAt).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </section>
    </PageContainer>
  );
}
