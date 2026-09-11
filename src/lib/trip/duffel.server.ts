/**
 * Server-only Duffel access (test mode). Flights via /air, hotels via
 * /stays, cars via /cars when the account has it. Every part fails soft: a
 * failing part returns a short note instead of breaking the response.
 */
import type {
  CarResult,
  FlightResult,
  StayResult,
  TripRequest,
  TripSearchResponse,
} from "./types";

const BASE = "https://api.duffel.com";

/** Fixed demo conversion table — labelled "approx." wherever it is applied. */
const FX_TO_EUR: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  PLN: 0.23,
  CHF: 1.05,
  SEK: 0.088,
  NOK: 0.086,
  DKK: 0.134,
  CZK: 0.04,
  HUF: 0.0026,
  RON: 0.2,
  JPY: 0.0061,
  AED: 0.25,
  TRY: 0.027,
};

const round = (n: number) => Math.round(n * 100) / 100;

function toEur(amount: number, currency: string): { amountEur: number; approx: boolean } {
  const code = currency.toUpperCase();
  const rate = FX_TO_EUR[code];
  if (code === "EUR") return { amountEur: round(amount), approx: false };
  if (!rate) return { amountEur: round(amount), approx: true };
  return { amountEur: round(amount * rate), approx: true };
}

function duffelKey(): string | null {
  return process.env["DUFFEL_API_KEY"] ?? null;
}

export function isTestKey(): boolean {
  const key = duffelKey();
  return !key || key.includes("test");
}

/**
 * Duffel test mode only has fake stay/car inventory at one fixed spot
 * (Duffel Test Hotel / Duffel Test Drive). Real cities return nothing there,
 * so we search these coordinates instead while a test key is in use and label
 * the results as samples. A live key automatically uses the real destination.
 */
const TEST_LOCATION = { latitude: -24.38, longitude: -128.32, radius: 2 };

function usesTestInventory(): boolean {
  return (duffelKey() ?? "").startsWith("duffel_test_");
}


export function hasDuffelKey(): boolean {
  return Boolean(duffelKey());
}

async function duffel<T>(path: string, body: unknown): Promise<T> {
  const key = duffelKey();
  if (!key) throw new Error("missing-key");

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Duffel-Version": "v2",
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Duffel ${path} failed [${res.status}]: ${text.slice(0, 500)}`);
    throw new Error(`duffel-${res.status}`);
  }
  return (await res.json()) as T;
}

/* ------------------------------- flights ------------------------------- */

type DuffelOffer = {
  id: string;
  total_amount: string;
  total_currency: string;
  expires_at?: string;
  owner?: { name?: string };
  slices?: Array<{
    segments?: Array<{
      marketing_carrier?: { name?: string; iata_code?: string };
      marketing_carrier_flight_number?: string;
      departing_at?: string;
      arriving_at?: string;
      passengers?: Array<{ cabin_class?: string }>;
    }>;
  }>;
};

export async function searchFlight(req: TripRequest): Promise<FlightResult | null> {
  const json = await duffel<{ data?: { offers?: DuffelOffer[] } }>(
    "/air/offer_requests?return_offers=true",
    {
      data: {
        slices: [
          {
            origin: req.originIata,
            destination: req.destinationIata,
            departure_date: req.departDate,
          },
          {
            origin: req.destinationIata,
            destination: req.originIata,
            departure_date: req.returnDate,
          },
        ],
        passengers: Array.from({ length: req.passengers }, () => ({ type: "adult" })),
        cabin_class: req.cabinClass,
      },
    },
  );

  const offers = json.data?.offers ?? [];
  // At most one connection per slice keeps the itinerary realistic.
  const simple = offers.filter((o) =>
    (o.slices ?? []).every((s) => (s.segments?.length ?? 1) <= 2),
  );
  const pool = simple.length ? simple : offers;
  const best = pool
    .slice()
    .sort((a, b) => Number(a.total_amount) - Number(b.total_amount))[0];
  if (!best) return null;

  const outbound = best.slices?.[0]?.segments ?? [];
  const first = outbound[0];
  const last = outbound[outbound.length - 1];
  const amount = Number(best.total_amount);
  const currency = best.total_currency;

  return {
    carrier: first?.marketing_carrier?.name ?? best.owner?.name ?? "Airline",
    flightNumbers: outbound
      .map((s) =>
        `${s.marketing_carrier?.iata_code ?? ""}${s.marketing_carrier_flight_number ?? ""}`.trim(),
      )
      .filter(Boolean),
    departAt: first?.departing_at ?? `${req.departDate}T00:00:00`,
    arriveAt: last?.arriving_at ?? `${req.departDate}T00:00:00`,
    returnDepartAt: best.slices?.[1]?.segments?.[0]?.departing_at ?? null,
    cabin: first?.passengers?.[0]?.cabin_class ?? req.cabinClass,
    amount: round(amount),
    currency,
    ...toEur(amount, currency),
    offerId: best.id,
    expiresAt: best.expires_at ?? null,
  };
}

/* -------------------------------- stays -------------------------------- */

type DuffelStay = {
  id?: string;
  cheapest_rate_total_amount?: string;
  cheapest_rate_currency?: string;
  cheapest_rate_id?: string;
  accommodation?: {
    name?: string;
    rating?: number;
    photos?: Array<{ url?: string }>;
    location?: {
      address?: { line_one?: string; city_name?: string; postal_code?: string };
    };
    rooms?: Array<{ rates?: Array<{ id?: string }> }>;
  };
};

function nightsBetween(a: string, b: string): number {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

export type StaySearchOutcome = {
  stay: StayResult | null;
  /** Up to 3 close options when the named hotel was not found. */
  alternatives: StayResult[];
  requested: string | null;
  notFound: boolean;
};

export async function searchStay(req: TripRequest): Promise<StaySearchOutcome> {
  const sample = usesTestInventory();
  const json = await duffel<{ data?: { results?: DuffelStay[] } }>("/stays/search", {
    data: {
      check_in_date: req.departDate,
      check_out_date: req.returnDate,
      rooms: 1,
      guests: [{ type: "adult" }],
      location: sample
        ? {
            radius: TEST_LOCATION.radius,
            geographic_coordinates: {
              latitude: TEST_LOCATION.latitude,
              longitude: TEST_LOCATION.longitude,
            },
          }
        : {
            radius: 3,
            geographic_coordinates: { latitude: req.lat, longitude: req.lon },
          },
    },
  });

  const requested = req.hotelNameExact?.trim() || null;

  const results = (json.data?.results ?? []).filter((r) =>
    Number.isFinite(Number(r.cheapest_rate_total_amount)),
  );
  if (!results.length) {
    return { stay: null, alternatives: [], requested, notFound: Boolean(requested) };
  }

  const nights = nightsBetween(req.departDate, req.returnDate);
  const map = (raw: DuffelStay): { rawName: string; result: StayResult } => {
    const amount = Number(raw.cheapest_rate_total_amount);
    const currency = raw.cheapest_rate_currency ?? "EUR";
    const address = raw.accommodation?.location?.address;
    const rawName = raw.accommodation?.name ?? "Hotel";
    const realAddress = [address?.line_one, address?.city_name].filter(Boolean).join(", ");
    return {
      rawName,
      result: {
        name: sample ? `Test Hotel — sample data (${rawName})` : rawName,
        address: sample ? `Duffel test inventory — not ${req.destinationCity}` : realAddress,
        rating: raw.accommodation?.rating ?? null,
        nightlyAmount: round(amount / nights),
        amount: round(amount),
        currency,
        ...toEur(amount, currency),
        photoUrl: raw.accommodation?.photos?.[0]?.url ?? null,
        rateId:
          raw.cheapest_rate_id ?? raw.accommodation?.rooms?.[0]?.rates?.[0]?.id ?? raw.id ?? null,
      },
    };
  };

  const mapped = results.map(map);

  // A named hotel overrides every preference-based pick.
  if (requested) {
    const hit = findByName(mapped, requested, (m) => m.rawName);
    if (hit) {
      return { stay: { ...hit.result, exact: true }, alternatives: [], requested, notFound: false };
    }
    const alternatives = mapped
      .filter((m) => m !== hit)
      .slice()
      .sort((a, b) => a.result.amount - b.result.amount)
      .slice(0, 3)
      .map((m) => m.result);
    return { stay: null, alternatives, requested, notFound: true };
  }

  // Above the 25th price percentile, best rating — "premium but not silly".
  const prices = results.map((r) => Number(r.cheapest_rate_total_amount)).sort((a, b) => a - b);
  const floor = prices[Math.floor(prices.length * 0.25)] ?? prices[0]!;
  const pool = mapped.filter((m) => m.result.amount >= floor);
  const best = (pool.length ? pool : mapped)
    .slice()
    .sort(
      (a, b) => (b.result.rating ?? 0) - (a.result.rating ?? 0) || a.result.amount - b.result.amount,
    )[0]!;

  return { stay: best.result, alternatives: [], requested: null, notFound: false };
}


/* --------------------------------- cars -------------------------------- */

type DuffelCar = {
  id?: string;
  total_amount?: string;
  total_currency?: string;
  transmission?: string;
  vehicle?: { name?: string; model?: string; transmission?: string };
  supplier?: { name?: string };
};

export type CarSearchOutcome = {
  car: CarResult | null;
  alternatives: CarResult[];
  requested: string | null;
  notFound: boolean;
};

export async function searchCar(req: TripRequest): Promise<CarSearchOutcome> {
  const sample = usesTestInventory();
  const location = sample
    ? {
        radius: TEST_LOCATION.radius,
        geographic_coordinates: {
          latitude: TEST_LOCATION.latitude,
          longitude: TEST_LOCATION.longitude,
        },
      }
    : { airport_iata_code: req.destinationIata };
  const json = await duffel<{ data?: { results?: DuffelCar[]; offers?: DuffelCar[] } }>(
    "/cars/search",
    {
      data: {
        pick_up_location: location,
        drop_off_location: location,
        pick_up_at: `${req.departDate}T10:00:00`,
        drop_off_at: `${req.returnDate}T18:00:00`,
        driver: { age: 30 },
      },
    },
  );

  const requested = req.carNameExact?.trim() || null;
  const results = json.data?.results ?? json.data?.offers ?? [];
  if (!results.length) {
    return { car: null, alternatives: [], requested, notFound: Boolean(requested) };
  }

  const map = (raw: DuffelCar): { rawName: string; result: CarResult } => {
    const amount = Number(raw.total_amount ?? 0);
    const currency = raw.total_currency ?? "EUR";
    const vehicle = raw.vehicle?.name ?? raw.vehicle?.model ?? "Car";
    const supplier = raw.supplier?.name ?? "Car supplier";
    return {
      rawName: `${supplier} ${vehicle}`,
      result: {
        supplier,
        vehicle: sample ? `Test Drive — sample data (${vehicle})` : vehicle,
        amount: round(amount),
        currency,
        ...toEur(amount, currency),
        transmission: raw.transmission ?? raw.vehicle?.transmission ?? "automatic",
      },
    };
  };

  const mapped = results.map(map);

  // A named supplier or model overrides the cheapest-automatic pick.
  if (requested) {
    const hit = findByName(mapped, requested, (m) => m.rawName);
    if (hit) {
      return { car: { ...hit.result, exact: true }, alternatives: [], requested, notFound: false };
    }
    const alternatives = mapped
      .filter((m) => m !== hit)
      .slice()
      .sort((a, b) => a.result.amount - b.result.amount)
      .slice(0, 3)
      .map((m) => m.result);
    return { car: null, alternatives, requested, notFound: true };
  }

  const automatic = mapped.filter((m) => /automatic/i.test(m.result.transmission));
  const pool = automatic.length ? automatic : mapped;
  const best = pool.slice().sort((a, b) => a.result.amount - b.result.amount)[0]!;
  return { car: best.result, alternatives: [], requested: null, notFound: false };
}



/* ------------------------------ orchestration --------------------------- */

function noteFor(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown";
  if (message === "missing-key") return "not-configured";
  if (message === "duffel-401" || message === "duffel-403") return "not-authorised";
  if (message === "duffel-404") return "unavailable";
  if (message === "duffel-429") return "rate-limited";
  return "unavailable";
}

export async function searchTripWithDuffel(req: TripRequest): Promise<TripSearchResponse> {
  const errors: TripSearchResponse["errors"] = {};

  const [flightRes, stayRes, carRes] = await Promise.allSettled([
    searchFlight(req),
    searchStay(req),
    req.needsCar ? searchCar(req) : Promise.resolve(null),
  ]);

  let flight: FlightResult | null = null;
  if (flightRes.status === "fulfilled") {
    flight = flightRes.value;
    if (!flight) errors.flights = "no-availability";
  } else {
    errors.flights = noteFor(flightRes.reason);
  }

  let stay: StayResult | null = null;
  if (stayRes.status === "fulfilled") {
    stay = stayRes.value;
    if (!stay) errors.stays = "no-availability";
  } else {
    errors.stays = noteFor(stayRes.reason);
  }

  let car: CarResult | null = null;
  if (carRes.status === "fulfilled") {
    car = carRes.value;
    // Cars are optional: no note when the traveller did not ask for one.
    if (!car && req.needsCar) errors.cars = "unavailable";
  } else {
    errors.cars = noteFor(carRes.reason);
  }

  const parts = [flight, stay, car].filter(Boolean) as Array<{
    amountEur: number;
    approx: boolean;
  }>;
  const totalEur = round(parts.reduce((sum, p) => sum + p.amountEur, 0));

  return {
    request: req,
    flight,
    stay,
    car,
    totalEur,
    approx: parts.some((p) => p.approx),
    savedEur: round(totalEur * 0.08),
    savedMinutes: 160,
    testMode: isTestKey(),
    errors,
  };
}
