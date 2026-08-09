import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Compass className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="font-medium">Page not found</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          That page doesn&apos;t exist, or the link is out of date.
        </p>
      </div>
      <ButtonLink size="sm" href="/dashboard">
        Back to dashboard
      </ButtonLink>
    </div>
  );
}
