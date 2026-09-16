/**
 * Turns saved traveller preferences into ranking scores. Duffel cannot filter
 * on most of these, so we use them to sort results rather than drop them.
 */
import { brandWords } from "@/lib/brands/catalogue";
import { houseBonus } from "@/lib/trip/house-standard";
import type { TravelPrefs } from "@/lib/prefs/questions";
import type { Learned } from "@/lib/trip/learning";
import type { TripOccasion, TripParty, TripPurpose } from "@/lib/trip/types";

/** Search-time subset of the preferences, safe to pass into server search. */
export type SearchPrefs = Pick<
  TravelPrefs,
  | "airlines"
  | "seat"
  | "cabinRule"
  | "hotelChains"
  | "hotelStars"
  | "hotelMinRating"
  | "hotelAmenities"
  | "hotelTypes"
  | "carBrands"
  | "carCompanies"
  | "carClass"
  | "carTransmission"
  | "cabinClass"
  | "maxConnections"
  | "hotelMaxKm"
  | "dealbreakers"
> & {
  /**
   * What we have noticed from their own swaps. Already filtered so that a
   * stated preference or dealbreaker always wins — see lib/trip/learning.
   */
  learned?: Learned;
  /**
   * What they actually chose in this destination before. Ranks below stated
   * preferences and confirmed habits, above learned weights and price.
   */
  remembered?: { hotels: string[]; carSuppliers: string[] };
};

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Preference value → words we expect to see in supplier text. */
const AIRLINE_WORDS: Record<string, string[]> = {
  lot: ["lot", "polish airlines"],
  lufthansa: ["lufthansa"],
  airfrance: ["air france"],
  klm: ["klm"],
  ba: ["british airways"],
  wizz: ["wizz"],
  ryanair: ["ryanair"],
  turkish: ["turkish"],
  emirates: ["emirates"],
  qatar: ["qatar"],
  swiss: ["swiss"],
  austrian: ["austrian"],
  iberia: ["iberia"],
  ita: ["ita airways", "alitalia"],
  sas: ["sas", "scandinavian"],
  finnair: ["finnair"],
  aegean: ["aegean"],
  easyjet: ["easyjet"],
  delta: ["delta"],
  united: ["united"],
  american: ["american"],
};

const CHAIN_WORDS: Record<string, string[]> = {
  hyatt: ["hyatt", "andaz", "park hyatt"],
  marriott: ["marriott", "sheraton", "westin", "st. regis", "ritz"],
  hilton: ["hilton", "conrad", "waldorf", "canopy"],
  ihg: ["intercontinental", "holiday inn", "kimpton", "crowne plaza"],
  accor: ["accor", "sofitel", "novotel", "mercure", "ibis", "pullman"],
  radisson: ["radisson", "park inn"],
  slh: ["small luxury"],
  designhotels: ["design hotel"],
  fourseasons: ["four seasons"],
  mandarin: ["mandarin oriental"],
  rosewood: ["rosewood"],
  kempinski: ["kempinski"],
  melia: ["melia", "meliá", "gran melia"],
  nh: ["nh hotel", "nh collection"],
  scandic: ["scandic"],
};

const CAR_BRAND_WORDS: Record<string, string[]> = {
  bmw: ["bmw"],
  mercedes: ["mercedes"],
  audi: ["audi"],
  vw: ["volkswagen", "vw"],
  volvo: ["volvo"],
  tesla: ["tesla"],
  toyota: ["toyota"],
  skoda: ["skoda", "škoda"],
  renault: ["renault"],
  peugeot: ["peugeot"],
};

const CAR_CLASS_WORDS: Record<string, string[]> = {
  economy: ["economy"],
  compact: ["compact"],
  midsize: ["midsize", "intermediate"],
  suv: ["suv", "crossover"],
  premium: ["premium"],
  luxury: ["luxury", "prestige"],
};

const AMENITY_WORDS: Record<string, string[]> = {
  spa: ["spa"],
  pool: ["pool"],
  sauna: ["sauna"],
  gym: ["gym", "fitness"],
  beachfront: ["beach"],
  boutique: ["boutique"],
  resort: ["resort"],
};

function matchesAny(text: string, words: string[]): boolean {
  const haystack = fold(text);
  return words.some((word) => haystack.includes(fold(word)));
}

/**
 * Brand preferences are stored as brand ids, so unknown keys fall back to the
 * brand catalogue's name and aliases before matching on the raw value.
 */
function anySelected(text: string, selected: string[], table: Record<string, string[]>): boolean {
  return selected.some((key) => matchesAny(text, table[key] ?? brandWords(key)));
}

/**
 * Whether one airline preference key matches a carrier name, using the same
 * word table the ranker uses. Exported so the flight comparison can say "your
 * airline" without a second, drifting copy of the list.
 */
export function matchesAirline(key: string, carrierText: string): boolean {
  return matchesAny(carrierText, AIRLINE_WORDS[key] ?? brandWords(key));
}

/** The same, for hotel groups. */
export function matchesChain(key: string, text: string): boolean {
  return matchesAny(text, CHAIN_WORDS[key] ?? brandWords(key));
}

/** The same, for hotel amenities and property types. */
export function matchesAmenity(key: string, text: string): boolean {
  return matchesAny(text, AMENITY_WORDS[key] ?? [key]);
}

/** The same, for car brands. */
export function matchesCarBrand(key: string, text: string): boolean {
  return matchesAny(text, CAR_BRAND_WORDS[key] ?? brandWords(key));
}

/* ------------------------------ hard filters ------------------------------ */

/**
 * Dealbreakers are rules, not scores: anything failing one is dropped before
 * ranking. We only apply the rules the supplier data can actually answer —
 * the rest stay recorded on the profile and are shown to the traveller.
 */
export function staysPassingDealbreakers<T>(
  items: T[],
  read: (item: T) => { name: string; rating: number | null },
  prefs?: SearchPrefs,
): T[] {
  const rules = prefs?.dealbreakers ?? [];
  if (!rules.length) return items;
  return items.filter((item) => {
    const { name, rating } = read(item);
    if (rules.includes("dbStars4") && (rating == null || rating < 4)) return false;
    return true;
  });
}

export function carsPassingDealbreakers<T>(
  items: T[],
  read: (item: T) => { transmission: string },
  prefs?: SearchPrefs,
): T[] {
  const rules = prefs?.dealbreakers ?? [];
  if (!rules.includes("dbAutomatic")) return items;
  return items.filter((item) => matchesAny(read(item).transmission, ["automatic", "auto"]));
}

/** The rules we cannot verify from supplier data yet — shown, never faked. */
export function unverifiableDealbreakers(prefs?: SearchPrefs): string[] {
  const shown: Record<string, string> = {
    dbLift: "a lift",
    dbStepFree: "step-free access",
    dbPets: "pets allowed",
  };
  return (prefs?.dealbreakers ?? []).flatMap((rule) => (shown[rule] ? [shown[rule]] : []));
}

/** Lower is better: a ranking price, not a real one. */
export function flightScore(carrierText: string, amount: number, prefs?: SearchPrefs): number {
  let score = amount * (prefs?.learned?.priceWeight ?? 1);
  // Preferred carriers rank as if they were 12% cheaper.
  if (prefs?.airlines.length && anySelected(carrierText, prefs.airlines, AIRLINE_WORDS))
    score *= 0.88;
  if (avoided(carrierText, "flight", prefs)) score *= 1.25;
  return score;
}

/** A name we remember from this city, matched loosely on the supplier text. */
function remembers(names: string[] | undefined, text: string): boolean {
  if (!names?.length) return false;
  const haystack = fold(text);
  return names.some((name) => {
    const needle = fold(name).trim();
    return needle.length > 3 && haystack.includes(needle);
  });
}

/** Brands they have swapped away from twice or more rank down, never out. */
function avoided(text: string, kind: "flight" | "hotel" | "car", prefs?: SearchPrefs): boolean {
  const ids = (prefs?.learned?.avoid ?? []).filter((e) => e.kind === kind).map((e) => e.brandId);
  return ids.length > 0 && anySelected(text, ids, {});
}

/** Higher is better. Chain and star matches outweigh a small price difference. */
/**
 * What the trip is for, as far as the hotel is concerned.
 *
 * The same two people, the same city, the same nights: a board meeting wants a
 * predictable desk near the office and a quiet early night, an anniversary
 * wants somewhere worth arriving at. Ranking on price and star rating alone
 * answers both with the same hotel, and is wrong for at least one of them.
 */
export type TripStyle = {
  purpose?: TripPurpose | null;
  party?: TripParty | null;
  occasion?: TripOccasion | null;
};

/** Words suppliers actually put in property names, grouped by what they signal. */
const STYLE_WORDS = {
  business: [
    "business",
    "executive",
    "courtyard",
    "express",
    "garden inn",
    "novotel",
    "mercure",
    "crowne",
    "hyatt place",
    "moxy",
    "aparthotel",
  ],
  special: [
    "boutique",
    "design",
    "relais",
    "chateau",
    "château",
    "palace",
    "small luxury",
    "suite",
    "spa",
    "grand hotel",
    "belmond",
    "rosewood",
    "aman",
    "st. regis",
    "four seasons",
    "mandarin",
    "bulgari",
  ],
  family: ["apartment", "residence", "suites", "family", "aparthotel", "resort"],
} as const;

const mentions = (name: string, words: readonly string[]) => {
  const text = fold(name);
  return words.some((word) => text.includes(fold(word)));
};

/**
 * Nudges the score by what this trip is, never by more than a stated
 * preference would: the traveller's own settings still outrank the occasion.
 */
export function styleScore(name: string, rating: number | null, style?: TripStyle): number {
  if (!style?.purpose) return 0;
  let score = 0;

  if (style.purpose === "business") {
    if (mentions(name, STYLE_WORDS.business)) score += 3;
    // A spa resort is not where anyone wants to be at 7am before a meeting.
    if (mentions(name, STYLE_WORDS.special)) score -= 1;
    // Predictability is the point: a well-rated known quantity beats a find.
    if (rating != null && rating >= 4) score += 1;
    return score;
  }

  const celebrating =
    style.occasion === "anniversary" ||
    style.occasion === "birthday" ||
    style.occasion === "honeymoon";

  if (style.party === "partner") {
    if (mentions(name, STYLE_WORDS.special)) score += celebrating ? 5 : 2;
    if (mentions(name, STYLE_WORDS.business)) score -= celebrating ? 3 : 1;
    // On a trip someone is marking, the best room in the city matters more
    // than the last forty euro.
    if (celebrating && rating != null && rating >= 4.5) score += 3;
  }

  if (style.party === "family") {
    if (mentions(name, STYLE_WORDS.family)) score += 4;
    if (mentions(name, STYLE_WORDS.business)) score -= 1;
  }

  if (style.party === "friends" && mentions(name, STYLE_WORDS.family)) score += 2;

  return score;
}

export function stayScore(
  name: string,
  rating: number | null,
  amount: number,
  prefs?: SearchPrefs,
  style?: TripStyle,
  /** What the supplier publishes about the property, lower-cased. */
  amenities?: string[],
): number {
  // A celebration is the one case where price should push less hard: someone
  // marking an anniversary is not shopping for the cheapest bed in the city.
  const celebrating =
    style?.purpose === "personal" &&
    style.party === "partner" &&
    (style.occasion === "anniversary" ||
      style.occasion === "birthday" ||
      style.occasion === "honeymoon");
  const priceWeight = (prefs?.learned?.priceWeight ?? 1) * (celebrating ? 0.6 : 1);

  // The house standard rides above every preference: what we are willing to put
  // our name on, for a traveller who has not used Adair before and will judge us
  // by the first hotel we show them.
  let score =
    (rating ?? 0) * 2 -
    (amount / 500) * priceWeight +
    styleScore(name, rating, style) +
    houseBonus(name, amenities);
  if (!prefs) return score;
  if (avoided(name, "hotel", prefs)) score -= 5;
  if (prefs.hotelChains.length && anySelected(name, prefs.hotelChains, CHAIN_WORDS)) score += 6;
  if (
    prefs.hotelStars.length &&
    rating != null &&
    prefs.hotelStars.includes(String(Math.round(rating)))
  )
    score += 3;
  if (rating != null && rating >= prefs.hotelMinRating) score += 2;
  if (prefs.hotelAmenities.length && anySelected(name, prefs.hotelAmenities, AMENITY_WORDS))
    score += 1;
  if (prefs.hotelTypes.length && anySelected(name, prefs.hotelTypes, AMENITY_WORDS)) score += 1;
  // Where they stayed before in this city, when nothing stated says otherwise.
  if (remembers(prefs.remembered?.hotels, name)) score += 4;
  return score;
}

/** Higher is better. */
export function carScore(
  supplier: string,
  vehicle: string,
  transmission: string,
  amount: number,
  prefs?: SearchPrefs,
): number {
  let score = (-amount / 100) * (prefs?.learned?.priceWeight ?? 1);
  if (avoided(`${supplier} ${vehicle}`, "car", prefs)) score -= 4;
  const wantedTransmission = prefs?.carTransmission ?? "automatic";
  if (wantedTransmission !== "any" && new RegExp(wantedTransmission, "i").test(transmission))
    score += 4;
  if (!prefs) return score;
  if (prefs.carBrands.length && anySelected(vehicle, prefs.carBrands, CAR_BRAND_WORDS)) score += 5;
  if (prefs.carCompanies.length && anySelected(supplier, prefs.carCompanies, {})) score += 4;
  if (prefs.carClass && matchesAny(vehicle, CAR_CLASS_WORDS[prefs.carClass] ?? [prefs.carClass]))
    score += 3;
  if (remembers(prefs.remembered?.carSuppliers, supplier)) score += 2;
  return score;
}
