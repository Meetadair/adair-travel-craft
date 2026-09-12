/**
 * Supplier order updates: schedule changes, cancellations and other
 * supplier-initiated changes to an order we booked.
 *
 * Every request is signature-verified before the body is treated as data, and
 * a message id we have already handled is ignored. On a real change we update
 * the affected trip items, keep the customer's connected calendars in step,
 * write a before/after audit row, and email the customer when email is
 * configured.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const payloadSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
  order_reference: z.string().min(1).max(120),
  status: z.enum(["confirmed", "changed", "cancelled"]).optional(),
  message: z.string().max(500).optional(),
  segments: z
    .array(
      z.object({
        departAt: z.string().max(40).optional(),
        arriveAt: z.string().max(40).optional(),
        origin: z.string().max(10).optional(),
        destination: z.string().max(10).optional(),
      }),
    )
    .max(20)
    .optional(),
});

function signatureMatches(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const given = header.trim().replace(/^sha256=/, "");
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function notify(
  email: string | undefined,
  subject: string,
  body: string,
): Promise<void> {
  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey || !email) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env['RESEND_FROM'] ?? "Adair <onboarding@resend.dev>",
        to: [email],
        subject,
        html: `<p>${body}</p><p>Adair</p>`,
      }),
    });
  } catch {
    // A failed email never fails the update.
  }
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env['SUPPLIER_WEBHOOK_SECRET'];
  if (!secret) return new Response("Not configured", { status: 503 });

  const raw = await request.text();
  const header =
    request.headers.get("x-adair-signature") ??
    request.headers.get("x-webhook-signature") ??
    request.headers.get("x-duffel-signature");
  if (!signatureMatches(raw, header, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return new Response("Invalid body", { status: 400 });
  const event = parsed.data;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Replay protection: the same message id is only ever applied once.
  const seen = await supabaseAdmin
    .from("supplier_events")
    .insert({
      event_id: event.id,
      event_kind: event.type,
      order_reference: event.order_reference,
    })
    .select("id")
    .maybeSingle();
  if (seen.error) return Response.json({ ok: true, duplicate: true });

  const itemRes = await supabaseAdmin
    .from("trip_items")
    .select("id, trip_id, user_id, kind, title, detail, status, payload, supplier_order_id")
    .eq("supplier_order_id", event.order_reference)
    .limit(5);
  const items = (itemRes.data ?? []) as Array<{
    id: string;
    trip_id: string;
    user_id: string;
    kind: string;
    title: string;
    detail: string | null;
    status: string;
    payload: Record<string, unknown> | null;
    supplier_order_id: string | null;
  }>;
  if (!items.length) return Response.json({ ok: true, matched: 0 });

  const cancelled = event.status === "cancelled" || /cancel/i.test(event.type);
  const first = event.segments?.[0];
  let changedItems = 0;

  for (const item of items) {
    const before = { status: item.status, payload: item.payload };
    const payload: Record<string, unknown> = { ...(item.payload ?? {}) };
    if (first?.departAt) payload['departAt'] = first.departAt;
    if (first?.arriveAt) payload['arriveAt'] = first.arriveAt;
    const status = cancelled ? "cancelled" : item.status;
    const detail = event.message ?? item.detail;

    const updated = await supabaseAdmin
      .from("trip_items")
      .update({ status, payload, detail })
      .eq("id", item.id)
      .select("id")
      .maybeSingle();
    if (updated.error) continue;
    changedItems += 1;

    await supabaseAdmin.from("audit_log").insert({
      action: cancelled ? "supplier_order_cancelled" : "supplier_order_changed",
      entity: `trip_item:${item.id}`,
      before: before as never,
      after: { status, payload, detail } as never,
    });

    // Keep the customer's calendars honest about what actually happens now.
    try {
      const { removeItemFromCalendars, syncTripToCalendars } = await import(
        "@/lib/calendar/sync.server"
      );
      if (cancelled) {
        await removeItemFromCalendars(supabaseAdmin as never, item.user_id, item.id);
      } else {
        const tripRes = await supabaseAdmin
          .from("trips")
          .select("id, title, city, start_date, end_date, document_number")
          .eq("id", item.trip_id)
          .maybeSingle();
        const allItems = await supabaseAdmin
          .from("trip_items")
          .select("id, kind, title, status, offer_reference, payload, calendar_event_ids")
          .eq("trip_id", item.trip_id);
        if (tripRes.data) {
          await syncTripToCalendars(supabaseAdmin as never, item.user_id, {
            id: tripRes.data.id,
            title: tripRes.data.title,
            city: tripRes.data.city,
            startDate: tripRes.data.start_date,
            endDate: tripRes.data.end_date,
            reference: tripRes.data.document_number,
            items: ((allItems.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
              id: String(row['id']),
              kind: String(row['kind']),
              title: String(row['title']),
              status: String(row['status']),
              reference: (row['offer_reference'] as string | null) ?? null,
              payload: row['payload'] as never,
              eventIds: row['calendar_event_ids'] as never,
            })),
          });
        }
      }
    } catch {
      // Calendar trouble must never block recording the supplier's change.
    }
  }

  // When every line on the trip is gone, the trip itself is cancelled.
  const tripId = items[0]!.trip_id;
  if (cancelled) {
    const remaining = await supabaseAdmin
      .from("trip_items")
      .select("status")
      .eq("trip_id", tripId);
    const live = ((remaining.data ?? []) as Array<{ status: string }>).filter(
      (row) => row.status !== "cancelled" && row.status !== "failed",
    );
    if (!live.length) {
      await supabaseAdmin.from("trips").update({ status: "cancelled" }).eq("id", tripId);
    }
  }

  const userRes = await supabaseAdmin.auth.admin.getUserById(items[0]!.user_id);
  await notify(
    userRes.data.user?.email,
    cancelled ? "Your booking has been cancelled" : "A change to your trip",
    cancelled
      ? `${items[0]!.title} has been cancelled by the operator.${event.message ? ` ${event.message}` : ""} We will be in touch with the options.`
      : `The times for ${items[0]!.title} have changed.${event.message ? ` ${event.message}` : ""} Your trip in Adair is already up to date.`,
  );

  return Response.json({ ok: true, matched: items.length, changed: changedItems, cancelled });
}

export const Route = createFileRoute("/api/public/supplier/order-updated")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
    },
  },
});
