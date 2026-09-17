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
import type {
  StayResult,
  StayDetail,
  StayRoomOption,
  StayReview,
  StayBedType,
} from "@/lib/trip/types";

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
export function cheapestRate(
  rate: LiteRate,
): { rateId: string; amount: number; currency: string; board: string | null } | null {
  let best: { rateId: string; amount: number; currency: string; board: string | null } | null =
    null;
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
      hotelId: hotel.id ?? null,
      lat: typeof hotel.latitude === "number" ? hotel.latitude : null,
      lon: typeof hotel.longitude === "number" ? hotel.longitude : null,
      amenities: (hotel.hotelFacilities ?? []).map((a) => a.toLowerCase()),
      breakfastIncluded: breakfastFrom(best.board),
    });
  }
  return results;
}

// --- Hotel detail: room list, amenities, review score, reviews --------------
//
// The shortlist search above only ever needs the cheapest rate per hotel.
// Everything below is fetched separately, on demand, when a traveller opens
// a specific property — a fuller, slower call that a list of ten hotels
// should never pay for ten times over.

type LiteBedType = { bedType?: string; quantity?: number };
type LiteRoomAmenity = { name?: string };
type LiteStaticRoom = {
  id?: number;
  roomName?: string;
  description?: string;
  roomSizeSquare?: number;
  bedTypes?: LiteBedType[];
  roomAmenities?: LiteRoomAmenity[];
};

type LiteHotelDetail = {
  id?: string;
  starRating?: number;
  rating?: number;
  reviewCount?: number;
  checkinCheckoutTimes?: {
    checkin_start?: string;
    checkout?: string;
  };
  rooms?: LiteStaticRoom[];
  hotelFacilities?: string[];
};

type LiteReviewRaw = {
  averageScore?: number;
  name?: string;
  country?: string;
  date?: string;
  pros?: string;
  cons?: string;
};

/** GET-with-query variant of `call`, for the data endpoints below. */
async function get<T>(path: string): Promise<T> {
  const apiKey = key();
  if (!apiKey) throw new Error("missing-key");
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-API-Key": apiKey, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`liteapi-${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function fetchHotelDetail(hotelId: string): Promise<LiteHotelDetail | null> {
  try {
    const json = await get<{ data?: LiteHotelDetail }>(
      `/data/hotel?hotelId=${encodeURIComponent(hotelId)}`,
    );
    return json.data ?? null;
  } catch {
    return null;
  }
}

async function fetchHotelReviews(hotelId: string, limit: number): Promise<LiteReviewRaw[]> {
  try {
    const json = await get<{ data?: LiteReviewRaw[] }>(
      `/data/reviews?hotelId=${encodeURIComponent(hotelId)}&limit=${limit}`,
    );
    return json.data ?? [];
  } catch {
    return [];
  }
}

async function fetchAllRoomRates(
  hotelId: string,
  checkIn: string,
  checkOut: string,
  adults: number,
  childrenAges: number[],
  currency: string,
): Promise<LiteRate | null> {
  try {
    const json = await call<{ data?: LiteRate[] }>("/hotels/rates", {
      method: "POST",
      body: JSON.stringify({
        hotelIds: [hotelId],
        checkin: checkIn,
        checkout: checkOut,
        currency,
        guestNationality: "PL",
        occupancies: [
          {
            adults: Math.max(1, adults),
            ...(childrenAges.length ? { children: childrenAges } : {}),
          },
        ],
      }),
    });
    return json.data?.[0] ?? null;
  } catch {
    return null;
  }
}

/** "double bed" / "twin" text; only classification the UI actually needs. */
export function bedTypesFrom(bedTypes: LiteBedType[] | undefined): StayBedType[] {
  return (bedTypes ?? [])
    .filter((b) => b.bedType)
    .map((b) => ({ bedType: b.bedType!, quantity: Math.max(1, b.quantity ?? 1) }));
}

/** Lower-cased, alphanumeric words only — good enough to compare two room names. */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2),
  );
}

/**
 * Best-effort match between a live rate's room name (e.g. "Run of House",
 * "Chambre Classique") and liteAPI's static room catalogue for the property,
 * so a price line can borrow its size, bed layout and amenities. Suppliers
 * do not share a room id across the two calls, so this is fuzzy by design —
 * a rate that matches nothing still shows fine, just without that detail.
 */
export function matchStaticRoom(
  rateName: string,
  staticRooms: LiteStaticRoom[],
): LiteStaticRoom | null {
  const rateTokens = tokenize(rateName);
  if (!rateTokens.size) return null;
  let best: { room: LiteStaticRoom; score: number } | null = null;
  for (const room of staticRooms) {
    const roomTokens = tokenize(room.roomName ?? "");
    if (!roomTokens.size) continue;
    let shared = 0;
    for (const t of rateTokens) if (roomTokens.has(t)) shared += 1;
    const score = shared / Math.min(rateTokens.size, roomTokens.size);
    if (score >= 0.5 && (!best || score > best.score)) best = { room, score };
  }
  return best?.room ?? null;
}

/** "RFN" is liteAPI's own tag for a refundable rate; everything else is not. */
export function refundableFromTag(tag: string | undefined): boolean {
  return tag === "RFN";
}

export type StayDetailInput = {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  currency: string;
};

/**
 * Everything a traveller needs to actually choose a room: every rate the
 * property has for these dates, enriched with size/bed/amenities where a
 * confident match exists, plus the property's check-in window, review score
 * and a few real reviews. Three liteAPI calls in parallel; any of them
 * failing still returns whatever the others found rather than nothing.
 */
export async function getStayDetail(input: StayDetailInput): Promise<StayDetail | null> {
  if (!hasLiteApiKey()) return null;
  const [detail, rate, reviews] = await Promise.all([
    fetchHotelDetail(input.hotelId),
    fetchAllRoomRates(
      input.hotelId,
      input.checkIn,
      input.checkOut,
      input.adults,
      input.childrenAges,
      input.currency,
    ),
    fetchHotelReviews(input.hotelId, 6),
  ]);

  const staticRooms = detail?.rooms ?? [];
  const roomOptions: StayRoomOption[] = [];
  for (const roomType of rate?.roomTypes ?? []) {
    for (const r of roomType.rates ?? []) {
      const total = r.retailRate?.total?.[0];
      const amount = Number(total?.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const name = r.name ?? roomType.rates?.[0]?.name ?? "Room";
      const matched = matchStaticRoom(name, staticRooms);
      const cancellation = (
        r as unknown as {
          cancellationPolicies?: {
            refundableTag?: string;
            cancelPolicyInfos?: Array<{ cancelTime?: string }>;
          };
        }
      ).cancellationPolicies;
      roomOptions.push({
        rateId: r.rateId ?? "",
        roomName: name,
        boardName: r.boardName ?? null,
        breakfastIncluded: breakfastFrom(r.boardName ?? null),
        refundable: refundableFromTag(cancellation?.refundableTag),
        freeCancellationUntil: cancellation?.cancelPolicyInfos?.[0]?.cancelTime ?? null,
        amount,
        currency: total?.currency ?? input.currency,
        sizeSqm: matched?.roomSizeSquare ?? null,
        bedTypes: bedTypesFrom(matched?.bedTypes),
        amenities: (matched?.roomAmenities ?? [])
          .map((a) => (a.name ?? "").toLowerCase())
          .filter(Boolean),
      });
    }
  }
  roomOptions.sort((a, b) => a.amount - b.amount);

  const parsedReviews: StayReview[] = reviews
    .filter((r) => r.name && (r.pros || r.cons))
    .map((r) => ({
      reviewerName: r.name!,
      country: r.country ?? null,
      score: Math.round((r.averageScore ?? 0) * 10) / 10,
      date: r.date ?? null,
      pros: r.pros || null,
      cons: r.cons || null,
    }));

  if (!detail && !roomOptions.length && !parsedReviews.length) return null;

  return {
    hotelId: input.hotelId,
    starRating: typeof detail?.starRating === "number" ? detail.starRating : null,
    reviewScore: typeof detail?.rating === "number" ? detail.rating : null,
    reviewCount: typeof detail?.reviewCount === "number" ? detail.reviewCount : null,
    checkinFrom: detail?.checkinCheckoutTimes?.checkin_start || null,
    checkoutUntil: detail?.checkinCheckoutTimes?.checkout || null,
    roomOptions: roomOptions.slice(0, 12),
    reviews: parsedReviews.slice(0, 4),
    currency: input.currency,
  };
}
