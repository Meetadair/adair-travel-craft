/** Reading and writing traveller memory. Server-only. */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  detectPatterns,
  mergePatterns,
  placeKey,
  type BookingFact,
  type Pattern,
  type PatternKind,
  type PatternStatus,
  type PlaceItemKind,
  type PlaceMemory,
} from "@/lib/trip/memory";

const table = (supabase: SupabaseClient, name: string) => supabase.from(name as never);

export async function loadPlaceMemory(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlaceMemory[]> {
  const res = await table(supabase, "traveller_place_memory")
    .select("place, item_kind, item_ref, item_name, times_chosen, last_chosen_at, source")
    .eq("user_id", userId)
    .order("times_chosen", { ascending: false })
    .limit(200);
  if (res.error) return [];
  return (res.data ?? []).map((row: Record<string, unknown>) => ({
    place: String(row["place"] ?? ""),
    itemKind: String(row["item_kind"] ?? "hotel") as PlaceItemKind,
    itemRef: (row["item_ref"] as string | null) ?? null,
    itemName: String(row["item_name"] ?? ""),
    timesChosen: Number(row["times_chosen"] ?? 1),
    lastChosenAt: String(row["last_chosen_at"] ?? ""),
    source: (row["source"] as PlaceMemory["source"]) ?? "booked",
  }));
}

export async function loadPatterns(
  supabase: SupabaseClient,
  userId: string,
): Promise<Pattern[]> {
  const res = await table(supabase, "traveller_patterns")
    .select("pattern_kind, value, confidence, evidence_count, status, asked_at")
    .eq("user_id", userId)
    .limit(100);
  if (res.error) return [];
  return (res.data ?? []).map((row: Record<string, unknown>) => ({
    patternKind: String(row["pattern_kind"] ?? "") as PatternKind,
    value: String(row["value"] ?? ""),
    confidence: Number(row["confidence"] ?? 0),
    evidenceCount: Number(row["evidence_count"] ?? 0),
    status: (row["status"] as PatternStatus) ?? "suggested",
    askedAt: (row["asked_at"] as string | null) ?? null,
  }));
}

/**
 * Records what they actually chose in a place. Repeat choices add to the count
 * rather than piling up rows.
 */
export async function rememberChoice(
  supabase: SupabaseClient,
  userId: string,
  input: {
    city: string | null;
    iata?: string | null;
    itemKind: PlaceItemKind;
    itemName: string;
    itemRef?: string | null;
    source: PlaceMemory["source"];
  },
): Promise<void> {
  const place = placeKey(input.city, input.iata);
  const name = input.itemName.trim();
  if (!place || !name) return;
  const existing = await table(supabase, "traveller_place_memory")
    .select("id, times_chosen")
    .eq("user_id", userId)
    .eq("place", place)
    .eq("item_kind", input.itemKind)
    .eq("item_name", name)
    .maybeSingle();
  const now = new Date().toISOString();
  if (existing.data) {
    const row = existing.data as { id: string; times_chosen: number };
    await table(supabase, "traveller_place_memory")
      .update({ times_chosen: row.times_chosen + 1, last_chosen_at: now } as never)
      .eq("id", row.id);
    return;
  }
  const res = await table(supabase, "traveller_place_memory").insert({
    user_id: userId,
    place,
    item_kind: input.itemKind,
    item_name: name,
    item_ref: input.itemRef ?? null,
    times_chosen: 1,
    last_chosen_at: now,
    source: input.source,
  } as never);
  if (res.error) console.error("place memory write failed", res.error);
}

/** Booked trips, reduced to the facts patterns are read from. */
export async function bookingFacts(
  supabase: SupabaseClient,
  userId: string,
): Promise<BookingFact[]> {
  const trips = await supabase
    .from("trips")
    .select("id, start_date, end_date, total_amount, created_at, status")
    .eq("user_id", userId)
    .not("booked_at", "is", null)
    .order("booked_at", { ascending: false })
    .limit(40);
  if (trips.error || !trips.data?.length) return [];
  const ids = (trips.data as { id: string }[]).map((t) => t.id);
  const items = await supabase
    .from("trip_items")
    .select("trip_id, kind, title, payload")
    .in("trip_id", ids);
  const byTrip = new Map<string, { kind: string; title: string; payload: unknown }[]>();
  for (const row of (items.data ?? []) as Record<string, unknown>[]) {
    const key = String(row["trip_id"]);
    const list = byTrip.get(key) ?? [];
    list.push({
      kind: String(row["kind"] ?? ""),
      title: String(row["title"] ?? ""),
      payload: row["payload"],
    });
    byTrip.set(key, list);
  }

  const days = (from: string, to: string) =>
    Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

  return (trips.data as Record<string, unknown>[]).map((trip) => {
    const lines = byTrip.get(String(trip["id"])) ?? [];
    const flight = lines.find((l) => l.kind === "flight");
    const stay = lines.find((l) => l.kind === "stay" || l.kind === "hotel");
    const car = lines.find((l) => l.kind === "car");
    const payload = (flight?.payload ?? {}) as Record<string, unknown>;
    const departAt = typeof payload["departAt"] === "string" ? payload["departAt"] : null;
    const start = String(trip["start_date"] ?? "");
    const end = String(trip["end_date"] ?? "");
    const created = String(trip["created_at"] ?? "");
    return {
      airline: flight ? (flight.title.split("·")[0] ?? "").trim() || null : null,
      hotelChain: stay ? stay.title.trim() || null : null,
      carBrand: car ? car.title.trim() || null : null,
      departHour: departAt ? Number(departAt.slice(11, 13)) : null,
      connections:
        typeof payload["connections"] === "number" ? (payload["connections"] as number) : null,
      leadDays: start && created ? days(created.slice(0, 10), start) : null,
      nights: start && end ? days(start, end) : null,
      spendEur: Number(trip["total_amount"] ?? 0) || null,
    } satisfies BookingFact;
  });
}

/** Refreshes stored patterns from booking history and returns them. */
export async function refreshPatterns(
  supabase: SupabaseClient,
  userId: string,
): Promise<Pattern[]> {
  const [existing, facts] = await Promise.all([
    loadPatterns(supabase, userId),
    bookingFacts(supabase, userId),
  ]);
  const merged = mergePatterns(existing, detectPatterns(facts));
  const changed = merged.filter((pattern) => {
    const known = existing.find(
      (e) => e.patternKind === pattern.patternKind && e.value === pattern.value,
    );
    return (
      !known ||
      known.confidence !== pattern.confidence ||
      known.evidenceCount !== pattern.evidenceCount
    );
  });
  for (const pattern of changed) {
    const res = await table(supabase, "traveller_patterns").upsert(
      {
        user_id: userId,
        pattern_kind: pattern.patternKind,
        value: pattern.value,
        confidence: pattern.confidence,
        evidence_count: pattern.evidenceCount,
        status: pattern.status,
        last_seen: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,pattern_kind,value" },
    );
    if (res.error) console.error("pattern write failed", res.error);
  }
  return merged;
}
