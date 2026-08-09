import { Loader2 } from "lucide-react";

/** Shown by Next.js while a route segment's chunk/data is still loading. */
export default function Loading() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
