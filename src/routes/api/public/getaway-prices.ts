/**
 * Nightly Getaway price check. For every home airport in use, it prices the
 * coming weekends to the active curated destinations and stores the result as
 * our own baseline. Batched and paced so it never competes with a live
 * customer search, and it keeps 90 days of history.
 */
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { comingWeekends } from "@/lib/getaway/match";

/** How many price lookups one run is allowed to make. */
const MAX_LOOKUPS = 120;
/** Pause between supplier calls, so live searches always win. */
const PACE_MS = 900;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run(request: Request): Promise<Response> {
  const denied = await authenticateCronRequest(request);
  if (denied) return denied;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { searchFlight, hasDuffelKey } = await import("@/lib/trip/duffel.server");
  if (!hasDuffelKey()) return Response.json({ ok: true, skipped: "no-supplier-key", checked: 0 });

  // Every home airport actually in use, so we only price real demand.
  const originsRes = await supabaseAdmin
    .from("profiles")
    .select("home_airport")
    .not("home_airport", "is", null);
  const origins = Array.from(
    new Set(
      ((originsRes.data ?? []) as Array<{ home_airport: string | null }>)
        .map((r) => (r.home_airport ?? "").toUpperCase())
        .filter((iata) => iata.length === 3),
    ),
  );

  const destRes = await supabaseAdmin
    .from("getaway_destinations")
    .select("id, name, nearest_airport_iata, latitude, longitude, active")
    .eq("active", true);
  const destinations = (destRes.data ?? []) as Array<{
    id: string;
    name: string;
    nearest_airport_iata: string;
    latitude: number;
    longitude: number;
  }>;

  const weekends = comingWeekends(2);
  let checked = 0;
  let failed = 0;

  outer: for (const origin of origins) {
    for (const dest of destinations) {
      if (dest.nearest_airport_iata.toUpperCase() === origin) continue;
      for (const weekend of weekends) {
        if (checked + failed >= MAX_LOOKUPS) break outer;

        // Skip anything we already priced today for this exact route and dates.
        const seen = await supabaseAdmin
          .from("getaway_prices")
          .select("id")
          .eq("origin_iata", origin)
          .eq("destination_id", dest.id)
          .eq("depart_date", weekend.depart)
          .gte("checked_at", new Date(Date.now() - 20 * 3_600_000).toISOString())
          .limit(1);
        if ((seen.data ?? []).length) continue;

        try {
          const result = await searchFlight({
            originCity: origin,
            originIata: origin,
            destinationCity: dest.name,
            destinationIata: dest.nearest_airport_iata,
            lat: Number(dest.latitude),
            lon: Number(dest.longitude),
            departDate: weekend.depart,
            returnDate: weekend.return,
            cabinClass: "economy",
            passengers: 1,
            hotelWish: null,
            hotelNameExact: null,
            carNameExact: null,
            needsCar: false,
            invoiceToCompany: false,
            stops: [],
          });
          const flightMinor = result?.flight
            ? Math.round(Number(result.flight.amountEur) * 100)
            : null;
          await supabaseAdmin.from("getaway_prices").insert({
            destination_id: dest.id,
            origin_iata: origin,
            depart_date: weekend.depart,
            return_date: weekend.return,
            flight_minor: flightMinor,
            stay_minor: null,
            currency: "EUR",
          });
          checked += 1;
        } catch {
          failed += 1;
        }
        await sleep(PACE_MS);
      }
    }
  }

  // 90 days of history is the baseline; older rows are dropped.
  await supabaseAdmin
    .from("getaway_prices")
    .delete()
    .lt("checked_at", new Date(Date.now() - 90 * 86_400_000).toISOString());

  return Response.json({ ok: true, origins: origins.length, checked, failed });
}

export const Route = createFileRoute("/api/public/getaway-prices")({
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
