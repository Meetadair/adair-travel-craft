/** Browser-side calls to the trip parse + search routes. */
import type { PriceContext, TripRequest, TripSearchResponse } from "./types";

export async function parseTrip(sentence: string): Promise<TripRequest> {
  const res = await fetch("/api/trip/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sentence }),
  });
  if (!res.ok) throw new Error(`parse-${res.status}`);
  return (await res.json()) as TripRequest;
}

export async function searchTrip(request: TripRequest): Promise<TripSearchResponse> {
  const res = await fetch("/api/trip/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`search-${res.status}`);
  return (await res.json()) as TripSearchResponse;
}

/** Nearby-date comparison for the same trip; safe to call after the card renders. */
export async function fetchPriceContext(
  request: TripRequest,
): Promise<PriceContext | null> {
  try {
    const res = await fetch("/api/trip/price-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) return null;
    return (await res.json()) as PriceContext;
  } catch {
    return null;
  }
}

const EUR = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function eur(amount: number): string {
  return EUR.format(amount);
}

/** "Thu 6:55 AM" style label from an ISO datetime. */
export function timeLabel(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function dayLabel(isoDate: string, locale: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(
    date,
  );
}
