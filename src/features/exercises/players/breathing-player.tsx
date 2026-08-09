"use client";

import { motion } from "motion/react";
import type { PlayerProps } from "./types";

type PhaseName = "Breathe in" | "Hold" | "Breathe out" | "Rest";

interface Phase {
  name: PhaseName;
  seconds: number;
  /** Circle scale reached at the end of this phase. */
  to: number;
}

const MIN_SCALE = 0.55;
const MAX_SCALE = 1;

function buildCycle(pattern: {
  inhale: number;
  hold: number;
  exhale: number;
  holdOut?: number;
}): Phase[] {
  const phases: Phase[] = [
    { name: "Breathe in", seconds: pattern.inhale, to: MAX_SCALE },
  ];
  if (pattern.hold > 0) {
    phases.push({ name: "Hold", seconds: pattern.hold, to: MAX_SCALE });
  }
  phases.push({ name: "Breathe out", seconds: pattern.exhale, to: MIN_SCALE });
  if (pattern.holdOut && pattern.holdOut > 0) {
    phases.push({ name: "Rest", seconds: pattern.holdOut, to: MIN_SCALE });
  }
  return phases;
}

/** Locates the current phase and how far through it we are. */
function resolvePhase(phases: Phase[], elapsed: number) {
  const cycleLength = phases.reduce((sum, p) => sum + p.seconds, 0);
  const t = elapsed % cycleLength;

  let acc = 0;
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    if (t < acc + phase.seconds) {
      const from = i === 0 ? phases[phases.length - 1].to : phases[i - 1].to;
      const ratio = (t - acc) / phase.seconds;
      return {
        phase,
        index: i,
        remaining: phase.seconds - (t - acc),
        scale: from + (phase.to - from) * ratio,
        cycleNumber: Math.floor(elapsed / cycleLength) + 1,
      };
    }
    acc += phase.seconds;
  }

  const last = phases[phases.length - 1];
  return {
    phase: last,
    index: phases.length - 1,
    remaining: 0,
    scale: last.to,
    cycleNumber: Math.floor(elapsed / cycleLength) + 1,
  };
}

export function BreathingPlayer({ config, timer }: PlayerProps) {
  const pattern = config.pattern ?? { inhale: 4, hold: 2, exhale: 4 };
  const phases = buildCycle(pattern);
  const { phase, remaining, scale, cycleNumber } = resolvePhase(
    phases,
    timer.elapsed,
  );
  const idle = !timer.running && timer.elapsed === 0;

  return (
    <div className="flex flex-col items-center gap-8 py-4">
      <div className="relative grid size-64 place-items-center sm:size-72">
        {/* Static outer ring marks the full-inhale size. */}
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/20" />

        <motion.div
          className="absolute rounded-full bg-primary/15"
          style={{ width: "100%", height: "100%" }}
          animate={{ scale: idle ? MIN_SCALE : scale }}
          transition={{ duration: 0.12, ease: "linear" }}
        />
        <motion.div
          className="absolute rounded-full bg-primary/30"
          style={{ width: "72%", height: "72%" }}
          animate={{ scale: idle ? MIN_SCALE : scale }}
          transition={{ duration: 0.12, ease: "linear" }}
        />

        <div className="relative z-10 text-center">
          <p className="text-xl font-semibold tracking-tight">
            {idle ? "Ready" : phase.name}
          </p>
          <p className="mt-1 text-4xl font-semibold tabular-nums text-primary">
            {idle ? "—" : Math.ceil(remaining)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-3 py-1">
          In {pattern.inhale}s
        </span>
        {pattern.hold > 0 ? (
          <span className="rounded-full bg-muted px-3 py-1">
            Hold {pattern.hold}s
          </span>
        ) : null}
        <span className="rounded-full bg-muted px-3 py-1">
          Out {pattern.exhale}s
        </span>
        {pattern.holdOut ? (
          <span className="rounded-full bg-muted px-3 py-1">
            Rest {pattern.holdOut}s
          </span>
        ) : null}
        {!idle ? (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
            Cycle {cycleNumber}
          </span>
        ) : null}
      </div>
    </div>
  );
}
