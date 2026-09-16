/**
 * Server-only Duffel access (test mode). Flights via /air, hotels via
 * /stays, cars via /cars when the account has it. Every part fails soft: a
 * failing part returns a short note instead of breaking the response.
 */
import { findByName } from "./match";
import { staysPassingGlobalRules } from "./global-stay-rules";
import { loadGlobalStayRules } from "./global-stay-rules.server";
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
  type TripStyle,
} from "@/lib/trip/rank";
import {
  DEFAULT_PLANNING_RULES,
  planBackwards,
  type ArrivalPlan,
  type PlanningRules,
} from "./backwards";
import type { CarResult, FlightResult, StayResult, TripRequest, TripSearchResponse } from "./types";
import { applyHouseStandard } from "./house-standard";
import { hasLiteApiKey, searchLiteApiStays } from "@/lib/suppliers/stays/liteapi";
import { fxRate } from "@/lib/fx.server";

const BASE = "https://api.duffel.com";

const round = (n: number) => Math.round(n * 100) / 100;

/** Labelled "approx." wherever it is applied — see fx.server.ts for the source. */
function toEur(amount: number, currency: string): { amountEur: number; approx: boolean } {
  const code = currency.toUpperCase();
  if (code === "EUR") return { amountEur: round(amount), approx: false };
  const rate = fxRate(code);
  if (!rate) return { amountEur: round(amount), approx: true };
  return { amountEur: round(amount * rate), approx: true };
}

function duffelKey(): string | null {
  return process.env["DUFFEL_API_KEY"] ?? null;
}

/**
 * True only for a Duffel test key. Duffel prefixes its keys `duffel_test_` and
 * `duffel_live_`, so the prefix is the whole answer — matching "test" anywhere
 * in the string was how a live key ended up displayed as test mode. No key at
 * all also counts as test: nothing can be bought, so nothing can be charged.
 */
export function isTestKey(): boolean {
  const key = duffelKey();
  if (!key) return true;
  return key.trim().toLowerCase().startsWith("duffel_test");
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
  conditions?: {
    change_before_departure?: {
      allowed?: boolean;
      penalty_amount?: string | null;
      penalty_currency?: string | null;
    } | null;
    refund_before_departure?: {
      allowed?: boolean;
      penalty_amount?: string | null;
      penalty_currency?: string | null;
    } | null;
  };
  slices?: Array<{
    origin?: { iata_code?: string };
    destination?: { iata_code?: string };
    segments?: Array<{
      marketing_carrier?: { name?: string; iata_code?: string };
      marketing_carrier_flight_number?: string;
      departing_at?: string;
      arriving_at?: string;
      origin?: { iata_code?: string };
      destination?: { iata_code?: string };
      passengers?: Array<{
        cabin_class?: string;
        baggages?: Array<{ type?: string; quantity?: number }>;
      }>;
    }>;
  }>;
};

/**
 * Checked bags the fare includes per passenger. A fare with none is the one
 * that catches travellers out at the desk, so we carry the number through to
 * the comparison rather than leaving it implied.
 */
function checkedBagsOf(offer: DuffelOffer): number {
  const bags = offer.slices?.[0]?.segments?.[0]?.passengers?.[0]?.baggages ?? [];
  return bags
    .filter((b) => b.type === "checked")
    .reduce((total, b) => total + (b.quantity ?? 0), 0);
}

/**
 * Fare conditions, left null when the airline does not state them. The penalty
 * matters as much as the permission: "refundable, minus €100" is the truth,
 * and "refundable" on its own is not.
 */
function conditionsOf(offer: DuffelOffer): {
  changeable: boolean | null;
  refundable: boolean | null;
  changePenaltyEur: number | null;
  refundPenaltyEur: number | null;
} {
  const change = offer.conditions?.change_before_departure;
  const refund = offer.conditions?.refund_before_departure;

  const penalty = (
    condition:
      { penalty_amount?: string | null; penalty_currency?: string | null } | null | undefined,
  ): number | null => {
    const raw = condition?.penalty_amount;
    const currency = condition?.penalty_currency;
    if (raw == null || !currency) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return toEur(value, currency).amountEur;
  };

  return {
    changeable: typeof change?.allowed === "boolean" ? change.allowed : null,
    refundable: typeof refund?.allowed === "boolean" ? refund.allowed : null,
    changePenaltyEur: penalty(change),
    refundPenaltyEur: penalty(refund),
  };
}

export async function searchFlight(
  req: TripRequest,
  prefs?: SearchPrefs,
): Promise<{ flight: FlightResult; alternatives: FlightResult[] } | null> {
  const json = await duffel<{ data?: { offers?: DuffelOffer[] } }>(
    "/air/offer_requests?return_offers=true",
    {
      data: {
        slices: req.oneWay
          ? [
              {
                origin: req.originIata,
                destination: req.destinationIata,
                departure_date: req.departDate,
              },
            ]
          : [
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
      originIata: head?.origin?.iata_code ?? offer.slices?.[0]?.origin?.iata_code ?? req.originIata,
      destinationIata:
        tail?.destination?.iata_code ??
        offer.slices?.[0]?.destination?.iata_code ??
        req.destinationIata,
      checkedBags: checkedBagsOf(offer),
      checkedBagPriceEur: null,
      ...conditionsOf(offer),
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
        (s) => `${s.marketing_carrier?.iata_code ?? ""}${s.marketing_carrier_flight_number ?? ""}`,
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
    originIata: first?.origin?.iata_code ?? best.slices?.[0]?.origin?.iata_code ?? req.originIata,
    destinationIata:
      last?.destination?.iata_code ??
      best.slices?.[0]?.destination?.iata_code ??
      req.destinationIata,
    checkedBags: checkedBagsOf(best),
    checkedBagPriceEur: null,
    ...conditionsOf(best),
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
    description?: string;
    accommodation_type?: string;
    property_type?: string;
    rating?: number;
    photos?: Array<{ url?: string }>;
    amenities?: Array<{ type?: string; description?: string }>;
    location?: {
      address?: { line_one?: string; city_name?: string; postal_code?: string };
      geographic_coordinates?: { latitude?: number; longitude?: number };
    };
    rooms?: Array<{
      name?: string;
      rates?: Array<{
        id?: string;
        name?: string;
        board_type?: string;
        total_amount?: string;
        total_currency?: string;
      }>;
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

/** Amenity types the property lists, lower-cased; empty when it lists none. */
function amenitiesOf(raw: DuffelStay): string[] {
  return (raw.accommodation?.amenities ?? [])
    .map((a) => (a.type ?? a.description ?? "").toLowerCase().trim())
    .filter(Boolean);
}

const BREAKFAST_BOARD = /breakfast|bed_and_breakfast|half_board|full_board|all_inclusive/i;

/**
 * Whether the cheapest rate feeds you, and what the same stay with breakfast
 * costs on top. Both stay null when the rates say nothing about board.
 */
function breakfastOf(
  raw: DuffelStay,
  cheapestAmount: number,
): { included: boolean | null; extra: number | null } {
  const rates = (raw.accommodation?.rooms ?? []).flatMap((room) => room.rates ?? []);
  const boards = rates.filter((rate) => typeof rate.board_type === "string" && rate.board_type);
  if (!boards.length) return { included: null, extra: null };

  const cheapest = boards
    .slice()
    .sort((a, b) => Number(a.total_amount ?? Infinity) - Number(b.total_amount ?? Infinity))[0];
  const included = BREAKFAST_BOARD.test(cheapest?.board_type ?? "");
  if (included) return { included: true, extra: null };

  const withBreakfast = boards
    .filter((rate) => BREAKFAST_BOARD.test(rate.board_type ?? ""))
    .map((rate) => Number(rate.total_amount))
    .filter((amount) => Number.isFinite(amount) && amount > cheapestAmount)
    .sort((a, b) => a - b)[0];

  return {
    included: false,
    extra: withBreakfast ? round(withBreakfast - cheapestAmount) : null,
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

/**
 * liteAPI is the hotel supplier that actually works today — Duffel Stays
 * answers 403 in both live and test mode until their sales team enables it.
 * Same shape out (StaySearchOutcome), same house rules, same ranking, so
 * nothing downstream of a search has to know which supplier answered.
 */
async function searchStayLiteApi(
  req: TripRequest,
  prefs: SearchPrefs | undefined,
  style: TripStyle,
): Promise<StaySearchOutcome> {
  const requested = req.hotelNameExact?.trim() || null;
  if (!hasLiteApiKey()) {
    return { stay: null, alternatives: [], requested, notFound: false, familyNote: null };
  }

  const children = req.childAges ?? [];
  const infants = req.infants ?? 0;

  let raw: StayResult[] = [];
  try {
    raw = await searchLiteApiStays({
      latitude: req.lat,
      longitude: req.lon,
      radiusKm: 3,
      checkIn: req.departDate,
      checkOut: req.returnDate,
      adults: adultsOf(req),
      childrenAges: children,
      currency: "EUR",
      limit: 30,
    });
  } catch (error) {
    console.error("liteAPI stays search failed", error);
    raw = [];
  }
  if (!raw.length) {
    return { stay: null, alternatives: [], requested, notFound: Boolean(requested), familyNote: null };
  }

  const globalRules = await loadGlobalStayRules();
  const allowed = staysPassingGlobalRules(
    raw,
    (s) => ({
      text: [s.name, s.address, ...(s.amenities ?? [])].filter(Boolean).join(" · "),
      propertyType: null,
    }),
    globalRules,
  );
  const pool0 = allowed.length ? allowed : raw;

  // The house standard: never below 4 stars, unless that would empty the list.
  const { stays: houseFiltered } = applyHouseStandard(pool0);

  const mapped = staysPassingDealbreakers(houseFiltered, (s) => ({ name: s.name, rating: s.rating }), prefs);
  const usable = mapped.length ? mapped : houseFiltered;
  if (!usable.length) {
    return { stay: null, alternatives: [], requested, notFound: Boolean(requested), familyNote: null };
  }

  if (requested) {
    const hit = findByName(usable, requested, (s) => s.name);
    if (hit) {
      return { stay: { ...hit, exact: true }, alternatives: [], requested, notFound: false, familyNote: null };
    }
    const alternatives = usable
      .slice()
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 3);
    return { stay: null, alternatives, requested, notFound: true, familyNote: null };
  }

  const prices = usable.map((s) => s.amount).sort((a, b) => a - b);
  const floor = prices[Math.floor(prices.length * 0.25)] ?? prices[0]!;
  const pool = usable.filter((s) => s.amount >= floor);
  const scored = (pool.length ? pool : usable)
    .slice()
    .sort(
      (a, b) =>
        stayScore(b.name, b.rating, b.amount, prefs, style, b.amenities) -
        stayScore(a.name, a.rating, a.amount, prefs, style, a.amenities),
    );
  const best = scored[0]!;
  const stayOthers = scored.slice(1, 4);

  // liteAPI does not publish room occupancy policy the way Duffel Stays does,
  // so a family is told to double-check rather than given a false all-clear.
  const familyNote =
    children.length + infants > 0
      ? "Double-check the room fits your family — this supplier does not publish occupancy policy."
      : null;

  return { stay: best, alternatives: stayOthers, requested: null, notFound: false, familyNote };
}

export async function searchStay(
  req: TripRequest,
  prefs?: SearchPrefs,
): Promise<StaySearchOutcome> {
  const sample = usesTestInventory();
  // What the traveller answered about this trip, carried into the ranking so a
  // work stay and an anniversary do not come back with the same hotel.
  const style: TripStyle = {
    purpose: req.purpose ?? null,
    party: req.party ?? null,
    occasion: req.occasion ?? null,
  };
  let json: { data?: { results?: DuffelStay[] } } | null = null;
  try {
    json = await duffel<{ data?: { results?: DuffelStay[] } }>("/stays/search", {
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
  } catch (error) {
    // Duffel Stays answers 403 ("contact sales") until that account is
    // enabled. That is not an outage worth surfacing to a traveller — fall
    // through to liteAPI below, which actually has live inventory.
    console.error("Duffel stays search failed, falling back to liteAPI", error);
  }

  const requested = req.hotelNameExact?.trim() || null;

  const results = (json?.data?.results ?? []).filter((r) =>
    Number.isFinite(Number(r.cheapest_rate_total_amount)),
  );
  if (!results.length) {
    return searchStayLiteApi(req, prefs, style);
  }

  // Standards we apply for everyone: no hostels, dorms, shared bathrooms,
  // smoking rooms or property types below hotel/apartment/villa/resort. The
  // rules are config, not code, so the team can see and adjust them.
  const globalRules = await loadGlobalStayRules();
  const allowed = staysPassingGlobalRules(
    results,
    (raw) => ({
      text: [
        raw.accommodation?.name,
        raw.accommodation?.description,
        ...(raw.accommodation?.rooms ?? []).flatMap((room) => [
          room.name,
          ...(room.rates ?? []).map((rate) => rate.name),
        ]),
      ]
        .filter(Boolean)
        .join(" · "),
      propertyType:
        raw.accommodation?.accommodation_type ?? raw.accommodation?.property_type ?? null,
    }),
    globalRules,
  );
  if (!allowed.length) {
    return {
      stay: null,
      alternatives: [],
      requested,
      notFound: Boolean(requested),
      familyNote: null,
    };
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
    ? allowed.filter((raw) => roomFits(roomPolicyOf(raw), party))
    : allowed;
  const familyNote = withChildren
    ? [
        fitting.length < allowed.length ? familyRoomReason(party) : null,
        freeChildrenNote(roomPolicyOf(fitting[0] ?? allowed[0]!)),
      ]
        .filter(Boolean)
        .join(" ") || null
    : null;
  const usable = fitting.length ? fitting : allowed;

  const nights = nightsBetween(req.departDate, req.returnDate);
  const map = (raw: DuffelStay): { rawName: string; result: StayResult } => {
    const amount = Number(raw.cheapest_rate_total_amount);
    const currency = raw.cheapest_rate_currency ?? "EUR";
    const address = raw.accommodation?.location?.address;
    const rawName = raw.accommodation?.name ?? "Hotel";
    const realAddress = [address?.line_one, address?.city_name].filter(Boolean).join(", ");
    const coords = raw.accommodation?.location?.geographic_coordinates;
    const breakfast = breakfastOf(raw, amount);
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
        lat: typeof coords?.latitude === "number" ? coords.latitude : null,
        lon: typeof coords?.longitude === "number" ? coords.longitude : null,
        amenities: amenitiesOf(raw),
        breakfastIncluded: breakfast.included,
        breakfastExtra: breakfast.extra,
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
        stayScore(b.rawName, b.result.rating, b.result.amount, prefs, style, b.result.amenities) -
        stayScore(a.rawName, a.result.rating, a.result.amount, prefs, style, a.result.amenities),
    )[0]!;

  // Keep the next best few so the traveller can swap without a new search.
  const stayOthers = (pool.length ? pool : mapped)
    .filter((m) => m !== best)
    .slice()
    .sort(
      (a, b) =>
        stayScore(b.rawName, b.result.rating, b.result.amount, prefs, style, b.result.amenities) -
        stayScore(a.rawName, a.result.rating, a.result.amount, prefs, style, a.result.amenities),
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

export async function searchCar(req: TripRequest, prefs?: SearchPrefs): Promise<CarSearchOutcome> {
  const sample = usesTestInventory();
  // The live API validates a shape different from what its own high-level docs
  // imply: a combined `pick_up_at` and an `airport_iata_code` location are
  // both rejected. It wants geographic coordinates and separate date/time
  // fields on each side of the rental, confirmed against Duffel's own test
  // coordinates.
  const coords = sample
    ? { latitude: TEST_LOCATION.latitude, longitude: TEST_LOCATION.longitude }
    : { latitude: req.lat, longitude: req.lon };
  const location = { geographic_coordinates: coords };
  let json: { data?: { results?: DuffelCar[]; offers?: DuffelCar[] } } | null = null;
  try {
    json = await duffel<{ data?: { results?: DuffelCar[]; offers?: DuffelCar[] } }>(
      "/cars/search",
      {
        data: {
          pickup_location: location,
          dropoff_location: location,
          pickup_date: req.departDate,
          pickup_time: "10:00:00",
          dropoff_date: req.returnDate,
          dropoff_time: "18:00:00",
          // Required by the API for every search; the traveller's actual
          // licence country is not collected today, so this is a placeholder
          // until that question exists — search only, never used to book.
          driver: { age: 30, residence_country_code: "US" },
        },
      },
    );
  } catch (error) {
    console.error("Duffel cars search failed", error);
  }

  const requested = req.carNameExact?.trim() || null;
  const results = json?.data?.results ?? json?.data?.offers ?? [];
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
        // Sample/test inventory has no real rate to book against.
        rateId: sample ? null : (raw.id ?? null),
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
  let familyNote: string | null = null;
  if (stayRes.status === "fulfilled") {
    familyNote = stayRes.value.familyNote ?? null;
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
        flightAlternatives = [previous, ...flightAlternatives.filter((f) => f !== swap)].slice(
          0,
          3,
        );
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
    familyNote,
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
