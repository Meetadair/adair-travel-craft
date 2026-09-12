/**
 * Rule-based parser: free-text sentence → structured trip request.
 * No AI call, so it is fast and deterministic. Weekday names resolve relative
 * to today; unparseable input falls back to Milan, next Tuesday–Thursday.
 */
import { CITIES, DEFAULT_DESTINATION, DEFAULT_ORIGIN, findCity, type CityEntry } from "./cities";
import { airportByIata } from "@/lib/prefs/airports";
import type { TripRequest, TripStop } from "./types";

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


/** The traveller's saved home airport, as a city entry we can search from. */
function homeAirportEntry(iata: string | undefined): CityEntry | null {
  if (!iata) return null;
  const code = iata.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  const known = CITIES.find((c) => c.iata === code);
  if (known) return known;
  const airport = airportByIata(code);
  if (!airport) return null;
  return { city: airport.city, iata: airport.iata, lat: 0, lon: 0, aliases: [] };
}

function originOf(text: string, destination: CityEntry, homeIata?: string): CityEntry {
  // "from Berlin", "z Warszawy" — otherwise the saved home airport.
  const fromMatch = /\b(?:from|out of|z|ze)\s+([\p{L}\s-]{3,24})/u.exec(text);
  if (fromMatch?.[1]) {
    const found = findCity(fromMatch[1].toLowerCase(), destination.iata);
    if (found) return found;
  }
  const home = homeAirportEntry(homeIata);
  if (home && home.iata !== destination.iata) return home;
  if (destination.iata === DEFAULT_ORIGIN.iata) {
    return CITIES.find((c) => c.iata === "BER")!;
  }
  return DEFAULT_ORIGIN;
}

/**
 * Every city named in the sentence, in the order it appears — this is how a
 * multi-city trip ("Rome then Athens then Santorini") becomes a stop list.
 */
function findCitiesInOrder(text: string): CityEntry[] {
  const hits: { entry: CityEntry; at: number }[] = [];
  for (const entry of CITIES) {
    let at = -1;
    for (const alias of [entry.city.toLowerCase(), entry.iata.toLowerCase(), ...entry.aliases]) {
      const found = text.indexOf(alias.length <= 3 ? ` ${alias} ` : alias);
      if (found >= 0 && (at < 0 || found < at)) at = found;
    }
    if (at >= 0) hits.push({ entry, at });
  }
  hits.sort((a, b) => a.at - b.at);

  // Drop a city that is only there as the departure point ("from Berlin").
  const fromMatch = /\b(?:from|out of|z|ze)\s+([\p{L}\s-]{3,24})/u.exec(text);
  const originName = fromMatch?.[1] ? findCity(fromMatch[1].toLowerCase())?.iata : undefined;

  const seen = new Set<string>();
  return hits
    .map((h) => h.entry)
    .filter((entry) => {
      if (entry.iata === originName) return false;
      if (seen.has(entry.iata)) return false;
      seen.add(entry.iata);
      return true;
    });
}


/** 24-hour clock time in a sentence: "3pm", "15:00", "o 15.00". */
function clockOf(text: string): { hour: number; minute: number } | null {
  const match =
    /\b(?:by|before|at|until|o|na|przed|do)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|rano|wieczor|wieczór)?/i.exec(
      text,
    );
  if (!match?.[1]) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const suffix = (match[3] ?? "").toLowerCase();
  if (/pm|wieczor|wieczór/.test(suffix) && hour < 12) hour += 12;
  if (/am|rano/.test(suffix) && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** The date a deadline refers to: today, tomorrow, or a named weekday. */
function deadlineDate(text: string, today: Date, fallbackIso: string): Date {
  if (/\btomorrow\b|jutro/.test(text)) return addDays(today, 1);
  if (/\btoday\b|dzis|dziś|dzisiaj/.test(text)) return new Date(today.getTime());
  for (let index = 0; index < WEEKDAYS.length; index += 1) {
    if (WEEKDAYS[index]!.some((term) => text.includes(term))) return nextWeekday(today, index);
  }
  return new Date(Date.parse(`${fallbackIso}T12:00:00Z`));
}

function atUtc(date: Date, hour: number, minute: number): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute),
  );
  return d.toISOString();
}

/**
 * "I need to be in Milan tomorrow at 3pm", "muszę być w Mediolanie jutro o 15:00".
 * A required arrival, kept separate from the ordinary date range.
 */
function mustArriveOf(sentence: string, today: Date, fallbackIso: string): string | null {
  const text = sentence.toLowerCase();
  const wantsArrival =
    /\b(?:need to be|have to be|must be|be in|be there|arrive|arriving|land|meeting|conference)\b/.test(
      text,
    ) || /musz[eę] by[cć]|mam by[cć]|spotkanie|konferencj|trzeba by[cć]/.test(text);
  if (!wantsArrival) return null;
  const clock = clockOf(text);
  if (!clock) return null;
  return atUtc(deadlineDate(text, today, fallbackIso), clock.hour, clock.minute);
}

/** "I have to leave Milan by Thursday evening" — the reverse constraint. */
function mustDepartOf(sentence: string, today: Date, fallbackIso: string): string | null {
  const text = sentence.toLowerCase();
  const wantsDeparture =
    /\b(?:leave|depart|fly back|be back|head back|return)\b/.test(text) ||
    /wyje[zż]d|wracam|wr[oó]ci[cć]|odlot/.test(text);
  if (!wantsDeparture) return null;
  const evening = /\bevening\b|wieczor|wieczór/.test(text);
  const clock = clockOf(text);
  if (!clock && !evening) return null;
  const date = deadlineDate(text, today, fallbackIso);
  return clock ? atUtc(date, clock.hour, clock.minute) : atUtc(date, 20, 0);
}

/** Where they have to be: "meeting at the Duomo", "spotkanie w biurze BNP". */
function meetingLocationOf(sentence: string): string | null {
  const match =
    /(?:meeting|conference|appointment|spotkanie|konferencj\w*)\s+(?:at|in|near|w|we|przy|na)\s+([^,.;]{2,60})/i.exec(
      sentence,
    );
  return match?.[1]?.trim() ?? null;
}

export function parseTripSentence(
  sentence: string,
  today = new Date(),
  homeAirportIata?: string,
): TripRequest {
  const text = ` ${sentence.toLowerCase()} `;

  const destinations = findCitiesInOrder(text);
  const destination = destinations[0] ?? findCity(text) ?? DEFAULT_DESTINATION;
  const origin = originOf(text, destination, homeAirportIata);

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

  const mustArriveBy = mustArriveOf(sentence, today, iso(depart));
  if (mustArriveBy) {
    // The deadline is the day they travel; keep at least one night if the
    // sentence implied a stay.
    depart = new Date(Date.parse(`${mustArriveBy.slice(0, 10)}T12:00:00Z`));
    if (back.getTime() <= depart.getTime()) back = addDays(depart, 1);
  }
  const mustDepartBy = mustDepartOf(sentence, today, iso(back));

  const stopEntries = destinations.length ? destinations : [destination];
  const stops: TripStop[] = [
    { city: origin.city, iata: origin.iata, lat: origin.lat, lon: origin.lon },
    ...stopEntries.map((c) => ({ city: c.city, iata: c.iata, lat: c.lat, lon: c.lon })),
  ];

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
    mustArriveBy,
    mustDepartBy,
    meetingLocation: meetingLocationOf(sentence) ?? hotelWishOf(sentence),
    invoiceToCompany: /invoice|company|vat|faktur|firm|rechnung|societ|empresa/.test(text),
    stops,
  };

}
