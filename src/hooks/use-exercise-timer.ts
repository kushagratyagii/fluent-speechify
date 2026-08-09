"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  totalSeconds: number;
  tickMs?: number;
}

/**
 * Wall-clock timer for exercise players.
 *
 * Elapsed time is derived from `Date.now()` rather than counted ticks, so a
 * backgrounded tab (where timers are throttled) still reports the real
 * practice duration when it comes back into focus.
 */
export function useExerciseTimer({ totalSeconds, tickMs = 100 }: Options) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);

  useEffect(() => {
    if (!running) return;

    const id = window.setInterval(() => {
      const base = accumulatedRef.current;
      const live = startedAtRef.current
        ? (Date.now() - startedAtRef.current) / 1000
        : 0;
      const next = base + live;

      if (next >= totalSeconds) {
        accumulatedRef.current = totalSeconds;
        startedAtRef.current = null;
        setElapsed(totalSeconds);
        setRunning(false);
        setFinished(true);
        return;
      }
      setElapsed(next);
    }, tickMs);

    return () => window.clearInterval(id);
  }, [running, totalSeconds, tickMs]);

  const start = useCallback(() => {
    if (finished) return;
    startedAtRef.current = Date.now();
    setRunning(true);
  }, [finished]);

  const pause = useCallback(() => {
    if (startedAtRef.current) {
      accumulatedRef.current += (Date.now() - startedAtRef.current) / 1000;
      startedAtRef.current = null;
    }
    setElapsed(accumulatedRef.current);
    setRunning(false);
  }, []);

  const toggle = useCallback(() => {
    if (running) pause();
    else start();
  }, [running, pause, start]);

  const reset = useCallback(() => {
    accumulatedRef.current = 0;
    startedAtRef.current = null;
    setElapsed(0);
    setRunning(false);
    setFinished(false);
  }, []);

  /** Ends the run early but keeps the elapsed time for partial XP. */
  const finishNow = useCallback(() => {
    pause();
    setFinished(true);
  }, [pause]);

  const remaining = Math.max(0, totalSeconds - elapsed);
  const progress = totalSeconds > 0 ? Math.min(1, elapsed / totalSeconds) : 0;

  return {
    elapsed,
    remaining,
    progress,
    running,
    finished,
    start,
    pause,
    toggle,
    reset,
    finishNow,
  };
}
