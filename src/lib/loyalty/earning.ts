/**
 * Which suppliers a programme actually earns on — not just the airline or chain
 * that owns it. Miles & More earns on LOT, Austrian, Swiss and across Star
 * Alliance; Avios on BA, Iberia, Aer Lingus and oneworld. The live mapping is
 * the `loyalty_earning_rules` table so it can be corrected without a release;
 * these defaults are only the fallback when the table can't be read.
 */
import type { Brand } from "@/lib/brands/catalogue";
import { brandsInSameGroup, earnsOnBrandGroup } from "@/lib/brands/ranking";

export type EarningRule = { category: string; programmeCode: string; matcher: string };

/**
 * Which brand in the `brands` table each programme belongs to. The brand's
 * alliance or owning group then tells us the rest: Bonvoy earns at Westin and
 * the Ritz-Carlton, LOT's Star Alliance card earns on Lufthansa and United.
 */
export const PROGRAMME_BRAND: Record<string, string> = {
  miles_more: "lufthansa",
  lot_miles: "lot",
  flying_blue: "airfrance",
  executive_club: "ba",
  aadvantage: "american",
  skymiles: "delta",
  mileageplus: "united",
  turkish_miles: "turkish",
  emirates_skywards: "emirates",
  qatar_privilege: "qatar",
  iberia_plus: "iberia",
  eurobonus: "sas",
  marriott_bonvoy: "marriott",
  hilton_honors: "hilton",
  world_of_hyatt: "hyatt",
  ihg_one: "ihg",
  accor_all: "accor",
  radisson_rewards: "radisson",
  wyndham_rewards: "wyndham",
  leaders_club: "lhw",
  hertz_gold: "hertz",
  avis_preferred: "avis",
  budget_fastbreak: "budget",
  sixt_card: "sixt",
  europcar_privilege: "europcar",
  enterprise_plus: "enterprise",
  national_emerald: "national",
};

export const DEFAULT_EARNING_RULES: EarningRule[] = [
  ...ruleSet("airline", "miles_more", ["LH", "LO", "OS", "LX", "SN", "UA", "TK", "SK", "A3"]),
  ...ruleSet("airline", "lot_miles", ["LO", "LH", "OS", "LX", "SN"]),
  ...ruleSet("airline", "flying_blue", ["AF", "KL", "DL", "AZ", "KE", "MU"]),
  ...ruleSet("airline", "executive_club", ["BA", "IB", "EI", "AY", "QR", "AA", "CX"]),
  ...ruleSet("airline", "iberia_plus", ["IB", "BA", "EI", "AY", "AA"]),
  ...ruleSet("airline", "aadvantage", ["AA", "BA", "IB", "AY", "QR", "JL"]),
  ...ruleSet("airline", "skymiles", ["DL", "AF", "KL", "AZ", "KE"]),
  ...ruleSet("airline", "mileageplus", ["UA", "LH", "LO", "OS", "LX", "SN", "TK", "SK"]),
  ...ruleSet("airline", "turkish_miles", ["TK", "LH", "LO", "UA", "LX", "OS"]),
  ...ruleSet("airline", "eurobonus", ["SK", "LH", "LO", "UA", "TK"]),
  ...ruleSet("airline", "emirates_skywards", ["EK", "FZ"]),
  ...ruleSet("airline", "qatar_privilege", ["QR", "BA", "IB", "AA", "AY"]),
  ...ruleSet("hotel", "marriott_bonvoy", [
    "marriott",
    "sheraton",
    "westin",
    "ritz-carlton",
    "st. regis",
    "w hotel",
    "courtyard",
    "moxy",
    "le meridien",
    "autograph",
    "renaissance",
    "aloft",
    "ac hotel",
  ]),
  ...ruleSet("hotel", "hilton_honors", [
    "hilton",
    "doubletree",
    "hampton",
    "conrad",
    "canopy",
    "waldorf",
    "curio",
    "embassy suites",
  ]),
  ...ruleSet("hotel", "world_of_hyatt", ["hyatt", "andaz", "park hyatt", "thompson", "alila"]),
  ...ruleSet("hotel", "ihg_one", [
    "intercontinental",
    "holiday inn",
    "crowne plaza",
    "kimpton",
    "hotel indigo",
    "staybridge",
    "voco",
  ]),
  ...ruleSet("hotel", "accor_all", [
    "accor",
    "sofitel",
    "novotel",
    "mercure",
    "ibis",
    "pullman",
    "mgallery",
    "raffles",
    "fairmont",
    "swissotel",
  ]),
  ...ruleSet("hotel", "radisson_rewards", ["radisson", "park inn", "park plaza"]),
  ...ruleSet("hotel", "wyndham_rewards", ["wyndham", "ramada", "days inn", "tryp"]),
  ...ruleSet("car", "hertz_gold", ["hertz", "dollar", "thrifty"]),
  ...ruleSet("car", "avis_preferred", ["avis", "budget"]),
  ...ruleSet("car", "budget_fastbreak", ["budget", "avis"]),
  ...ruleSet("car", "sixt_card", ["sixt"]),
  ...ruleSet("car", "europcar_privilege", ["europcar", "goldcar"]),
  ...ruleSet("car", "enterprise_plus", ["enterprise", "national", "alamo"]),
  ...ruleSet("car", "national_emerald", ["national", "enterprise", "alamo"]),
];

function ruleSet(category: string, programmeCode: string, matchers: string[]): EarningRule[] {
  return matchers.map((matcher) => ({ category, programmeCode, matcher }));
}

/** Airline: exact two-letter carrier code. Hotel/car: brand name contained in the supplier name. */
export function earnsOn(
  rules: EarningRule[],
  category: string,
  programmeCode: string,
  supplier: string | null | undefined,
): boolean {
  if (!supplier) return false;
  const mine = rules.filter((r) => r.category === category && r.programmeCode === programmeCode);
  if (!mine.length) return false;
  if (category === "airline") {
    const code = supplier.trim().toUpperCase();
    return mine.some((r) => r.matcher.toUpperCase() === code);
  }
  const name = supplier.toLowerCase();
  return mine.some((r) => name.includes(r.matcher.toLowerCase()));
}

/**
 * Earning check that also counts the programme's whole alliance or hotel group,
 * read from the brand table. Airlines are matched on the two-letter code, so the
 * group widening only applies to hotels and car rental supplier names.
 */
/** Carrier code per airline brand, so an alliance card can widen across it. */
export const BRAND_IATA: Record<string, string> = {
  lot: "LO",
  lufthansa: "LH",
  swiss: "LX",
  austrian: "OS",
  brussels: "SN",
  united: "UA",
  turkish: "TK",
  sas: "SK",
  aegean: "A3",
  tap: "TP",
  aircanada: "AC",
  singapore: "SQ",
  thai: "TG",
  ana: "NH",
  asiana: "OZ",
  eva: "BR",
  ethiopian: "ET",
  egyptair: "MS",
  airchina: "CA",
  airindia: "AI",
  croatia: "OU",
  avianca: "AV",
  copa: "CM",
  airnz: "NZ",
  southafrican: "SA",
  shenzhen: "ZH",
  ba: "BA",
  iberia: "IB",
  finnair: "AY",
  qatar: "QR",
  american: "AA",
  cathay: "CX",
  jal: "JL",
  qantas: "QF",
  malaysia: "MH",
  alaska: "AS",
  royaljordanian: "RJ",
  srilankan: "UL",
  royalairmaroc: "AT",
  aerlingus: "EI",
  hawaiian: "HA",
  delta: "DL",
  airfrance: "AF",
  klm: "KL",
  ita: "AZ",
  korean: "KE",
  chinaeastern: "MU",
  chinaairlines: "CI",
  vietnam: "VN",
  garuda: "GA",
  aeromexico: "AM",
  aerolineas: "AR",
  kenya: "KQ",
  mea: "ME",
  saudia: "SV",
  tarom: "RO",
  virginatlantic: "VS",
  wizz: "W6",
  ryanair: "FR",
  easyjet: "U2",
  norwegian: "DY",
  vueling: "VY",
  airbaltic: "BT",
  eurowings: "EW",
  transavia: "HV",
  emirates: "EK",
  etihad: "EY",
  southwest: "WN",
  jetblue: "B6",
  spirit: "NK",
  frontier: "F9",
  westjet: "WS",
  latam: "LA",
  gol: "G3",
  azul: "AD",
  chinasouthern: "CZ",
};

export function earnsOnWithGroup(
  rules: EarningRule[],
  brands: Brand[],
  category: string,
  programmeCode: string,
  supplier: string | null | undefined,
): boolean {
  if (earnsOn(rules, category, programmeCode, supplier)) return true;
  const brandId = PROGRAMME_BRAND[programmeCode];
  if (!brandId) return false;
  if (category === "airline") {
    const code = (supplier ?? "").trim().toUpperCase();
    if (!code) return false;
    return brandsInSameGroup(brands, brandId).some((b) => BRAND_IATA[b.id] === code);
  }
  return earnsOnBrandGroup(brands, brandId, supplier);
}
