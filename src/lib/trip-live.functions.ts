/**
 * Signed-in live trip search: real supplier results, traveller preferences
 * applied, priced with the plan's rules and stored as a trip card.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TripRequest, TripSearchResponse } from "@/lib/trip/types";
import type { InsuranceQuote } from "@/lib/trip/insurance";
import type { SearchPrefs } from "@/lib/trip/rank";

export type LiveTripResult = {
  cardId: string;
  plan: string;
  search: TripSearchResponse;
  /** Traveller-facing prices in EUR, already including the Adair margin. */
  priced: {
    flight: number | null;
    stay: number | null;
    car: number | null;
    total: number;
  };
  /** Optional travel-insurance offer; only counted when the traveller opts in. */
  insurance: InsuranceQuote | null;
  expiresAt: string | null;
};

const stopSchema = z.object({
  city: z.string().trim().min(1).max(60),
  iata: z.string().trim().length(3),
  lat: z.number(),
  lon: z.number(),
});

const sentenceSchema = z.object({
  sentence: z.string().trim().min(3).max(400),
  /** Reordered stop list from the map view: search the new first leg instead. */
  stops: z.array(stopSchema).min(2).max(8).optional(),
  /** Shift the parsed dates by this many days (cheaper nearby dates). */
  dateShiftDays: z.number().int().min(-60).max(60).optional(),
});

/** Same date, moved by whole days. */
function shiftIsoDate(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export const searchLiveTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sentenceSchema.parse(input))
  .handler(async ({ data, context }): Promise<LiveTripResult> => {
    const { supabase, userId } = context;

    const [{ parseTripSentence }, { searchTripWithDuffel, hasDuffelKey }, pricing] =
      await Promise.all([
        import("@/lib/trip/parse"),
        import("@/lib/trip/duffel.server"),
        import("@/lib/pricing.server"),
      ]);

    if (!hasDuffelKey()) throw new Error("search-not-configured");

    const [profileRes, prefsRes] = await Promise.all([
      supabase.from("profiles").select("plan, home_airport").eq("id", userId).maybeSingle(),
      supabase
        .from("preferences")
        .select(
          "cabin_class, max_connections, seat, airlines, cabin_rule, hotel_chains, hotel_stars, hotel_min_rating, hotel_amenities, hotel_types, car_brands, car_companies, car_class, car_transmission, budget_band",
        )
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    const profile = profileRes.data as { plan: string; home_airport: string } | null;
    const row = (prefsRes.data ?? null) as Record<string, unknown> | null;
    const plan = profile?.plan ?? "free";

    const list = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    const searchPrefs: SearchPrefs = {
      airlines: list(row?.["airlines"]),
      seat: (row?.["seat"] as string) ?? "any",
      cabinRule: (row?.["cabin_rule"] as string | null) ?? null,
      hotelChains: list(row?.["hotel_chains"]),
      hotelStars: list(row?.["hotel_stars"]),
      hotelMinRating: Number(row?.["hotel_min_rating"] ?? 4),
      hotelAmenities: list(row?.["hotel_amenities"]),
      hotelTypes: list(row?.["hotel_types"]),
      carBrands: list(row?.["car_brands"]),
      carCompanies: list(row?.["car_companies"]),
      carClass: (row?.["car_class"] as string | null) ?? null,
      carTransmission: (row?.["car_transmission"] as string) ?? "automatic",
    };

    const parsed = parseTripSentence(data.sentence, new Date(), profile?.home_airport);
    const reordered = data.stops?.length ? data.stops : null;
    const origin = reordered?.[0];
    const firstStop = reordered?.[1];
    const request: TripRequest = {
      ...parsed,
      cabinClass: (row?.["cabin_class"] as TripRequest["cabinClass"]) ?? parsed.cabinClass,
      ...(data.dateShiftDays
        ? {
            departDate: shiftIsoDate(parsed.departDate, data.dateShiftDays),
            returnDate: shiftIsoDate(parsed.returnDate, data.dateShiftDays),
          }
        : {}),
      ...(reordered && origin && firstStop
        ? {
            originCity: origin.city,
            originIata: origin.iata,
            destinationCity: firstStop.city,
            destinationIata: firstStop.iata,
            lat: firstStop.lat,
            lon: firstStop.lon,
            stops: reordered,
          }
        : {}),
    };

    const requestRow = await supabase
      .from("trip_requests")
      .insert({ user_id: userId, raw_sentence: data.sentence, parsed: request })
      .select("id")
      .single();
    if (requestRow.error) throw new Error(requestRow.error.message);
    const tripRequestId = (requestRow.data as { id: string }).id;

    const search = await searchTripWithDuffel(request, searchPrefs);

    // Internal demand reporting: which named hotels we cannot source yet.
    if (search.hotelNotFound && search.hotelRequested) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("hotel_requests_missed").insert({
          name_requested: search.hotelRequested,
          destination_iata: request.destinationIata,
          checkin_date: request.departDate,
        });
      } catch (error) {
        console.error("Could not log missed hotel request", error);
      }
    }



    const table = await pricing.loadPricing(supabase, plan);
    const priceLine = (net: number | null | undefined, kind: "flight" | "stay" | "car") =>
      net == null ? null : pricing.fromMinor(pricing.grossMinor(net, table[kind]));

    const flight = priceLine(search.flight?.amountEur ?? null, "flight");
    const stay = priceLine(search.stay?.amountEur ?? null, "stay");
    const car = priceLine(search.car?.amountEur ?? null, "car");
    const total = Math.round(((flight ?? 0) + (stay ?? 0) + (car ?? 0)) * 100) / 100;
    const netTotal = search.totalEur;

    const { insuranceQuoteFor } = await import("@/lib/insurance.server");
    const insurance = await insuranceQuoteFor(
      supabase,
      table,
      request.departDate,
      request.returnDate,
      request.passengers,
    );

    const { matchSummary, budgetStatus } = await import("@/lib/trip/match");
    const match = matchSummary(search, searchPrefs);
    const budget = budgetStatus(total, (row?.["budget_band"] as string | null) ?? null);

    const expiresAt =
      search.flight?.expiresAt ?? new Date(Date.now() + 20 * 60_000).toISOString();

    const card = await supabase
      .from("trip_cards")
      .insert({
        trip_request_id: tripRequestId,
        user_id: userId,
        total_minor: pricing.toMinor(total),
        markup_minor: pricing.toMinor(Math.max(0, total - netTotal)),
        saved_minor: pricing.toMinor(search.savedEur),
        saved_minutes: search.savedMinutes,
        expires_at: expiresAt,
        items: { search, priced: { flight, stay, car, total }, insurance, match, budget },
      })
      .select("id")
      .single();
    if (card.error) throw new Error(card.error.message);

    return {
      cardId: (card.data as { id: string }).id,
      plan,
      search,
      priced: { flight, stay, car, total },
      insurance,
      match,
      budget,
      expiresAt,
    };
  });

export const getTripCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ cardId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("trip_cards")
      .select("id, items, total_minor, saved_minor, expires_at, status, currency")
      .eq("user_id", context.userId)
      .eq("id", data.cardId)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error("card-not-found");

    const row = res.data as unknown as {
      id: string;
      items: {
        search: TripSearchResponse;
        priced: LiveTripResult["priced"];
        insurance?: InsuranceQuote | null;
      };
      total_minor: number;
      saved_minor: number;
      expires_at: string | null;
      status: string;
    };
    return {
      cardId: row.id,
      search: row.items.search,
      priced: row.items.priced,
      insurance: row.items.insurance ?? null,
      totalEur: row.total_minor / 100,
      savedEur: row.saved_minor / 100,
      expiresAt: row.expires_at,
      status: row.status,
      expired: row.expires_at ? new Date(row.expires_at).getTime() < Date.now() : false,
    };
  });

/**
 * Swap one of the offered alternatives into the card when the hotel or car
 * the traveller named is not in inventory. Reprices with the plan's rules.
 */
export const swapCardAlternative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        cardId: z.string().uuid(),
        kind: z.enum(["stay", "car"]),
        index: z.number().int().min(0).max(2),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pricing = await import("@/lib/pricing.server");

    const [cardRes, profileRes] = await Promise.all([
      supabase
        .from("trip_cards")
        .select("id, items, saved_minor, expires_at, status")
        .eq("user_id", userId)
        .eq("id", data.cardId)
        .maybeSingle(),
      supabase.from("profiles").select("plan").eq("id", userId).maybeSingle(),
    ]);
    if (cardRes.error) throw new Error(cardRes.error.message);
    if (!cardRes.data) throw new Error("card-not-found");

    const row = cardRes.data as unknown as {
      items: {
        search: TripSearchResponse;
        priced: LiveTripResult["priced"];
        insurance?: InsuranceQuote | null;
      };
      saved_minor: number;
      expires_at: string | null;
    };
    const search = row.items.search;

    if (data.kind === "stay") {
      const pick = search.hotelAlternatives?.[data.index];
      if (!pick) throw new Error("alternative-not-found");
      search.stay = pick;
      search.hotelAlternatives = [];
      search.hotelNotFound = false;
      delete search.errors.stays;
    } else {
      const pick = search.carAlternatives?.[data.index];
      if (!pick) throw new Error("alternative-not-found");
      search.car = pick;
      search.carAlternatives = [];
      search.carNotFound = false;
      delete search.errors.cars;
    }

    const plan = (profileRes.data as { plan: string } | null)?.plan ?? "free";
    const table = await pricing.loadPricing(supabase, plan);
    const priceLine = (net: number | null | undefined, kind: "flight" | "stay" | "car") =>
      net == null ? null : pricing.fromMinor(pricing.grossMinor(net, table[kind]));

    const flight = priceLine(search.flight?.amountEur ?? null, "flight");
    const stay = priceLine(search.stay?.amountEur ?? null, "stay");
    const car = priceLine(search.car?.amountEur ?? null, "car");
    const total = Math.round(((flight ?? 0) + (stay ?? 0) + (car ?? 0)) * 100) / 100;
    const netTotal =
      Math.round(
        ((search.flight?.amountEur ?? 0) +
          (search.stay?.amountEur ?? 0) +
          (search.car?.amountEur ?? 0)) *
          100,
      ) / 100;
    search.totalEur = netTotal;

    const priced = { flight, stay, car, total };
    const insurance = row.items.insurance ?? null;
    const update = await supabase
      .from("trip_cards")
      .update({
        total_minor: pricing.toMinor(total),
        markup_minor: pricing.toMinor(Math.max(0, total - netTotal)),
        items: { search, priced, insurance },
      })
      .eq("user_id", userId)
      .eq("id", data.cardId);
    if (update.error) throw new Error(update.error.message);

    return {
      cardId: data.cardId,
      plan,
      search,
      priced,
      insurance,
      expiresAt: row.expires_at,
    } satisfies LiveTripResult;
  });
