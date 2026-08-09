import type { SessionSummary } from "@/types";

const KEY = "speech-therapy:last-summary";

/**
 * Holds the value after it has been taken out of sessionStorage, so repeated
 * reads within the same page lifetime (React re-running mount effects in
 * development, a component remount) see the same summary instead of nothing.
 * A full reload clears it, which is what stops an old celebration replaying.
 */
let consumed: SessionSummary | null = null;

/** Hands the just-finished summary to the summary screen. */
export const lastSummary = {
  set(summary: SessionSummary) {
    consumed = null;
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(summary));
    } catch {
      // Storage can be unavailable in private mode; fall back to memory only.
      consumed = summary;
    }
  },

  /** Reads the summary and removes it from storage. Idempotent per page load. */
  consume(): SessionSummary | null {
    if (consumed) return consumed;
    try {
      const raw = window.sessionStorage.getItem(KEY);
      window.sessionStorage.removeItem(KEY);
      consumed = raw ? (JSON.parse(raw) as SessionSummary) : null;
    } catch {
      consumed = null;
    }
    return consumed;
  },
};
