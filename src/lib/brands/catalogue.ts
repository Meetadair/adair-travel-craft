/**
 * Every airline, hotel group and rental company we offer as a preference lives
 * here as DATA, mirrored into the `brands` table so the team can add or re-rank
 * one in /admin without a release. This module is the canonical seed and the
 * fallback the app uses when the table cannot be read.
 *
 * `group` is the alliance (airlines) or owning group (hotels, car rental). It is
 * what makes loyalty work: pick Marriott and Westin counts too; pick LOT and the
 * rest of Star Alliance earns as well.
 */
import { airportByIata } from "@/lib/prefs/airports";

export type BrandKind = "airline" | "hotel_chain" | "car_rental";

/** Coarse selling regions — enough to rank a short list by where the customer flies from. */
export type Region = "eu" | "us" | "ca" | "mea" | "apac" | "latam";

export type Brand = {
  id: string;
  kind: BrandKind;
  name: string;
  /** Alliance (airlines) or owning group (hotels, car rental). */
  group: string | null;
  regions: Region[];
  /** Lower is more popular; drives the short list order. */
  rank: number;
  active: boolean;
  /** Extra words used when matching a supplier name to this brand. */
  aliases?: string[];
};

const EU: Region[] = ["eu"];
const US: Region[] = ["us"];
const NA: Region[] = ["us", "ca"];
const GLOBAL: Region[] = ["eu", "us", "ca", "mea", "apac", "latam"];

let seq = 0;
const air = (
  id: string,
  name: string,
  group: string | null,
  regions: Region[],
  aliases?: string[],
): Brand => ({
  id,
  kind: "airline",
  name,
  group,
  regions,
  rank: ++seq,
  active: true,
  ...(aliases ? { aliases } : {}),
});

let hSeq = 0;
const hotel = (
  id: string,
  name: string,
  group: string | null,
  regions: Region[],
  aliases?: string[],
): Brand => ({
  id,
  kind: "hotel_chain",
  name,
  group,
  regions,
  rank: ++hSeq,
  active: true,
  ...(aliases ? { aliases } : {}),
});

let cSeq = 0;
const car = (
  id: string,
  name: string,
  group: string | null,
  regions: Region[],
  aliases?: string[],
): Brand => ({
  id,
  kind: "car_rental",
  name,
  group,
  regions,
  rank: ++cSeq,
  active: true,
  ...(aliases ? { aliases } : {}),
});

const AIRLINES: Brand[] = [
  // European network carriers
  air("lot", "LOT Polish Airlines", "Star Alliance", EU, ["lot", "polish airlines"]),
  air("lufthansa", "Lufthansa", "Star Alliance", EU),
  air("airfrance", "Air France", "SkyTeam", EU),
  air("klm", "KLM", "SkyTeam", EU),
  air("ba", "British Airways", "oneworld", EU),
  air("swiss", "SWISS", "Star Alliance", EU),
  air("austrian", "Austrian Airlines", "Star Alliance", EU),
  air("brussels", "Brussels Airlines", "Star Alliance", EU),
  air("iberia", "Iberia", "oneworld", EU),
  air("ita", "ITA Airways", "SkyTeam", EU, ["ita airways", "alitalia"]),
  air("sas", "SAS", "SkyTeam", EU, ["sas", "scandinavian"]),
  air("finnair", "Finnair", "oneworld", EU),
  air("aegean", "Aegean Airlines", "Star Alliance", EU),
  air("tap", "TAP Air Portugal", "Star Alliance", EU, ["tap", "air portugal"]),
  air("airbaltic", "airBaltic", null, EU),
  air("eurowings", "Eurowings", null, EU),
  air("virginatlantic", "Virgin Atlantic", "SkyTeam", EU),
  air("aerlingus", "Aer Lingus", null, EU),
  air("croatia", "Croatia Airlines", "Star Alliance", EU),
  air("tarom", "TAROM", "SkyTeam", EU),
  air("lufthansacity", "Lufthansa City Airlines", "Star Alliance", EU),
  // European low-cost
  air("wizz", "Wizz Air", null, EU, ["wizz"]),
  air("ryanair", "Ryanair", null, EU),
  air("easyjet", "easyJet", null, EU),
  air("norwegian", "Norwegian", null, EU),
  air("vueling", "Vueling", null, EU),
  air("transavia", "Transavia", null, EU),
  // US majors and regionals
  air("delta", "Delta Air Lines", "SkyTeam", US),
  air("united", "United Airlines", "Star Alliance", US),
  air("american", "American Airlines", "oneworld", US),
  air("southwest", "Southwest Airlines", null, US),
  air("jetblue", "JetBlue", null, US),
  air("alaska", "Alaska Airlines", "oneworld", US),
  air("spirit", "Spirit Airlines", null, US),
  air("frontier", "Frontier Airlines", null, US),
  air("hawaiian", "Hawaiian Airlines", "oneworld", US),
  air("skywest", "SkyWest", null, US),
  air("republic", "Republic Airways", null, US),
  // Canada
  air("aircanada", "Air Canada", "Star Alliance", ["ca", "us"]),
  air("westjet", "WestJet", null, ["ca", "us"]),
  // Gulf, Turkey, Africa
  air("emirates", "Emirates", null, ["mea", "eu", "apac"]),
  air("qatar", "Qatar Airways", "oneworld", ["mea", "eu", "apac"]),
  air("etihad", "Etihad Airways", null, ["mea", "eu", "apac"]),
  air("turkish", "Turkish Airlines", "Star Alliance", ["mea", "eu"]),
  air("saudia", "Saudia", "SkyTeam", ["mea"]),
  air("royaljordanian", "Royal Jordanian", "oneworld", ["mea"]),
  air("mea", "Middle East Airlines", "SkyTeam", ["mea"]),
  air("royalairmaroc", "Royal Air Maroc", "oneworld", ["mea", "eu"]),
  air("egyptair", "EgyptAir", "Star Alliance", ["mea", "eu"]),
  air("ethiopian", "Ethiopian Airlines", "Star Alliance", ["mea"]),
  air("kenya", "Kenya Airways", "SkyTeam", ["mea"]),
  air("southafrican", "South African Airways", "Star Alliance", ["mea"]),
  // Asia-Pacific
  air("singapore", "Singapore Airlines", "Star Alliance", ["apac"]),
  air("cathay", "Cathay Pacific", "oneworld", ["apac"]),
  air("jal", "Japan Airlines", "oneworld", ["apac"], ["japan airlines", "jal"]),
  air("ana", "ANA", "Star Alliance", ["apac"], ["ana", "all nippon"]),
  air("korean", "Korean Air", "SkyTeam", ["apac"]),
  air("asiana", "Asiana Airlines", "Star Alliance", ["apac"]),
  air("eva", "EVA Air", "Star Alliance", ["apac"]),
  air("thai", "Thai Airways", "Star Alliance", ["apac"]),
  air("malaysia", "Malaysia Airlines", "oneworld", ["apac"]),
  air("qantas", "Qantas", "oneworld", ["apac"]),
  air("airnz", "Air New Zealand", "Star Alliance", ["apac"]),
  air("chinaairlines", "China Airlines", "SkyTeam", ["apac"]),
  air("chinaeastern", "China Eastern", "SkyTeam", ["apac"]),
  air("chinasouthern", "China Southern", null, ["apac"]),
  air("airchina", "Air China", "Star Alliance", ["apac"]),
  air("vietnam", "Vietnam Airlines", "SkyTeam", ["apac"]),
  air("garuda", "Garuda Indonesia", "SkyTeam", ["apac"]),
  air("airindia", "Air India", "Star Alliance", ["apac"]),
  air("srilankan", "SriLankan Airlines", "oneworld", ["apac"]),
  air("shenzhen", "Shenzhen Airlines", "Star Alliance", ["apac"]),
  // Latin America
  air("latam", "LATAM Airlines", null, ["latam"]),
  air("avianca", "Avianca", "Star Alliance", ["latam"]),
  air("copa", "Copa Airlines", "Star Alliance", ["latam"]),
  air("aeromexico", "Aeroméxico", "SkyTeam", ["latam"], ["aeromexico", "aeroméxico"]),
  air("aerolineas", "Aerolíneas Argentinas", "SkyTeam", ["latam"], ["aerolineas", "aerolíneas"]),
  air("gol", "GOL", null, ["latam"]),
  air("azul", "Azul", null, ["latam"]),
];

const HOTELS: Brand[] = [
  hotel("marriott", "Marriott", "Marriott", GLOBAL),
  hotel("ritzcarlton", "Ritz-Carlton", "Marriott", GLOBAL, ["ritz-carlton", "ritz carlton"]),
  hotel("stregis", "St. Regis", "Marriott", GLOBAL, ["st. regis", "st regis"]),
  hotel("whotels", "W Hotels", "Marriott", GLOBAL, ["w hotel"]),
  hotel("westin", "Westin", "Marriott", GLOBAL),
  hotel("sheraton", "Sheraton", "Marriott", GLOBAL),
  hotel("autograph", "Autograph Collection", "Marriott", GLOBAL, ["autograph"]),
  hotel("lemeridien", "Le Méridien", "Marriott", GLOBAL, ["le meridien", "le méridien"]),
  hotel("hilton", "Hilton", "Hilton", GLOBAL),
  hotel("waldorf", "Waldorf Astoria", "Hilton", GLOBAL, ["waldorf"]),
  hotel("conrad", "Conrad", "Hilton", GLOBAL),
  hotel("doubletree", "DoubleTree", "Hilton", GLOBAL),
  hotel("canopy", "Canopy", "Hilton", GLOBAL),
  hotel("hyatt", "Hyatt", "Hyatt", GLOBAL),
  hotel("parkhyatt", "Park Hyatt", "Hyatt", GLOBAL),
  hotel("andaz", "Andaz", "Hyatt", GLOBAL),
  hotel("grandhyatt", "Grand Hyatt", "Hyatt", GLOBAL),
  hotel("ihg", "IHG", "IHG", GLOBAL),
  hotel("intercontinental", "InterContinental", "IHG", GLOBAL),
  hotel("kimpton", "Kimpton", "IHG", GLOBAL),
  hotel("sixsenses", "Six Senses", "IHG", GLOBAL),
  hotel("hotelindigo", "Hotel Indigo", "IHG", GLOBAL, ["hotel indigo"]),
  hotel("crowneplaza", "Crowne Plaza", "IHG", GLOBAL),
  hotel("accor", "Accor", "Accor", ["eu", "mea", "apac", "latam"]),
  hotel("sofitel", "Sofitel", "Accor", ["eu", "mea", "apac"]),
  hotel("raffles", "Raffles", "Accor", ["eu", "mea", "apac"]),
  hotel("fairmont", "Fairmont", "Accor", GLOBAL),
  hotel("pullman", "Pullman", "Accor", ["eu", "mea", "apac"]),
  hotel("novotel", "Novotel", "Accor", ["eu", "mea", "apac"]),
  hotel("mercure", "Mercure", "Accor", ["eu", "mea", "apac"]),
  hotel("ibis", "ibis", "Accor", ["eu", "mea", "apac"]),
  hotel("radisson", "Radisson", "Radisson", GLOBAL, ["radisson", "park inn", "park plaza"]),
  hotel("fourseasons", "Four Seasons", "Four Seasons", GLOBAL),
  hotel("mandarin", "Mandarin Oriental", "Mandarin Oriental", GLOBAL),
  hotel("rosewood", "Rosewood", "Rosewood", GLOBAL),
  hotel("aman", "Aman", "Aman", GLOBAL),
  hotel("kempinski", "Kempinski", "Kempinski", ["eu", "mea", "apac"]),
  hotel("melia", "Meliá", "Meliá", ["eu", "latam"], ["melia", "meliá", "gran melia"]),
  hotel("nh", "NH Hotels", "Minor", ["eu", "latam"], ["nh hotel", "nh collection"]),
  hotel("scandic", "Scandic", "Scandic", EU),
  hotel("motelone", "Motel One", "Motel One", EU),
  hotel("wyndham", "Wyndham", "Wyndham", GLOBAL, ["wyndham", "ramada", "days inn"]),
  hotel("choice", "Choice Hotels", "Choice", NA, ["choice", "comfort inn", "quality inn"]),
  hotel("bestwestern", "Best Western", "Best Western", GLOBAL),
  hotel("slh", "Small Luxury Hotels", "SLH", GLOBAL, ["small luxury"]),
  hotel("designhotels", "Design Hotels", "Marriott", GLOBAL, ["design hotel"]),
  hotel("relaischateaux", "Relais & Châteaux", "Relais & Châteaux", GLOBAL, ["relais"]),
  hotel("lhw", "Leading Hotels of the World", "LHW", GLOBAL, ["leading hotels"]),
];

const CARS: Brand[] = [
  car("sixt", "Sixt", "Sixt", ["eu", "us"]),
  car("hertz", "Hertz", "Hertz", GLOBAL),
  car("avis", "Avis", "Avis Budget", GLOBAL),
  car("europcar", "Europcar", "Europcar", ["eu", "mea"]),
  car("enterprise", "Enterprise", "Enterprise", GLOBAL),
  car("budget", "Budget", "Avis Budget", GLOBAL),
  car("national", "National", "Enterprise", NA),
  car("alamo", "Alamo", "Enterprise", GLOBAL),
  car("dollar", "Dollar", "Hertz", NA),
  car("thrifty", "Thrifty", "Hertz", GLOBAL),
  car("turo", "Turo", "Turo", NA),
  car("panek", "Panek", "Panek", EU),
  car("express", "Express", "Express", EU),
  car("goldcar", "Goldcar", "Europcar", EU),
];

export const BRAND_SEED: Brand[] = [...AIRLINES, ...HOTELS, ...CARS];

const BY_ID = new Map(BRAND_SEED.map((b) => [b.id, b]));

export function seedBrand(id: string): Brand | undefined {
  return BY_ID.get(id);
}

/** Human label for a stored preference value, e.g. "ritzcarlton" → "Ritz-Carlton". */
export function brandName(id: string): string | undefined {
  return BY_ID.get(id)?.name;
}

/** Words used to spot this brand inside a supplier or hotel name. */
export function brandWords(id: string, brands: Brand[] = BRAND_SEED): string[] {
  const brand = brands.find((b) => b.id === id) ?? BY_ID.get(id);
  if (!brand) return [id];
  return [brand.name.toLowerCase(), ...(brand.aliases ?? [])];
}

/* ------------------------------ regions ------------------------------ */

const COUNTRY_REGION: Record<string, Region> = {
  "United States": "us",
  Canada: "ca",
  Mexico: "latam",
  Brazil: "latam",
  Argentina: "latam",
  Chile: "latam",
  Colombia: "latam",
  Peru: "latam",
  "United Arab Emirates": "mea",
  Qatar: "mea",
  "Saudi Arabia": "mea",
  Turkey: "mea",
  Israel: "mea",
  Egypt: "mea",
  Morocco: "mea",
  "South Africa": "mea",
  Japan: "apac",
  China: "apac",
  "Hong Kong": "apac",
  Singapore: "apac",
  "South Korea": "apac",
  Thailand: "apac",
  India: "apac",
  Australia: "apac",
  "New Zealand": "apac",
  Indonesia: "apac",
  Vietnam: "apac",
  Malaysia: "apac",
};

export function regionForCountry(country: string | null | undefined): Region {
  if (!country) return "eu";
  return COUNTRY_REGION[country] ?? "eu";
}

/** Which region a customer's home airport sits in — Warsaw → eu, New York → us. */
export function regionForAirport(iata: string | null | undefined): Region {
  if (!iata) return "eu";
  const airport = airportByIata(iata);
  if (!airport) return "eu";
  return regionForCountry(airport.country);
}
