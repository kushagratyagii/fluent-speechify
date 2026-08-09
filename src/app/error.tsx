"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Next.js renders this in place of the segment that threw, for any error
 * not already caught closer to the source (e.g. AppShell's data-load error
 * state). It does not catch errors in the root layout itself — see
 * global-error.tsx for that.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="font-medium">Something went wrong</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This page hit an unexpected error. Your practice data is safe on
          this device — try again, or head back to the dashboard.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={reset}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
        <Button size="sm" variant="outline" onClick={() => (window.location.href = "/dashboard")}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
