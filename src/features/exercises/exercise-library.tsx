"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Clock, Lock, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { exerciseCategories, exercises } from "@/data/exercises";
import { formatDuration } from "@/utils/date";

type CategoryFilter = "all" | string;

export function ExerciseLibrary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const visibleCategories = useMemo(
    () =>
      exerciseCategories.filter((c) =>
        exercises.some((e) => e.categoryId === c.id),
      ),
    [],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((exercise) => {
      if (category !== "all" && exercise.categoryId !== category) return false;
      if (!q) return true;
      return (
        exercise.title.toLowerCase().includes(q) ||
        exercise.summary.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  const available = results.filter((e) => e.phase === 1);
  const comingSoon = results.filter((e) => e.phase === 2);

  return (
    <PageContainer>
      <PageHeader
        title="Exercise library"
        subtitle="Pick any exercise, at any difficulty, whenever you like."
      />

      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises"
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <FilterChip
            active={category === "all"}
            onClick={() => setCategory("all")}
          >
            All
          </FilterChip>
          {visibleCategories.map((c) => (
            <FilterChip
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </FilterChip>
          ))}
        </div>
      </div>

      {available.length === 0 && comingSoon.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No exercises match that search.
        </p>
      ) : null}

      {available.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {available.map((exercise, i) => (
            <motion.div
              key={exercise.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.25 }}
            >
              <Link href={`/exercises/${exercise.slug}`} className="block h-full">
                <Card className="h-full gap-3 p-5 transition-all hover:border-primary/50 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold">{exercise.title}</h3>
                    <Badge variant="secondary" className="shrink-0">
                      {exerciseCategories.find((c) => c.id === exercise.categoryId)
                        ?.name ?? ""}
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {exercise.summary}
                  </p>
                  <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {formatDuration(
                        exercise.difficulties.beginner.durationSeconds,
                      )}
                      {" – "}
                      {formatDuration(
                        exercise.difficulties.advanced.durationSeconds,
                      )}
                    </span>
                    <span>·</span>
                    <span>{exercise.baseXp} XP base</span>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </section>
      ) : null}

      {comingSoon.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Coming in the next phase
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {comingSoon.map((exercise) => (
              <Card
                key={exercise.id}
                className="gap-2 border-dashed bg-muted/20 p-5 opacity-70"
              >
                <div className="flex items-center gap-2">
                  <Lock className="size-3.5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">{exercise.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {exercise.summary}
                </p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </PageContainer>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
