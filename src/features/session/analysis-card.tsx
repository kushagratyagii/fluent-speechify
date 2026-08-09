import { AlertTriangle } from "lucide-react";
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

export function AnalysisCard({ analysis }: { analysis: SpeechAnalysis }) {
  const fluentPct = Math.round(analysis.overallFluentRatio * 100);

  return (
    <Card>
      <CardContent className="space-y-4">
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

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Fluent</p>
            <p className="font-medium tabular-nums">{fluentPct}% of clip</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Severity score</p>
            <p className="font-medium tabular-nums">
              {Math.round(analysis.overallSeverityScore)} / 100
            </p>
          </div>
        </div>

        {analysis.dominantDisfluencyType ? (
          <p className="text-xs text-muted-foreground">
            Most common pattern:{" "}
            <span className="font-medium text-foreground">
              {TYPE_LABEL[analysis.dominantDisfluencyType]}
            </span>
          </p>
        ) : null}

        {analysis.warnings.length > 0 ? (
          <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            {analysis.warnings.map((w) => (
              <div key={w} className="flex items-start gap-2 text-xs text-amber-700">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        ) : null}

        <p className="text-[11px] text-muted-foreground">
          Automated estimate for practice tracking — not a clinical
          assessment. Model {analysis.modelVersion}.
        </p>
      </CardContent>
    </Card>
  );
}
