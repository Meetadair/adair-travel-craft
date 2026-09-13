/**
 * Signed-in live trip search: real supplier results, traveller preferences
 * applied, priced with the plan's rules and stored as a trip card.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TripRequest, TripSearchResponse } from "@/lib/trip/types";
import type { BudgetStatus, MatchSummary } from "@/lib/trip/match";
import type { InsuranceQuote } from "@/lib/trip/insurance";
import type { SearchPrefs } from "@/lib/trip/rank";
import { loadLearned as loadLearnedFor } from "@/lib/trip/learned.server";

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
  /** How well each line fits the traveller's saved preferences. */
  match?: MatchSummary | null;
  /** Where the total sits against their usual budget. */
  budget?: BudgetStatus | null;
  /** Set when booking far ahead lowered our own fee. */
  earlyBooking?: { daysAhead: number; discountBps: number; savedEur: number } | null;
  expiresAt: string | null;
};

const stopSchema = z.object({
  city: z.string().trim().min(1).max(60),
  iata: z.string().trim().length(3),
  lat: z.number(),
  lon: z.number(),
});

/** Corrections the traveller made on the understanding strip, or in an answer. */
const overridesSchema = z.object({
  originIata: z.string().trim().length(3).optional(),
  destinationIata: z.string().trim().length(3).optional(),
  departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mustArriveBy: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  passengers: z.number().int().min(1).max(9).optional(),
  childAges: z.array(z.number().int().min(0).max(17)).max(8).optional(),
});

const sentenceSchema = z.object({
  sentence: z.string().trim().min(3).max(400),
  /** Reordered stop list from the map view: search the new first leg instead. */
  stops: z.array(stopSchema).min(2).max(8).optional(),
  /** Shift the parsed dates by this many days (cheaper nearby dates). */
  dateShiftDays: z.number().int().min(-60).max(60).optional(),
  overrides: overridesSchema.optional(),
});

/** Same date, moved by whole days. */
function shiftIsoDate(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Short, human-readable pointer to the offer we swapped away from or to. */
function reference(line: Record<string, unknown> | null): string | null {
  if (!line) return null;
  const id = line["offerId"] ?? line["rateId"] ?? line["quoteId"] ?? null;
  const name = line["name"] ?? line["carrier"] ?? line["vehicle"] ?? null;
  return (typeof id === "string" ? id : typeof name === "string" ? name : null) ?? null;
}


/** Analytics sink. Never allowed to break the interaction it measures. */
async function record(
  userId: string,
  name: string,
  props: Record<string, unknown>,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("events").insert({ name, user_id: userId, props: props as never });
  } catch (error) {
    console.error("event insert failed", error);
  }
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
          "cabin_class, max_connections, hotel_max_km, seat, airlines, cabin_rule, hotel_chains, hotel_stars, hotel_min_rating, hotel_amenities, hotel_types, car_brands, car_companies, car_class, car_transmission, budget_band, trip_purpose, dealbreakers, extra_answers",
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
      cabinClass: (row?.["cabin_class"] as string) ?? "economy",
      maxConnections: Number(row?.["max_connections"] ?? 1),
      hotelMaxKm: (row?.["hotel_max_km"] as number | null) ?? null,
      dealbreakers: list(row?.["dealbreakers"]),
    };
    searchPrefs.learned = await loadLearnedFor(context.supabase, userId, searchPrefs);
    // Repeated "too far" keeps hotels closer than the stated limit.
    if (searchPrefs.hotelMaxKm && searchPrefs.learned.distanceWeight > 1)
      searchPrefs.hotelMaxKm = Math.max(
        1,
        Math.round(searchPrefs.hotelMaxKm / searchPrefs.learned.distanceWeight),
      );

    const parsed = parseTripSentence(data.sentence, new Date(), profile?.home_airport);
    // No destination, no trip: the chat asks where they are going instead.
    if (!parsed) throw new Error("needs-destination");
    const reordered = data.stops?.length ? data.stops : null;
    const origin = reordered?.[0];
    const firstStop = reordered?.[1];
    const base: TripRequest = {
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
    // Corrections the traveller made on the strip, or answers to what we asked,
    // win over what we read from the sentence.
    const { applyOverrides } = await import("@/lib/trip/understanding");
    const request: TripRequest = data.overrides
      ? applyOverrides(base, data.overrides)
      : base;

    // What we remember about this place, and habits they have confirmed. Both
    // rank below anything they stated; neither can override a dealbreaker.
    const { loadPlaceMemory, loadPatterns } = await import("@/lib/trip/memory.server");
    const { placeKey, resolvePreferences, sameAgainQuestion } = await import("@/lib/trip/memory");
    const [placeMemory, patterns] = await Promise.all([
      loadPlaceMemory(supabase, userId),
      loadPatterns(supabase, userId),
    ]);
    const currentPlace = placeKey(request.destinationCity, request.destinationIata);
    const resolved = resolvePreferences(
      {
        airlines: searchPrefs.airlines,
        hotelChains: searchPrefs.hotelChains,
        carBrands: searchPrefs.carBrands,
        carCompanies: searchPrefs.carCompanies,
        dealbreakers: searchPrefs.dealbreakers,
      },
      patterns,
      placeMemory,
      currentPlace,
      searchPrefs.learned,
    );
    searchPrefs.airlines = resolved.airlines;
    searchPrefs.hotelChains = resolved.hotelChains;
    searchPrefs.carBrands = resolved.carBrands;
    searchPrefs.remembered = {
      hotels: resolved.rememberedHotels,
      carSuppliers: resolved.rememberedCarSuppliers,
    };
    const sameAgain = sameAgainQuestion(placeMemory, currentPlace, request.destinationCity, {
      sameAgain: "You stayed at {hotel} last time in {city} — same again?",
      full: "",
    });

    const requestRow = await supabase
      .from("trip_requests")
      .insert({ user_id: userId, raw_sentence: data.sentence, parsed: request })
      .select("id")
      .single();
    if (requestRow.error) throw new Error(requestRow.error.message);
    const tripRequestId = (requestRow.data as { id: string }).id;

    // Buffers used when planning backwards from a fixed arrival time; tunable
    // by an admin without a deploy.
    const { DEFAULT_PLANNING_RULES } = await import("@/lib/trip/backwards");
    const rulesRes = await supabase
      .from("planning_rules")
      .select(
        "schengen_clear_min, non_schengen_clear_min, safety_margin_min, business_extra_margin_min, transfer_base_min, transfer_min_per_km",
      )
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    const ruleRow = (rulesRes.data ?? null) as Record<string, unknown> | null;
    const planningRules = ruleRow
      ? {
          schengenClearMin: Number(ruleRow["schengen_clear_min"]),
          nonSchengenClearMin: Number(ruleRow["non_schengen_clear_min"]),
          safetyMarginMin: Number(ruleRow["safety_margin_min"]),
          businessExtraMarginMin: Number(ruleRow["business_extra_margin_min"]),
          transferBaseMin: Number(ruleRow["transfer_base_min"]),
          transferMinPerKm: Number(ruleRow["transfer_min_per_km"]),
        }
      : DEFAULT_PLANNING_RULES;
    const purposes = list(row?.["trip_purpose"]).map((p) => p.toLowerCase());
    const business = purposes.some((p) => p.includes("business") || p.includes("work"));

    const search = await searchTripWithDuffel(request, searchPrefs, {
      rules: planningRules,
      business,
    });

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



    const baseTable = await pricing.loadPricing(supabase, plan);

    // Early-booking reward: leisure trips booked far ahead pay a smaller Adair
    // fee. Business trips (invoiced) keep the standard fee.
    const daysAhead = pricing.daysUntilDeparture(request.departDate);
    const leadTimeBps = business
      ? 0
      : pricing.leadTimeDiscountBps(await pricing.loadLeadTimeTiers(supabase, plan), daysAhead);
    const table = pricing.withLeadTimeDiscount(baseTable, leadTimeBps);

    const priceLine = (net: number | null | undefined, kind: "flight" | "stay" | "car") =>
      net == null ? null : pricing.fromMinor(pricing.grossMinor(net, table[kind]));
    const priceLineBase = (net: number | null | undefined, kind: "flight" | "stay" | "car") =>
      net == null ? 0 : pricing.fromMinor(pricing.grossMinor(net, baseTable[kind]));

    const flight = priceLine(search.flight?.amountEur ?? null, "flight");
    const stay = priceLine(search.stay?.amountEur ?? null, "stay");
    const car = priceLine(search.car?.amountEur ?? null, "car");
    const total = Math.round(((flight ?? 0) + (stay ?? 0) + (car ?? 0)) * 100) / 100;
    const netTotal = search.totalEur;

    const baseTotal =
      Math.round(
        (priceLineBase(search.flight?.amountEur ?? null, "flight") +
          priceLineBase(search.stay?.amountEur ?? null, "stay") +
          priceLineBase(search.car?.amountEur ?? null, "car")) *
          100,
      ) / 100;
    const earlyBooking =
      leadTimeBps > 0 && baseTotal > total
        ? {
            daysAhead,
            discountBps: leadTimeBps,
            savedEur: Math.round((baseTotal - total) * 100) / 100,
          }
        : null;

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
    const cheapestAlt = (
      list: { amountEur: number }[] | undefined,
      kind: "flight" | "stay" | "car",
    ) => {
      const nets = (list ?? []).map((a) => a.amountEur).filter((n) => Number.isFinite(n));
      if (!nets.length) return null;
      return priceLine(Math.min(...nets), kind);
    };
    const budget = budgetStatus(
      total,
      (row?.["budget_band"] as string | null) ?? null,
      { flight, stay, car },
      {
        flight: cheapestAlt(search.flightAlternatives, "flight"),
        stay: cheapestAlt(search.hotelAlternatives, "stay"),
        car: cheapestAlt(search.carAlternatives, "car"),
      },
    );

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
        items: {
          search,
          priced: { flight, stay, car, total },
          insurance,
          match,
          budget,
          earlyBooking,
        },
      })
      .select("id")
      .single();
    if (card.error) throw new Error(card.error.message);

    void record(userId, "search_run", {
      destination: request.destinationCity,
      destination_iata: request.destinationIata,
      total_eur: total,
      peak: Boolean((search as { peak?: unknown }).peak),
    });
    if (earlyBooking) {
      void record(userId, "early_booking_discount", {
        days_ahead: earlyBooking.daysAhead,
        discount_bps: earlyBooking.discountBps,
        saved_eur: earlyBooking.savedEur,
        total_eur: total,
      });
    }
    void record(userId, "card_created", { total_eur: total, has_stay: Boolean(search.stay) });
    for (const kind of ["flight", "stay", "car"] as const) {
      const line = match[kind];
      if (!line || line.total === 0) continue;
      void record(userId, "match_score", {
        kind,
        score: Math.round((line.met / line.total) * 100),
        unmet: line.criteria.filter((c) => !c.ok).map((c) => c.label),
      });
    }

    return {
      cardId: (card.data as { id: string }).id,
      plan,
      search,
      priced: { flight, stay, car, total },
      insurance,
      match,
      budget,
      earlyBooking,
      expiresAt,
      memoryNote: sameAgain?.question ?? null,
      rememberedHotel: sameAgain?.hotel ?? null,
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
        match?: MatchSummary | null;
        budget?: BudgetStatus | null;
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
      match: row.items.match ?? null,
      budget: row.items.budget ?? null,
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
        kind: z.enum(["flight", "stay", "car"]),
        index: z.number().int().min(0).max(2),
        reason: z.string().trim().max(200).optional(),
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
        match?: MatchSummary | null;
        budget?: BudgetStatus | null;
        earlyBooking?: LiveTripResult["earlyBooking"];
      };
      saved_minor: number;
      expires_at: string | null;
    };
    const search = row.items.search;

    let recommended: Record<string, unknown> | null = null;
    let chosen: Record<string, unknown> | null = null;

    if (data.kind === "flight") {
      const pick = search.flightAlternatives?.[data.index];
      if (!pick) throw new Error("alternative-not-found");
      const previous = search.flight;
      recommended = previous ? { ...previous } : null;
      chosen = { ...pick };
      search.flight = pick;
      search.flightAlternatives = [
        ...(previous ? [previous] : []),
        ...(search.flightAlternatives ?? []).filter((_, i) => i !== data.index),
      ].slice(0, 3);
      delete search.errors.flights;
    } else if (data.kind === "stay") {
      const pick = search.hotelAlternatives?.[data.index];
      if (!pick) throw new Error("alternative-not-found");
      const previous = search.stay;
      recommended = previous ? { ...previous } : null;
      chosen = { ...pick };
      search.stay = pick;
      // Keep the rest swappable, with the earlier pick back on the list.
      search.hotelAlternatives = [
        ...(previous ? [previous] : []),
        ...(search.hotelAlternatives ?? []).filter((_, i) => i !== data.index),
      ].slice(0, 3);
      search.hotelNotFound = false;
      delete search.errors.stays;
    } else {
      const pick = search.carAlternatives?.[data.index];
      if (!pick) throw new Error("alternative-not-found");
      const previous = search.car;
      recommended = previous ? { ...previous } : null;
      chosen = { ...pick };
      search.car = pick;
      search.carAlternatives = [
        ...(previous ? [previous] : []),
        ...(search.carAlternatives ?? []).filter((_, i) => i !== data.index),
      ].slice(0, 3);
      search.carNotFound = false;
      delete search.errors.cars;
    }

    // Remember that our suggestion was not the one they wanted.
    const { error: feedbackError } = await supabase.from("choice_feedback").insert({
      user_id: userId,
      trip_card_id: data.cardId,
      item_kind: data.kind,
      recommended: (recommended ?? {}) as never,
      chosen: (chosen ?? {}) as never,
      rejected_reference: reference(recommended),
      chosen_reference: reference(chosen),
      ...(data.reason ? { reason: data.reason } : {}),
    });
    if (feedbackError) console.error("Could not log choice feedback", feedbackError);

    const plan = (profileRes.data as { plan: string } | null)?.plan ?? "free";
    const baseTable = await pricing.loadPricing(supabase, plan);
    // The early-booking reward was earned by the departure date, so it survives
    // a swap; only the amount it saves is recalculated.
    const earlyBps = row.items.earlyBooking?.discountBps ?? 0;
    const table = pricing.withLeadTimeDiscount(baseTable, earlyBps);
    const priceLine = (net: number | null | undefined, kind: "flight" | "stay" | "car") =>
      net == null ? null : pricing.fromMinor(pricing.grossMinor(net, table[kind]));
    const priceLineBase = (net: number | null | undefined, kind: "flight" | "stay" | "car") =>
      net == null ? 0 : pricing.fromMinor(pricing.grossMinor(net, baseTable[kind]));

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

    const baseTotal =
      Math.round(
        (priceLineBase(search.flight?.amountEur ?? null, "flight") +
          priceLineBase(search.stay?.amountEur ?? null, "stay") +
          priceLineBase(search.car?.amountEur ?? null, "car")) *
          100,
      ) / 100;
    const earlyBooking =
      row.items.earlyBooking && baseTotal > total
        ? { ...row.items.earlyBooking, savedEur: Math.round((baseTotal - total) * 100) / 100 }
        : null;

    const prefsRes = await supabase
      .from("preferences")
      .select(
        "cabin_class, max_connections, hotel_max_km, seat, airlines, cabin_rule, hotel_chains, hotel_stars, hotel_min_rating, hotel_amenities, hotel_types, car_brands, car_companies, car_class, car_transmission, budget_band, dealbreakers, extra_answers",
      )
      .eq("user_id", userId)
      .maybeSingle();
    const prefRow = (prefsRes.data ?? null) as Record<string, unknown> | null;
    const list = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    const searchPrefs: SearchPrefs = {
      airlines: list(prefRow?.["airlines"]),
      seat: (prefRow?.["seat"] as string) ?? "any",
      cabinRule: (prefRow?.["cabin_rule"] as string | null) ?? null,
      hotelChains: list(prefRow?.["hotel_chains"]),
      hotelStars: list(prefRow?.["hotel_stars"]),
      hotelMinRating: Number(prefRow?.["hotel_min_rating"] ?? 4),
      hotelAmenities: list(prefRow?.["hotel_amenities"]),
      hotelTypes: list(prefRow?.["hotel_types"]),
      carBrands: list(prefRow?.["car_brands"]),
      carCompanies: list(prefRow?.["car_companies"]),
      carClass: (prefRow?.["car_class"] as string | null) ?? null,
      carTransmission: (prefRow?.["car_transmission"] as string) ?? "automatic",
      cabinClass: (prefRow?.["cabin_class"] as string) ?? "economy",
      maxConnections: Number(prefRow?.["max_connections"] ?? 1),
      hotelMaxKm: (prefRow?.["hotel_max_km"] as number | null) ?? null,
      dealbreakers: list(prefRow?.["dealbreakers"]),
    };
    searchPrefs.learned = await loadLearnedFor(context.supabase, userId, searchPrefs);
    const { matchSummary, budgetStatus } = await import("@/lib/trip/match");
    const match = matchSummary(search, searchPrefs);
    const cheapestAlt = (
      alts: { amountEur: number }[] | undefined,
      kind: "flight" | "stay" | "car",
    ) => {
      const nets = (alts ?? []).map((a) => a.amountEur).filter((n) => Number.isFinite(n));
      if (!nets.length) return null;
      return priceLine(Math.min(...nets), kind);
    };
    const budget = budgetStatus(
      total,
      (prefRow?.["budget_band"] as string | null) ?? null,
      { flight, stay, car },
      {
        flight: cheapestAlt(search.flightAlternatives, "flight"),
        stay: cheapestAlt(search.hotelAlternatives, "stay"),
        car: cheapestAlt(search.carAlternatives, "car"),
      },
    );
    const update = await supabase
      .from("trip_cards")
      .update({
        total_minor: pricing.toMinor(total),
        markup_minor: pricing.toMinor(Math.max(0, total - netTotal)),
        items: { search, priced, insurance, match, budget, earlyBooking },
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
      match,
      budget,
      earlyBooking,
      expiresAt: row.expires_at,
    } satisfies LiveTripResult;
  });
