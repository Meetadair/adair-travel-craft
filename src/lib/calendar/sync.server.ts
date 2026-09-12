/**
 * Push booked trips into the customer's connected calendars.
 *
 * We only ever write events we created. Provider event ids are stored on the
 * trip item, so a change updates the same event and a cancellation removes it —
 * never a duplicate.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { tripCalendarEvents, type CalendarEvent, type ItemCalendarPayload } from "@/lib/calendar";
import { decryptToken, encryptToken } from "@/lib/calendar/crypto.server";
import {
  refreshAccessToken,
  removeEvent,
  upsertEvent,
  type CalendarProvider,
} from "@/lib/calendar/providers.server";

type Db = SupabaseClient<Database>;

export type SyncTrip = {
  id: string;
  title: string;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  reference: string | null;
  items: Array<{
    id: string;
    kind: string;
    title: string;
    status: string;
    reference: string | null;
    payload?: ItemCalendarPayload | null;
    /** Stored provider event ids, keyed "<provider>:<event uid>". */
    eventIds?: Record<string, string> | null;
  }>;
};

type LiveConnection = {
  provider: CalendarProvider;
  accessToken: string;
  calendarId: string;
  timeZone: string;
};

/** Connections with a usable access token, refreshing silently when expired. */
export async function liveConnections(db: Db, userId: string): Promise<LiveConnection[]> {
  const res = await db
    .from("calendar_connections")
    .select("id, provider, access_token, refresh_token, expires_at, calendar_id, time_zone")
    .eq("user_id", userId);
  if (res.error || !res.data) return [];

  const live: LiveConnection[] = [];
  for (const row of res.data) {
    const provider = row.provider as CalendarProvider;
    if (!row.access_token) continue;
    try {
      let accessToken = await decryptToken(row.access_token);
      const expired = row.expires_at ? Date.parse(row.expires_at) - 60_000 < Date.now() : false;
      if (expired && row.refresh_token) {
        const refreshed = await refreshAccessToken(provider, await decryptToken(row.refresh_token));
        accessToken = refreshed.accessToken;
        await db
          .from("calendar_connections")
          .update({
            access_token: await encryptToken(refreshed.accessToken),
            expires_at: refreshed.expiresAt,
            ...(refreshed.refreshToken
              ? { refresh_token: await encryptToken(refreshed.refreshToken) }
              : {}),
          })
          .eq("id", row.id);
      } else if (expired) {
        continue;
      }
      live.push({
        provider,
        accessToken,
        calendarId: row.calendar_id ?? "primary",
        timeZone: row.time_zone ?? "UTC",
      });
    } catch (error) {
      console.error("calendar connection unusable", provider, error);
    }
  }
  return live;
}

const eventsForItem = (events: CalendarEvent[], itemId: string) =>
  events.filter((event) => event.uid.startsWith(`${itemId}-`));

/**
 * Create or update every event of a trip in every connected calendar and store
 * the resulting event ids on the trip items. Never throws.
 */
export async function syncTripToCalendars(db: Db, userId: string, trip: SyncTrip): Promise<number> {
  try {
    const connections = await liveConnections(db, userId);
    if (!connections.length) return 0;
    const events = tripCalendarEvents(trip);
    let written = 0;

    for (const item of trip.items) {
      const stored: Record<string, string> = { ...(item.eventIds ?? {}) };
      const cancelled = item.status === "cancelled" || item.status === "failed";
      const mine = cancelled ? [] : eventsForItem(events, item.id);

      for (const connection of connections) {
        // Remove events that no longer belong on the trip.
        for (const key of Object.keys(stored)) {
          if (!key.startsWith(`${connection.provider}:`)) continue;
          const uid = key.slice(connection.provider.length + 1);
          if (mine.some((event) => event.uid === uid)) continue;
          const eventId = stored[key];
          if (!eventId) continue;
          try {
            await removeEvent(connection.provider, {
              accessToken: connection.accessToken,
              calendarId: connection.calendarId,
              eventId,
            });
          } catch (error) {
            console.error("calendar delete failed", error);
          }
          delete stored[key];
        }

        for (const event of mine) {
          const key = `${connection.provider}:${event.uid}`;
          try {
            const eventId = await upsertEvent(connection.provider, {
              accessToken: connection.accessToken,
              calendarId: connection.calendarId,
              timeZone: connection.timeZone,
              event,
              eventId: stored[key] ?? null,
            });
            if (eventId) {
              stored[key] = eventId;
              written += 1;
            }
          } catch (error) {
            console.error("calendar write failed", error);
          }
        }
      }

      await db
        .from("trip_items")
        .update({ calendar_event_ids: stored })
        .eq("id", item.id)
        .eq("user_id", userId);
    }

    return written;
  } catch (error) {
    console.error("calendar sync failed", error);
    return 0;
  }
}

/** Delete every connected-calendar event created for one trip line. */
export async function removeItemFromCalendars(
  db: Db,
  userId: string,
  itemId: string,
): Promise<void> {
  try {
    const res = await db
      .from("trip_items")
      .select("calendar_event_ids")
      .eq("id", itemId)
      .eq("user_id", userId)
      .maybeSingle();
    const stored = (res.data?.calendar_event_ids ?? {}) as Record<string, string>;
    if (!Object.keys(stored).length) return;
    const connections = await liveConnections(db, userId);
    for (const connection of connections) {
      for (const [key, eventId] of Object.entries(stored)) {
        if (!key.startsWith(`${connection.provider}:`)) continue;
        try {
          await removeEvent(connection.provider, {
            accessToken: connection.accessToken,
            calendarId: connection.calendarId,
            eventId,
          });
        } catch (error) {
          console.error("calendar delete failed", error);
        }
        delete stored[key];
      }
    }
    await db
      .from("trip_items")
      .update({ calendar_event_ids: stored })
      .eq("id", itemId)
      .eq("user_id", userId);
  } catch (error) {
    console.error("calendar cleanup failed", error);
  }
}
