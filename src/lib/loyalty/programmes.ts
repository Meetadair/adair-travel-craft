/**
 * Common loyalty programmes per category. The list is a convenience only —
 * every category also accepts a free-text programme name.
 */
export const LOYALTY_CATEGORIES = ["airline", "hotel", "car"] as const;
export type LoyaltyCategory = (typeof LOYALTY_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<LoyaltyCategory, string> = {
  airline: "Airlines",
  hotel: "Hotels",
  car: "Car rental",
};

export type ProgrammeOption = {
  code: string;
  label: string;
  /** Airline programmes carry the operating carrier code the supplier expects. */
  iata?: string;
};

export const PROGRAMMES: Record<LoyaltyCategory, ProgrammeOption[]> = {
  airline: [
    { code: "miles_more", label: "Miles & More (Lufthansa group)", iata: "LH" },
    { code: "lot_miles", label: "LOT Miles & More", iata: "LO" },
    { code: "flying_blue", label: "Flying Blue (Air France / KLM)", iata: "AF" },
    { code: "executive_club", label: "British Airways Executive Club", iata: "BA" },
    { code: "aadvantage", label: "American AAdvantage", iata: "AA" },
    { code: "skymiles", label: "Delta SkyMiles", iata: "DL" },
    { code: "mileageplus", label: "United MileagePlus", iata: "UA" },
    { code: "turkish_miles", label: "Turkish Miles&Smiles", iata: "TK" },
    { code: "emirates_skywards", label: "Emirates Skywards", iata: "EK" },
    { code: "qatar_privilege", label: "Qatar Privilege Club", iata: "QR" },
    { code: "iberia_plus", label: "Iberia Plus", iata: "IB" },
    { code: "eurobonus", label: "SAS EuroBonus", iata: "SK" },
  ],
  hotel: [
    { code: "marriott_bonvoy", label: "Marriott Bonvoy" },
    { code: "hilton_honors", label: "Hilton Honors" },
    { code: "world_of_hyatt", label: "World of Hyatt" },
    { code: "ihg_one", label: "IHG One Rewards" },
    { code: "accor_all", label: "Accor ALL" },
    { code: "radisson_rewards", label: "Radisson Rewards" },
    { code: "wyndham_rewards", label: "Wyndham Rewards" },
    { code: "gha_discovery", label: "GHA Discovery" },
    { code: "leaders_club", label: "Leading Hotels — Leaders Club" },
  ],
  car: [
    { code: "hertz_gold", label: "Hertz Gold Plus Rewards" },
    { code: "avis_preferred", label: "Avis Preferred" },
    { code: "sixt_card", label: "Sixt Card" },
    { code: "europcar_privilege", label: "Europcar Privilege" },
    { code: "enterprise_plus", label: "Enterprise Plus" },
    { code: "budget_fastbreak", label: "Budget Fastbreak" },
    { code: "national_emerald", label: "National Emerald Club" },
  ],
};

export const COMMON_TIERS = ["Silver", "Gold", "Platinum", "Diamond", "Senator", "Elite"];

export function programmeByCode(
  category: LoyaltyCategory,
  code: string,
): ProgrammeOption | undefined {
  return PROGRAMMES[category].find((p) => p.code === code);
}

/** "1234567890" → "•••• 7890" */
export function maskNumber(last4: string): string {
  return `•••• ${last4}`;
}
