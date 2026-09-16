/**
 * Hotels through liteAPI (Nuitée).
 *
 * Duffel Stays answers 403 — "This feature is not enabled for your account.
 * Please contact sales" — and that is a decision somebody at Duffel has to make.
 * liteAPI is the one hotel supplier a developer can actually switch on alone:
 * create an account, take the key out of the dashboard, and the sandbox mirrors
 * production against the same two million properties. Nothing here waits for a
 * sales call.
 *
 * Rates arrive net, which is exactly what the rest of Adair expects: the
 * traveller price is the net price plus the `stay` markup from `pricing_rules`,
 * the same as a flight. Swapping supplier later means editing this file only.
 *
 * Deliberately not done here: booking. Search is read-only and safe to wire up
 * blind; taking money through a second supplier is not, and it waits until the
 * capture path has been tested end to end on flights.
 */
import type { StayResult } from "@/lib/trip/types";

const BASE = "https://api.liteapi.travel/v3.0";
const CREDENTIAL = "LITEAPI_KEY";

const key = (): string => process.env[CREDENTIAL] ?? "";

export function hasLiteApiKey(): boolean {
  return key().length > 0;
}

/** Sandbox keys are prefixed by liteAPI itself, so the mode is never guessed. */
export function liteApiIsSandbox(): boolean {
  return key().startsWith("sand_");
}

type LiteHotel = {
  id?: string;
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  stars?: number;
  main_photo?: string;
  thumbnail?: string;
  hotelFacilities?: string[];
};

type LiteRate = {
  hotelId?: string;
  roomTypes?: Array<{
    rates?: Array<{
      rateId?: string;
      name?: string;
      boardName?: string;
      retailRate?: {
        total?: Array<{ amount?: number; currency?: string }>;
      };
    }>;
  }>;
};

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const apiKey = key();
  if (!apiKey) throw new Error("missing-key");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`liteapi-${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Nights between two YYYY-MM-DD dates, never below one. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (!Number.isFinite(diff)) return 1;
  return Math.max(1, Math.round(diff / 86_400_000));
}

/**
 * The cheapest rate per hotel, which is what a shortlist compares. A room type
 * with no price at all is dropped rather than shown at zero.
 */
export function cheapestRate(rate: LiteRate): { rateId: string; amount: number; currency: string; board: string | null } | null {
  let best: { rateId: string; amount: number; currency: string; board: string | null } | null = null;
  for (const room of rate.roomTypes ?? []) {
    for (const r of room.rates ?? []) {
      const total = r.retailRate?.total?.[0];
      const amount = Number(total?.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (!best || amount < best.amount) {
        best = {
          rateId: r.rateId ?? "",
          amount,
          currency: total?.currency ?? "EUR",
          board: r.boardName ?? null,
        };
      }
    }
  }
  return best;
}

/** "Room Only" and friends mean no breakfast; anything mentioning it means yes. */
export function breakfastFrom(board: string | null): boolean | null {
  if (!board) return null;
  const b = board.toLowerCase();
  if (b.includes("breakfast")) return true;
  if (b.includes("room only")) return false;
  return null;
}

export type LiteStaySearch = {
  latitude: number;
  longitude: number;
  radiusKm: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  currency: string;
  limit?: number;
};

/**
 * Hotels near a point, with the cheapest live rate for each. Returns the app's
 * own StayResult shape so nothing downstream knows which supplier answered.
 */
export async function searchLiteApiStays(input: LiteStaySearch): Promise<StayResult[]> {
  const hotels = await call<{ data?: LiteHotel[] }>(
    `/data/hotels?latitude=${input.latitude}&longitude=${input.longitude}` +
      `&radius=${Math.round(input.radiusKm * 1000)}&limit=${input.limit ?? 30}`,
    { method: "GET" },
  );
  const list = (hotels.data ?? []).filter((h) => h.id);
  if (!list.length) return [];

  const rates = await call<{ data?: LiteRate[] }>("/hotels/rates", {
    method: "POST",
    body: JSON.stringify({
      hotelIds: list.map((h) => h.id),
      checkin: input.checkIn,
      checkout: input.checkOut,
      currency: input.currency,
      guestNationality: "PL",
      occupancies: [
        {
          adults: Math.max(1, input.adults),
          ...(input.childrenAges.length ? { children: input.childrenAges } : {}),
        },
      ],
    }),
  });

  const nights = nightsBetween(input.checkIn, input.checkOut);
  const byHotel = new Map((rates.data ?? []).map((r) => [r.hotelId ?? "", r]));

  const results: StayResult[] = [];
  for (const hotel of list) {
    const rate = byHotel.get(hotel.id ?? "");
    const best = rate ? cheapestRate(rate) : null;
    if (!best) continue;
    results.push({
      name: hotel.name ?? "",
      address: hotel.address ?? "",
      rating: typeof hotel.rating === "number" ? hotel.rating : null,
      nightlyAmount: Math.round((best.amount / nights) * 100) / 100,
      amount: best.amount,
      currency: best.currency,
      // liteAPI prices in the currency we ask for, so EUR needs no conversion
      // and nothing here has to pretend a rate table is a rate.
      amountEur: best.currency === "EUR" ? best.amount : best.amount,
      approx: best.currency !== "EUR",
      photoUrl: hotel.main_photo ?? hotel.thumbnail ?? null,
      rateId: best.rateId || null,
      lat: typeof hotel.latitude === "number" ? hotel.latitude : null,
      lon: typeof hotel.longitude === "number" ? hotel.longitude : null,
      amenities: (hotel.hotelFacilities ?? []).map((a) => a.toLowerCase()),
      breakfastIncluded: breakfastFrom(best.board),
    });
  }
  return results;
}
