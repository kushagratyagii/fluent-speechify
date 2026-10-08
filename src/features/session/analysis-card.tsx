import { AlertTriangle, BookOpen, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DisfluencyType, SpeechAnalysis } from "@/types";

const TYPE_LABEL: Record<DisfluencyType, string> = {
  block: "Blocks",
  prolongation: "Prolongations",
  sound_repetition: "Sound repetitions",
  word_repetition: "Word repetitions",
  interjection: "Interjections",
};

const BUCKET_STYLE: Record<string, string> = {
  mild: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30",
  moderate: "text-amber-600 bg-amber-500/10 border-amber-500/30",
  severe: "text-rose-600 bg-rose-500/10 border-rose-500/30",
};

export function AnalysisCard({
  analysis,
}: {
  analysis: SpeechAnalysis;
}) {
  const fluentPct = Math.round(analysis.overallFluentRatio * 100);

  const targetWords = analysis.targetWords ?? [];
  const exercise = analysis.personalizedExercise;

  const highlightWords = new Set(
    (exercise?.targetWords ?? []).map((word) => word.toLowerCase()),
  );

  const exerciseParts =
    exercise?.text.split(/(\b[\w'-]+\b)/g) ?? [];

  return (
    <Card>
      <CardContent className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Voice analysis</h2>

          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
              BUCKET_STYLE[analysis.overallSeverityBucket],
            )}
          >
            {analysis.overallSeverityBucket}
          </span>
        </div>

        {/* Main metrics */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Fluent</p>
            <p className="font-medium tabular-nums">
              {fluentPct}% of clip
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Severity score
            </p>
            <p className="font-medium tabular-nums">
              {Math.round(analysis.overallSeverityScore)} / 100
            </p>
          </div>
        </div>

        {/* Dominant pattern */}
        {analysis.dominantDisfluencyType ? (
          <p className="text-xs text-muted-foreground">
            Most common pattern:{" "}
            <span className="font-medium text-foreground">
              {TYPE_LABEL[analysis.dominantDisfluencyType]}
            </span>
          </p>
        ) : null}

        {/* Warnings */}
        {analysis.warnings.length > 0 ? (
          <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            {analysis.warnings.map((warning) => (
              <div
                key={warning}
                className="flex items-start gap-2 text-xs text-amber-700"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Target words */}
        {targetWords.length > 0 ? (
          <section className="space-y-3 border-t pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Target className="size-4 text-primary" />
              Words to practice
            </h3>

            <div className="flex flex-wrap gap-2">
              {targetWords.slice(0, 5).map((target) => (
                <span
                  key={target.word}
                  className="rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-sm font-medium"
                >
                  {target.word}
                </span>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Suggested from overlapping audio windows; these are
              possible practice words, not confirmed stutter locations.
            </p>
          </section>
        ) : null}

        {/* Personalized exercise */}
        {exercise ? (
          <section className="space-y-3 border-t pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="size-4 text-primary" />
              {exercise.title}
            </h3>

            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-sm leading-7">
                {exerciseParts.map((part, index) =>
                  highlightWords.has(part.toLowerCase()) ? (
                    <mark
                      key={index}
                      className="rounded bg-primary/15 px-0.5 text-foreground"
                    >
                      {part}
                    </mark>
                  ) : (
                    <span key={index}>{part}</span>
                  ),
                )}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Read this paragraph aloud at a comfortable pace.
            </p>

            {exercise.targetWords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {exercise.targetWords.map((word) => (
                  <span
                    key={word}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                  >
                    {word}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Footer */}
        <p className="text-[11px] text-muted-foreground">
          Automated estimate for practice tracking — not a clinical
          assessment. Model {analysis.modelVersion}.
        </p>
      </CardContent>
    </Card>
  );
}
