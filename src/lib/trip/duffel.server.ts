/**
 * Server-only Duffel access (test mode). Flights via /air, hotels via
 * /stays, cars via /cars when the account has it. Every part fails soft: a
 * failing part returns a short note instead of breaking the response.
 */
import { findByName } from "./match";
import { guestsPerRoom, roomsFor } from "./passengers";
import {
  familyRoomReason,
  freeChildrenNote,
  roomFits,
  type Party,
  type RoomPolicy,
} from "./family";

/** Adults only, for the room split — children never make a room of their own. */
function adultsOf(req: TripRequest): number {
  const children = (req.childAges?.length ?? 0) + (req.infants ?? 0);
  return Math.max(1, req.passengers - children);
}

function flightPassengers(req: TripRequest): Array<{ type?: string; age?: number }> {
  const ages = req.childAges ?? [];
  return [
    ...Array.from({ length: adultsOf(req) }, () => ({ type: "adult" })),
    ...ages.map((age) => ({ age })),
    ...Array.from({ length: req.infants ?? 0 }, () => ({ type: "infant_without_seat" })),
  ];
}

function stayGuests(req: TripRequest): Array<{ type: string; age?: number }> {
  const adults = adultsOf(req);
  const perRoom = guestsPerRoom(adults);
  return [
    ...Array.from({ length: perRoom }, () => ({ type: "adult" })),
    ...(req.childAges ?? []).map((age) => ({ type: "child", age })),
    ...Array.from({ length: req.infants ?? 0 }, () => ({ type: "child", age: 1 })),
  ];
}
import {
  carScore,
  carsPassingDealbreakers,
  flightScore,
  stayScore,
  staysPassingDealbreakers,
  type SearchPrefs,
} from "@/lib/trip/rank";
import {
  DEFAULT_PLANNING_RULES,
  planBackwards,
  type ArrivalPlan,
  type PlanningRules,
} from "./backwards";
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

export async function searchFlight(
  req: TripRequest,
  prefs?: SearchPrefs,
): Promise<{ flight: FlightResult; alternatives: FlightResult[] } | null> {
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
        // Age drives the fare: children get a child fare, babies a lap-infant
        // fare, so the airline prices the family rather than a row of adults.
        passengers: flightPassengers(req),
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
  const carrierText = (o: DuffelOffer) =>
    `${o.owner?.name ?? ""} ${o.slices?.[0]?.segments?.[0]?.marketing_carrier?.name ?? ""}`;
  const ranked = pool
    .slice()
    .sort(
      (a, b) =>
        flightScore(carrierText(a), Number(a.total_amount), prefs) -
        flightScore(carrierText(b), Number(b.total_amount), prefs),
    );
  const best = ranked[0];
  if (!best) return null;

  const toResult = (offer: DuffelOffer): FlightResult => {
    const legs = offer.slices?.[0]?.segments ?? [];
    const head = legs[0];
    const tail = legs[legs.length - 1];
    const value = Number(offer.total_amount);
    const cur = offer.total_currency;
    return {
      carrier: head?.marketing_carrier?.name ?? offer.owner?.name ?? "Airline",
      flightNumbers: legs
        .map((s) =>
          `${s.marketing_carrier?.iata_code ?? ""}${s.marketing_carrier_flight_number ?? ""}`.trim(),
        )
        .filter(Boolean),
      departAt: head?.departing_at ?? `${req.departDate}T00:00:00`,
      arriveAt: tail?.arriving_at ?? `${req.departDate}T00:00:00`,
      returnDepartAt: offer.slices?.[1]?.segments?.[0]?.departing_at ?? null,
      cabin: head?.passengers?.[0]?.cabin_class ?? req.cabinClass,
      stops: Math.max(0, legs.length - 1),
      amount: round(value),
      currency: cur,
      ...toEur(value, cur),
      offerId: offer.id,
      expiresAt: offer.expires_at ?? null,
    };
  };

  // Keep the next best genuinely different itineraries so the traveller can
  // swap without a new search. Duffel returns many near-identical offers, so
  // dedupe on the itinerary itself rather than showing the same flight thrice.
  const seen = new Set<string>();
  const key = (offer: DuffelOffer): string => {
    const legs = offer.slices?.[0]?.segments ?? [];
    const numbers = legs
      .map(
        (s) =>
          `${s.marketing_carrier?.iata_code ?? ""}${s.marketing_carrier_flight_number ?? ""}`,
      )
      .join("-");
    return `${numbers}|${legs[0]?.departing_at ?? ""}|${offer.total_amount}`;
  };
  seen.add(key(best));
  const alternatives: FlightResult[] = [];
  for (const offer of ranked.slice(1)) {
    const id = key(offer);
    if (seen.has(id)) continue;
    seen.add(id);
    alternatives.push(toResult(offer));
    if (alternatives.length === 3) break;
  }

  const outbound = best.slices?.[0]?.segments ?? [];
  const first = outbound[0];
  const last = outbound[outbound.length - 1];
  const amount = Number(best.total_amount);
  const currency = best.total_currency;

  const flight: FlightResult = {
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
    stops: Math.max(0, outbound.length - 1),
    offerId: best.id,
    expiresAt: best.expires_at ?? null,
  };
  return { flight, alternatives };
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
    rooms?: Array<{
      rates?: Array<{ id?: string }>;
      // Occupancy limits, where the hotel states them.
      max_occupancy?: number;
      maximum_occupancy?: number;
      max_adults?: number;
      max_children?: number;
      max_child_age?: number;
      children_free_under?: number;
    }>;
  };
};

function nightsBetween(a: string, b: string): number {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

/** Occupancy limits as the hotel states them; unknown stays unknown. */
function roomPolicyOf(raw: DuffelStay): RoomPolicy {
  const room = raw.accommodation?.rooms?.[0];
  return {
    maxOccupancy: room?.max_occupancy ?? room?.maximum_occupancy ?? null,
    maxAdults: room?.max_adults ?? null,
    maxChildren: room?.max_children ?? null,
    maxChildAge: room?.max_child_age ?? null,
    childrenFreeUnder: room?.children_free_under ?? null,
  };
}

export type StaySearchOutcome = {
  stay: StayResult | null;
  /** Said plainly when a family needs a family room, or a policy is worth knowing. */
  familyNote?: string | null;
  /** Up to 3 close options when the named hotel was not found. */
  alternatives: StayResult[];
  requested: string | null;
  notFound: boolean;
};

export async function searchStay(
  req: TripRequest,
  prefs?: SearchPrefs,
): Promise<StaySearchOutcome> {
  const sample = usesTestInventory();
  const json = await duffel<{ data?: { results?: DuffelStay[] } }>("/stays/search", {
    data: {
      check_in_date: req.departDate,
      check_out_date: req.returnDate,
      // Two share a room; three or more get doubles rather than one big room.
      rooms: roomsFor(adultsOf(req)),
      // Children's ages go with the occupancy, so the hotel only offers rooms
      // that actually take this family.
      guests: stayGuests(req),
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
    return { stay: null, alternatives: [], requested, notFound: Boolean(requested), familyNote: null };
  }

  // A family is counted properly: children with ages, babies as infants.
  const children = req.childAges ?? [];
  const infants = req.infants ?? 0;
  const party: Party = {
    adults: adultsOf(req),
    children: children.length,
    childAges: children,
    infants,
    infantsWithSeat: 0,
    categories: [],
    total: req.passengers,
  };
  const withChildren = children.length + infants > 0;

  // Rooms whose own policy this family exceeds are not offered at all.
  const fitting = withChildren
    ? results.filter((raw) => roomFits(roomPolicyOf(raw), party))
    : results;
  const familyNote = withChildren
    ? [
        fitting.length < results.length ? familyRoomReason(party) : null,
        freeChildrenNote(roomPolicyOf(fitting[0] ?? results[0]!)),
      ]
        .filter(Boolean)
        .join(" ") || null
    : null;
  const usable = fitting.length ? fitting : results;

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
        address: sample ? `Test inventory — not ${req.destinationCity}` : realAddress,
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

  // Dealbreakers are hard rules: drop anything that fails one before ranking.
  const mapped = staysPassingDealbreakers(
    usable.map(map),
    (m) => ({ name: m.rawName, rating: m.result.rating }),
    prefs,
  );
  if (!mapped.length) {
    return { stay: null, alternatives: [], requested, notFound: Boolean(requested) };
  }

  // A named hotel overrides every preference-based pick.
  if (requested) {
    const hit = findByName(mapped, requested, (m) => m.rawName);
    if (hit) {
      return {
        stay: { ...hit.result, exact: true },
        alternatives: [],
        requested,
        notFound: false,
        familyNote,
      };
    }
    const alternatives = mapped
      .filter((m) => m !== hit)
      .slice()
      .sort((a, b) => a.result.amount - b.result.amount)
      .slice(0, 3)
      .map((m) => m.result);
    return { stay: null, alternatives, requested, notFound: true, familyNote };
  }

  // Above the 25th price percentile, then ranked by the traveller's hotel
  // preferences (chain, stars, rating, amenities) rather than price alone.
  const prices = mapped.map((m) => m.result.amount).sort((a, b) => a - b);
  const floor = prices[Math.floor(prices.length * 0.25)] ?? prices[0]!;
  const pool = mapped.filter((m) => m.result.amount >= floor);
  const best = (pool.length ? pool : mapped)
    .slice()
    .sort(
      (a, b) =>
        stayScore(b.rawName, b.result.rating, b.result.amount, prefs) -
        stayScore(a.rawName, a.result.rating, a.result.amount, prefs),
    )[0]!;

  // Keep the next best few so the traveller can swap without a new search.
  const stayOthers = (pool.length ? pool : mapped)
    .filter((m) => m !== best)
    .slice()
    .sort(
      (a, b) =>
        stayScore(b.rawName, b.result.rating, b.result.amount, prefs) -
        stayScore(a.rawName, a.result.rating, a.result.amount, prefs),
    )
    .slice(0, 3)
    .map((m) => m.result);
  return {
    stay: best.result,
    alternatives: stayOthers,
    requested: null,
    notFound: false,
    familyNote,
  };
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

export async function searchCar(
  req: TripRequest,
  prefs?: SearchPrefs,
): Promise<CarSearchOutcome> {
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

  const mapped = carsPassingDealbreakers(
    results.map(map),
    (m) => ({ transmission: m.result.transmission }),
    prefs,
  );
  if (!mapped.length) {
    return { car: null, alternatives: [], requested, notFound: Boolean(requested) };
  }

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

  const best = mapped
    .slice()
    .sort(
      (a, b) =>
        carScore(b.result.supplier, b.rawName, b.result.transmission, b.result.amount, prefs) -
        carScore(a.result.supplier, a.rawName, a.result.transmission, a.result.amount, prefs),
    )[0]!;
  const carOthers = mapped
    .filter((m) => m !== best)
    .slice()
    .sort(
      (a, b) =>
        carScore(b.result.supplier, b.rawName, b.result.transmission, b.result.amount, prefs) -
        carScore(a.result.supplier, a.rawName, a.result.transmission, a.result.amount, prefs),
    )
    .slice(0, 3)
    .map((m) => m.result);
  return { car: best.result, alternatives: carOthers, requested: null, notFound: false };
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

export async function searchTripWithDuffel(
  req: TripRequest,
  prefs?: SearchPrefs,
  planning?: { rules: PlanningRules; business: boolean },
): Promise<TripSearchResponse> {
  const errors: TripSearchResponse["errors"] = {};

  const [flightRes, stayRes, carRes] = await Promise.allSettled([
    searchFlight(req, prefs),
    searchStay(req, prefs),
    req.needsCar
      ? searchCar(req, prefs)
      : Promise.resolve<CarSearchOutcome>({
          car: null,
          alternatives: [],
          requested: null,
          notFound: false,
        }),
  ]);

  let flight: FlightResult | null = null;
  let flightAlternatives: FlightResult[] = [];
  if (flightRes.status === "fulfilled") {
    flight = flightRes.value?.flight ?? null;
    flightAlternatives = flightRes.value?.alternatives ?? [];
    if (!flight) errors.flights = "no-availability";
  } else {
    errors.flights = noteFor(flightRes.reason);
  }

  let stay: StayResult | null = null;
  let hotelRequested: string | null = req.hotelNameExact?.trim() || null;
  let hotelNotFound = false;
  let hotelAlternatives: StayResult[] = [];
  if (stayRes.status === "fulfilled") {
    stay = stayRes.value.stay;
    hotelNotFound = stayRes.value.notFound;
    hotelAlternatives = stayRes.value.alternatives;
    hotelRequested = stayRes.value.requested ?? hotelRequested;
    if (!stay) errors.stays = hotelNotFound ? "name-not-found" : "no-availability";
  } else {
    errors.stays = noteFor(stayRes.reason);
  }

  let car: CarResult | null = null;
  let carRequested: string | null = req.needsCar ? req.carNameExact?.trim() || null : null;
  let carNotFound = false;
  let carAlternatives: CarResult[] = [];
  if (carRes.status === "fulfilled") {
    car = carRes.value.car;
    carNotFound = carRes.value.notFound;
    carAlternatives = carRes.value.alternatives;
    carRequested = carRes.value.requested ?? carRequested;
    // Cars are optional: no note when the traveller did not ask for one.
    if (!car && req.needsCar) errors.cars = carNotFound ? "name-not-found" : "unavailable";
  } else {
    errors.cars = noteFor(carRes.reason);
  }

  // Fixed arrival time: re-pick the flight backwards from the deadline.
  let arrivalPlan: ArrivalPlan | null = null;
  let transfer: TripSearchResponse["transfer"] = null;
  if (req.mustArriveBy && flight) {
    const rules = planning?.rules ?? DEFAULT_PLANNING_RULES;
    const candidates = [flight, ...flightAlternatives];
    const result = planBackwards({
      candidates,
      mustArriveBy: req.mustArriveBy,
      meetingLocation: req.meetingLocation ?? null,
      destinationIata: req.destinationIata,
      // Airport-to-centre run; the meeting is assumed to be in the city.
      transferDistanceKm: 25,
      rules,
      business: planning?.business ?? false,
    });
    if (result.chosen) {
      flight = result.chosen;
      flightAlternatives = candidates.filter((_, i) => i !== result.chosenIndex);
    }
    arrivalPlan = result.plan;
    transfer = {
      pickupAt: result.plan.transferPickupAt,
      fromLabel: `${req.destinationIata} airport`,
      toLabel: req.meetingLocation ?? `${req.destinationCity} centre`,
      minutes: result.plan.transferMin,
      supplierConnected: false,
    };
  }

  // Reverse constraint: "I have to leave Milan by Thursday evening".
  let departureNote: string | null = null;
  if (req.mustDepartBy && flight) {
    const deadline = Date.parse(req.mustDepartBy);
    const fits = (candidate: FlightResult) => {
      const back = candidate.returnDepartAt ? Date.parse(candidate.returnDepartAt) : NaN;
      return Number.isFinite(back) && back <= deadline;
    };
    const local = (iso: string) =>
      new Date(iso).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      });
    if (!fits(flight)) {
      const swap = flightAlternatives.find(fits);
      if (swap) {
        const previous = flight;
        flightAlternatives = [previous, ...flightAlternatives.filter((f) => f !== swap)].slice(0, 3);
        flight = swap;
        departureNote = `Return moved to ${local(swap.returnDepartAt!)} so you leave before your deadline.`;
      } else if (flight.returnDepartAt) {
        departureNote = `The earliest return we can source leaves ${local(
          flight.returnDepartAt,
        )}, after the time you wanted to be away. Shifting the return date by a day fixes it.`;
      }
    }
  }

  const parts = [flight, stay, car].filter(Boolean) as Array<{
    amountEur: number;
    approx: boolean;
  }>;
  const totalEur = round(parts.reduce((sum, p) => sum + p.amountEur, 0));

  return {
    request: req,
    flight,
    flightAlternatives,
    stay,
    car,
    totalEur,
    approx: parts.some((p) => p.approx),
    savedEur: round(totalEur * 0.08),
    savedMinutes: 160,
    testMode: isTestKey(),
    hotelRequested,
    hotelNotFound,
    hotelAlternatives,
    carRequested,
    carNotFound,
    carAlternatives,
    arrivalPlan,
    transfer,
    departureNote,
    errors,
  };
}

