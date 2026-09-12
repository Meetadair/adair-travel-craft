/**
 * This week's Getaway proposal for the signed-in traveller. Reach and season
 * come first, the profile next, price last. Content is editorial: whatever the
 * team has not written yet is simply absent, never invented.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CITIES } from "@/lib/trip/cities";
import {
  applyPriceTieBreak,
  dealVerdict,
  interestScore,
  reachFrom,
  weekStartIso,
  type GetawayProfile,
  type Reach,
  type ScoredCandidate,
} from "@/lib/getaway/match";

export type GetawayPlace = {
  id: string;
  kind: "hotel" | "restaurant" | "sight";
  name: string;
  address: string | null;
  editorialNote: string | null;
  whyThisOne: string | null;
  priceBand: string | null;
  familyFriendly: boolean;
  lat: number | null;
  lon: number | null;
};

export type GetawayDay = {
  dayNumber: number;
  morning: string | null;
  afternoon: string | null;
  evening: string | null;
  sleepPlace: string | null;
  mealPlaces: string[];
};

export type GetawayProposal = {
  weekStart: string;
  destination: {
    id: string;
    name: string;
    country: string;
    airport: string;
    lat: number;
    lon: number;
    editorialNote: string | null;
    bestFor: string | null;
    avoidWhen: string | null;
    typicalNights: number;
  };
  theme: { id: string; name: string; slug: string } | null;
  /** "Chosen because …" — the same spirit as the match score on a trip card. */
  reasons: string[];
  reach: Reach | null;
  /** Needs more than a weekend: shown plainly instead of being hidden. */
  needsMoreThanWeekend: boolean;
  places: GetawayPlace[];
  itinerary: { title: string; nights: number; summary: string | null; days: GetawayDay[] } | null;
  price: {
    departDate: string;
    returnDate: string;
    flightMinor: number | null;
    stayMinor: number | null;
    currency: string;
    checkedAt: string;
    deal: { label: string; better: boolean } | null;
  } | null;
  /** A ready sentence for the normal search-and-book flow. */
  planSentence: string;
};

export type GetawayResult =
  | { status: "ok"; proposal: GetawayProposal }
  | { status: "no-home-airport" }
  | { status: "no-match"; note: string };

function originPoint(iata: string) {
  const city = CITIES.find((c) => c.iata === iata.toUpperCase());
  return city ? { lat: city.lat, lon: city.lon } : null;
}

type DestRow = {
  id: string;
  name: string;
  country: string;
  nearest_airport_iata: string;
  latitude: number;
  longitude: number;
  drivable_from: string[] | null;
  editorial_note: string | null;
  best_for: string | null;
  avoid_when: string | null;
  typical_nights: number;
};

type JoinRow = {
  destination_id: string;
  theme_id: string;
  season_months: number[];
  editorial_angle: string | null;
  getaway_destinations: DestRow | null;
  getaway_themes: { id: string; slug: string; name: string; interest_tags: string[] | null; active: boolean } | null;
};

export const getWeeklyGetaway = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GetawayResult> => {
    const supabase = context.supabase;
    const userId = context.userId;
    const month = new Date().getUTCMonth() + 1;
    const weekStart = weekStartIso();

    const profileRes = await supabase
      .from("profiles")
      .select("home_airport")
      .eq("id", userId)
      .maybeSingle();
    const homeAirport = (profileRes.data?.home_airport ?? "").toUpperCase();
    if (!homeAirport) return { status: "no-home-airport" };

    const prefsRes = await supabase
      .from("preferences")
      .select("interests, cuisines, budget_band, extra_answers")
      .eq("user_id", userId)
      .maybeSingle();
    const profile: GetawayProfile = {
      interests: (prefsRes.data?.interests as string[] | null) ?? [],
      cuisines: (prefsRes.data?.cuisines as string[] | null) ?? [],
      budgetBand: (prefsRes.data?.budget_band as string | null) ?? null,
      extraAnswers: (prefsRes.data?.extra_answers as Record<string, string[]> | null) ?? {},
    };

    const optOutRes = await supabase
      .from("getaway_theme_optouts")
      .select("theme_id")
      .eq("user_id", userId);
    const optedOut = new Set(((optOutRes.data ?? []) as Array<{ theme_id: string }>).map((r) => r.theme_id));

    // SEASON is enforced in the query itself.
    const joinRes = await supabase
      .from("getaway_destination_themes")
      .select(
        "destination_id, theme_id, season_months, editorial_angle, getaway_destinations!inner(id, name, country, nearest_airport_iata, latitude, longitude, drivable_from, editorial_note, best_for, avoid_when, typical_nights, active), getaway_themes!inner(id, slug, name, interest_tags, active)",
      )
      .contains("season_months", [month])
      .eq("getaway_destinations.active", true)
      .eq("getaway_themes.active", true);
    if (joinRes.error) throw new Error(joinRes.error.message);
    const rows = (joinRes.data ?? []) as unknown as JoinRow[];

    const origin = originPoint(homeAirport);
    const reachByDestination = new Map<string, Reach>();
    const candidates: ScoredCandidate[] = [];
    const weekendOnly: ScoredCandidate[] = [];

    for (const row of rows) {
      const dest = row.getaway_destinations;
      const theme = row.getaway_themes;
      if (!dest || !theme || optedOut.has(theme.id)) continue;

      // REACH first: never propose something we cannot get them to.
      const reach = reachFrom(
        origin,
        homeAirport,
        { lat: Number(dest.latitude), lon: Number(dest.longitude) },
        dest.drivable_from ?? [],
      );
      if (!reach || !reach.ok) continue;
      reachByDestination.set(dest.id, reach);

      const scored = interestScore(
        { id: theme.id, slug: theme.slug, name: theme.name, interestTags: theme.interest_tags ?? [] },
        profile,
        dest.name,
        false,
      );
      const candidate: ScoredCandidate = {
        destinationId: dest.id,
        themeId: theme.id,
        score: scored.score,
        reasons: [
          ...scored.reasons,
          reach.label,
          ...(row.editorial_angle ? [row.editorial_angle] : []),
        ],
      };
      if (reach.weekend) weekendOnly.push(candidate);
      else candidates.push(candidate);
    }

    const pool = weekendOnly.length ? weekendOnly : candidates;
    if (!pool.length) {
      return {
        status: "no-match",
        note: origin
          ? "Nothing in the curated list is both in season and within reach of your home airport this week."
          : `We do not have coordinates for ${homeAirport} yet, so we cannot check travel time honestly.`,
      };
    }

    // PRICE last: only a tie-break between equally well-matched candidates.
    const priceRes = await supabase
      .from("getaway_prices")
      .select("destination_id, depart_date, return_date, flight_minor, stay_minor, currency, checked_at")
      .eq("origin_iata", homeAirport)
      .in("destination_id", pool.map((c) => c.destinationId))
      .order("checked_at", { ascending: false })
      .limit(400);
    const prices = (priceRes.data ?? []) as Array<{
      destination_id: string;
      depart_date: string;
      return_date: string;
      flight_minor: number | null;
      stay_minor: number | null;
      currency: string;
      checked_at: string;
    }>;
    const latest = new Map<string, (typeof prices)[number]>();
    const history = new Map<string, number[]>();
    for (const row of prices) {
      if (!latest.has(row.destination_id)) latest.set(row.destination_id, row);
      if (row.flight_minor !== null) {
        history.set(row.destination_id, [...(history.get(row.destination_id) ?? []), row.flight_minor]);
      }
    }
    const dealBonus: Record<string, number> = {};
    for (const [destId, values] of history) {
      const current = latest.get(destId)?.flight_minor ?? null;
      const verdict = dealVerdict(current, values);
      dealBonus[destId] = verdict?.better ? 1 : 0;
    }

    // One per week: keep whatever was already chosen for this week.
    const existing = await supabase
      .from("getaway_proposals")
      .select("destination_id, theme_id, reasons")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .maybeSingle();

    let chosen = applyPriceTieBreak(pool, dealBonus)[0]!;
    if (existing.data) {
      const kept = pool.find(
        (c) => c.destinationId === existing.data!.destination_id && c.themeId === existing.data!.theme_id,
      );
      if (kept) chosen = { ...kept, reasons: (existing.data.reasons as string[]) ?? kept.reasons };
    } else {
      await supabase.from("getaway_proposals").insert({
        user_id: userId,
        week_start: weekStart,
        destination_id: chosen.destinationId,
        theme_id: chosen.themeId,
        reasons: chosen.reasons,
      });
    }

    const destRow = rows.find((r) => r.getaway_destinations?.id === chosen.destinationId)!
      .getaway_destinations!;
    const themeRow = rows.find((r) => r.getaway_themes?.id === chosen.themeId)?.getaway_themes ?? null;

    const placesRes = await supabase
      .from("getaway_places")
      .select("id, kind, name, address, latitude, longitude, editorial_note, why_this_one, price_band, family_friendly")
      .eq("destination_id", destRow.id)
      .eq("active", true)
      .order("kind");
    const places: GetawayPlace[] = ((placesRes.data ?? []) as Array<Record<string, unknown>>).map((p) => ({
      id: String(p['id']),
      kind: p['kind'] as GetawayPlace["kind"],
      name: String(p['name']),
      address: (p['address'] as string | null) ?? null,
      editorialNote: (p['editorial_note'] as string | null) ?? null,
      whyThisOne: (p['why_this_one'] as string | null) ?? null,
      priceBand: (p['price_band'] as string | null) ?? null,
      familyFriendly: Boolean(p['family_friendly']),
      lat: p['latitude'] === null ? null : Number(p['latitude']),
      lon: p['longitude'] === null ? null : Number(p['longitude']),
    }));

    const itinRes = await supabase
      .from("getaway_itineraries")
      .select("id, title, nights, summary")
      .eq("destination_id", destRow.id)
      .eq("active", true)
      .order("nights")
      .limit(1)
      .maybeSingle();
    let itinerary: GetawayProposal["itinerary"] = null;
    if (itinRes.data) {
      const daysRes = await supabase
        .from("getaway_itinerary_days")
        .select("day_number, morning, afternoon, evening, sleep_place_id, meal_place_ids")
        .eq("itinerary_id", itinRes.data.id)
        .order("day_number");
      const nameOf = (id: string | null) => places.find((p) => p.id === id)?.name ?? null;
      itinerary = {
        title: itinRes.data.title,
        nights: itinRes.data.nights,
        summary: itinRes.data.summary ?? null,
        days: ((daysRes.data ?? []) as Array<Record<string, unknown>>).map((d) => ({
          dayNumber: Number(d['day_number']),
          morning: (d['morning'] as string | null) ?? null,
          afternoon: (d['afternoon'] as string | null) ?? null,
          evening: (d['evening'] as string | null) ?? null,
          sleepPlace: nameOf((d['sleep_place_id'] as string | null) ?? null),
          mealPlaces: ((d['meal_place_ids'] as string[] | null) ?? [])
            .map((id) => nameOf(id))
            .filter((n): n is string => Boolean(n)),
        })),
      };
    }

    const priceRow = latest.get(destRow.id) ?? null;
    const reach = reachByDestination.get(destRow.id) ?? null;
    const nights = itinerary?.nights ?? destRow.typical_nights;
    const planSentence = priceRow
      ? `${destRow.name} from ${homeAirport}, ${priceRow.depart_date} to ${priceRow.return_date}, flight and hotel`
      : `${destRow.name} from ${homeAirport} for ${nights} nights, flight and hotel`;

    return {
      status: "ok",
      proposal: {
        weekStart,
        destination: {
          id: destRow.id,
          name: destRow.name,
          country: destRow.country,
          airport: destRow.nearest_airport_iata,
          lat: Number(destRow.latitude),
          lon: Number(destRow.longitude),
          editorialNote: destRow.editorial_note,
          bestFor: destRow.best_for,
          avoidWhen: destRow.avoid_when,
          typicalNights: destRow.typical_nights,
        },
        theme: themeRow ? { id: themeRow.id, name: themeRow.name, slug: themeRow.slug } : null,
        reasons: chosen.reasons,
        reach,
        needsMoreThanWeekend: Boolean(reach && !reach.weekend),
        places,
        itinerary,
        price: priceRow
          ? {
              departDate: priceRow.depart_date,
              returnDate: priceRow.return_date,
              flightMinor: priceRow.flight_minor,
              stayMinor: priceRow.stay_minor,
              currency: priceRow.currency,
              checkedAt: priceRow.checked_at,
              deal: dealVerdict(priceRow.flight_minor, history.get(destRow.id) ?? []),
            }
          : null,
        planSentence,
      },
    };
  });

/** "Not interested in this theme" — feeds straight back into the matching. */
export const muteGetawayTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ themeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("getaway_theme_optouts")
      .upsert({ user_id: context.userId, theme_id: data.themeId }, { onConflict: "user_id,theme_id" });
    await context.supabase
      .from("getaway_proposals")
      .delete()
      .eq("user_id", context.userId)
      .eq("week_start", weekStartIso());
    return { ok: true };
  });
