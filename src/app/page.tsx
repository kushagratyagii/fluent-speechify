"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";

/** Entry point: straight to the dashboard, or into onboarding on first run. */
export default function RootPage() {
  const router = useRouter();
  const { ready, error, onboarded } = useAppData();

  useEffect(() => {
    if (!ready || error) return;
    router.replace(onboarded ? "/dashboard" : "/onboarding");
  }, [ready, error, onboarded, router]);

  if (error) {
    // AppShell (mounted for every other route) shows the full retry UI;
    // the splash screen just needs to stop pretending to load forever.
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground">
          F
        </span>
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load your data. Try reloading the page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground">
        F
      </span>
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}
