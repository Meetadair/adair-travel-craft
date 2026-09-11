/**
 * Signed-in live trip search: real supplier results, traveller preferences
 * applied, priced with the plan's rules and stored as a trip card.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TripRequest, TripSearchResponse } from "@/lib/trip/types";

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
  expiresAt: string | null;
};

const sentenceSchema = z.object({
  sentence: z.string().trim().min(3).max(400),
});

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
        .select("cabin_class, max_connections")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    const profile = profileRes.data as { plan: string; home_airport: string } | null;
    const prefs = prefsRes.data as { cabin_class: string; max_connections: number } | null;
    const plan = profile?.plan ?? "free";

    const parsed = parseTripSentence(data.sentence);
    const request: TripRequest = {
      ...parsed,
      cabinClass: (prefs?.cabin_class as TripRequest["cabinClass"]) ?? parsed.cabinClass,
    };

    const requestRow = await supabase
      .from("trip_requests")
      .insert({ user_id: userId, raw_sentence: data.sentence, parsed: request })
      .select("id")
      .single();
    if (requestRow.error) throw new Error(requestRow.error.message);
    const tripRequestId = (requestRow.data as { id: string }).id;

    const search = await searchTripWithDuffel(request);

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
        items: { search, priced: { flight, stay, car, total } },
      })
      .select("id")
      .single();
    if (card.error) throw new Error(card.error.message);

    return {
      cardId: (card.data as { id: string }).id,
      plan,
      search,
      priced: { flight, stay, car, total },
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
      items: { search: TripSearchResponse; priced: LiveTripResult["priced"] };
      total_minor: number;
      saved_minor: number;
      expires_at: string | null;
      status: string;
    };
    return {
      cardId: row.id,
      search: row.items.search,
      priced: row.items.priced,
      totalEur: row.total_minor / 100,
      savedEur: row.saved_minor / 100,
      expiresAt: row.expires_at,
      status: row.status,
      expired: row.expires_at ? new Date(row.expires_at).getTime() < Date.now() : false,
    };
  });
