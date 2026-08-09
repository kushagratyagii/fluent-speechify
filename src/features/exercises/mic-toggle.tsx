"use client";

import { Loader2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MicToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled: boolean;
  /** True while the one-time backend health check is in flight. */
  checkingAvailability: boolean;
  /** False if the analysis backend didn't respond to /health. */
  available: boolean;
}

/**
 * Opt-in control for recording the session's audio for stammering
 * analysis. Off by default -- this uploads the user's voice to a separate
 * backend service, so it should never turn on without an explicit tap.
 */
export function MicToggle({
  enabled,
  onToggle,
  disabled,
  checkingAvailability,
  available,
}: MicToggleProps) {
  if (checkingAvailability) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Checking voice analysis availability…
      </div>
    );
  }

  if (!available) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MicOff className="size-3.5" />
        Voice analysis isn&apos;t available right now.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onToggle(!enabled)}
        className={cn(
          "gap-2",
          enabled && "border-primary bg-primary/10 text-primary",
        )}
        aria-pressed={enabled}
      >
        {enabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        {enabled ? "Voice analysis on" : "Analyze my voice"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {enabled
          ? "Your voice will be recorded during this exercise and analyzed for stammering patterns. Nothing is saved beyond this session's results."
          : "Optional — records this exercise and gives you feedback on fluency patterns."}
      </p>
    </div>
  );
}
