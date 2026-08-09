"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GuidedStep } from "@/types";
import type { PlayerProps } from "./types";

/**
 * The catalogue defines step lengths for a nominal run; they are rescaled so
 * the sequence always fills exactly the selected difficulty's duration.
 */
function scaleSteps(steps: GuidedStep[], totalSeconds: number): GuidedStep[] {
  const nominal = steps.reduce((sum, s) => sum + s.seconds, 0);
  if (nominal === 0) return steps;
  const factor = totalSeconds / nominal;
  return steps.map((s) => ({ ...s, seconds: Math.max(5, s.seconds * factor) }));
}

function resolveStep(steps: GuidedStep[], elapsed: number) {
  let acc = 0;
  for (let i = 0; i < steps.length; i++) {
    if (elapsed < acc + steps[i].seconds) {
      return { index: i, remaining: acc + steps[i].seconds - elapsed };
    }
    acc += steps[i].seconds;
  }
  return { index: steps.length - 1, remaining: 0 };
}

export function GuidedPlayer({ exercise, config, timer }: PlayerProps) {
  const steps = scaleSteps(
    exercise.content?.steps ?? [],
    config.durationSeconds,
  );
  if (steps.length === 0) return null;

  const { index, remaining } = resolveStep(steps, timer.elapsed);
  const active = steps[index];
  const idle = !timer.running && timer.elapsed === 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-linear-to-br from-primary/10 to-transparent p-6 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-3 text-center"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              Step {index + 1} of {steps.length}
            </p>
            <h3 className="text-2xl font-semibold tracking-tight">
              {active.label}
            </h3>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
              {active.detail}
            </p>
            <p className="pt-2 text-4xl font-semibold tabular-nums text-primary">
              {idle ? "—" : Math.ceil(remaining)}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <ol className="space-y-1.5">
        {steps.map((step, i) => {
          const done = i < index;
          const current = i === index && !idle;
          return (
            <li
              key={step.label}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                current && "border-primary bg-primary/5 font-medium",
                done && "text-muted-foreground",
                !current && !done && "border-transparent bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border text-[10px]",
                  done && "border-primary bg-primary text-primary-foreground",
                  current && "border-primary text-primary",
                  !done && !current && "border-muted-foreground/30",
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              {step.label}
            </li>
          );
        })}
      </ol>

      {exercise.content?.tips?.length ? (
        <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          {exercise.content.tips.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
