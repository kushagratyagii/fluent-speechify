"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selectable card used across onboarding and exercise setup. Renders as a
 * real button with `aria-pressed` so it stays keyboard and screen-reader
 * friendly without pulling in a headless primitive.
 */
export function ChoiceCard({
  selected,
  onSelect,
  title,
  hint,
  emoji,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  hint?: string;
  emoji?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all",
        "hover:border-primary/50 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected
          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/25"
          : "border-border",
        className,
      )}
    >
      {emoji ? <span className="text-xl leading-none">{emoji}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30",
        )}
      >
        {selected ? <Check className="size-3.5" /> : null}
      </span>
    </button>
  );
}

/** Compact pill variant for dense option grids. */
export function ChoiceChip({
  selected,
  onSelect,
  children,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-all",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function NativeSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full appearance-none rounded-lg border border-input bg-card px-3 text-sm",
        "bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-9",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22gray%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')]",
        className,
      )}
      {...props}
    />
  );
}
