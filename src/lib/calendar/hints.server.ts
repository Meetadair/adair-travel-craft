/**
 * Reading the connected calendar to spot trips. Only runs for a connection
 * where the customer explicitly opted in to read access.
 */
import { eventsToHints, type TripHint } from "@/lib/calendar/hints";
import { liveConnections } from "@/lib/calendar/sync.server";

type Db = Parameters<typeof liveConnections>[0];

export async function scanHints(
  db: Db,
  userId: string,
  homeIata: string,
  now = new Date(),
): Promise<{ found: number; scanned: number }> {
  const { listUpcomingEvents } = await import("@/lib/calendar/providers.server");
  const connections = await liveConnections(db, userId);

  // Only connections with read consent.
  const readRes = await db
    .from("calendar_connections")
    .select("provider, read_enabled")
    .eq("user_id", userId);
  const readable = new Set(
    (readRes.data ?? []).filter((r) => r.read_enabled).map((r) => r.provider),
  );

  const to = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  let found = 0;
  let scanned = 0;

  for (const connection of connections) {
    if (!readable.has(connection.provider)) continue;
    let hints: TripHint[] = [];
    try {
      const events = await listUpcomingEvents(connection.provider, {
        accessToken: connection.accessToken,
        calendarId: connection.calendarId,
        from: now,
        to,
      });
      scanned += events.length;
      hints = eventsToHints(events, { homeIata, now });
    } catch {
      continue;
    }

    for (const hint of hints) {
      // Skip anything already dismissed — a dismissal is final.
      const existing = await db
        .from("calendar_trip_hints")
        .select("id, dismissed_at")
        .eq("user_id", userId)
        .eq("provider", connection.provider)
        .eq("event_id", hint.eventId)
        .maybeSingle();
      if (existing.data?.dismissed_at) continue;

      const row = {
        user_id: userId,
        provider: connection.provider,
        event_id: hint.eventId,
        title: hint.title,
        location: hint.location,
        city: hint.city,
        iata: hint.iata,
        starts_at: hint.startsAt,
        ends_at: hint.endsAt,
      };
      if (existing.data) {
        await db.from("calendar_trip_hints").update(row).eq("id", existing.data.id);
      } else {
        await db.from("calendar_trip_hints").insert(row);
      }
      found += 1;
    }
  }

  // Hints for events that have passed are no longer useful — delete them.
  await db
    .from("calendar_trip_hints")
    .delete()
    .eq("user_id", userId)
    .lt("ends_at", now.toISOString());

  return { found, scanned };
}
