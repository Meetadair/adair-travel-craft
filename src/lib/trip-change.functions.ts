/**
 * Changing a booked trip. The traveller changes one parameter; everything else
 * is kept. We quote the difference and the conditions first, and only then
 * book the new trip and release the old one.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isBooked, isLive } from "@/lib/trip/trip-status";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { changeSentence, type ChangeMethod, type ChangeTrip } from "@/lib/trip/change";

export type StartChangeResult = {
  tripId: string;
  sentence: string;
  oldTotalEur: number;
  feeEur: number;
  method: ChangeMethod;
  trip: ChangeTrip;
  documentNumber: string | null;
};

const startSchema = z.object({
  tripId: z.string().uuid(),
  kind: z.enum(["dates", "stay"]),
  departDate: z.string().trim().min(1).nullable().optional(),
  returnDate: z.string().trim().min(1).nullable().optional(),
  stayName: z.string().trim().min(1).max(120).nullable().optional(),
});

type ItemRow = {
  id: string;
  kind: string;
  title: string;
  status: string;
  amount: number;
  detail: string | null;
  offer_reference: string | null;
  supplier_order_id: string | null;
  payload: Record<string, unknown> | null;
};

const activeItems = (rows: ItemRow[]) => rows.filter((r) => isLive(r.status));

export const startTripChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => startSchema.parse(input))
  .handler(async ({ data, context }): Promise<StartChangeResult> => {
    const { supabase, userId } = context;

    const tripRes = await supabase
      .from("trips")
      .select(
        "id, title, city, origin, start_date, end_date, status, total_amount, document_number",
      )
      .eq("user_id", userId)
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw new Error(tripRes.error.message);
    if (!tripRes.data) throw new Error("trip-not-found");
    const trip = tripRes.data as {
      id: string;
      city: string | null;
      origin: string | null;
      start_date: string | null;
      end_date: string | null;
      status: string;
      total_amount: number;
      document_number: string | null;
    };
    if (trip.status === "cancelled") throw new Error("trip-cancelled");
    // A saved itinerary has no supplier order behind it, so there is nothing to
    // change and nothing to cancel. Offering either would be a lie.
    if (!isBooked(trip.status)) throw new Error("trip-not-booked");

    const itemsRes = await supabase
      .from("trip_items")
      .select(
        "id, kind, title, status, amount, detail, offer_reference, supplier_order_id, payload",
      )
      .eq("user_id", userId)
      .eq("trip_id", trip.id);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    const items = activeItems((itemsRes.data ?? []) as ItemRow[]);
    if (!items.length) throw new Error("nothing-to-change");

    const stay = items.find((i) => i.kind === "stay");
    const flight = items.find((i) => i.kind === "flight");
    const passengers = Math.max(
      1,
      Number((flight?.payload as Record<string, unknown> | null)?.["passengers"] ?? 1) || 1,
    );

    const changeTrip: ChangeTrip = {
      originCity: trip.origin ?? "",
      destinationCity: trip.city ?? "",
      startDate: trip.start_date,
      endDate: trip.end_date,
      stayName: stay?.title ?? null,
      passengers,
      hasFlight: Boolean(flight),
      hasStay: Boolean(stay),
      hasCar: items.some((i) => i.kind === "car"),
    };

    const { loadPricing } = await import("@/lib/pricing.server");
    const profileRes = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .maybeSingle();
    const plan = ((profileRes.data as { plan: string } | null)?.plan ?? "free") as string;
    const pricing = await loadPricing(supabase as never, plan);
    const feeEur = (pricing.flight?.changeFeeMinor ?? 0) / 100;

    return {
      tripId: trip.id,
      sentence: changeSentence(changeTrip, {
        kind: data.kind,
        departDate: data.departDate ?? null,
        returnDate: data.returnDate ?? null,
        stayName: data.stayName ?? null,
      }),
      oldTotalEur: Number(trip.total_amount ?? 0),
      feeEur,
      // We do not swap a line inside an existing booking: the new trip is
      // booked and the old one released, with the fee shown up front.
      method: "cancel-and-rebook",
      trip: changeTrip,
      documentNumber: trip.document_number,
    };
  });

const finaliseSchema = z.object({
  oldTripId: z.string().uuid(),
  newTripId: z.string().uuid(),
  kind: z.enum(["dates", "stay"]),
  feeEur: z.number().min(0).max(10000),
  note: z.string().trim().max(400).nullable().optional(),
});

export type FinaliseChangeResult = {
  refundEur: number;
  differenceEur: number;
  cancelled: number;
  /** Anything the supplier did not confirm cancelled — empty when everything was. */
  unfinished: string[];
  documentNumber: string | null;
};

export const finaliseTripChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => finaliseSchema.parse(input))
  .handler(async ({ data, context }): Promise<FinaliseChangeResult> => {
    const { supabase, userId } = context;
    if (data.oldTripId === data.newTripId) throw new Error("same-trip");

    const tripsRes = await supabase
      .from("trips")
      .select(
        "id, title, city, origin, start_date, end_date, status, total_amount, document_number, company_id",
      )
      .eq("user_id", userId)
      .in("id", [data.oldTripId, data.newTripId]);
    if (tripsRes.error) throw new Error(tripsRes.error.message);
    const rows = (tripsRes.data ?? []) as Array<Record<string, unknown>>;
    const oldTrip = rows.find((r) => r["id"] === data.oldTripId);
    const newTrip = rows.find((r) => r["id"] === data.newTripId);
    if (!oldTrip || !newTrip) throw new Error("trip-not-found");
    if (oldTrip["status"] === "changed") throw new Error("already-changed");

    // 1. Release every line of the original booking with the supplier.
    const itemsRes = await supabase
      .from("trip_items")
      .select(
        "id, kind, title, status, amount, detail, offer_reference, supplier_order_id, payload",
      )
      .eq("user_id", userId)
      .eq("trip_id", data.oldTripId);
    const oldItems = activeItems((itemsRes.data ?? []) as ItemRow[]);

    const { removeItemFromCalendars } = await import("@/lib/calendar/sync.server");
    const { cancelAtSupplier, cancelNote, needsFollowUp } =
      await import("@/lib/trip/supplier-cancel");
    let cancelled = 0;
    /** Lines the supplier did not confirm, so the traveller is told rather than assured. */
    const unfinished: string[] = [];
    for (const item of oldItems) {
      const outcome = await cancelAtSupplier({
        kind: item.kind,
        supplierOrderId: item.supplier_order_id,
      });
      const status = outcome === "released" || outcome === "unsupported" ? "cancelled" : outcome;
      if (needsFollowUp(outcome)) {
        const note = cancelNote(item.kind, outcome);
        if (note) unfinished.push(note);
      }
      await supabase.from("trip_items").update({ status }).eq("id", item.id).eq("user_id", userId);
      // Calendar entries follow the stored provider event IDs.
      try {
        await removeItemFromCalendars(supabase, userId, item.id);
      } catch (error) {
        console.error("calendar removal failed", error);
      }
      cancelled += 1;
    }

    await supabase
      .from("trips")
      .update({ status: "changed", total_amount: 0 })
      .eq("id", data.oldTripId)
      .eq("user_id", userId);

    const oldTotal = Number(oldTrip["total_amount"] ?? 0);
    const newTotal = Number(newTrip["total_amount"] ?? 0);
    const { changeQuote } = await import("@/lib/trip/change");
    const quote = changeQuote(oldTotal, newTotal, data.feeEur);

    // 2. The original trip's creator commission goes with it; the new trip
    //    accrued its own commission when it was booked.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { reverseCreatorEarnings } = await import("@/lib/creators.server");
      await reverseCreatorEarnings(supabaseAdmin as never, data.oldTripId);
    } catch (error) {
      console.error("creator reversal failed", error);
    }

    // 3. Corrected invoice for the company that was billed.
    try {
      const companyId = (newTrip["company_id"] ?? oldTrip["company_id"]) as string | null;
      if (companyId) {
        const companyRes = await supabase
          .from("companies")
          .select(
            "name, legal_form, vat_id, country, city, postcode, street, building, address_extra, invoice_email, invoice_emails",
          )
          .eq("id", companyId)
          .eq("user_id", userId)
          .maybeSingle();
        const c = (companyRes.data ?? null) as Record<string, unknown> | null;
        if (c) {
          const raw = Array.isArray(c["invoice_emails"]) ? (c["invoice_emails"] as string[]) : [];
          const emails = [...raw, (c["invoice_email"] as string | null) ?? ""].filter(
            (e): e is string => typeof e === "string" && e.trim().length > 0,
          );
          const line = (key: string) => (c[key] as string | null) ?? null;
          const address = [
            [line("street"), line("building")].filter(Boolean).join(" "),
            line("address_extra"),
            [line("postcode"), line("city")].filter(Boolean).join(" "),
            line("country"),
          ].filter((v): v is string => Boolean(v && v.trim()));
          const newItemsRes = await supabase
            .from("trip_items")
            .select("kind, title, detail, offer_reference, amount, status")
            .eq("user_id", userId)
            .eq("trip_id", data.newTripId);
          const newItems = ((newItemsRes.data ?? []) as ItemRow[]).filter(
            (i) => i.status !== "cancelled" && i.status !== "failed",
          );
          const { isTestKey } = await import("@/lib/trip/duffel.server");
          const { sendInvoiceEmail } = await import("@/lib/invoice-email.server");
          await sendInvoiceEmail({
            to: Array.from(new Set(emails)),
            documentNumber: (newTrip["document_number"] as string | null) ?? data.newTripId,
            correctionOf: (oldTrip["document_number"] as string | null) ?? data.oldTripId,
            companyName: [line("name"), line("legal_form")].filter(Boolean).join(" ") || null,
            companyVatId: line("vat_id"),
            companyAddress: address,
            origin: (newTrip["origin"] as string | null) ?? null,
            destination: (newTrip["city"] as string | null) ?? null,
            startDate: (newTrip["start_date"] as string | null) ?? null,
            endDate: (newTrip["end_date"] as string | null) ?? null,
            totalEur: newTotal,
            testMode: isTestKey(),
            lines: newItems.map((i) => ({
              kind: i.kind,
              title: i.title,
              detail: i.detail,
              reference: i.offer_reference,
              amountEur: Number(i.amount),
            })),
          });
        }
      }
    } catch (error) {
      console.error("correction invoice failed", error);
    }

    // 4. Record the change for the traveller and for the audit trail.
    await supabase.from("trip_changes").insert({
      trip_id: data.newTripId,
      user_id: userId,
      kind: data.kind,
      method: "cancel-and-rebook",
      before: {
        tripId: data.oldTripId,
        documentNumber: oldTrip["document_number"] ?? null,
        startDate: oldTrip["start_date"] ?? null,
        endDate: oldTrip["end_date"] ?? null,
        totalEur: oldTotal,
      } as never,
      after: {
        tripId: data.newTripId,
        documentNumber: newTrip["document_number"] ?? null,
        startDate: newTrip["start_date"] ?? null,
        endDate: newTrip["end_date"] ?? null,
        totalEur: newTotal,
      } as never,
      difference_minor: Math.round(quote.differenceEur * 100),
      fee_minor: Math.round(quote.feeEur * 100),
      status: "completed",
      note: data.note ?? null,
    });

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("audit_log").insert({
        actor: userId,
        action: "trip_changed",
        entity: "trip",
        before: { tripId: data.oldTripId, totalEur: oldTotal } as never,
        after: {
          tripId: data.newTripId,
          totalEur: newTotal,
          kind: data.kind,
          feeEur: quote.feeEur,
        } as never,
      });
    } catch (error) {
      console.error("audit_log insert failed", error);
    }

    return {
      refundEur: quote.refundEur,
      differenceEur: quote.differenceEur,
      cancelled,
      /**
       * Anything the supplier did not confirm. Empty means every line really is
       * released; a line here is a job somebody still has to finish, and the
       * traveller is told rather than assured.
       */
      unfinished,
      documentNumber: (newTrip["document_number"] as string | null) ?? null,
    };
  });
