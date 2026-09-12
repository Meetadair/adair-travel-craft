/**
 * Google Calendar and Microsoft Graph calendar adapters.
 *
 * Scopes are the narrowest that allow writing our own events. We never read the
 * customer's existing events: no list/get calls on their calendar.
 */
import type { CalendarEvent } from "@/lib/calendar";

export type CalendarProvider = "google" | "microsoft";

type Creds = { clientId: string; clientSecret: string };

const CONFIG: Record<CalendarProvider, { idEnv: string; secretEnv: string; label: string }> = {
  google: {
    idEnv: "GOOGLE_CALENDAR_CLIENT_ID",
    secretEnv: "GOOGLE_CALENDAR_CLIENT_SECRET",
    label: "Google Calendar",
  },
  microsoft: {
    idEnv: "MS_GRAPH_CLIENT_ID",
    secretEnv: "MS_GRAPH_CLIENT_SECRET",
    label: "Microsoft 365 / Outlook",
  },
};

export const PROVIDER_LABEL = (provider: CalendarProvider) => CONFIG[provider].label;

export function providerCreds(provider: CalendarProvider): Creds | null {
  const clientId = process.env[CONFIG[provider].idEnv];
  const clientSecret = process.env[CONFIG[provider].secretEnv];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export const providerAvailable = (provider: CalendarProvider): boolean =>
  providerCreds(provider) !== null;

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.events", "openid", "email"];
const MS_SCOPES = ["offline_access", "openid", "email", "Calendars.ReadWrite", "User.Read"];

export function authorizeUrl(
  provider: CalendarProvider,
  opts: { redirectUri: string; state: string; read?: boolean },
): string {
  const creds = providerCreds(provider);
  if (!creds) throw new Error("provider-not-configured");
  if (provider === "google") {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: opts.redirectUri,
      response_type: "code",
      scope: (opts.read ? readScopes("google") : GOOGLE_SCOPES).join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state: opts.state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: (opts.read ? readScopes("microsoft") : MS_SCOPES).join(" "),
    state: opts.state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

const tokenEndpoint = (provider: CalendarProvider) =>
  provider === "google"
    ? "https://oauth2.googleapis.com/token"
    : "https://login.microsoftonline.com/common/oauth2/v2.0/token";

type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  email: string | null;
};

function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  const part = idToken.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`calendar-oauth-failed [${res.status}]: ${text}`);
  return JSON.parse(text) as Record<string, unknown>;
}

export async function exchangeCode(
  provider: CalendarProvider,
  opts: { code: string; redirectUri: string },
): Promise<TokenSet> {
  const creds = providerCreds(provider);
  if (!creds) throw new Error("provider-not-configured");
  const json = await postForm(tokenEndpoint(provider), {
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    code: opts.code,
    grant_type: "authorization_code",
    redirect_uri: opts.redirectUri,
  });
  const expiresIn = Number(json["expires_in"] ?? 3600);
  let email = emailFromIdToken(json["id_token"] as string | undefined);
  const accessToken = String(json["access_token"]);
  if (!email && provider === "microsoft") email = await graphEmail(accessToken);
  return {
    accessToken,
    refreshToken: (json["refresh_token"] as string | undefined) ?? null,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    email,
  };
}

export async function refreshAccessToken(
  provider: CalendarProvider,
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: string; refreshToken: string | null }> {
  const creds = providerCreds(provider);
  if (!creds) throw new Error("provider-not-configured");
  const json = await postForm(tokenEndpoint(provider), {
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const expiresIn = Number(json["expires_in"] ?? 3600);
  return {
    accessToken: String(json["access_token"]),
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    refreshToken: (json["refresh_token"] as string | undefined) ?? null,
  };
}

async function graphEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { mail?: string; userPrincipalName?: string };
  return json.mail ?? json.userPrincipalName ?? null;
}

/** Reminders: 24 h and 2 h before the event starts. */
const REMINDERS = [1440, 120];

function googleBody(event: CalendarEvent, timeZone: string) {
  const when = (value: string) =>
    event.allDay ? { date: value.slice(0, 10) } : { dateTime: `${value}:00`, timeZone };
  return {
    summary: event.title,
    description: event.description,
    location: event.location,
    start: when(event.start),
    end: when(event.end),
    reminders: {
      useDefault: false,
      overrides: REMINDERS.map((minutes) => ({ method: "popup", minutes })),
    },
  };
}

function graphBody(event: CalendarEvent, timeZone: string) {
  const when = (value: string) =>
    event.allDay
      ? { dateTime: `${value.slice(0, 10)}T00:00:00`, timeZone }
      : { dateTime: `${value}:00`, timeZone };
  return {
    subject: event.title,
    body: { contentType: "text", content: event.description },
    location: { displayName: event.location },
    start: when(event.start),
    end: when(event.end),
    isAllDay: event.allDay,
    isReminderOn: true,
    // Graph supports a single reminder per event; the .ics fallback carries both.
    reminderMinutesBeforeStart: 120,
  };
}

async function callApi(url: string, accessToken: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`calendar-api-failed [${res.status}]: ${text}`);
  }
  if (res.status === 204) return {};
  return (await res.json()) as Record<string, unknown>;
}

const googleEventsUrl = (calendarId: string) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

/** Create the event, or update it in place when we already made one. */
export async function upsertEvent(
  provider: CalendarProvider,
  opts: {
    accessToken: string;
    calendarId: string;
    timeZone: string;
    event: CalendarEvent;
    eventId: string | null;
  },
): Promise<string | null> {
  const tz = opts.timeZone || "UTC";
  if (provider === "google") {
    const base = googleEventsUrl(opts.calendarId);
    const body = googleBody(opts.event, tz);
    if (opts.eventId) {
      const patched = await callApi(`${base}/${encodeURIComponent(opts.eventId)}`, opts.accessToken, "PATCH", body);
      if (patched) return opts.eventId;
    }
    const created = await callApi(base, opts.accessToken, "POST", body);
    return created ? String(created["id"]) : null;
  }
  const base = "https://graph.microsoft.com/v1.0/me/events";
  const body = graphBody(opts.event, tz);
  if (opts.eventId) {
    const patched = await callApi(`${base}/${encodeURIComponent(opts.eventId)}`, opts.accessToken, "PATCH", body);
    if (patched) return opts.eventId;
  }
  const created = await callApi(base, opts.accessToken, "POST", body);
  return created ? String(created["id"]) : null;
}

export async function removeEvent(
  provider: CalendarProvider,
  opts: { accessToken: string; calendarId: string; eventId: string },
): Promise<void> {
  const url =
    provider === "google"
      ? `${googleEventsUrl(opts.calendarId)}/${encodeURIComponent(opts.eventId)}`
      : `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(opts.eventId)}`;
  await callApi(url, opts.accessToken, "DELETE");
}

/**
 * Reading is a separate, optional consent. These scopes are only requested
 * when the customer opts in to letting Adair spot trips, and they are
 * read-only: we can list events, never change or delete them.
 */
const GOOGLE_READ_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const MS_READ_SCOPE = "Calendars.Read";

/** One upcoming event, reduced to the few fields a trip hint needs. */
export type RawCalendarEvent = {
  id: string;
  title: string;
  location: string | null;
  start: string | null;
  end: string | null;
  allDay: boolean;
  recurring: boolean;
};

/** Forward-looking events in a window. Read-only; no other calendar data. */
export async function listUpcomingEvents(
  provider: CalendarProvider,
  opts: { accessToken: string; calendarId: string; from: Date; to: Date; limit?: number },
): Promise<RawCalendarEvent[]> {
  const limit = opts.limit ?? 100;
  const timeMin = opts.from.toISOString();
  const timeMax = opts.to.toISOString();

  if (provider === "google") {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(limit),
      fields: "items(id,summary,location,start,end,recurringEventId)",
    });
    const json = await callApi(
      `${googleEventsUrl(opts.calendarId)}?${params.toString()}`,
      opts.accessToken,
      "GET",
    );
    const items = (json?.["items"] ?? []) as Array<Record<string, never>>;
    return items.map((item) => {
      const start = item["start"] as unknown as { date?: string; dateTime?: string } | undefined;
      const end = item["end"] as unknown as { date?: string; dateTime?: string } | undefined;
      return {
        id: String(item["id"] ?? ""),
        title: String(item["summary"] ?? ""),
        location: (item["location"] as unknown as string) ?? null,
        start: start?.dateTime ?? start?.date ?? null,
        end: end?.dateTime ?? end?.date ?? null,
        allDay: Boolean(start?.date && !start?.dateTime),
        recurring: Boolean(item["recurringEventId"]),
      };
    });
  }

  const params = new URLSearchParams({
    startDateTime: timeMin,
    endDateTime: timeMax,
    $top: String(limit),
    $select: "id,subject,location,start,end,isAllDay,type,seriesMasterId",
  });
  const json = await callApi(
    `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`,
    opts.accessToken,
    "GET",
  );
  const items = (json?.["value"] ?? []) as Array<Record<string, never>>;
  return items.map((item) => {
    const start = item["start"] as unknown as { dateTime?: string } | undefined;
    const end = item["end"] as unknown as { dateTime?: string } | undefined;
    const location = item["location"] as unknown as { displayName?: string } | undefined;
    const type = String(item["type"] ?? "singleInstance");
    return {
      id: String(item["id"] ?? ""),
      title: String(item["subject"] ?? ""),
      location: location?.displayName ?? null,
      start: start?.dateTime ? `${start.dateTime}Z`.replace(/Z+$/, "Z") : null,
      end: end?.dateTime ? `${end.dateTime}Z`.replace(/Z+$/, "Z") : null,
      allDay: Boolean(item["isAllDay"]),
      recurring: type !== "singleInstance" || Boolean(item["seriesMasterId"]),
    };
  });
}

export function readScopes(provider: CalendarProvider): string[] {
  return provider === "google"
    ? [...GOOGLE_SCOPES, GOOGLE_READ_SCOPE]
    : [...MS_SCOPES, MS_READ_SCOPE];
}
