/**
 * Flight extras for a held trip card: the airline's own checked bags and seats,
 * priced with the extras markup and pre-ticked from stored preferences.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TripSearchResponse } from "@/lib/trip/types";
import {
  ANCILLARY_NONE_NOTE,
  ANCILLARY_NO_SEATS_NOTE,
  preselectAncillaries,
  type AncillaryOption,
  type AncillarySelection,
} from "@/lib/trip/ancillaries";

export type FlightAncillaries = {
  options: AncillaryOption[];
  preselected: AncillarySelection[];
  /** Plain sentence to show when the fare carries no bags or no seats. */
  bagNote: string | null;
  seatNote: string | null;
};

export const getFlightAncillaries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ cardId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<FlightAncillaries> => {
    const empty: FlightAncillaries = {
      options: [],
      preselected: [],
      bagNote: ANCILLARY_NONE_NOTE,
      seatNote: ANCILLARY_NO_SEATS_NOTE,
    };

    const res = await context.supabase
      .from("trip_cards")
      .select("items")
      .eq("user_id", context.userId)
      .eq("id", data.cardId)
      .maybeSingle();
    if (res.error || !res.data) return empty;

    const search = (res.data as unknown as { items: { search: TripSearchResponse } }).items.search;
    const offerId = search.flight?.offerId;
    if (!offerId) return empty;

    const [{ getOfferAncillaries }, { loadPricing }] = await Promise.all([
      import("@/lib/trip/duffel-book.server"),
      import("@/lib/pricing.server"),
    ]);

    const table = await loadPricing(context.supabase as never, "free");

    let options: AncillaryOption[] = [];
    try {
      const result = await getOfferAncillaries(offerId, table.extras);
      options = result.options;
    } catch (error) {
      console.error("ancillaries lookup failed", error);
      return empty;
    }

    const prefs = await context.supabase
      .from("preferences")
      .select("seat, seat_front, seat_legroom")
      .eq("user_id", context.userId)
      .maybeSingle();
    const prefRow = (prefs.data ?? null) as {
      seat: string;
      seat_front: boolean;
      seat_legroom: boolean;
    } | null;

    const nights = search.request.returnDate
      ? Math.max(
          1,
          Math.round(
            (new Date(search.request.returnDate).getTime() -
              new Date(search.request.departDate).getTime()) /
              86_400_000,
          ),
        )
      : 1;

    const preselected = preselectAncillaries(
      options,
      {
        seat: prefRow?.seat === "window" || prefRow?.seat === "aisle" ? prefRow.seat : "any",
        seatFront: prefRow?.seat_front ?? false,
        seatLegroom: prefRow?.seat_legroom ?? false,
      },
      { nights, passengers: Math.max(1, search.request.passengers) },
    );

    return {
      options,
      preselected,
      bagNote: options.some((o) => o.kind === "bag") ? null : ANCILLARY_NONE_NOTE,
      seatNote: options.some((o) => o.kind === "seat") ? null : ANCILLARY_NO_SEATS_NOTE,
    };
  });
