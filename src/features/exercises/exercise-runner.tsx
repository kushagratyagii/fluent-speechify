"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

import {
  ArrowLeft,
  Check,
  Circle,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";

import { useAppData } from "@/hooks/use-app-data";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useExerciseTimer } from "@/hooks/use-exercise-timer";

import {
  analysisService,
  type PersonalizationHistoryItem,
} from "@/lib/services/analysis.service";

import { sessionService } from "@/lib/services/session.service";
import { personalizationService } from "@/lib/services/personalization.service";
import { getCategory } from "@/data/exercises";

import type {
  Difficulty,
  Exercise,
  ExerciseContent,
  ReadingPassage,
  SpeechAnalysis,
} from "@/types";

import { formatClock } from "@/utils/date";

import { AnalysisCard } from "@/features/session/analysis-card";

import { MicToggle } from "./mic-toggle";

import { BreathingPlayer } from "./players/breathing-player";
import { GuidedPlayer } from "./players/guided-player";
import { MirrorPlayer } from "./players/mirror-player";
import { ReadingPlayer } from "./players/reading-player";
import { RepetitionPlayer } from "./players/repetition-player";

import type { PlayerProps } from "./players/types";

import { lastSummary } from "./session-store";

/** Only exercises with actual speech content are worth analyzing. */
const RECORDABLE_PLAYERS: Exercise["player"][] = [
  "reading",
  "repetition",
];

const PLAYERS: Record<
  Exercise["player"],
  (props: PlayerProps) => React.ReactNode
> = {
  breathing: BreathingPlayer,
  guided: GuidedPlayer,
  reading: ReadingPlayer,
  repetition: RepetitionPlayer,
  mirror: MirrorPlayer,
};

const DIFFICULTY_ORDER: Difficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
];

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

type GeneratedPassageData = {
  title: string;
  sentences: string[];
  vocabulary?: string[];
};

export function ExerciseRunner({
  exercise,
  initialDifficulty,
}: {
  exercise: Exercise;
  initialDifficulty: Difficulty;
}) {
  const router = useRouter();
  const { refresh, account } = useAppData();

  const [difficulty, setDifficulty] =
    useState<Difficulty>(initialDifficulty);

  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [resultForReview, setResultForReview] = useState<
    Awaited<ReturnType<typeof sessionService.complete>> | null
  >(null);

  const startedAtRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  const config = exercise.difficulties[difficulty];
  const category = getCategory(exercise.categoryId);
  const Player = PLAYERS[exercise.player];

  const recordable = RECORDABLE_PLAYERS.includes(exercise.player);

  const timer = useExerciseTimer({
    totalSeconds: config.durationSeconds,
  });

  const recorder = useAudioRecorder();

  const [recordingEnabled, setRecordingEnabled] =
    useState(false);

  const [analysisAvailable, setAnalysisAvailable] =
    useState(false);

  const [dailyPassage, setDailyPassage] =
    useState<ReadingPassage | null>(null);

  const [personalizedPassage, setPersonalizedPassage] =
    useState<ReadingPassage | null>(null);

  const [personalizedItems, setPersonalizedItems] =
    useState<string[]>([]);

  const [personalizedContent, setPersonalizedContent] =
    useState<ExerciseContent | null>(null);

  const [checkingAvailability, setCheckingAvailability] =
    useState(recordable);

  /**
   * Load the latest personalized exercise from persistent account storage.
   */
  useEffect(() => {
    let cancelled = false;

    setPersonalizedContent(null);
    setPersonalizedItems([]);
    setPersonalizedPassage(null);

    personalizationService
      .getProfile()
      .then((profile) => {
        if (cancelled) return;

        const generated = profile.personalizedExercise;
        const content = generated?.personalizedContent?.[exercise.id];

        if (exercise.player !== "reading") {
          setPersonalizedContent(content ?? null);
        }

        if (exercise.player === "reading") {
          const generatedPassage = content?.passages?.[0];

          if (
            generatedPassage &&
            Array.isArray(generatedPassage.sentences) &&
            generatedPassage.sentences.length > 0
          ) {
            setPersonalizedPassage({
              ...generatedPassage,
              difficulty,
            });
          } else if (generated?.text) {
            const sentences = generated.text
              .split(/(?<=[.!?])\s+/)
              .map((sentence) => sentence.trim())
              .filter(Boolean);

            setPersonalizedPassage(
              sentences.length
                ? {
                    id: "personalized-profile",
                    title: generated.title || "Personalized Para",
                    kind: "paragraph",
                    difficulty,
                    sentences,
                  }
                : null,
            );
          } else {
            setPersonalizedPassage(null);
          }
        }

        if (exercise.player === "repetition") {
          const isSyllable = exercise.id === "ex-syllable-practice";
          const items = isSyllable
            ? generated?.syllableItems ?? []
            : generated?.targetWords ?? [];

          setPersonalizedItems(items.slice(0, isSyllable ? 10 : 5));
        } else {
          setPersonalizedItems([]);
        }
      })
      .catch((error) => {
        console.error("Could not load personalized profile:", error);
        if (!cancelled) {
          setPersonalizedContent(null);
          setPersonalizedItems([]);
          setPersonalizedPassage(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [exercise.id, exercise.player, difficulty]);

  /**
   * Generate one AI Daily Passage.
   * Previous session target words are incorporated into it.
   * Cached per account, local date and difficulty.
   */
  useEffect(() => {
    if (exercise.player !== "reading" || !account?.id) {
      setDailyPassage(null);
      return;
    }

    let cancelled = false;

    const now = new Date();

    const dateKey = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    const accountKey = String(account.id);

    const dailyCacheKey =
      `fluent:${accountKey}:daily-passage:${dateKey}:${difficulty}`;

    const toReadingPassage = (
      data: GeneratedPassageData,
    ): ReadingPassage => ({
      id: `daily-${dateKey}-${difficulty}`,
      title: data.title,
      kind: "paragraph",
      difficulty,
      sentences: data.sentences,
      vocabulary: data.vocabulary ?? [],
    });

    async function loadDailyPassage() {
      try {
        // Reuse today's passage if it already exists.
        const cachedDaily = localStorage.getItem(dailyCacheKey);

        if (cachedDaily) {
          try {
            const parsed = JSON.parse(
              cachedDaily,
            ) as GeneratedPassageData;

            if (
              parsed?.title &&
              Array.isArray(parsed.sentences) &&
              parsed.sentences.length > 0
            ) {
              if (!cancelled) {
                setDailyPassage(toReadingPassage(parsed));
              }
              return;
            }
          } catch {
            localStorage.removeItem(dailyCacheKey);
          }
        }

        // Fetch previous speech sessions.
        const sessions = await sessionService.listAll();

        if (cancelled) return;

        // Collect target words from previous analyses.
        const collectedWords = [...sessions]
          .reverse()
          .flatMap((session) => {
            const personalizedWords =
              session.analysis?.personalizedExercise?.targetWords ?? [];

            const detectedWords =
              session.analysis?.targetWords?.map(
                (item) => item.word,
              ) ?? [];

            return [...personalizedWords, ...detectedWords];
          });

        const targetWords = [
          ...new Set(
            collectedWords
              .map((word) => word.trim().toLowerCase())
              .filter(Boolean),
          ),
        ].slice(0, 8);

        if (cancelled) return;

        // Generate the Daily Passage.
        const generated = await analysisService.generatePassage({
          difficulty,
          targetWords,
        });

        if (cancelled) return;

        localStorage.setItem(
          dailyCacheKey,
          JSON.stringify(generated),
        );

        setDailyPassage(toReadingPassage(generated));
      } catch (error) {
        console.error(
          "Daily Passage generation failed:",
          error,
        );
      }
    }

    void loadDailyPassage();

    return () => {
      cancelled = true;
    };
  }, [account?.id, difficulty, exercise.player]);

  /**
   * One-off readiness check so the toggle doesn't promise
   * analysis the backend can't currently deliver.
   */
  useEffect(() => {
    if (!recordable) return;

    let cancelled = false;

    analysisService.checkHealth().then((ok) => {
      if (!cancelled) {
        setAnalysisAvailable(ok);
        setCheckingAvailability(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [recordable]);

  const save = useCallback(
    async (elapsedSeconds: number) => {
      if (savedRef.current) return;

      savedRef.current = true;
      setSaving(true);

      let analysis: SpeechAnalysis | undefined;

      if (recordingEnabled) {
        setAnalyzing(true);

        try {
          const blob = await recorder.stop();

          if (!blob) {
            throw new Error("No audio recording was created.");
          }

          console.log(
            "Recording blob created:",
            blob.size,
            blob.type,
          );

          const previousProfile =
            await personalizationService.getProfile();

          const previousExercise =
            previousProfile.personalizedExercise;

          const personalizationHistory: PersonalizationHistoryItem[] =
            previousExercise
              ? [
                  {
                    targetWords: previousExercise.targetWords ?? [],
                    personalizedText: previousExercise.text ?? "",
                    dominantDisfluencyType: null,
                    severityScore: 0,
                  },
                ]
              : [];

          analysis = await analysisService.analyze(
            blob,
            undefined,
            personalizationHistory,
          );

          console.log("ANALYSIS SUCCESS:", analysis);
        } catch (error) {
          console.error("ANALYSIS ERROR:", error);

          toast.error(
            error instanceof Error
              ? error.message
              : "Could not analyze your recording.",
          );
        }

        setAnalyzing(false);
      }

      try {
        const summary = await sessionService.complete({
          exerciseId: exercise.id,
          difficulty,
          elapsedSeconds,
          targetSeconds: config.durationSeconds,
          startedAt:
            startedAtRef.current ??
            new Date().toISOString(),
          analysis,
        });

        await refresh();

        if (!summary) {
          toast.info(
            "That was too short to log. Give it at least 10 seconds.",
          );

          router.push("/dashboard");
          return;
        }

        lastSummary.set(summary);
        setSaving(false);

        if (summary.analysis) {
          setResultForReview(summary);
          return;
        }

        router.push("/session/summary");
      } catch {
        savedRef.current = false;
        setSaving(false);

        toast.error("Could not save this session.");
      }
    },
    [
      exercise.id,
      difficulty,
      config.durationSeconds,
      refresh,
      router,
      recordingEnabled,
      recorder,
    ],
  );

  // The timer reaching zero ends the session automatically.
  useEffect(() => {
    if (timer.finished && !savedRef.current) {
      void save(timer.elapsed);
    }
  }, [timer.finished, timer.elapsed, save]);

  async function handleStart() {
    if (!startedAtRef.current) {
      startedAtRef.current = new Date().toISOString();
    }

    if (recordingEnabled) {
      if (recorder.state === "idle") {
        await recorder.start();
      } else if (timer.running) {
        recorder.pause();
      } else if (recorder.state === "paused") {
        recorder.resume();
      }
    }

    timer.toggle();
  }

  function handleFinishEarly() {
    timer.pause();
    void save(timer.elapsed);
  }

  function handleRestart() {
    timer.reset();

    if (
      recordingEnabled &&
      recorder.state !== "idle"
    ) {
      void recorder.stop().then(() => recorder.reset());
    }
  }

  const started = timer.elapsed > 0;

  const exerciseForPlayer: Exercise = personalizedContent
    ? {
        ...exercise,
        content: {
          ...exercise.content,
          ...personalizedContent,
        },
      }
    : exercise;

  if (resultForReview?.analysis) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-primary/15 text-primary">
            <Check className="size-7" />
          </span>

          <h1 className="text-xl font-semibold tracking-tight">
            Here&apos;s how that sounded
          </h1>
        </div>

        <AnalysisCard analysis={resultForReview.analysis} />

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={() => router.push("/session/summary")}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <ButtonLink
          variant="ghost"
          size="sm"
          href="/exercises"
        >
          <ArrowLeft className="size-4" />
          Exercises
        </ButtonLink>

        {started ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFinishEarly}
            disabled={saving || analyzing}
          >
            <X className="size-4" />
            End session
          </Button>
        ) : null}
      </div>

      <header className="mb-6 space-y-2">
        {category ? (
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            {category.name}
          </p>
        ) : null}

        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {exercise.title}
        </h1>

        <p className="text-sm text-muted-foreground">
          {exercise.summary}
        </p>
      </header>

      {/* Difficulty can only change before the first tick. */}
      <div className="mb-6 flex flex-wrap gap-2">
        {DIFFICULTY_ORDER.map((level) => (
          <button
            key={level}
            type="button"
            disabled={started}
            onClick={() => setDifficulty(level)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
              level === difficulty
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {DIFFICULTY_LABEL[level]} Â·{" "}
            {Math.round(
              exercise.difficulties[level].durationSeconds / 60,
            )}
            m
          </button>
        ))}
      </div>

      {!started ? (
        <ul className="mb-6 space-y-2 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          {exercise.instructions.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      {recordable && !started ? (
        <div className="mb-6">
          <MicToggle
            enabled={recordingEnabled}
            onToggle={setRecordingEnabled}
            disabled={started}
            checkingAvailability={checkingAvailability}
            available={analysisAvailable}
          />
        </div>
      ) : null}

      {recordingEnabled &&
        started &&
        (recorder.state === "recording" ||
          recorder.state === "paused") ? (
        <div className="mb-4 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
          <Circle
            className={cn(
              "size-2.5 fill-current",
              recorder.state === "recording"
                ? "animate-pulse text-rose-500"
                : "text-muted-foreground",
            )}
          />

          {recorder.state === "recording"
            ? "Recording"
            : "Recording paused"}
        </div>
      ) : null}

      <Player
        exercise={exerciseForPlayer}
        config={config}
        timer={timer}
        dailyPassage={dailyPassage ?? undefined}
        personalizedPassage={personalizedPassage ?? undefined}
        personalizedItems={personalizedItems}
      />

      {/* Timer and transport controls */}
      <div className="mt-8 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium tabular-nums">
              {formatClock(timer.elapsed)}
            </span>

            <span className="tabular-nums text-muted-foreground">
              {formatClock(config.durationSeconds)}
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              animate={{
                width: `${timer.progress * 100}%`,
              }}
              transition={{
                duration: 0.15,
                ease: "linear",
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          {started ? (
            <Button
              variant="outline"
              size="icon-lg"
              onClick={handleRestart}
              disabled={saving || analyzing}
              aria-label="Restart"
            >
              <RotateCcw className="size-4" />
            </Button>
          ) : null}

          <Button
            size="lg"
            className="min-w-40"
            onClick={handleStart}
            disabled={saving || analyzing || timer.finished}
          >
            {saving || analyzing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : timer.running ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}

            {analyzing
              ? "Analyzing your voiceâ€¦"
              : saving
                ? "Savingâ€¦"
                : timer.running
                  ? "Pause"
                  : started
                    ? "Resume"
                    : "Start exercise"}
          </Button>

          {started && !timer.running ? (
            <Button
              variant="outline"
              size="icon-lg"
              onClick={handleFinishEarly}
              disabled={saving || analyzing}
              aria-label="Finish now"
            >
              <Check className="size-4" />
            </Button>
          ) : null}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Finish at least 90% of the time to mark this
          exercise complete for today.
        </p>
      </div>
    </div>
  );
}
