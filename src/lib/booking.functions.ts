/**
 * Test-mode booking: reprice the held offer, create the supplier order,
 * store the trip with its line items, and allow cancelling a line.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TripSearchResponse } from "@/lib/trip/types";
import {
  tripCalendarEvents,
  type CalendarEvent,
  type ItemCalendarPayload,
} from "@/lib/calendar";

const travellerSchema = z.object({
  givenName: z.string().trim().min(1).max(60),
  familyName: z.string().trim().min(1).max(60),
  email: z.string().trim().email(),
  phone: z.string().trim().min(6).max(25),
  bornOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(["m", "f"]),
  title: z.enum(["mr", "ms", "mrs"]),
});

const bookSchema = z.object({
  cardId: z.string().uuid(),
  include: z.object({ flight: z.boolean(), stay: z.boolean(), car: z.boolean() }),
  companyId: z.string().uuid().nullable(),
  traveller: travellerSchema,
});

export type BookingResult = {
  tripId: string | null;
  status: "confirmed" | "partial" | "failed";
  reference: string | null;
  totalEur: number;
  lines: Array<{
    kind: string;
    title: string;
    status: string;
    amountEur: number;
    reference: string | null;
    note: string | null;
    payload?: ItemCalendarPayload;
  }>;
  repriced: { from: number; to: number } | null;
  /** Machine-readable failure reason, e.g. "offer-expired". */
  reason: string | null;
  testMode: boolean;
  /** Calendar events for the booked legs, ready for .ics / Google Calendar. */
  calendar: CalendarEvent[];
};


type CardItems = {
  search: TripSearchResponse;
  priced: { flight: number | null; stay: number | null; car: number | null; total: number };
};


export const bookTripCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bookSchema.parse(input))
  .handler(async ({ data, context }): Promise<BookingResult> => {
    const { supabase, userId } = context;
    const [{ getOffer, createFlightOrder }, pricing, { isTestKey }] = await Promise.all([
      import("@/lib/trip/duffel-book.server"),
      import("@/lib/pricing.server"),
      import("@/lib/trip/duffel.server"),
    ]);

    const cardRes = await supabase
      .from("trip_cards")
      .select("id, items, status, expires_at")
      .eq("user_id", userId)
      .eq("id", data.cardId)
      .maybeSingle();
    if (cardRes.error) throw new Error(cardRes.error.message);
    if (!cardRes.data) throw new Error("card-not-found");
    const card = cardRes.data as unknown as {
      id: string;
      items: CardItems;
      status: string;
      expires_at: string | null;
    };
    if (card.status === "booked") throw new Error("already-booked");

    const search = card.items.search;
    const priced = card.items.priced;
    const request = search.request;

    const lines: BookingResult["lines"] = [];
    let repriced: BookingResult["repriced"] = null;
    let flightOrderId: string | null = null;
    let flightReference: string | null = null;
    let flightGross = 0;
    let flightNet = 0;
    let failed = false;
    let reason: string | null = null;

    const planRes = await supabase.from("profiles").select("plan").eq("id", userId).maybeSingle();
    const plan = (planRes.data as { plan: string } | null)?.plan ?? "free";
    const table = await pricing.loadPricing(supabase, plan);

    if (data.include.flight && search.flight?.offerId) {
      try {
        const offer = await getOffer(search.flight.offerId);
        if (Math.abs(offer.totalAmount - search.flight.amount) > 0.01) {
          repriced = { from: search.flight.amount, to: offer.totalAmount };
        }
        const order = await createFlightOrder({
          offerId: offer.id,
          amount: offer.totalAmount,
          currency: offer.currency,
          passengerIds: offer.passengerIds,
          traveller: data.traveller,
          idempotencyKey: `${card.id}-flight`,
        });
        flightOrderId = order.id;
        flightReference = order.bookingReference;
        flightNet = search.flight.amountEur;
        // The card already holds the traveller price; only recompute if missing.
        flightGross =
          priced.flight ?? pricing.fromMinor(pricing.grossMinor(flightNet, table.flight));
        lines.push({
          kind: "flight",
          title: `${search.flight.carrier} ${search.flight.flightNumbers.join(" / ")}`,
          status: "confirmed",
          amountEur: flightGross,
          reference: order.bookingReference,
          note: null,
          payload: {
            route: `${request.originIata} → ${request.destinationIata}`,
            returnRoute: `${request.destinationIata} → ${request.originIata}`,
            departAt: search.flight.departAt,
            arriveAt: search.flight.arriveAt,
            returnDepartAt: search.flight.returnDepartAt,
          },
        });

      } catch (error) {
        failed = true;
        const message = error instanceof Error ? error.message : "unknown";
        reason =
          message === "offer-gone" || message === "duffel-422" || message === "duffel-404"
            ? "offer-expired"
            : message === "missing-key"
              ? "supplier-not-configured"
              : "supplier-error";
        lines.push({
          kind: "flight",
          title: search.flight
            ? `${search.flight.carrier} ${search.flight.flightNumbers.join(" / ")}`
            : "Flight",
          status: "failed",
          amountEur: 0,
          reference: null,
          note: reason,
        });
      }
    }


    // Stays and cars are not bookable on this supplier account yet: they are
    // stored as requested lines so nothing is silently charged.
    if (data.include.stay && search.stay) {
      lines.push({
        kind: "stay",
        title: search.stay.name,
        status: "requested",
        amountEur: priced.stay ?? 0,
        reference: null,
        note: "supplier-not-enabled",
        payload: {
          checkin: request.departDate,
          checkout: request.returnDate,
          address: search.stay.address ?? request.destinationCity,
        },
      });
    }
    if (data.include.car && search.car) {
      lines.push({
        kind: "car",
        title: `${search.car.vehicle} · ${search.car.supplier}`,
        status: "requested",
        amountEur: priced.car ?? 0,
        reference: null,
        note: "supplier-not-enabled",
        payload: {
          pickup: request.departDate,
          dropoff: request.returnDate,
          location: request.destinationCity,
        },
      });
    }


    if (!lines.length) throw new Error("nothing-selected");

    const confirmedTotal =
      Math.round(lines.reduce((sum, l) => sum + (l.status === "failed" ? 0 : l.amountEur), 0) * 100) /
      100;
    const status: BookingResult["status"] = lines.every((l) => l.status === "failed")
      ? "failed"
      : failed
        ? "partial"
        : "confirmed";

    const audit = async (action: string, after: unknown) => {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("audit_log")
          .insert({ actor: userId, action, entity: "trip_card", after: after as never });
      } catch (error) {
        console.error("audit_log insert failed", error);
      }
    };

    // Nothing at all could be booked: keep the card open so the traveller can
    // simply search again instead of ending up with an empty trip.
    if (status === "failed") {
      await supabase.from("payments").insert({
        user_id: userId,
        provider: "duffel-test",
        amount_minor: Math.round(priced.total * 100),
        status: "failed",
        idempotency_key: `${card.id}-payment`,
      });
      await audit("booking_failed", { cardId: card.id, reason });
      return {
        tripId: null,
        status,
        reference: null,
        totalEur: 0,
        lines,
        repriced,
        reason,
        testMode: isTestKey(),
      };
    }

    const tripRow = await supabase
      .from("trips")
      .insert({
        user_id: userId,
        title: `${request.destinationCity} · ${request.departDate} – ${request.returnDate}`,
        city: request.destinationCity,
        origin: request.originCity,
        start_date: request.departDate,
        end_date: request.returnDate,
        status: "booked",
        total_amount: confirmedTotal,
        card_id: card.id,
        company_id: data.companyId,
        booked_at: new Date().toISOString(),
        document_number: flightReference,
        data_source: "duffel-test",
      })
      .select("id")
      .single();
    if (tripRow.error) throw new Error(tripRow.error.message);
    const tripId = (tripRow.data as { id: string }).id;

    const itemsInsert = lines.map((line, index) => ({
      trip_id: tripId,
      user_id: userId,
      kind: line.kind,
      type: line.kind,
      title: line.title,
      detail: line.note,
      status: line.status,
      supplier: "duffel",
      supplier_order_id: line.kind === "flight" ? flightOrderId : null,
      offer_reference: line.reference,
      amount: line.amountEur,
      net_minor: line.kind === "flight" ? Math.round(flightNet * 100) : 0,
      gross_minor: Math.round(line.amountEur * 100),
      position: index,
      payload: {},
      documents: [],
    }));
    const itemsRes = await supabase.from("trip_items").insert(itemsInsert);
    if (itemsRes.error) throw new Error(itemsRes.error.message);

    await supabase
      .from("trip_cards")
      .update({ status: "booked" })
      .eq("id", card.id)
      .eq("user_id", userId);

    await supabase.from("payments").insert({
      user_id: userId,
      trip_id: tripId,
      provider: "duffel-test",
      provider_ref: flightOrderId,
      amount_minor: Math.round(confirmedTotal * 100),
      status: "test_settled",
      idempotency_key: `${card.id}-payment`,
    });

    await audit("booking_created", {
      cardId: card.id,
      tripId,
      status,
      totalEur: confirmedTotal,
      testMode: isTestKey(),
    });

    return {
      tripId,
      status,
      reference: flightReference,
      totalEur: confirmedTotal,
      lines,
      repriced,
      reason,
      testMode: isTestKey(),
    };

  });

export type MyTrip = {
  id: string;
  title: string;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  totalEur: number;
  reference: string | null;
  /** True when the trip was created against the supplier's test environment. */
  testMode: boolean;
  items: Array<{
    id: string;
    kind: string;
    title: string;
    detail: string | null;
    status: string;
    amountEur: number;
    reference: string | null;
  }>;
};

export const listMyTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyTrip[]> => {
    const { supabase, userId } = context;
    const tripsRes = await supabase
      .from("trips")
      .select(
        "id, title, city, start_date, end_date, status, total_amount, document_number, data_source, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (tripsRes.error) throw new Error(tripsRes.error.message);
    const trips = (tripsRes.data ?? []) as Array<{
      id: string;
      title: string;
      city: string | null;
      start_date: string | null;
      end_date: string | null;
      status: string;
      total_amount: number;
      document_number: string | null;
      data_source: string | null;
    }>;

    if (!trips.length) return [];

    const itemsRes = await supabase
      .from("trip_items")
      .select("id, trip_id, kind, title, detail, status, amount, offer_reference, position")
      .eq("user_id", userId)
      .in(
        "trip_id",
        trips.map((t) => t.id),
      )
      .order("position", { ascending: true });
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    const items = (itemsRes.data ?? []) as Array<{
      id: string;
      trip_id: string;
      kind: string;
      title: string;
      detail: string | null;
      status: string;
      amount: number;
      offer_reference: string | null;
    }>;

    return trips.map((trip) => ({
      id: trip.id,
      title: trip.title,
      city: trip.city,
      startDate: trip.start_date,
      endDate: trip.end_date,
      status: trip.status,
      totalEur: Number(trip.total_amount),
      reference: trip.document_number,
      testMode: (trip.data_source ?? "").includes("test"),

      items: items
        .filter((i) => i.trip_id === trip.id)
        .map((i) => ({
          id: i.id,
          kind: i.kind,
          title: i.title,
          detail: i.detail,
          status: i.status,
          amountEur: Number(i.amount),
          reference: i.offer_reference,
        })),
    }));
  });

export const cancelTripItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ itemId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const itemRes = await supabase
      .from("trip_items")
      .select("id, kind, status, supplier_order_id, trip_id, amount")
      .eq("user_id", userId)
      .eq("id", data.itemId)
      .maybeSingle();
    if (itemRes.error) throw new Error(itemRes.error.message);
    if (!itemRes.data) throw new Error("item-not-found");
    const item = itemRes.data as {
      id: string;
      kind: string;
      status: string;
      supplier_order_id: string | null;
      trip_id: string;
      amount: number;
    };
    if (item.status === "cancelled") return { status: "cancelled" as const };

    let status = "cancelled";
    if (item.kind === "flight" && item.supplier_order_id) {
      const { cancelFlightOrder } = await import("@/lib/trip/duffel-book.server");
      try {
        const result = await cancelFlightOrder(item.supplier_order_id);
        status = result.status;
      } catch {
        status = "cancel-requested";
      }
    }

    await supabase
      .from("trip_items")
      .update({ status })
      .eq("id", item.id)
      .eq("user_id", userId);

    const remaining = await supabase
      .from("trip_items")
      .select("amount, status")
      .eq("user_id", userId)
      .eq("trip_id", item.trip_id);
    const rows = (remaining.data ?? []) as Array<{ amount: number; status: string }>;
    const active = rows.filter((r) => r.status !== "cancelled" && r.status !== "failed");
    await supabase
      .from("trips")
      .update({
        total_amount: active.reduce((sum, r) => sum + Number(r.amount), 0),
        status: active.length ? "booked" : "cancelled",
      })
      .eq("id", item.trip_id)
      .eq("user_id", userId);

    return { status };
  });
