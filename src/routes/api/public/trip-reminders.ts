/**
 * Reminder emails for upcoming trips. Called by a scheduler (once or twice a
 * day). Sends one email 24 h before departure and one on the morning of it.
 * If RESEND_API_KEY is not configured, the run does nothing and reports so.
 */
import { createFileRoute } from "@tanstack/react-router";

type ItemRow = {
  trip_id: string;
  kind: string;
  title: string;
  status: string;
  payload: Record<string, string | null> | null;
};

function itineraryLines(items: ItemRow[]): string {
  return items
    .filter((item) => item.status !== "cancelled" && item.status !== "failed")
    .map((item) => {
      const p = item.payload ?? {};
      const when =
        p['departAt'] ??
        p['pickupAt'] ??
        p['reservationAt'] ??
        p['checkin'] ??
        p['pickup'] ??
        null;
      const label =
        item.kind === "flight"
          ? "Flight"
          : item.kind === "car"
            ? "Car"
            : item.kind === "ride"
              ? "Transfer"
              : item.kind === "restaurant"
                ? "Dinner"
                : item.kind === "insurance"
                  ? "Insurance"
                  : "Hotel";
      const where =
        item.kind === "ride"
          ? [p['pickupAddress'], p['dropoffAddress']].filter(Boolean).join(" → ")
          : item.kind === "restaurant" && p['partySize']
            ? `table for ${String(p['partySize'])}`
            : "";
      return `<li>${label}: ${item.title}${when ? ` — ${String(when).replace("T", " ").slice(0, 16)}` : ""}${where ? ` (${where})` : ""}</li>`;
    })
    .join("");
}

async function run(): Promise<Response> {
  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey) return Response.json({ ok: true, skipped: "no-email-key", sent: 0 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const day = 86_400_000;
  const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = iso(new Date());
  const tomorrow = iso(new Date(Date.now() + day));

  const tripsRes = await supabaseAdmin
    .from("trips")
    .select("id, user_id, title, city, start_date, status")
    .in("start_date", [today, tomorrow])
    .eq("status", "booked");
  if (tripsRes.error) return Response.json({ ok: false, error: tripsRes.error.message }, { status: 500 });
  const trips = (tripsRes.data ?? []) as Array<{
    id: string;
    user_id: string;
    title: string;
    city: string | null;
    start_date: string;
  }>;
  if (!trips.length) return Response.json({ ok: true, sent: 0 });

  const itemsRes = await supabaseAdmin
    .from("trip_items")
    .select("trip_id, kind, title, status, payload")
    .in("trip_id", trips.map((t) => t.id));
  const items = (itemsRes.data ?? []) as ItemRow[];

  const sentRes = await supabaseAdmin
    .from("trip_reminders")
    .select("trip_id, kind")
    .in("trip_id", trips.map((t) => t.id));
  const alreadySent = new Set(
    ((sentRes.data ?? []) as Array<{ trip_id: string; kind: string }>).map(
      (r) => `${r.trip_id}:${r.kind}`,
    ),
  );

  // "Getting from the airport" note for the day-before email, when the team
  // has written one for that destination.
  const cities = Array.from(
    new Set(trips.map((t) => (t.city ?? "").trim()).filter((c) => c.length > 0)),
  );
  const airportTips = new Map<string, string>();
  if (cities.length) {
    const { parseTravelTips } = await import("@/lib/trip/tips");
    const destRes = await supabaseAdmin
      .from("getaway_destinations")
      .select("name, travel_tips")
      .in("name", cities);
    for (const row of (destRes.data ?? []) as Array<{ name: string; travel_tips: unknown }>) {
      const tip = parseTravelTips(row.travel_tips).airport;
      if (tip) airportTips.set(row.name.toLowerCase(), tip);
    }
  }

  let sent = 0;
  for (const trip of trips) {
    const kind = trip.start_date === today ? "day_of" : "day_before";
    if (alreadySent.has(`${trip.id}:${kind}`)) continue;

    const userRes = await supabaseAdmin.auth.admin.getUserById(trip.user_id);
    const email = userRes.data.user?.email;
    if (!email) continue;

    const subject =
      kind === "day_of"
        ? `Today: your trip to ${trip.city ?? "your destination"}`
        : `Tomorrow: your trip to ${trip.city ?? "your destination"}`;
    const airportTip = trip.city ? airportTips.get(trip.city.trim().toLowerCase()) : undefined;
    const tipBlock = airportTip
      ? `<p><strong>Getting from the airport:</strong> ${escapeHtml(airportTip)}</p>`
      : "";
    const html = `<p>${subject}</p><ul>${itineraryLines(items.filter((i) => i.trip_id === trip.id))}</ul>${tipBlock}<p>Adair</p>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env['RESEND_FROM'] ?? "Adair <onboarding@resend.dev>",
        to: [email],
        subject,
        html,
      }),
    });
    if (!res.ok) continue;

    await supabaseAdmin.from("trip_reminders").insert({ trip_id: trip.id, kind });
    sent += 1;
  }

  return Response.json({ ok: true, sent });
}

export const Route = createFileRoute("/api/public/trip-reminders")({
  server: { handlers: { GET: () => run(), POST: () => run() } },
});
