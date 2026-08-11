"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChoiceCard, ChoiceChip, NativeSelect } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logomark } from "@/components/ui/logomark";
import { useAppData } from "@/hooks/use-app-data";
import { profileService } from "@/lib/services/profile.service";
import {
  hasErrors,
  validateAssessment,
  validateProfile,
  type AssessmentInput,
  type ProfileInput,
  type ValidationErrors,
} from "@/lib/validations/profile";
import type { Goal, Severity, SpeakingSituation, SpeechDifficulty } from "@/types";
import {
  COUNTRY_OPTIONS,
  DIFFICULTY_OPTIONS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  LANGUAGE_OPTIONS,
  SEVERITY_OPTIONS,
  SITUATION_OPTIONS,
} from "./options";

const STEPS = [
  "Welcome",
  "About you",
  "What you notice",
  "How much it affects you",
  "Where it happens",
  "Your goals",
] as const;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function OnboardingWizard() {
  const router = useRouter();
  const { ready, authenticated, account, refresh } = useAppData();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);

  // Lazy initializer reads whatever account is already in context at first
  // render (it's loaded by the provider before signup redirects here), so
  // no effect is needed to sync it in afterwards.
  const [profile, setProfile] = useState<ProfileInput>(() => ({
    name: account?.name ?? "",
    age: null,
    gender: null,
    preferredLanguage: "English",
    nativeLanguage: "English",
    country: "India",
  }));

  useEffect(() => {
    if (ready && !authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  const [profileErrors, setProfileErrors] = useState<
    ValidationErrors<ProfileInput>
  >({});

  const [difficulties, setDifficulties] = useState<SpeechDifficulty[]>([]);
  const [severity, setSeverity] = useState<Severity>("moderate");
  const [situations, setSituations] = useState<SpeakingSituation[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [assessmentErrors, setAssessmentErrors] = useState<
    ValidationErrors<AssessmentInput>
  >({});

  function go(next: number) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  function canAdvance(): boolean {
    if (step === 1) {
      const errors = validateProfile(profile);
      setProfileErrors(errors);
      return !hasErrors(errors);
    }
    if (step === 2) {
      if (difficulties.length === 0) {
        setAssessmentErrors({ difficulties: "Select at least one." });
        return false;
      }
      setAssessmentErrors({});
    }
    return true;
  }

  async function finish() {
    const errors = validateAssessment({
      difficulties,
      severity,
      situations,
      goals,
    });
    setAssessmentErrors(errors);
    if (hasErrors(errors)) return;

    setSaving(true);
    try {
      await profileService.saveProfile(profile);
      await profileService.saveAssessment({
        difficulties,
        severity,
        situations,
        goals,
      });
      await refresh();
      toast.success("Your plan is ready");
      router.replace("/dashboard");
    } catch {
      toast.error("Could not save your answers. Please try again.");
      setSaving(false);
    }
  }

  const isLast = step === STEPS.length - 1;

  if (!ready || !authenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-8 sm:px-6">
      <div className="mb-8 space-y-3">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>{STEPS[step]}</span>
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 28 }}
          />
        </div>
      </div>

      <div className="flex-1">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="space-y-6"
          >
            {step === 0 ? <WelcomeStep /> : null}

            {step === 1 ? (
              <StepShell
                title="Tell us about you"
                subtitle="This shapes the language and pace of your exercises."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" error={profileErrors.name}>
                    <Input
                      value={profile.name}
                      autoFocus
                      placeholder="Your name"
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, name: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Age" error={profileErrors.age}>
                    <Input
                      type="number"
                      min={3}
                      max={110}
                      placeholder="Optional"
                      value={profile.age ?? ""}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          age: e.target.value === "" ? null : Number(e.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Gender">
                    <NativeSelect
                      value={profile.gender ?? ""}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          gender: (e.target.value || null) as ProfileInput["gender"],
                        }))
                      }
                    >
                      <option value="">Prefer not to say</option>
                      {GENDER_OPTIONS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Country" error={profileErrors.country}>
                    <NativeSelect
                      value={profile.country}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, country: e.target.value }))
                      }
                    >
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Preferred language">
                    <NativeSelect
                      value={profile.preferredLanguage}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          preferredLanguage: e.target.value,
                        }))
                      }
                    >
                      {LANGUAGE_OPTIONS.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Native language">
                    <NativeSelect
                      value={profile.nativeLanguage}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          nativeLanguage: e.target.value,
                        }))
                      }
                    >
                      {LANGUAGE_OPTIONS.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
              </StepShell>
            ) : null}

            {step === 2 ? (
              <StepShell
                title="What do you notice in your speech?"
                subtitle="Pick everything that applies. You can change this later."
                error={assessmentErrors.difficulties}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {DIFFICULTY_OPTIONS.map((opt) => (
                    <ChoiceCard
                      key={opt.value}
                      title={opt.label}
                      hint={opt.hint}
                      selected={difficulties.includes(opt.value)}
                      onSelect={() =>
                        setDifficulties((d) => toggle(d, opt.value))
                      }
                    />
                  ))}
                </div>
              </StepShell>
            ) : null}

            {step === 3 ? (
              <StepShell
                title="How much does it affect your day?"
                subtitle="This sets your starting difficulty. Nothing is locked in."
              >
                <div className="grid gap-3">
                  {SEVERITY_OPTIONS.map((opt) => (
                    <ChoiceCard
                      key={opt.value}
                      title={opt.label}
                      hint={opt.hint}
                      selected={severity === opt.value}
                      onSelect={() => setSeverity(opt.value)}
                    />
                  ))}
                </div>
              </StepShell>
            ) : null}

            {step === 4 ? (
              <StepShell
                title="Where is speaking hardest?"
                subtitle="Optional, but it helps us pick relevant practice content."
              >
                <div className="flex flex-wrap gap-2">
                  {SITUATION_OPTIONS.map((opt) => (
                    <ChoiceChip
                      key={opt.value}
                      selected={situations.includes(opt.value)}
                      onSelect={() => setSituations((s) => toggle(s, opt.value))}
                    >
                      <span className="mr-1.5">{opt.emoji}</span>
                      {opt.label}
                    </ChoiceChip>
                  ))}
                </div>
              </StepShell>
            ) : null}

            {step === 5 ? (
              <StepShell
                title="What do you want to work towards?"
                subtitle="Your daily plan is built around these."
                error={assessmentErrors.goals}
              >
                <div className="grid gap-3">
                  {GOAL_OPTIONS.map((opt) => (
                    <ChoiceCard
                      key={opt.value}
                      title={opt.label}
                      emoji={opt.emoji}
                      selected={goals.includes(opt.value)}
                      onSelect={() => setGoals((g) => toggle(g, opt.value))}
                    />
                  ))}
                </div>
              </StepShell>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-10 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => go(Math.max(0, step - 1))}
          disabled={step === 0 || saving}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {isLast ? (
          <Button onClick={finish} disabled={saving} size="lg">
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Build my plan
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => {
              if (canAdvance()) go(step + 1);
            }}
          >
            {step === 0 ? "Get started" : "Continue"}
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="space-y-6 py-6 text-center">
      <motion.div
        className="mx-auto grid size-20 place-items-center rounded-3xl bg-primary text-primary-foreground"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 16 }}
      >
        <Logomark className="size-10" />
      </motion.div>
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome to Fluent
        </h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          A few short questions, then a daily practice plan built around how you
          actually speak. Most sessions take under fifteen minutes.
        </p>
      </div>
      <ul className="mx-auto grid max-w-sm gap-2 text-left text-sm text-muted-foreground">
        {[
          "Guided breathing, reading and speaking exercises",
          "Streaks, XP and badges to keep the habit going",
          "Everything is stored on this device — no account needed",
        ].map((line) => (
          <li key={line} className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  error,
  children,
}: {
  title: string;
  subtitle?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
