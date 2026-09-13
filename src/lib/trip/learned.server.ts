/** Reads swap history and turns it into the ranking adjustments we apply. */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyPrecedence,
  learnFrom,
  NO_LEARNING,
  type FeedbackRow,
  type Learned,
  type StatedPrefs,
} from "@/lib/trip/learning";

const titleOf = (value: unknown): string => {
  const row = (value ?? {}) as Record<string, unknown>;
  const parts = [row["title"], row["name"], row["supplier"], row["carrier"], row["vehicle"]];
  return parts.filter((p): p is string => typeof p === "string").join(" ");
};

/**
 * Adjustments for this traveller, with stated preferences and their own resets
 * already taking precedence.
 */
export async function loadLearned(
  supabase: SupabaseClient,
  userId: string,
  stated: StatedPrefs,
): Promise<Learned> {
  const [feedback, overrides] = await Promise.all([
    supabase
      .from("choice_feedback")
      .select("item_kind, reason, recommended")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("learned_overrides")
      .select("subject, action")
      .eq("user_id", userId)
      .eq("kind", "ranking"),
  ]);
  if (feedback.error) return NO_LEARNING;

  const rows: FeedbackRow[] = (feedback.data ?? []).map((row) => ({
    itemKind: String(row["item_kind"] ?? ""),
    reason: (row["reason"] as string | null) ?? null,
    rejectedTitle: titleOf(row["recommended"]),
  }));
  const ignored = (overrides.data ?? [])
    .filter((row) => row["action"] === "ignore")
    .map((row) => String(row["subject"]));

  return applyPrecedence(learnFrom(rows), stated, ignored);
}
