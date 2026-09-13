/**
 * Turns saved traveller preferences into ranking scores. Duffel cannot filter
 * on most of these, so we use them to sort results rather than drop them.
 */
import { brandWords } from "@/lib/brands/catalogue";
import type { TravelPrefs } from "@/lib/prefs/questions";
import type { Learned } from "@/lib/trip/learning";

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
export function stayScore(
  name: string,
  rating: number | null,
  amount: number,
  prefs?: SearchPrefs,
): number {
  let score = (rating ?? 0) * 2 - (amount / 500) * (prefs?.learned?.priceWeight ?? 1);
  if (!prefs) return score;
  if (avoided(name, "hotel", prefs)) score -= 5;
  if (prefs.hotelChains.length && anySelected(name, prefs.hotelChains, CHAIN_WORDS)) score += 6;
  if (prefs.hotelStars.length && rating != null && prefs.hotelStars.includes(String(Math.round(rating))))
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
  if (prefs.carCompanies.length && anySelected(supplier, prefs.carCompanies, { })) score += 4;
  if (prefs.carClass && matchesAny(vehicle, CAR_CLASS_WORDS[prefs.carClass] ?? [prefs.carClass]))
    score += 3;
  if (remembers(prefs.remembered?.carSuppliers, supplier)) score += 2;
  return score;
}
