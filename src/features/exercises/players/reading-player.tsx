"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { PlayerProps } from "./types";

/** A short beat between sentences so the reader can take a breath. */
const SENTENCE_PAUSE_SECONDS = 1.2;

function countWords(sentence: string): number {
  return sentence.trim().split(/\s+/).filter(Boolean).length;
}

export function ReadingPlayer({exercise,config,timer,personalizedPassage,}: PlayerProps) {
  const passages = personalizedPassage
  ? [personalizedPassage, ...(exercise.content?.passages ?? [])]
  : (exercise.content?.passages ?? []);
  const [passageId, setPassageId] = useState(passages[0]?.id ?? "");
  const [speed, setSpeed] = useState(1);

  const passage = passages.find((p) => p.id === passageId) ?? passages[0];

  const timeline = useMemo(() => {
    if (!passage) return { durations: [] as number[], total: 0 };
    const wpm = (config.wpm ?? 100) * speed;
    const durations = passage.sentences.map(
      (s) => (countWords(s) / wpm) * 60 + SENTENCE_PAUSE_SECONDS,
    );
    return { durations, total: durations.reduce((a, b) => a + b, 0) };
  }, [passage, config.wpm, speed]);

  if (!passage) return null;

  // The passage loops until the session timer runs out.
  const t = timeline.total > 0 ? timer.elapsed % timeline.total : 0;
  let acc = 0;
  let activeIndex = 0;
  let sentenceProgress = 0;
  for (let i = 0; i < timeline.durations.length; i++) {
    if (t < acc + timeline.durations[i]) {
      activeIndex = i;
      sentenceProgress = (t - acc) / timeline.durations[i];
      break;
    }
    acc += timeline.durations[i];
  }

  const idle = !timer.running && timer.elapsed === 0;
  const pass = Math.floor(timer.elapsed / Math.max(1, timeline.total)) + 1;

  return (
    <div className="space-y-6">
      {passages.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {passages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPassageId(p.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                p.id === passage.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p.title}
            </button>
          ))}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {passage.title}
          {!idle && pass > 1 ? ` · read ${pass}` : ""}
        </p>

        <div className="space-y-3">
          {passage.sentences.map((sentence, i) => {
            const isActive = !idle && i === activeIndex;
            const isDone = !idle && i < activeIndex;
            return (
              <div key={sentence} className="relative">
                <p
                  className={cn(
                    "text-lg leading-relaxed transition-colors sm:text-xl",
                    isActive && "font-medium text-foreground",
                    isDone && "text-muted-foreground/60",
                    !isActive && !isDone && "text-muted-foreground",
                  )}
                >
                  {sentence}
                </p>
                {isActive ? (
                  <motion.span
                    layoutId="reading-underline"
                    className="absolute -bottom-1 left-0 h-0.5 rounded-full bg-primary"
                    animate={{ width: `${sentenceProgress * 100}%` }}
                    transition={{ duration: 0.12, ease: "linear" }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-muted-foreground">Reading speed</span>
          <span className="tabular-nums text-primary">
            {Math.round((config.wpm ?? 100) * speed)} words / min
          </span>
        </div>
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.05}
          value={speed}
          aria-label="Reading speed"
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Slower</span>
          <span>Faster</span>
        </div>
      </div>
    </div>
  );
}
