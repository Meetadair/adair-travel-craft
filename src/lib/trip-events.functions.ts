/**
 * "Happening while you're there" — real events near the hotel during the
 * trip's own dates, from Ticketmaster's Discovery API. Discovery-only: every
 * card links to Ticketmaster's own event page to buy, because that tier
 * cannot sell a ticket through us (see ticketmaster.server.ts). Nothing here
 * is ever presented as something Adair booked or can book.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { eventsNear, ticketmasterConfigured } from "@/lib/events/ticketmaster.server";
import type { TripEvent } from "@/lib/events/types";
import type { TripSearchResponse } from "@/lib/trip/types";

export type TripEvents = {
  city: string;
  any: boolean;
  events: TripEvent[];
};

const EMPTY = (city = ""): TripEvents => ({ city, any: false, events: [] });

export const getTripEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tripId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<TripEvents> => {
    if (!ticketmasterConfigured()) return EMPTY();
    const { supabase, userId } = context;

    const tripRes = await supabase
      .from("trips")
      .select("id, city, start_date, end_date, card_id")
      .eq("user_id", userId)
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw new Error(tripRes.error.message);
    if (!tripRes.data) throw new Error("trip-not-found");
    const trip = tripRes.data as {
      city: string | null;
      start_date: string | null;
      end_date: string | null;
      card_id: string | null;
    };
    const city = trip.city ?? "";
    if (!trip.start_date) return EMPTY(city);

    const cardRes = trip.card_id
      ? await supabase.from("trip_cards").select("items").eq("id", trip.card_id).maybeSingle()
      : { data: null };
    const search = (cardRes.data as { items?: { search?: TripSearchResponse } } | null)?.items
      ?.search;
    const point =
      search?.request.lat != null && search?.request.lon != null
        ? { lat: search.request.lat, lon: search.request.lon }
        : null;
    if (!point) return EMPTY(city);

    const events = await eventsNear(
      supabase,
      point,
      trip.start_date,
      trip.end_date ?? trip.start_date,
    );

    return { city, any: events.length > 0, events: events.slice(0, 12) };
  });
