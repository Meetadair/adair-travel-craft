/**
 * "Connected calendars": Google, Microsoft 365 / Outlook and a subscribable
 * feed for Apple Calendar. Adair only adds Adair trips; it never reads events.
 */
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Check, Copy, Link2, Trash2 } from "lucide-react";
import {
  disconnectCalendar,
  getCalendarSettings,
  scanCalendarHints,
  setCalendarRead,
  startCalendarConnect,
  syncMyTripsToCalendars,
  type CalendarProviderName,
} from "@/lib/calendar.functions";

const LABEL: Record<CalendarProviderName, string> = {
  google: "Google Calendar",
  microsoft: "Microsoft 365 / Outlook",
};

export function ConnectedCalendars() {
  const fetchSettings = useServerFn(getCalendarSettings);
  const beginConnect = useServerFn(startCalendarConnect);
  const removeConnection = useServerFn(disconnectCalendar);
  const syncTrips = useServerFn(syncMyTripsToCalendars);
  const changeRead = useServerFn(setCalendarRead);
  const scanHints = useServerFn(scanCalendarHints);
  const queryClient = useQueryClient();

  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const settings = useQuery({ queryKey: ["calendar-settings"], queryFn: () => fetchSettings() });

  // Message after returning from the provider's consent screen.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const status = new URL(window.location.href).searchParams.get("calendar");
    if (!status) return;
    setNotice(
      status === "connected"
        ? "Calendar connected. Your trips are on their way."
        : status === "cancelled"
          ? "Connection cancelled — nothing was changed."
          : status === "expired"
            ? "That link expired. Please try connecting again."
            : "We could not connect that calendar. Please try again.",
    );
    if (status === "connected") {
      void syncTrips().catch(() => undefined);
      void scanHints()
        .then(() => queryClient.invalidateQueries({ queryKey: ["trip-hints"] }))
        .catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: ["calendar-settings"] });
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, [queryClient, syncTrips, scanHints]);

  const connect = useMutation({
    mutationFn: async (
      input: CalendarProviderName | { provider: CalendarProviderName; read: boolean },
    ) => {
      const provider = typeof input === "string" ? input : input.provider;
      const read = typeof input === "string" ? false : input.read;
      const timeZone =
        typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
      const result = await beginConnect({
        data: { provider, origin: window.location.origin, timeZone, read },
      });
      window.location.href = result.url;
    },
    onError: () => setNotice("We could not start that connection. Please try again."),
  });

  const remove = useMutation({
    mutationFn: (provider: CalendarProviderName) => removeConnection({ data: { provider } }),
    onSuccess: async () => {
      setNotice("Disconnected. The stored access was deleted.");
      await queryClient.invalidateQueries({ queryKey: ["calendar-settings"] });
    },
  });

  // Read access is a separate, optional consent — never bundled into connect.
  const readAccess = useMutation({
    mutationFn: async (input: { provider: CalendarProviderName; enabled: boolean }) => {
      if (input.enabled) {
        // Needs a fresh consent screen for the read permission.
        await connect.mutateAsync({ provider: input.provider, read: true });
        return;
      }
      await changeRead({ data: { provider: input.provider, enabled: false } });
      setNotice("Trip spotting is off, and what we stored from your calendar was deleted.");
      await queryClient.invalidateQueries({ queryKey: ["calendar-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["trip-hints"] });
    },
  });

  const feed = useMemo(() => {
    const path = settings.data?.feedPath;
    if (!path || typeof window === "undefined") return null;
    return {
      webcal: `webcal://${window.location.host}${path}`,
      https: `${window.location.origin}${path}`,
    };
  }, [settings.data?.feedPath]);

  const connected = (provider: CalendarProviderName) =>
    settings.data?.connections.find((c) => c.provider === provider) ?? null;

  return (
    <section className="hairline-card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Connected calendars</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Adair only adds your Adair trips. We never read your calendar.
        </p>
      </div>

      {notice && <p className="text-sm text-primary">{notice}</p>}
      {settings.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {(["google", "microsoft"] as const).map((provider) => {
        const link = connected(provider);
        const available = settings.data?.available[provider];
        return (
          <div
            key={provider}
            className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="size-4 shrink-0 text-muted-foreground" />
                {LABEL[provider]}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {!settings.data
                  ? " "
                  : !available
                    ? "Not available yet — this calendar is being set up."
                    : link
                      ? `Connected${link.accountEmail ? ` · ${link.accountEmail}` : ""}`
                      : provider === "google"
                        ? "Adds and updates only the events Adair creates."
                        : "Adds and updates only the events Adair creates."}
              </p>
            </div>
            {available && link && (
              <button
                type="button"
                onClick={() => remove.mutate(provider)}
                disabled={remove.isPending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-secondary disabled:opacity-60"
              >
                <Trash2 className="size-4" /> Disconnect
              </button>
            )}
            {available && link && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground sm:max-w-[16rem]">
                <input
                  type="checkbox"
                  checked={link.readEnabled}
                  onChange={(e) =>
                    readAccess.mutate({ provider, enabled: e.currentTarget.checked })
                  }
                  disabled={readAccess.isPending}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span>
                  Let Adair spot trips you’ll need to book — we only look for events with a location
                  away from home, and never read anything else. Optional, and you can turn it off
                  any time.
                </span>
              </label>
            )}
            {available && !link && (
              <button
                type="button"
                onClick={() => connect.mutate(provider)}
                disabled={connect.isPending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <Link2 className="size-4" /> Connect
              </button>
            )}
          </div>
        );
      })}

      <div className="rounded-xl border border-border p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="size-4 shrink-0 text-muted-foreground" />
          Apple iCloud Calendar
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Apple Calendar: subscribe once, updates automatically.
        </p>
        {feed && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <a
              href={feed.webcal}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Subscribe in Apple Calendar
            </a>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(feed.https);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                } catch {
                  setNotice("Copy failed — select the link manually.");
                }
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-secondary"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy feed link"}
            </button>
          </div>
        )}
        <p className="mt-2 break-all text-[11px] text-muted-foreground">{feed?.https}</p>
      </div>

      <p className="text-xs text-muted-foreground">
        Prefer no connection? Every booking still offers an “Add to calendar” download.
      </p>
    </section>
  );
}
