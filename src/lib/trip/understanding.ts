/**
 * What Adair understood from the sentence, before anything is searched.
 *
 * The strip under the input is built from this: structured fields that open a
 * picker when tapped, plus the free-text wishes we keep in the traveller's own
 * words ("hotel with a pool", "dinner at 7pm").
 *
 * Pure and browser-safe; the chat and the tests read the same rules.
 */
import { AIRPORT_COORDS } from "./airport-geo";
import { airportByIata } from "@/lib/prefs/airports";
import type { TripOccasion, TripParty, TripPurpose, TripRequest } from "./types";

/** Which picker a field opens when tapped. */
export type PickerKind =
  "origin" | "destination" | "departDate" | "returnDate" | "arriveBy" | "travellers";

export type UnderstoodField = {
  key: PickerKind;
  /** Short label, e.g. "From". */
  label: string;
  /** What we read, e.g. "Warsaw (WAW)". */
  value: string;
};

export type Understanding = {
  fields: UnderstoodField[];
  /** Wishes we could not turn into structure, kept verbatim. */
  wishes: string[];
};

export type UnderstandingCopy = {
  from: string;
  to: string;
  depart: string;
  back: string;
  arriveBy: string;
  travellers: string;
  travellerOne: string;
  travellerMany: string;
};

export const UNDERSTANDING_COPY: UnderstandingCopy = {
  from: "From",
  to: "To",
  depart: "Out",
  back: "Back",
  arriveBy: "There by",
  travellers: "Travellers",
  travellerOne: "1 person",
  travellerMany: "{count} people",
};

/** Free-text wishes worth repeating back, in the order they appear. */
const WISH_PATTERNS: RegExp[] = [
  /hotel\s+with\s+[^,.;]{2,40}/gi,
  /\b(?:with|z)\s+(?:a\s+)?(?:pool|swimming pool|gym|spa|sauna|garage|parking|balcony|sea view|basenem|siłowni\w*)\b/gi,
  /\b(?:dinner|lunch|breakfast|kolacja|obiad)\b(?:\s+(?:at|for|o|na)\s+[^,.;]{1,24})?/gi,
  /\b(?:taxi|transfer|ride|car service|taks[oó]wk\w*)\b(?:\s+(?:from|to|z|na)\s+[^,.;]{1,24})?/gi,
  /\b(?:quiet|central|walking distance|near the (?:centre|center|beach|old town))\b/gi,
  /\b(?:late checkout|early check-?in|non-?smoking|pet friendly)\b/gi,
];

/** Wishes stated in the sentence, de-duplicated and trimmed. */
export function wishesFromSentence(sentence: string): string[] {
  const found: string[] = [];
  for (const pattern of WISH_PATTERNS) {
    for (const match of sentence.matchAll(pattern)) {
      const text = match[0].trim().replace(/\s+/g, " ");
      if (text.length < 3) continue;
      const key = text.toLowerCase();
      if (!found.some((f) => f.toLowerCase() === key)) found.push(text);
    }
  }
  return found.slice(0, 5);
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

/** The strip contents: structured fields first, then the wishes. */
export function understand(
  sentence: string,
  request: TripRequest,
  copy: UnderstandingCopy = UNDERSTANDING_COPY,
): Understanding {
  const fields: UnderstoodField[] = [
    { key: "origin", label: copy.from, value: `${request.originCity} (${request.originIata})` },
    {
      key: "destination",
      label: copy.to,
      value: `${request.destinationCity} (${request.destinationIata})`,
    },
    { key: "departDate", label: copy.depart, value: request.departDate },
    { key: "returnDate", label: copy.back, value: request.returnDate },
  ];
  if (request.mustArriveBy) {
    fields.push({ key: "arriveBy", label: copy.arriveBy, value: time(request.mustArriveBy) });
  }
  fields.push({
    key: "travellers",
    label: copy.travellers,
    value:
      request.passengers === 1
        ? copy.travellerOne
        : fill(copy.travellerMany, { count: String(request.passengers) }),
  });

  const wishes = wishesFromSentence(sentence);
  if (request.hotelNameExact && !wishes.some((w) => w.includes(request.hotelNameExact!))) {
    wishes.unshift(request.hotelNameExact);
  }
  if (
    request.hotelWish &&
    !wishes.some((w) => w.toLowerCase() === request.hotelWish!.toLowerCase())
  )
    wishes.push(request.hotelWish);
  if (request.carNameExact) wishes.push(request.carNameExact);

  return { fields, wishes: wishes.slice(0, 6) };
}

/** Edits made in the strip; they override the parsed request, never the words. */
export type TripOverrides = {
  originIata?: string | undefined;
  destinationIata?: string | undefined;
  departDate?: string | undefined;
  returnDate?: string | undefined;
  mustArriveBy?: string | undefined;
  passengers?: number | undefined;
  childAges?: number[] | undefined;
  cabinClass?: string | undefined;
  /** Explicitly false collapses a one-way back into a return trip. */
  oneWay?: boolean | undefined;
  /** Work or private, as answered in the chat. */
  purpose?: TripPurpose | undefined;
  /** Who is coming, as answered in the chat. */
  party?: TripParty | undefined;
  /** A celebration, as answered in the chat. */
  occasion?: TripOccasion | undefined;
  /** Answered either way in the chat; false is a real answer, not silence. */
  needsCar?: boolean | undefined;
  /** The hotel actually shown on the card — pins live search to that property
   *  instead of letting it re-rank and possibly land on a different one. */
  hotelNameExact?: string | undefined;
};

/** The request as the traveller corrected it. */
export function applyOverrides(request: TripRequest, overrides: TripOverrides): TripRequest {
  const next: TripRequest = { ...request };
  if (overrides.departDate) next.departDate = overrides.departDate;
  if (overrides.returnDate) next.returnDate = overrides.returnDate;
  if (overrides.mustArriveBy) next.mustArriveBy = overrides.mustArriveBy;
  if (overrides.passengers) next.passengers = overrides.passengers;
  if (overrides.childAges?.length) next.childAges = overrides.childAges;
  if (overrides.cabinClass) next.cabinClass = overrides.cabinClass as TripRequest["cabinClass"];
  // Tested against undefined, not truthiness: turning a one-way back into a
  // return trip means sending false, and `if (false)` would drop it silently.
  if (overrides.oneWay !== undefined) next.oneWay = overrides.oneWay;
  if (overrides.originIata) {
    const iata = overrides.originIata.toUpperCase();
    next.originIata = iata;
    // Answering the question is what makes the origin real: the flag stops the
    // chat asking again, and the city name has to follow the code or the card
    // would still print whichever city the fallback had invented.
    next.originStated = true;
    const airport = airportByIata(iata);
    if (airport) next.originCity = airport.city;
    const coords = AIRPORT_COORDS[iata];
    next.stops = next.stops.length
      ? [
          {
            city: airport?.city ?? next.originCity,
            iata,
            lat: coords?.lat ?? next.stops[0]!.lat,
            lon: coords?.lon ?? next.stops[0]!.lon,
          },
          ...next.stops.slice(1),
        ]
      : next.stops;
  }
  if (overrides.purpose) next.purpose = overrides.purpose;
  if (overrides.party) next.party = overrides.party;
  if (overrides.occasion) next.occasion = overrides.occasion;
  if (overrides.needsCar !== undefined) next.needsCar = overrides.needsCar;
  if (overrides.hotelNameExact) next.hotelNameExact = overrides.hotelNameExact;
  if (overrides.destinationIata) {
    const iata = overrides.destinationIata.toUpperCase();
    next.destinationIata = iata;
    // A different airport means a different search centre for hotels and cars.
    const coords = AIRPORT_COORDS[iata];
    if (coords) {
      next.lat = coords.lat;
      next.lon = coords.lon;
    }
  }
  if (next.returnDate < next.departDate) next.returnDate = next.departDate;
  return next;
}
