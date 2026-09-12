/**
 * Connected calendars for signed-in customers: Google, Microsoft 365 and a
 * private subscribable feed for Apple Calendar.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const providerSchema = z.enum(["google", "microsoft"]);

export type CalendarProviderName = z.infer<typeof providerSchema>;

export type CalendarSettings = {
  /** Providers whose credentials are configured on the server. */
  available: Record<CalendarProviderName, boolean>;
  connections: Array<{
    provider: CalendarProviderName;
    accountEmail: string | null;
    connectedAt: string;
    /** Optional read access: lets Adair spot trips from their calendar. */
    readEnabled: boolean;
  }>;
  /** Unguessable path for the .ics subscription feed, without the host. */
  feedPath: string;
};

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

export const getCalendarSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CalendarSettings> => {
    const { supabase, userId } = context;
    const { providerAvailable } = await import("@/lib/calendar/providers.server");

    const connectionsRes = await supabase
      .from("calendar_connections")
      .select("provider, account_email, created_at, read_enabled")
      .eq("user_id", userId);

    let feedRes = await supabase
      .from("calendar_feeds")
      .select("token")
      .eq("user_id", userId)
      .maybeSingle();
    if (!feedRes.data) {
      const token = randomToken();
      await supabase.from("calendar_feeds").insert({ user_id: userId, token });
      feedRes = { ...feedRes, data: { token } } as typeof feedRes;
    }

    return {
      available: { google: providerAvailable("google"), microsoft: providerAvailable("microsoft") },
      connections: (connectionsRes.data ?? []).map((row) => ({
        provider: row.provider as CalendarProviderName,
        accountEmail: row.account_email,
        connectedAt: row.created_at,
        readEnabled: Boolean(row.read_enabled),
      })),
      feedPath: `/api/public/calendar/feed/${feedRes.data?.token ?? ""}.ics`,
    };
  });

export const startCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        provider: providerSchema,
        origin: z.string().url(),
        timeZone: z.string().max(64).optional(),
        /** Ask for read access too (spotting trips) — separate opt-in. */
        read: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { supabase, userId } = context;
    const { authorizeUrl, providerAvailable } = await import("@/lib/calendar/providers.server");
    if (!providerAvailable(data.provider)) throw new Error("provider-not-configured");

    // The "read_" prefix tells the callback this consent included read access.
    const state = `${data.read ? "read_" : ""}${randomToken()}`;
    const redirectUri = `${data.origin.replace(/\/$/, "")}/api/public/calendar/callback/${data.provider}`;
    const insert = await supabase.from("calendar_oauth_states").insert({
      state,
      user_id: userId,
      provider: data.provider,
      redirect_uri: redirectUri,
      time_zone: data.timeZone ?? null,
    });
    if (insert.error) throw new Error(insert.error.message);

    return { url: authorizeUrl(data.provider, { redirectUri, state, read: data.read === true }) };
  });

export const disconnectCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ provider: providerSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Deleting the row deletes the stored tokens.
    const res = await supabase
      .from("calendar_connections")
      .delete()
      .eq("user_id", userId)
      .eq("provider", data.provider);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

/** Push every booked trip into the connected calendars (used after connecting). */
export const syncMyTripsToCalendars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ events: number }> => {
    const { supabase, userId } = context;
    const { syncTripToCalendars } = await import("@/lib/calendar/sync.server");

    const tripsRes = await supabase
      .from("trips")
      .select("id, title, city, start_date, end_date, document_number, status")
      .eq("user_id", userId)
      .neq("status", "cancelled");
    if (tripsRes.error || !tripsRes.data?.length) return { events: 0 };

    const itemsRes = await supabase
      .from("trip_items")
      .select("id, trip_id, kind, title, status, offer_reference, payload, calendar_event_ids")
      .eq("user_id", userId)
      .in(
        "trip_id",
        tripsRes.data.map((t) => t.id),
      );
    const items = itemsRes.data ?? [];

    let events = 0;
    for (const trip of tripsRes.data) {
      events += await syncTripToCalendars(supabase, userId, {
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
            payload: (i.payload ?? null) as never,
            eventIds: (i.calendar_event_ids ?? {}) as Record<string, string>,
          })),
      });
    }
    return { events };
  });

/**
 * Reading the calendar to spot trips — a separate, optional opt-in on top of
 * the existing write connection. Off by default.
 */
export const setCalendarRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ provider: providerSchema, enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; needsConsent: boolean }> => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("calendar_connections")
      .update({ read_enabled: data.enabled })
      .eq("user_id", userId)
      .eq("provider", data.provider);
    if (res.error) throw new Error(res.error.message);

    if (!data.enabled) {
      // Turning it off deletes everything we stored from their calendar.
      await supabase
        .from("calendar_trip_hints")
        .delete()
        .eq("user_id", userId)
        .eq("provider", data.provider);
    }
    return { ok: true, needsConsent: data.enabled };
  });

export const scanCalendarHints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ found: number }> => {
    const { supabase, userId } = context;
    const profile = await supabase
      .from("profiles")
      .select("home_airport")
      .eq("id", userId)
      .maybeSingle();
    const homeIata = (profile.data?.home_airport ?? "WAW").toUpperCase();
    const { scanHints } = await import("@/lib/calendar/hints.server");
    const result = await scanHints(supabase, userId, homeIata);
    return { found: result.found };
  });

export type TripHintRow = {
  id: string;
  title: string;
  city: string;
  location: string;
  startsAt: string;
  endsAt: string;
  sentence: string;
};

export const listTripHints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ hints: TripHintRow[]; readEnabled: boolean }> => {
    const { supabase, userId } = context;
    const [profile, connections, hints] = await Promise.all([
      supabase.from("profiles").select("home_airport").eq("id", userId).maybeSingle(),
      supabase.from("calendar_connections").select("read_enabled").eq("user_id", userId),
      supabase
        .from("calendar_trip_hints")
        .select("id, title, city, location, starts_at, ends_at")
        .eq("user_id", userId)
        .is("dismissed_at", null)
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(5),
    ]);

    const { CITIES } = await import("@/lib/trip/cities");
    const { hintSentence } = await import("@/lib/calendar/hints");
    const homeIata = (profile.data?.home_airport ?? "WAW").toUpperCase();
    const homeCity = CITIES.find((c) => c.iata === homeIata)?.city ?? "home";

    return {
      readEnabled: (connections.data ?? []).some((c) => c.read_enabled),
      hints: (hints.data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        city: row.city,
        location: row.location,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        sentence: hintSentence(
          { city: row.city, startsAt: row.starts_at, endsAt: row.ends_at },
          homeCity,
        ),
      })),
    };
  });

/** Dismissing is final: the suggestion never comes back. */
export const dismissTripHint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("calendar_trip_hints")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("id", data.id);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });
