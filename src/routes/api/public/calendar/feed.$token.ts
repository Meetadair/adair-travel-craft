/**
 * Private, unguessable .ics subscription feed. Apple Calendar (or any client)
 * subscribes once with webcal:// and refreshes automatically afterwards.
 */
import { createFileRoute } from "@tanstack/react-router";
import { buildIcs, tripCalendarEvents, type ItemCalendarPayload } from "@/lib/calendar";

export const Route = createFileRoute("/api/public/calendar/feed/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token.replace(/\.ics$/i, "");
        if (!/^[a-f0-9]{24,64}$/.test(token)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const feed = await supabaseAdmin
          .from("calendar_feeds")
          .select("user_id")
          .eq("token", token)
          .maybeSingle();
        if (!feed.data) return new Response("Not found", { status: 404 });
        const userId = feed.data.user_id;

        const tripsRes = await supabaseAdmin
          .from("trips")
          .select("id, title, city, start_date, end_date, document_number, status")
          .eq("user_id", userId)
          .neq("status", "cancelled");
        const trips = tripsRes.data ?? [];

        const itemsRes = trips.length
          ? await supabaseAdmin
              .from("trip_items")
              .select("id, trip_id, kind, title, status, offer_reference, payload")
              .eq("user_id", userId)
              .in(
                "trip_id",
                trips.map((t) => t.id),
              )
          : { data: [] as never[] };
        const items = itemsRes.data ?? [];

        const events = trips.flatMap((trip) =>
          tripCalendarEvents({
            id: trip.id,
            title: trip.title,
            city: trip.city,
            startDate: trip.start_date,
            endDate: trip.end_date,
            reference: trip.document_number,
            items: items
              .filter((i) => i.trip_id === trip.id)
              .map((i) => ({
                id: i.id,
                kind: i.kind,
                title: i.title,
                status: i.status,
                reference: i.offer_reference,
                payload: (i.payload ?? null) as ItemCalendarPayload | null,
              })),
          }),
        );

        return new Response(buildIcs(events, "Adair trips"), {
          headers: {
            "content-type": "text/calendar; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
