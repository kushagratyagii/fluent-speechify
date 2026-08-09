"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { useAppData } from "@/hooks/use-app-data";
import { clearAllData } from "@/lib/db/storage";
import { GOAL_LABELS, profileService } from "@/lib/services/profile.service";
import {
  hasErrors,
  validateProfile,
  type ProfileInput,
  type ValidationErrors,
} from "@/lib/validations/profile";
import type { Profile } from "@/types";
import { formatDuration } from "@/utils/date";
import {
  COUNTRY_OPTIONS,
  DIFFICULTY_OPTIONS,
  GENDER_OPTIONS,
  LANGUAGE_OPTIONS,
  SEVERITY_OPTIONS,
  SITUATION_OPTIONS,
} from "@/features/onboarding/options";

export function ProfileView() {
  const router = useRouter();
  const { profile, assessment, stats, refresh } = useAppData();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!profile) return null;

  async function resetEverything() {
    await clearAllData();
    await refresh();
    toast.success("All practice data cleared");
    router.replace("/onboarding");
  }

  return (
    <PageContainer>
      <PageHeader
        title="Profile"
        subtitle="Your details and assessment answers."
      />

      {/* Keyed on the profile id so the form re-initialises if it is replaced. */}
      <ProfileForm key={profile.id} profile={profile} onSaved={refresh} />

      {assessment ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>Your assessment</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/onboarding")}
            >
              Retake
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Row label="Difficulties">
              {assessment.difficulties.map((d) => (
                <Badge key={d} variant="secondary">
                  {DIFFICULTY_OPTIONS.find((o) => o.value === d)?.label ?? d}
                </Badge>
              ))}
            </Row>
            <Row label="Severity">
              <Badge variant="secondary">
                {SEVERITY_OPTIONS.find((o) => o.value === assessment.severity)
                  ?.label ?? assessment.severity}
              </Badge>
            </Row>
            {assessment.situations.length > 0 ? (
              <Row label="Hardest situations">
                {assessment.situations.map((s) => (
                  <Badge key={s} variant="secondary">
                    {SITUATION_OPTIONS.find((o) => o.value === s)?.label ?? s}
                  </Badge>
                ))}
              </Row>
            ) : null}
            <Row label="Goals">
              {assessment.goals.map((g) => (
                <Badge key={g} variant="secondary">
                  {GOAL_LABELS[g]}
                </Badge>
              ))}
            </Row>
          </CardContent>
        </Card>
      ) : null}

      {stats ? (
        <Card>
          <CardHeader>
            <CardTitle>Lifetime totals</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Total label="Sessions" value={String(stats.totalSessions)} />
            <Total
              label="Practice time"
              value={formatDuration(stats.totalSeconds)}
            />
            <Total label="XP" value={String(stats.totalXp)} />
            <Total label="Best streak" value={`${stats.streak.longest}d`} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="size-4" />
            Clear all data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Practice history, streaks, XP and achievements are stored only on
            this device. Clearing removes all of it permanently and cannot be
            undone.
          </p>
          {confirmReset ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" onClick={resetEverything}>
                Yes, delete everything
              </Button>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirmReset(true)}>
              Clear all data
            </Button>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<ProfileInput>({
    name: profile.name,
    age: profile.age,
    gender: profile.gender,
    preferredLanguage: profile.preferredLanguage,
    nativeLanguage: profile.nativeLanguage,
    country: profile.country,
  });
  const [errors, setErrors] = useState<ValidationErrors<ProfileInput>>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    const nextErrors = validateProfile(form);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSaving(true);
    await profileService.saveProfile(form);
    await onSaved();
    setSaving(false);
    toast.success("Profile updated");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>About you</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name}>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Age" error={errors.age}>
            <Input
              type="number"
              min={3}
              max={110}
              value={form.age ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  age: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label="Gender">
            <NativeSelect
              value={form.gender ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  gender: (e.target.value || null) as ProfileInput["gender"],
                })
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
          <Field label="Country" error={errors.country}>
            <NativeSelect
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Preferred language">
            <NativeSelect
              value={form.preferredLanguage}
              onChange={(e) =>
                setForm({ ...form, preferredLanguage: e.target.value })
              }
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Native language">
            <NativeSelect
              value={form.nativeLanguage}
              onChange={(e) =>
                setForm({ ...form, nativeLanguage: e.target.value })
              }
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save changes
        </Button>
      </CardContent>
    </Card>
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

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
