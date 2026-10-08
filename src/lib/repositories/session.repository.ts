import { supabase } from "@/lib/supabase";
import { requireCurrentAccountId } from "@/lib/repositories/account.repository";
import type { ExerciseSession } from "@/types";
import { toDateKey } from "@/utils/date";

export const sessionRepository = {
  async list(): Promise<ExerciseSession[]> {
    const userId = await requireCurrentAccountId();

    const { data, error } = await supabase
      .from("exercise_results")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      profileId: row.user_id,
      exerciseId: row.exercise_id,
      difficulty: "beginner",
      durationSeconds: row.duration_seconds,
      completed: true,
      xpEarned: 0,
      startedAt: row.created_at,
      endedAt: row.created_at,
      analysis: {
        durationSeconds: row.duration_seconds,
        clips: [],
        overallFluentRatio: row.fluent_ratio ?? 0,
        overallSeverityScore: row.severity_score ?? 0,
        overallSeverityBucket: row.severity_bucket,
        dominantDisfluencyType: row.dominant_disfluency_type,
        modelVersion: row.model_version ?? "unknown",
        warnings: [],
      },
    }));
  },

  async listByDate(dateKey: string): Promise<ExerciseSession[]> {
    const rows = await this.list();

    return rows.filter(
      (session) => toDateKey(new Date(session.endedAt)) === dateKey,
    );
  },

  async create(session: ExerciseSession): Promise<ExerciseSession> {
    const userId = await requireCurrentAccountId();

    const analysis = session.analysis;

    // No analysis = nothing to save in our results table.
    if (!analysis) {
      return session;
    }

    const { data, error } = await supabase
      .from("exercise_results")
      .insert({
        user_id: userId,
        exercise_id: session.exerciseId,
        duration_seconds: Math.round(session.durationSeconds),
        severity_score: analysis.overallSeverityScore,
        severity_bucket: analysis.overallSeverityBucket,
        fluent_ratio: analysis.overallFluentRatio,
        dominant_disfluency_type: analysis.dominantDisfluencyType,
        model_version: analysis.modelVersion,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      ...session,
      id: data.id,
      profileId: data.user_id,
    };
  },

  async clear(): Promise<void> {
    const userId = await requireCurrentAccountId();

    const { error } = await supabase
      .from("exercise_results")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;
  },
};