"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { PlayerProps } from "./types";

/**
 * Cycles through syllables or words. Each item holds the screen for
 * `itemSeconds`, split into `reps` evenly spaced beats.
 */
export function RepetitionPlayer({ exercise, config, timer }: PlayerProps) {
  const items = exercise.content?.items ?? [];
  if (items.length === 0) return null;

  const itemSeconds = config.itemSeconds ?? 6;
  const reps = Math.max(1, config.reps ?? 3);
  const beatSeconds = itemSeconds / reps;

  const idle = !timer.running && timer.elapsed === 0;
  const itemIndex = Math.floor(timer.elapsed / itemSeconds) % items.length;
  const timeInItem = timer.elapsed % itemSeconds;
  const beat = Math.min(reps - 1, Math.floor(timeInItem / beatSeconds));
  const beatProgress = (timeInItem % beatSeconds) / beatSeconds;

  const current = idle ? items[0] : items[itemIndex];

  return (
    <div className="space-y-6">
      <div className="relative grid min-h-56 place-items-center overflow-hidden rounded-2xl border bg-linear-to-br from-primary/10 to-transparent p-8">
        <AnimatePresence mode="wait">
          <motion.p
            key={`${current}-${idle}`}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.2 }}
            className="text-center text-5xl font-semibold tracking-tight sm:text-6xl"
          >
            {current}
          </motion.p>
        </AnimatePresence>

        {/* Beat pulse: one dot lights up per repetition. */}
        <div className="absolute bottom-6 flex gap-2">
          {Array.from({ length: reps }, (_, i) => (
            <motion.span
              key={i}
              className={cn(
                "size-2.5 rounded-full",
                !idle && i === beat ? "bg-primary" : "bg-primary/25",
              )}
              animate={
                !idle && i === beat
                  ? { scale: 1 + (1 - beatProgress) * 0.6 }
                  : { scale: 1 }
              }
              transition={{ duration: 0.12, ease: "linear" }}
            />
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {idle
          ? `Say each item ${reps} times, slowly.`
          : `Repetition ${beat + 1} of ${reps} · item ${itemIndex + 1} of ${items.length}`}
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        {items.map((item, i) => (
          <span
            key={item}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              !idle && i === itemIndex
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
