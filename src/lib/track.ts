/**
 * Browser-side helper for the first-party event log. Fire-and-forget: analytics
 * must never block or break the interaction it is measuring.
 */
import { logEvent, type EventName } from "@/lib/events.functions";

const KEY = "adair.session";

function sessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing && existing.length >= 6) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s${Date.now()}${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return `s${Date.now()}`;
  }
}

export function track(
  name: EventName,
  props?: Record<string, unknown>,
  userId?: string | null,
): void {
  if (typeof window === "undefined") return;
  void logEvent({
    data: {
      name,
      sessionId: sessionId(),
      ...(props ? { props } : {}),
      ...(userId ? { userId } : {}),
    },
  }).catch(() => {});
}
