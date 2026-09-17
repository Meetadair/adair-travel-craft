/**
 * The travel policy engine.
 *
 * The whole promise of Adair for Business is that a standard is a *filter*,
 * not a warning: an option the traveller may not book is never shown, rather
 * than shown with a red flag beside it. So this module answers one question —
 * may this person book this — and it has to answer it the same way every time,
 * for the search, for the card and for the approval queue.
 *
 * Nothing here touches the database or the network. A policy you cannot test
 * is a policy that quietly excludes every hotel in Zurich.
 */

export type Cabin = "economy" | "premium_economy" | "business" | "first";
export type RailClass = "first" | "second";
export type CarClass = "none" | "economy" | "compact" | "intermediate" | "executive";

const CABIN_ORDER: Cabin[] = ["economy", "premium_economy", "business", "first"];
const CAR_ORDER: CarClass[] = ["none", "economy", "compact", "intermediate", "executive"];

/** A named set of entitlements. Every employee has exactly one. */
export type Grade = {
  id: string;
  name: string;
  /** Best cabin allowed, and the flight length from which it is allowed. */
  cabin: Cabin;
  /** Below this many hours in the air, the cabin falls back to economy. */
  cabinFromHours: number;
  railClass: RailClass;
  /** Cap per night before the city multiplier, in minor units. */
  hotelCapMinor: number;
  carClass: CarClass;
  perDiemMinor: number;
  /** Days of notice below which a trip needs approving. */
  noticeDays: number;
  /** Lounge access, or only on a long connection. */
  lounge: "never" | "long_connection" | "always";
};

/**
 * The five we ship with. A client may edit the numbers; the shape is ours.
 * These mirror the table in the business booklet, and the booklet is what the
 * client was sold — so they must not drift apart.
 */
export const DEFAULT_GRADES: Grade[] = [
  {
    id: "board",
    name: "Board",
    cabin: "business",
    cabinFromHours: 4,
    railClass: "first",
    hotelCapMinor: 32_000,
    carClass: "executive",
    perDiemMinor: 9_500,
    noticeDays: 0,
    lounge: "always",
  },
  {
    id: "director",
    name: "Director",
    cabin: "premium_economy",
    cabinFromHours: 6,
    railClass: "first",
    hotelCapMinor: 22_000,
    carClass: "intermediate",
    perDiemMinor: 7_500,
    noticeDays: 3,
    lounge: "always",
  },
  {
    id: "manager",
    name: "Manager",
    cabin: "economy",
    cabinFromHours: 0,
    railClass: "first",
    hotelCapMinor: 16_000,
    carClass: "compact",
    perDiemMinor: 6_000,
    noticeDays: 7,
    lounge: "long_connection",
  },
  {
    id: "standard",
    name: "Standard",
    cabin: "economy",
    cabinFromHours: 0,
    railClass: "second",
    hotelCapMinor: 11_000,
    carClass: "economy",
    perDiemMinor: 5_000,
    noticeDays: 14,
    lounge: "long_connection",
  },
  {
    id: "entry",
    name: "Entry and contractor",
    cabin: "economy",
    cabinFromHours: 0,
    railClass: "second",
    hotelCapMinor: 8_500,
    carClass: "none",
    perDiemMinor: 4_000,
    noticeDays: 21,
    lounge: "never",
  },
];

/**
 * City bands.
 *
 * A flat hotel cap is the commonest reason a policy gets ignored: €110 is
 * generous in Poznań and unbookable in Zurich. The multiplier is what keeps a
 * standard honest in both places.
 */
export type Band = "1" | "2" | "3" | "4" | "event";

export const BAND_MULTIPLIER: Record<Band, number> = {
  "1": 1.8,
  "2": 1.4,
  "3": 1.1,
  "4": 1.0,
  event: 2.2,
};

const BAND_BY_CITY: Record<string, Band> = {};
const band = (cities: string[], value: Band) => {
  for (const city of cities) BAND_BY_CITY[city.toLowerCase()] = value;
};
band(
  ["Zurich", "Geneva", "New York", "London", "Singapore", "San Francisco", "Hong Kong", "Tokyo"],
  "1",
);
band(["Paris", "Amsterdam", "Munich", "Milan", "Dublin", "Stockholm", "Oslo", "Copenhagen"], "2");
band(["Berlin", "Madrid", "Vienna", "Lisbon", "Prague", "Barcelona", "Rome", "Frankfurt"], "3");
band(["Warsaw", "Budapest", "Bucharest", "Krakow", "Kraków", "Poznan", "Poznań", "Sofia"], "4");

/** Band 4 is the floor, not a guess: an unknown city is never dearer by default. */
export function bandFor(city: string): Band {
  return BAND_BY_CITY[city.trim().toLowerCase()] ?? "4";
}

/** What this grade may spend on a room in this city, per night, in minor units. */
export function hotelCapMinor(grade: Grade, city: string, isEventWeek = false): number {
  const multiplier = BAND_MULTIPLIER[isEventWeek ? "event" : bandFor(city)];
  return Math.round(grade.hotelCapMinor * multiplier);
}

/** The best cabin this grade may take on a flight of this length. */
export function cabinFor(grade: Grade, flightHours: number): Cabin {
  if (grade.cabinFromHours <= 0) return grade.cabin;
  return flightHours >= grade.cabinFromHours ? grade.cabin : "economy";
}

const rank = <T>(order: T[], value: T): number => order.indexOf(value);

export function cabinAllowed(grade: Grade, flightHours: number, cabin: Cabin): boolean {
  return rank(CABIN_ORDER, cabin) <= rank(CABIN_ORDER, cabinFor(grade, flightHours));
}

export function carAllowed(grade: Grade, carClass: CarClass): boolean {
  if (grade.carClass === "none") return carClass === "none";
  return rank(CAR_ORDER, carClass) <= rank(CAR_ORDER, grade.carClass);
}

export function railAllowed(grade: Grade, railClass: RailClass): boolean {
  return grade.railClass === "first" || railClass === "second";
}

/** Days between today and departure. Negative means the past. */
export function noticeDays(departDate: string, today: string): number {
  const a = Date.parse(`${departDate}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((a - b) / 86_400_000);
}

export type Violation = {
  rule: "cabin" | "rail" | "hotel" | "car" | "notice";
  /** Plain words for the traveller and the approver. Never a rule identifier. */
  detail: string;
  /** What it would cost to bring this inside the standard, when we can say. */
  overMinor?: number;
};

export type TripUnderReview = {
  destinationCity: string;
  departDate: string;
  cabin?: Cabin;
  flightHours?: number;
  railClass?: RailClass;
  carClass?: CarClass;
  /** Per night, in minor units. */
  hotelNightlyMinor?: number;
  isEventWeek?: boolean;
};

export type PolicyVerdict = {
  ok: boolean;
  violations: Violation[];
};

const money = (minor: number, currency = "EUR") =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);

/**
 * Every way this trip sits outside the standard, in the order a person would
 * notice them. An empty list is the only way to be in policy.
 */
export function checkTrip(grade: Grade, trip: TripUnderReview, today: string): PolicyVerdict {
  const violations: Violation[] = [];

  if (trip.cabin) {
    const hours = trip.flightHours ?? 0;
    if (!cabinAllowed(grade, hours, trip.cabin)) {
      const allowed = cabinFor(grade, hours);
      violations.push({
        rule: "cabin",
        detail: `${grade.name} flies ${allowed.replace("_", " ")} on a ${hours}-hour flight, not ${trip.cabin.replace("_", " ")}.`,
      });
    }
  }

  if (trip.railClass && !railAllowed(grade, trip.railClass)) {
    violations.push({
      rule: "rail",
      detail: `${grade.name} travels second class by rail.`,
    });
  }

  if (trip.hotelNightlyMinor !== undefined) {
    const cap = hotelCapMinor(grade, trip.destinationCity, trip.isEventWeek);
    if (trip.hotelNightlyMinor > cap) {
      violations.push({
        rule: "hotel",
        detail: `${money(trip.hotelNightlyMinor)} a night is over the ${money(cap)} cap for ${trip.destinationCity}.`,
        overMinor: trip.hotelNightlyMinor - cap,
      });
    }
  }

  if (trip.carClass && !carAllowed(grade, trip.carClass)) {
    violations.push({
      rule: "car",
      detail:
        grade.carClass === "none"
          ? `${grade.name} does not include a hire car.`
          : `${grade.name} hires up to ${grade.carClass}, not ${trip.carClass}.`,
    });
  }

  const notice = noticeDays(trip.departDate, today);
  if (grade.noticeDays > 0 && notice < grade.noticeDays) {
    violations.push({
      rule: "notice",
      detail: `${grade.name} books ${grade.noticeDays} days ahead; this is ${notice < 0 ? 0 : notice}.`,
    });
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Lowest logical fare: of the fares the standard allows, take the cheapest
 * unless another is barely dearer and saves real time. The exception is what
 * travellers actually want, and what clumsy policies forbid.
 */
export type Fare = { id: string; amountMinor: number; durationMinutes: number };

export function lowestLogicalFare(
  fares: Fare[],
  { extraMinor = 4_000, savesMinutes = 90 } = {},
): Fare | null {
  if (fares.length === 0) return null;
  const cheapest = fares.reduce((a, b) => (b.amountMinor < a.amountMinor ? b : a));
  let best = cheapest;
  for (const fare of fares) {
    if (fare.amountMinor - cheapest.amountMinor > extraMinor) continue;
    if (cheapest.durationMinutes - fare.durationMinutes < savesMinutes) continue;
    if (fare.durationMinutes < best.durationMinutes) best = fare;
  }
  return best;
}

/**
 * Rail before air under this distance. Good for the carbon line in the annual
 * report, usually cheaper, and the reason a client's sustainability officer
 * takes the meeting.
 */
export const RAIL_FIRST_KM = 700;

export function preferRail(distanceKm: number, limitKm = RAIL_FIRST_KM): boolean {
  return distanceKm > 0 && distanceKm < limitKm;
}
