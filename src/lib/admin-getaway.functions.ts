/**
 * Editorial tools for Adair Getaway. Everything here is admin-only and checked
 * through the caller's own session before anything is written.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assertAdmin(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not verify your account");
  if (!data?.["is_admin"]) throw new Error("Admins only");
}

export type AdminTheme = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  interest_tags: string[];
  season_months: number[];
  sort_order: number;
  active: boolean;
};

export type AdminDestination = {
  id: string;
  name: string;
  country: string;
  nearest_airport_iata: string;
  latitude: number;
  longitude: number;
  drivable_from: string[];
  editorial_note: string | null;
  best_for: string | null;
  avoid_when: string | null;
  typical_nights: number;
  active: boolean;
  /** Theme assignments, each with its own season window. */
  themes: Array<{ id: string; theme_id: string; season_months: number[]; editorial_angle: string | null }>;
  places: Array<{ id: string; kind: string; name: string; active: boolean; why_this_one: string | null }>;
  itineraries: Array<{ id: string; title: string; nights: number; summary: string | null; active: boolean }>;
};

export const getGetawayContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const s = context.supabase;
    const [themes, dests, joins, places, itins] = await Promise.all([
      s.from("getaway_themes").select("*").order("sort_order"),
      s.from("getaway_destinations").select("*").order("name"),
      s.from("getaway_destination_themes").select("id, destination_id, theme_id, season_months, editorial_angle"),
      s.from("getaway_places").select("id, destination_id, kind, name, active, why_this_one").order("name"),
      s.from("getaway_itineraries").select("id, destination_id, title, nights, summary, active").order("nights"),
    ]);

    const destinations: AdminDestination[] = ((dests.data ?? []) as Array<Record<string, unknown>>).map(
      (d) => ({
        id: String(d['id']),
        name: String(d['name']),
        country: String(d['country']),
        nearest_airport_iata: String(d['nearest_airport_iata']),
        latitude: Number(d['latitude']),
        longitude: Number(d['longitude']),
        drivable_from: (d['drivable_from'] as string[] | null) ?? [],
        editorial_note: (d['editorial_note'] as string | null) ?? null,
        best_for: (d['best_for'] as string | null) ?? null,
        avoid_when: (d['avoid_when'] as string | null) ?? null,
        typical_nights: Number(d['typical_nights']),
        active: Boolean(d['active']),
        themes: ((joins.data ?? []) as Array<Record<string, unknown>>)
          .filter((j) => j['destination_id'] === d['id'])
          .map((j) => ({
            id: String(j['id']),
            theme_id: String(j['theme_id']),
            season_months: (j['season_months'] as number[] | null) ?? [],
            editorial_angle: (j['editorial_angle'] as string | null) ?? null,
          })),
        places: ((places.data ?? []) as Array<Record<string, unknown>>)
          .filter((p) => p['destination_id'] === d['id'])
          .map((p) => ({
            id: String(p['id']),
            kind: String(p['kind']),
            name: String(p['name']),
            active: Boolean(p['active']),
            why_this_one: (p['why_this_one'] as string | null) ?? null,
          })),
        itineraries: ((itins.data ?? []) as Array<Record<string, unknown>>)
          .filter((i) => i['destination_id'] === d['id'])
          .map((i) => ({
            id: String(i['id']),
            title: String(i['title']),
            nights: Number(i['nights']),
            summary: (i['summary'] as string | null) ?? null,
            active: Boolean(i['active']),
          })),
      }),
    );

    return {
      themes: ((themes.data ?? []) as unknown as AdminTheme[]).map((t) => ({
        ...t,
        interest_tags: t.interest_tags ?? [],
        season_months: t.season_months ?? [],
      })),
      destinations,
    };
  });

const months = z.array(z.number().int().min(1).max(12)).max(12);

export const saveGetawayTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        slug: z.string().trim().min(2).max(40),
        name: z.string().trim().min(2).max(80),
        description: z.string().trim().max(600).nullable(),
        interest_tags: z.array(z.string().trim().min(1).max(40)).max(20),
        season_months: months,
        sort_order: z.number().int().min(0).max(999),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { id, ...fields } = data;
    const res = id
      ? await context.supabase.from("getaway_themes").update(fields).eq("id", id)
      : await context.supabase.from("getaway_themes").insert(fields);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export const saveGetawayDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(120),
        country: z.string().trim().min(2).max(60),
        nearest_airport_iata: z.string().trim().length(3),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        drivable_from: z.array(z.string().trim().length(3)).max(20),
        editorial_note: z.string().trim().max(4000).nullable(),
        best_for: z.string().trim().max(600).nullable(),
        avoid_when: z.string().trim().max(600).nullable(),
        typical_nights: z.number().int().min(1).max(21),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { id, ...fields } = data;
    const payload = { ...fields, nearest_airport_iata: fields.nearest_airport_iata.toUpperCase() };
    const res = id
      ? await context.supabase.from("getaway_destinations").update(payload).eq("id", id)
      : await context.supabase.from("getaway_destinations").insert(payload);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export const saveGetawayThemeAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        destination_id: z.string().uuid(),
        theme_id: z.string().uuid(),
        season_months: months,
        editorial_angle: z.string().trim().max(600).nullable(),
        remove: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.remove) {
      const res = await context.supabase
        .from("getaway_destination_themes")
        .delete()
        .eq("destination_id", data.destination_id)
        .eq("theme_id", data.theme_id);
      if (res.error) throw new Error(res.error.message);
      return { ok: true };
    }
    const res = await context.supabase.from("getaway_destination_themes").upsert(
      {
        destination_id: data.destination_id,
        theme_id: data.theme_id,
        season_months: data.season_months,
        editorial_angle: data.editorial_angle,
      },
      { onConflict: "destination_id,theme_id" },
    );
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export const saveGetawayPlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        destination_id: z.string().uuid(),
        kind: z.enum(["hotel", "restaurant", "sight"]),
        name: z.string().trim().min(2).max(160),
        address: z.string().trim().max(300).nullable(),
        latitude: z.number().min(-90).max(90).nullable(),
        longitude: z.number().min(-180).max(180).nullable(),
        editorial_note: z.string().trim().max(4000).nullable(),
        why_this_one: z.string().trim().max(1000).nullable(),
        price_band: z.string().trim().max(20).nullable(),
        family_friendly: z.boolean(),
        active: z.boolean(),
        remove: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { id, remove, ...fields } = data;
    if (remove && id) {
      const res = await context.supabase.from("getaway_places").delete().eq("id", id);
      if (res.error) throw new Error(res.error.message);
      return { ok: true };
    }
    const res = id
      ? await context.supabase.from("getaway_places").update(fields).eq("id", id)
      : await context.supabase.from("getaway_places").insert(fields);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export const saveGetawayItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        destination_id: z.string().uuid(),
        title: z.string().trim().min(2).max(160),
        nights: z.number().int().min(1).max(21),
        summary: z.string().trim().max(2000).nullable(),
        active: z.boolean(),
        remove: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { id, remove, ...fields } = data;
    if (remove && id) {
      const res = await context.supabase.from("getaway_itineraries").delete().eq("id", id);
      if (res.error) throw new Error(res.error.message);
      return { ok: true };
    }
    const res = id
      ? await context.supabase.from("getaway_itineraries").update(fields).eq("id", id)
      : await context.supabase.from("getaway_itineraries").insert(fields);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export const getGetawayItineraryDays = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ itineraryId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const res = await context.supabase
      .from("getaway_itinerary_days")
      .select("id, day_number, morning, afternoon, evening, sleep_place_id, meal_place_ids")
      .eq("itinerary_id", data.itineraryId)
      .order("day_number");
    if (res.error) throw new Error(res.error.message);
    return (res.data ?? []) as Array<{
      id: string;
      day_number: number;
      morning: string | null;
      afternoon: string | null;
      evening: string | null;
      sleep_place_id: string | null;
      meal_place_ids: string[] | null;
    }>;
  });

export const saveGetawayItineraryDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        itinerary_id: z.string().uuid(),
        day_number: z.number().int().min(1).max(21),
        morning: z.string().trim().max(1000).nullable(),
        afternoon: z.string().trim().max(1000).nullable(),
        evening: z.string().trim().max(1000).nullable(),
        sleep_place_id: z.string().uuid().nullable(),
        meal_place_ids: z.array(z.string().uuid()).max(6),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const res = await context.supabase
      .from("getaway_itinerary_days")
      .upsert(data, { onConflict: "itinerary_id,day_number" });
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });
