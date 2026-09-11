/**
 * Rule-based parser: free-text sentence → structured trip request.
 * No AI call, so it is fast and deterministic. Weekday names resolve relative
 * to today; unparseable input falls back to Milan, next Tuesday–Thursday.
 */
import { CITIES, DEFAULT_DESTINATION, DEFAULT_ORIGIN, findCity, type CityEntry } from "./cities";
import type { TripRequest } from "./types";

/** Weekday match terms, index 0 = Monday. */
const WEEKDAYS: string[][] = [
  ["monday", "mon ", "poniedzia", "montag", "lundi", "lunedi", "lunedì"],
  ["tuesday", "tue", "wtorek", "dienstag", "mardi", "martedi", "martedì"],
  ["wednesday", "wed", "sroda", "środa", "srode", "środę", "mittwoch", "mercredi", "mercoledi"],
  ["thursday", "thu", "czwartek", "donnerstag", "jeudi", "giovedi", "giovedì"],
  ["friday", "fri", "piatek", "piątek", "freitag", "vendredi", "venerdi"],
  ["saturday", "sat", "sobota", "sobote", "sobotę", "samstag", "samedi", "sabato"],
  ["sunday", "sun", "niedziela", "niedziele", "sonntag", "dimanche", "domenica"],
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Next date (strictly in the future) whose weekday is `index` (0 = Monday). */
function nextWeekday(from: Date, index: number): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const current = (d.getUTCDay() + 6) % 7; // 0 = Monday
  let delta = index - current;
  if (delta <= 0) delta += 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function cabinOf(text: string): TripRequest["cabinClass"] {
  if (/business|biznes|klasa biznes/.test(text)) return "business";
  if (/first class|pierwsza klasa/.test(text)) return "first";
  if (/premium/.test(text)) return "premium_economy";
  return "economy";
}

function passengersOf(text: string): number {
  const match = /(\d+)\s*(passengers?|people|persons?|adults?|osob|osoby|pasa[zż]er)/.exec(text);
  const n = match ? Number(match[1]) : 1;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 9);
}

/** "near the Duomo", "close to the convention center", "koło Duomo". */
function hotelWishOf(sentence: string): string | null {
  const match =
    /((?:near|close to|next to|by the|within walking distance of|walking distance from|kolo|koło|blisko|obok|w poblizu|w pobliżu)\s+[^,.;]{2,60})/i.exec(
      sentence,
    );
  return match?.[1]?.trim() ?? null;
}

/** Known rental brands and car makes we accept as an exact car request. */
const CAR_BRANDS =
  /\b(sixt|hertz|avis|europcar|enterprise|budget|alamo|thrifty|national|dollar|tesla|bmw|audi|mercedes|volvo|toyota|skoda|škoda|volkswagen|renault|peugeot|ford|fiat|kia|hyundai|nissan|opel|seat|cupra|polestar)\b/i;

/**
 * A specific property the traveller named: quoted, or a capitalised
 * multi-word proper noun after "at" / "hotel" / "w hotelu" / "stay at".
 */
function hotelNameExactOf(sentence: string): string | null {
  const mentionsHotel = /hotel|stay|nocleg|hotelu|apartament|resort|guesthouse|pensjonat/i.test(
    sentence,
  );

  const quoted = /["“„']([^"“”„']{3,60})["”“'"]/.exec(sentence);
  if (quoted?.[1] && mentionsHotel) return quoted[1].trim();

  const proper =
    /(?:stay(?:ing)?\s+at|check\s+in\s+at|hotel(?:u)?|w\s+hotelu|nocleg\s+w|at\s+the|at)\s+((?:[A-ZÀ-ŸŁŚŻŹĆŃÓĘĄ][\p{L}&'’.-]*)(?:\s+(?:[A-ZÀ-ŸŁŚŻŹĆŃÓĘĄ][\p{L}&'’.-]*|de|del|della|di|la|le|du|of|the|and|&))*)/u.exec(
      sentence,
    );
  const name = proper?.[1]?.trim();
  if (!name) return null;
  // A single short word ("Milan", "Tuesday") is not a venue name.
  if (!/\s/.test(name) && name.length < 6) return null;
  return name;
}

/** "from Sixt", "a Tesla", "Sixt automatic". */
function carNameExactOf(sentence: string): string | null {
  const explicit = /(?:from|with|z|od|u)\s+(sixt|hertz|avis|europcar|enterprise|budget|alamo|thrifty|national|dollar)\b/i.exec(
    sentence,
  );
  if (explicit?.[1]) return explicit[1];
  const brand = CAR_BRANDS.exec(sentence);
  if (!brand?.[1]) return null;
  const after = sentence.slice((brand.index ?? 0) + brand[1].length).match(/^\s+([\p{L}\d-]{2,14})/u);
  return after?.[1] && /^[a-z0-9]/i.test(after[1])
    ? `${brand[1]} ${after[1]}`.trim()
    : brand[1];
}


function originOf(text: string, destination: CityEntry): CityEntry {
  // "from Berlin", "z Warszawy" — otherwise default to Warsaw.
  const fromMatch = /\b(?:from|out of|z|ze)\s+([\p{L}\s-]{3,24})/u.exec(text);
  if (fromMatch?.[1]) {
    const found = findCity(fromMatch[1].toLowerCase(), destination.iata);
    if (found) return found;
  }
  if (destination.iata === DEFAULT_ORIGIN.iata) {
    return CITIES.find((c) => c.iata === "BER")!;
  }
  return DEFAULT_ORIGIN;
}

export function parseTripSentence(sentence: string, today = new Date()): TripRequest {
  const text = ` ${sentence.toLowerCase()} `;

  const destination = findCity(text) ?? DEFAULT_DESTINATION;
  const origin = originOf(text, destination);

  // Weekday hits, in the order they appear in the sentence.
  const hits: { index: number; at: number }[] = [];
  WEEKDAYS.forEach((terms, index) => {
    let at = -1;
    for (const term of terms) {
      const found = text.indexOf(term);
      if (found >= 0 && (at < 0 || found < at)) at = found;
    }
    if (at >= 0) hits.push({ index, at });
  });
  hits.sort((a, b) => a.at - b.at);

  const isWeekend = /weekend|week-end|wochenende/.test(text);

  let depart: Date;
  let back: Date;
  if (hits.length >= 2) {
    depart = nextWeekday(today, hits[0]!.index);
    back = nextWeekday(depart, hits[1]!.index);
  } else if (hits.length === 1) {
    depart = nextWeekday(today, hits[0]!.index);
    back = isWeekend ? nextWeekday(depart, 6) : addDays(depart, 1);
  } else if (isWeekend) {
    depart = nextWeekday(today, 5); // Saturday
    back = nextWeekday(depart, 6); // Sunday
  } else {
    depart = nextWeekday(today, 1); // Tuesday
    back = nextWeekday(depart, 3); // Thursday
  }

  const nightsMatch = /(\d+)\s*(nights?|noc)/.exec(text);
  if (nightsMatch?.[1]) {
    const nights = Math.min(Math.max(Number(nightsMatch[1]), 1), 21);
    back = addDays(depart, nights);
  }

  const namedHotel = hotelNameExactOf(sentence);
  const isCityName = (value: string) =>
    [destination.city, origin.city, destination.iata, origin.iata].some(
      (c) => c.toLowerCase() === value.toLowerCase(),
    );

  return {
    originCity: origin.city,
    originIata: origin.iata,
    destinationCity: destination.city,
    destinationIata: destination.iata,
    lat: destination.lat,
    lon: destination.lon,
    departDate: iso(depart),
    returnDate: iso(back),
    cabinClass: cabinOf(text),
    passengers: passengersOf(text),
    hotelWish: hotelWishOf(sentence),
    hotelNameExact: namedHotel && !isCityName(namedHotel) ? namedHotel : null,
    carNameExact: carNameExactOf(sentence),
    needsCar: /\bcar\b|auto|samoch|rental|mietwagen|voiture/.test(text) && !/no car|without a car|bez auta|bez samoch/.test(text),
    invoiceToCompany: /invoice|company|vat|faktur|firm|rechnung|societ|empresa/.test(text),
  };

}
