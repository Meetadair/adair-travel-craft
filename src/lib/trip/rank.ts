/**
 * Turns saved traveller preferences into ranking scores. Duffel cannot filter
 * on most of these, so we use them to sort results rather than drop them.
 */
import type { TravelPrefs } from "@/lib/prefs/questions";

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
>;

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

function anySelected(text: string, selected: string[], table: Record<string, string[]>): boolean {
  return selected.some((key) => matchesAny(text, table[key] ?? [key]));
}

/** Preferred carriers rank as if they were 12% cheaper. */
export function flightScore(carrierText: string, amount: number, prefs?: SearchPrefs): number {
  if (!prefs?.airlines.length) return amount;
  return anySelected(carrierText, prefs.airlines, AIRLINE_WORDS) ? amount * 0.88 : amount;
}

/** Higher is better. Chain and star matches outweigh a small price difference. */
export function stayScore(
  name: string,
  rating: number | null,
  amount: number,
  prefs?: SearchPrefs,
): number {
  let score = (rating ?? 0) * 2 - amount / 500;
  if (!prefs) return score;
  if (prefs.hotelChains.length && anySelected(name, prefs.hotelChains, CHAIN_WORDS)) score += 6;
  if (prefs.hotelStars.length && rating != null && prefs.hotelStars.includes(String(Math.round(rating))))
    score += 3;
  if (rating != null && rating >= prefs.hotelMinRating) score += 2;
  if (prefs.hotelAmenities.length && anySelected(name, prefs.hotelAmenities, AMENITY_WORDS))
    score += 1;
  if (prefs.hotelTypes.length && anySelected(name, prefs.hotelTypes, AMENITY_WORDS)) score += 1;
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
  let score = -amount / 100;
  const wantedTransmission = prefs?.carTransmission ?? "automatic";
  if (wantedTransmission !== "any" && new RegExp(wantedTransmission, "i").test(transmission))
    score += 4;
  if (!prefs) return score;
  if (prefs.carBrands.length && anySelected(vehicle, prefs.carBrands, CAR_BRAND_WORDS)) score += 5;
  if (prefs.carCompanies.length && anySelected(supplier, prefs.carCompanies, { })) score += 4;
  if (prefs.carClass && matchesAny(vehicle, CAR_CLASS_WORDS[prefs.carClass] ?? [prefs.carClass]))
    score += 3;
  return score;
}
