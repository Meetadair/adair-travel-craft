/**
 * Which suppliers a programme actually earns on — not just the airline or chain
 * that owns it. Miles & More earns on LOT, Austrian, Swiss and across Star
 * Alliance; Avios on BA, Iberia, Aer Lingus and oneworld. The live mapping is
 * the `loyalty_earning_rules` table so it can be corrected without a release;
 * these defaults are only the fallback when the table can't be read.
 */
export type EarningRule = { category: string; programmeCode: string; matcher: string };

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
    "marriott", "sheraton", "westin", "ritz-carlton", "st. regis", "w hotel",
    "courtyard", "moxy", "le meridien", "autograph", "renaissance", "aloft", "ac hotel",
  ]),
  ...ruleSet("hotel", "hilton_honors", [
    "hilton", "doubletree", "hampton", "conrad", "canopy", "waldorf", "curio", "embassy suites",
  ]),
  ...ruleSet("hotel", "world_of_hyatt", ["hyatt", "andaz", "park hyatt", "thompson", "alila"]),
  ...ruleSet("hotel", "ihg_one", [
    "intercontinental", "holiday inn", "crowne plaza", "kimpton", "hotel indigo", "staybridge", "voco",
  ]),
  ...ruleSet("hotel", "accor_all", [
    "accor", "sofitel", "novotel", "mercure", "ibis", "pullman", "mgallery", "raffles",
    "fairmont", "swissotel",
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
