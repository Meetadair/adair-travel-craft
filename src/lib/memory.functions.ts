/**
 * What Adair knows about the traveller: visible, correctable, deletable.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  describePattern,
  knowsSentences,
  patternToAsk,
  type Pattern,
  type PlaceMemory,
} from "@/lib/trip/memory";
import { noticedSentences } from "@/lib/trip/learning";
import { BRAND_SEED } from "@/lib/brands/catalogue";

export type MemoryView = {
  lines: { id: string; text: string; group: "pattern" | "place" | "ranking" }[];
  /** The one habit worth asking about, if any. */
  ask: { patternKind: string; value: string; question: string } | null;
};

const nameOf = (id: string) => BRAND_SEED.find((b) => b.id === id)?.name ?? id;

export const getMyMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemoryView> => {
    const { supabase, userId } = context;
    const [{ loadPlaceMemory, refreshPatterns }, { loadLearned }] = await Promise.all([
      import("@/lib/trip/memory.server"),
      import("@/lib/trip/learned.server"),
    ]);
    const prefsRes = await supabase
      .from("preferences")
      .select("airlines, hotel_chains, car_brands, car_companies, dealbreakers")
      .eq("user_id", userId)
      .maybeSingle();
    const row = (prefsRes.data ?? {}) as Record<string, unknown>;
    const list = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    const stated = {
      airlines: list(row["airlines"]),
      hotelChains: list(row["hotel_chains"]),
      carBrands: list(row["car_brands"]),
      carCompanies: list(row["car_companies"]),
      dealbreakers: list(row["dealbreakers"]),
    };

    const [place, patterns, learned] = await Promise.all([
      loadPlaceMemory(supabase, userId),
      refreshPatterns(supabase, userId),
      loadLearned(supabase, userId, stated),
    ]);

    // Explicit preference selections (airlines/hotel chains/car brands) are
    // already shown as editable chips on the Preferences page itself, so they
    // are not re-echoed here — only genuine behavioural inference is.
    const ask = patternToAsk(patterns);
    return {
      lines: knowsSentences(patterns, place, noticedSentences(learned, nameOf)),
      ask: ask
        ? {
            patternKind: ask.patternKind,
            value: ask.value,
            question: `${describePattern(ask)} — should I treat that as a preference?`,
          }
        : null,
    };
  });

/** Yes makes it a preference; no is recorded and never asked again. */
export const answerPattern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { patternKind: string; value: string; accept: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("traveller_patterns" as never)
      .update({
        status: data.accept ? "confirmed" : "rejected",
        asked_at: new Date().toISOString(),
      } as never)
      .eq("user_id", userId)
      .eq("pattern_kind", data.patternKind)
      .eq("value", data.value);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

/** Marks a habit as put to them, so it is only ever asked once. */
export const markPatternAsked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { patternKind: string; value: string }) => input)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("traveller_patterns" as never)
      .update({ asked_at: new Date().toISOString() } as never)
      .eq("user_id", context.userId)
      .eq("pattern_kind", data.patternKind)
      .eq("value", data.value);
    return { ok: true };
  });

/** Deletes one remembered line. Ids come from getMyMemory. */
export const forgetMemoryLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [group, ...rest] = data.id.split(":");
    if (group === "pattern") {
      const [patternKind, ...value] = rest;
      await supabase
        .from("traveller_patterns" as never)
        .delete()
        .eq("user_id", userId)
        .eq("pattern_kind", patternKind ?? "")
        .eq("value", value.join(":"));
      return { ok: true };
    }
    if (group === "place") {
      const [place, itemKind, ...name] = rest;
      await supabase
        .from("traveller_place_memory" as never)
        .delete()
        .eq("user_id", userId)
        .eq("place", place ?? "")
        .eq("item_kind", itemKind ?? "")
        .eq("item_name", name.join(":"));
      return { ok: true };
    }
    return { ok: true };
  });

/**
 * Clears everything Adair worked out by itself: habits, place memory and the
 * ranking adjustments from past swaps. Stated preferences are kept — those are
 * the traveller's own words. The swap history itself is a record of what
 * happened and stays, but it stops affecting any ranking.
 */
export const forgetEverythingLearned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { loadLearned } = await import("@/lib/trip/learned.server");
    const learned = await loadLearned(supabase, userId, {
      airlines: [],
      hotelChains: [],
      carBrands: [],
      carCompanies: [],
      dealbreakers: [],
    });
    const subjects = [
      ...learned.avoid.map((entry) => `${entry.kind}:${entry.brandId}`),
      ...(learned.distanceWeight > 1 ? ["distance"] : []),
      ...(learned.priceWeight > 1 ? ["price"] : []),
    ];
    await Promise.all([
      supabase
        .from("traveller_patterns" as never)
        .delete()
        .eq("user_id", userId),
      supabase
        .from("traveller_place_memory" as never)
        .delete()
        .eq("user_id", userId),
      subjects.length
        ? supabase.from("learned_overrides").insert(
            subjects.map((subject) => ({
              user_id: userId,
              kind: "ranking",
              subject,
              action: "ignore",
            })) as never,
          )
        : Promise.resolve({ error: null }),
    ]);
    return { ok: true };
  });

export type { Pattern, PlaceMemory };
