/**
 * The onboarding question set as DATA. Add or remove a question here and both
 * the wizard (/onboarding) and the Preferences page pick it up — no component
 * changes needed.
 */

export type Option = { value: string; label: string };

/** Every answer is kept as a list of strings, or a boolean for toggles. */
export type Answers = Record<string, string[]>;
export type Toggles = Record<string, boolean>;

export type FieldDef = {
  field: string;
  label?: string;
  options: Option[];
  /** Value that clears every other choice, e.g. "No preference". */
  noneValue?: string;
};

export type TextDef = {
  field: string;
  label: string;
  placeholder?: string;
};

export type QuestionDef = {
  id: string;
  /**
   * 1 = essentials and dealbreakers: enough to plan a trip, asked up front.
   * 2 = taste: makes matches better, offered after the first part and always
   * available later in Preferences.
   */
  part: 1 | 2;
  title: string;
  hint?: string;
  kind: "airport" | "fields" | "companies";
  skippable: boolean;
  singles?: FieldDef[];
  multis?: FieldDef[];
  toggles?: { field: string; label: string }[];
  texts?: TextDef[];
};

const opts = (...pairs: Array<[string, string]>): Option[] =>
  pairs.map(([value, label]) => ({ value, label }));

const NONE: [string, string] = ["none", "No preference"];

export const QUESTIONS: QuestionDef[] = [
  {
    id: "airport",
    part: 1,
    kind: "airport",
    skippable: false,
    title: "Which airport do you fly from?",
    hint: "This becomes the departure point for every trip you ask for.",
  },
  {
    id: "purpose",
    part: 1,
    kind: "fields",
    skippable: true,
    title: "What do you travel for?",
    multis: [{ field: "tripPurpose", options: opts(["business", "Business"], ["leisure", "Leisure"], ["both", "Both"]) }],
  },
  {
    id: "airlines",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "Any airlines you prefer?",
    hint: "We put these first when the price is close.",
    multis: [
      {
        field: "airlines",
        noneValue: "none",
        options: opts(
          ["lot", "LOT"],
          ["lufthansa", "Lufthansa"],
          ["airfrance", "Air France"],
          ["klm", "KLM"],
          ["ba", "British Airways"],
          ["wizz", "Wizz Air"],
          ["ryanair", "Ryanair"],
          ["turkish", "Turkish Airlines"],
          ["emirates", "Emirates"],
          ["qatar", "Qatar Airways"],
          ["swiss", "SWISS"],
          ["austrian", "Austrian"],
          ["iberia", "Iberia"],
          ["ita", "ITA Airways"],
          ["sas", "SAS"],
          ["finnair", "Finnair"],
          ["aegean", "Aegean"],
          ["easyjet", "easyJet"],
          ["delta", "Delta"],
          ["united", "United"],
          ["american", "American Airlines"],
          NONE,
        ),
      },
    ],
  },
  {
    id: "cabin",
    part: 1,
    kind: "fields",
    skippable: true,
    title: "Which cabin should we book?",
    singles: [
      {
        field: "cabinChoice",
        options: opts(
          ["economy", "Economy"],
          ["premium_economy", "Premium economy"],
          ["business", "Business"],
          ["first", "First"],
          ["business_over_2h", "Business for flights over 2h"],
        ),
      },
    ],
  },
  {
    id: "seat",
    part: 1,
    kind: "fields",
    skippable: true,
    title: "Where do you like to sit?",
    singles: [
      { field: "seat", options: opts(["window", "Window"], ["aisle", "Aisle"], ["any", "No preference"]) },
    ],
    toggles: [
      { field: "seatFront", label: "Front of cabin" },
      { field: "seatLegroom", label: "Extra legroom" },
    ],
  },
  {
    id: "hotelType",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "What kind of place do you stay in?",
    multis: [
      {
        field: "hotelTypes",
        options: opts(
          ["hotel", "Hotel"],
          ["apartment", "Apartment"],
          ["boutique", "Boutique"],
          ["design", "Design"],
          ["resort", "Resort"],
          ["villa", "Villa"],
        ),
      },
    ],
  },
  {
    id: "hotelChains",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "Any hotel groups you like?",
    multis: [
      {
        field: "hotelChains",
        noneValue: "none",
        options: opts(
          ["hyatt", "Hyatt"],
          ["marriott", "Marriott"],
          ["hilton", "Hilton"],
          ["ihg", "IHG"],
          ["accor", "Accor"],
          ["radisson", "Radisson"],
          ["slh", "Small Luxury Hotels"],
          ["designhotels", "Design Hotels"],
          ["fourseasons", "Four Seasons"],
          ["mandarin", "Mandarin Oriental"],
          ["rosewood", "Rosewood"],
          ["kempinski", "Kempinski"],
          ["melia", "Meliá"],
          ["nh", "NH"],
          ["scandic", "Scandic"],
          NONE,
        ),
      },
    ],
  },
  {
    id: "hotelStars",
    part: 1,
    kind: "fields",
    skippable: true,
    title: "Hotels outside these star ratings won't be shown",
    multis: [
      { field: "hotelStars", options: opts(["2", "2 stars"], ["3", "3 stars"], ["4", "4 stars"], ["5", "5 stars"]) },
    ],
  },
  {
    id: "hotelRating",
    part: 1,
    kind: "fields",
    skippable: true,
    title: "Hotels below this rating won't be shown",
    singles: [
      {
        field: "hotelRatingLevel",
        options: opts(
          ["exceptional", "Exceptional"],
          ["very_good", "Very good"],
          ["good", "Good"],
          ["pleasant", "Pleasant"],
        ),
      },
    ],
  },
  {
    id: "hotelAmenities",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "What matters inside the hotel?",
    multis: [
      {
        field: "hotelAmenities",
        options: opts(
          ["pool", "Pool"],
          ["spa", "Spa"],
          ["sauna", "Sauna"],
          ["gym", "Gym"],
          ["bathtub", "Bathtub"],
          ["beachfront", "Beachfront"],
          ["view", "Great view"],
          ["balcony", "Balcony"],
          ["breakfast", "Breakfast included"],
          ["allinclusive", "All-inclusive"],
          ["large", "Large hotel"],
          ["boutique", "Boutique"],
          ["pets", "Pet friendly"],
          ["adults", "Adults only"],
          ["doublebed", "Double bed"],
          ["adair", "Adair recommendation"],
        ),
      },
    ],
  },
  {
    id: "hotelDistance",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "Only show hotels within…",
    singles: [
      {
        field: "hotelMaxKm",
        options: opts(["1", "Within 1 km"], ["2", "Within 2 km"], ["3", "Within 3 km"], ["5", "Within 5 km"], ["10", "Within 10 km"]),
      },
    ],
  },
  {
    id: "carBrands",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "Which car makes do you like?",
    multis: [
      {
        field: "carBrands",
        noneValue: "none",
        options: opts(
          ["bmw", "BMW"],
          ["mercedes", "Mercedes"],
          ["audi", "Audi"],
          ["vw", "Volkswagen"],
          ["volvo", "Volvo"],
          ["tesla", "Tesla"],
          ["toyota", "Toyota"],
          ["skoda", "Škoda"],
          ["renault", "Renault"],
          ["peugeot", "Peugeot"],
          NONE,
        ),
      },
    ],
  },
  {
    id: "carSetup",
    part: 1,
    kind: "fields",
    skippable: true,
    title: "What sort of car, and how set up?",
    singles: [
      {
        field: "carClass",
        label: "Class",
        options: opts(
          ["economy", "Economy"],
          ["compact", "Compact"],
          ["midsize", "Midsize"],
          ["suv", "SUV"],
          ["premium", "Premium"],
          ["luxury", "Luxury"],
        ),
      },
      {
        field: "carTransmission",
        label: "Transmission",
        options: opts(["automatic", "Automatic"], ["manual", "Manual"], ["any", "No preference"]),
      },
    ],
    toggles: [
      { field: "carNavigation", label: "Navigation" },
      { field: "carChildSeat", label: "Child seat" },
    ],
  },
  {
    id: "carCompanies",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "Preferred rental companies?",
    multis: [
      {
        field: "carCompanies",
        noneValue: "none",
        options: opts(
          ["sixt", "Sixt"],
          ["hertz", "Hertz"],
          ["avis", "Avis"],
          ["europcar", "Europcar"],
          ["enterprise", "Enterprise"],
          ["budget", "Budget"],
          ["alamo", "Alamo"],
          NONE,
        ),
      },
    ],
  },
  {
    id: "food",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "How do you like to eat?",
    multis: [
      {
        field: "cuisines",
        label: "Cuisines",
        options: opts(
          ["italian", "Italian"],
          ["japanese", "Japanese / Sushi"],
          ["french", "French"],
          ["polish", "Polish"],
          ["hungarian", "Hungarian"],
          ["spanish", "Spanish"],
          ["greek", "Greek"],
          ["thai", "Thai"],
          ["indian", "Indian"],
          ["vegetarian", "Vegetarian"],
          ["vegan", "Vegan"],
          ["steakhouse", "Steakhouse"],
          ["finedining", "Fine dining"],
          ["local", "Local / traditional"],
        ),
      },
      {
        field: "diets",
        label: "Dietary needs",
        noneValue: "none",
        options: opts(
          ["glutenfree", "Gluten-free"],
          ["halal", "Halal"],
          ["kosher", "Kosher"],
          ["lactosefree", "Lactose-free"],
          ["none", "None"],
        ),
      },
    ],
  },
  {
    id: "interests",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "What do you enjoy on a trip?",
    multis: [
      {
        field: "interests",
        options: opts(
          ["music", "Live music & concerts"],
          ["museums", "Museums & galleries"],
          ["architecture", "Architecture"],
          ["nightlife", "Nightlife"],
          ["wine", "Wine & gastronomy"],
          ["nature", "Nature & hiking"],
          ["beach", "Beach"],
          ["ski", "Skiing"],
          ["golf", "Golf"],
          ["wellness", "Wellness"],
          ["shopping", "Shopping"],
          ["sports", "Sports events"],
          ["family", "Family activities"],
        ),
      },
    ],
  },
  {
    id: "music",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "Which music would you go out for?",
    hint: "Only used to spot concerts on your dates.",
    multis: [
      {
        field: "music",
        options: opts(
          ["jazz", "Jazz"],
          ["classical", "Classical"],
          ["rock", "Rock"],
          ["electronic", "Electronic"],
          ["pop", "Pop"],
          ["hiphop", "Hip-hop"],
          ["opera", "Opera"],
          ["world", "World"],
        ),
      },
    ],
  },
  {
    id: "budget",
    part: 1,
    kind: "fields",
    skippable: true,
    title: "Typical budget per trip?",
    singles: [
      {
        field: "budgetBand",
        options: opts(
          ["u500", "Under €500"],
          ["500_1500", "€500 – 1,500"],
          ["1500_3000", "€1,500 – 3,000"],
          ["3000plus", "€3,000+"],
          ["nolimit", "No limit"],
        ),
      },
    ],
  },
  {
    id: "dealbreakers",
    part: 1,
    kind: "fields",
    skippable: true,
    title: "A few things we should never book for you",
    hint: "Hard rules, not preferences. We filter these out before comparing options — and where a supplier does not publish the detail, we tell you rather than guess.",
    toggles: [
      { field: "dbStars4", label: "Never below 4 stars" },
      { field: "dbLift", label: "Never without a lift" },
      { field: "dbAutomatic", label: "Automatic transmission only" },
      { field: "dbStepFree", label: "Step-free access required" },
      { field: "dbPets", label: "Must allow pets" },
    ],
  },
  {
    id: "style",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "How do you like to travel?",
    singles: [
      {
        field: "travelStyle",
        options: opts(
          ["efficiency", "Efficiency — shortest door to door"],
          ["comfort", "Comfort — space and calm"],
          ["value", "Value — best price that still works"],
          ["experience", "Experience first — the place matters most"],
        ),
      },
    ],
  },
  {
    id: "rhythm",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "Your usual rhythm",
    singles: [
      {
        field: "tripLength",
        label: "Typical trip length",
        options: opts(
          ["1", "A day"],
          ["2_3", "2 – 3 nights"],
          ["4_7", "4 – 7 nights"],
          ["8plus", "Longer than a week"],
        ),
      },
      {
        field: "leadTime",
        label: "How far ahead you usually book",
        options: opts(
          ["last_minute", "Last minute"],
          ["1_2w", "1 – 2 weeks"],
          ["1m", "About a month"],
          ["3m_plus", "Three months or more"],
        ),
      },
    ],
    multis: [
      {
        field: "companions",
        label: "Who you usually travel with",
        options: opts(
          ["alone", "Alone"],
          ["partner", "Partner"],
          ["family", "Family with children"],
          ["colleagues", "Colleagues"],
          ["friends", "Friends"],
        ),
      },
    ],
  },
  {
    id: "loyalty",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "Do you hold any loyalty programmes?",
    hint: "Numbers live in Settings → Saved details, where they stay encrypted. Add them there any time and we pass them to the airline, hotel and rental desk.",
    singles: [
      {
        field: "loyalty",
        label: "Airline, hotel or car rental membership",
        options: opts(
          ["yes", "Yes — I'll add the numbers in Settings"],
          ["no", "No"],
        ),
      },
    ],
  },
  {
    id: "tradeoffs",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "Three quick trade-offs",
    hint: "These predict your real choices better than anything else we ask.",
    singles: [
      {
        field: "tradeConnection",
        label: "Pay about €50 more to avoid a connection?",
        options: opts(["yes", "Yes"], ["no", "No"], ["depends", "Depends on the trip"]),
      },
      {
        field: "tradeCloser",
        label: "Pay about €50 more for a hotel 10 minutes closer?",
        options: opts(["yes", "Yes"], ["no", "No"], ["depends", "Depends on the trip"]),
      },
      {
        field: "tradeMorning",
        label: "Pay about €50 more for a direct morning departure?",
        options: opts(["yes", "Yes"], ["no", "No"], ["depends", "Depends on the trip"]),
      },
    ],
  },
  {
    id: "notes",
    part: 2,
    kind: "fields",
    skippable: true,
    title: "Anything else we should know?",
    hint: "Written in your words. We read these before every booking.",
    texts: [
      {
        field: "accessibilityNote",
        label: "Accessibility needs",
        placeholder: "e.g. step-free route, assistance at the gate",
      },
      {
        field: "avoidNote",
        label: "Always avoid",
        placeholder: "e.g. no red-eye flights, no rooms above the 10th floor",
      },
    ],
  },
  {
    id: "companies",
    part: 2,
    kind: "companies",
    skippable: true,
    title: "Who should invoices be made out to?",
    hint: "Add as many companies as you need. Invoices can go to several email addresses.",
  },
];

/* ----------------------------- companies ----------------------------- */

export const COUNTRIES: Option[] = [
  { value: "PL", label: "Poland" },
  { value: "HU", label: "Hungary" },
  { value: "DE", label: "Germany" },
  { value: "AT", label: "Austria" },
  { value: "CH", label: "Switzerland" },
  { value: "GB", label: "United Kingdom" },
  { value: "FR", label: "France" },
  { value: "IT", label: "Italy" },
  { value: "NL", label: "Netherlands" },
  { value: "ES", label: "Spain" },
  { value: "OTHER", label: "Other" },
];

/** Legal forms offered per country, plus "Other" free text everywhere. */
export const LEGAL_FORMS: Record<string, string[]> = {
  PL: ["sp. z o.o.", "S.A.", "S.K.A.", "sp. k.", "j.d.g."],
  HU: ["Kft.", "Zrt.", "Nyrt.", "Bt."],
  DE: ["GmbH", "AG", "UG", "GmbH & Co. KG"],
  AT: ["GmbH", "AG", "OG"],
  CH: ["GmbH", "AG"],
  GB: ["Ltd", "PLC", "LLP"],
  FR: ["SARL", "SAS", "SA", "SASU"],
  IT: ["S.r.l.", "S.p.A.", "S.a.s."],
  NL: ["B.V.", "N.V."],
  ES: ["S.L.", "S.A."],
  OTHER: [],
};

export function legalFormsFor(country: string): string[] {
  return LEGAL_FORMS[country] ?? [];
}

/* --------------------------- answers <-> prefs --------------------------- */

export type TravelPrefs = {
  seat: string;
  cabinClass: string;
  maxConnections: number;
  hotelMinRating: number;
  hotelRules: string | null;
  carTransmission: string;
  tripPurpose: string[];
  airlines: string[];
  cabinRule: string | null;
  seatFront: boolean;
  seatLegroom: boolean;
  hotelTypes: string[];
  hotelChains: string[];
  hotelStars: string[];
  hotelRatingLevel: string | null;
  hotelAmenities: string[];
  hotelMaxKm: number | null;
  carBrands: string[];
  carClass: string | null;
  carNavigation: boolean;
  carChildSeat: boolean;
  carCompanies: string[];
  cuisines: string[];
  diets: string[];
  interests: string[];
  music: string[];
  budgetBand: string | null;
  /** Hard rules, e.g. "dbStars4" — filtered out before ranking. */
  dealbreakers: string[];
  /** Part 2 profile answers keyed by field, kept open so new questions need no migration. */
  extraAnswers: Record<string, string[]>;
  accessibilityNote: string | null;
  avoidNote: string | null;
};

/** Toggle fields that act as hard filters rather than scores. */
export const DEALBREAKER_FIELDS = [
  "dbStars4",
  "dbLift",
  "dbAutomatic",
  "dbStepFree",
  "dbPets",
] as const;

/** Part 2 answer fields stored in the open `extraAnswers` map. */
export const EXTRA_ANSWER_FIELDS = [
  "travelStyle",
  "tripLength",
  "leadTime",
  "companions",
  "loyalty",
  "tradeConnection",
  "tradeCloser",
  "tradeMorning",
] as const;

export const DEFAULT_PREFS: TravelPrefs = {
  seat: "any",
  cabinClass: "economy",
  maxConnections: 1,
  hotelMinRating: 4,
  hotelRules: null,
  carTransmission: "automatic",
  tripPurpose: [],
  airlines: [],
  cabinRule: null,
  seatFront: false,
  seatLegroom: false,
  hotelTypes: [],
  hotelChains: [],
  hotelStars: [],
  hotelRatingLevel: null,
  hotelAmenities: [],
  hotelMaxKm: null,
  carBrands: [],
  carClass: null,
  carNavigation: false,
  carChildSeat: false,
  carCompanies: [],
  cuisines: [],
  diets: [],
  interests: [],
  music: [],
  budgetBand: null,
  dealbreakers: [],
  extraAnswers: {},
  accessibilityNote: null,
  avoidNote: null,
};

const RATING_TO_NUMBER: Record<string, number> = {
  exceptional: 5,
  very_good: 4,
  good: 3,
  pleasant: 2,
};

const first = (list: string[] | undefined) => list?.[0] ?? null;

export function answersToPrefs(answers: Answers, toggles: Toggles): TravelPrefs {
  const cabinChoice = first(answers["cabinChoice"]) ?? "economy";
  const ratingLevel = first(answers["hotelRatingLevel"]);
  const maxKm = first(answers["hotelMaxKm"]);
  const clean = (field: string, noneValue = "none") =>
    (answers[field] ?? []).filter((v) => v !== noneValue);

  return {
    seat: first(answers["seat"]) ?? "any",
    cabinClass: cabinChoice === "business_over_2h" ? "economy" : cabinChoice,
    maxConnections: 1,
    hotelMinRating: ratingLevel ? (RATING_TO_NUMBER[ratingLevel] ?? 4) : 4,
    hotelRules: null,
    carTransmission: first(answers["carTransmission"]) ?? "automatic",
    tripPurpose: answers["tripPurpose"] ?? [],
    airlines: clean("airlines"),
    cabinRule: cabinChoice === "business_over_2h" ? "business_over_2h" : null,
    seatFront: Boolean(toggles["seatFront"]),
    seatLegroom: Boolean(toggles["seatLegroom"]),
    hotelTypes: answers["hotelTypes"] ?? [],
    hotelChains: clean("hotelChains"),
    hotelStars: answers["hotelStars"] ?? [],
    hotelRatingLevel: ratingLevel,
    hotelAmenities: answers["hotelAmenities"] ?? [],
    hotelMaxKm: maxKm ? Number(maxKm) : null,
    carBrands: clean("carBrands"),
    carClass: first(answers["carClass"]),
    carNavigation: Boolean(toggles["carNavigation"]),
    carChildSeat: Boolean(toggles["carChildSeat"]),
    carCompanies: clean("carCompanies"),
    cuisines: answers["cuisines"] ?? [],
    diets: clean("diets"),
    interests: answers["interests"] ?? [],
    music: answers["music"] ?? [],
    budgetBand: first(answers["budgetBand"]),
    dealbreakers: DEALBREAKER_FIELDS.filter((field) => Boolean(toggles[field])),
    extraAnswers: Object.fromEntries(
      EXTRA_ANSWER_FIELDS.map((field) => [field, clean(field)]).filter(
        ([, values]) => (values as string[]).length > 0,
      ),
    ) as Record<string, string[]>,
    accessibilityNote: first(answers["accessibilityNote"]),
    avoidNote: first(answers["avoidNote"]),
  };
}

export function prefsToAnswers(prefs: TravelPrefs): { answers: Answers; toggles: Toggles } {
  return {
    answers: {
      ...prefs.extraAnswers,
      accessibilityNote: prefs.accessibilityNote ? [prefs.accessibilityNote] : [],
      avoidNote: prefs.avoidNote ? [prefs.avoidNote] : [],
      seat: [prefs.seat],
      cabinChoice: [prefs.cabinRule === "business_over_2h" ? "business_over_2h" : prefs.cabinClass],
      carTransmission: [prefs.carTransmission],
      tripPurpose: prefs.tripPurpose,
      airlines: prefs.airlines,
      hotelTypes: prefs.hotelTypes,
      hotelChains: prefs.hotelChains,
      hotelStars: prefs.hotelStars,
      hotelRatingLevel: prefs.hotelRatingLevel ? [prefs.hotelRatingLevel] : [],
      hotelAmenities: prefs.hotelAmenities,
      hotelMaxKm: prefs.hotelMaxKm ? [String(prefs.hotelMaxKm)] : [],
      carBrands: prefs.carBrands,
      carClass: prefs.carClass ? [prefs.carClass] : [],
      carCompanies: prefs.carCompanies,
      cuisines: prefs.cuisines,
      diets: prefs.diets,
      interests: prefs.interests,
      music: prefs.music,
      budgetBand: prefs.budgetBand ? [prefs.budgetBand] : [],
    },
    toggles: {
      seatFront: prefs.seatFront,
      seatLegroom: prefs.seatLegroom,
      carNavigation: prefs.carNavigation,
      carChildSeat: prefs.carChildSeat,
    },
  };
}

/** How many things Adair now knows — used on the summary screen. */
export function countKnownPreferences(prefs: TravelPrefs): number {
  const lists = [
    prefs.tripPurpose,
    prefs.airlines,
    prefs.hotelTypes,
    prefs.hotelChains,
    prefs.hotelStars,
    prefs.hotelAmenities,
    prefs.carBrands,
    prefs.carCompanies,
    prefs.cuisines,
    prefs.diets,
    prefs.interests,
    prefs.music,
  ];
  const singles = [
    prefs.seat !== "any" ? 1 : 0,
    prefs.cabinClass ? 1 : 0,
    prefs.hotelRatingLevel ? 1 : 0,
    prefs.hotelMaxKm ? 1 : 0,
    prefs.carClass ? 1 : 0,
    prefs.carTransmission !== "any" ? 1 : 0,
    prefs.budgetBand ? 1 : 0,
    prefs.seatFront ? 1 : 0,
    prefs.seatLegroom ? 1 : 0,
    prefs.carNavigation ? 1 : 0,
    prefs.carChildSeat ? 1 : 0,
  ];
  return lists.reduce((sum, l) => sum + l.length, 0) + singles.reduce((a, b) => a + b, 0);
}

/**
 * How much of the optional "Refine your profile" part is filled in, 0–100.
 * Shown on Preferences and in the prompt after the essentials.
 */
export function part2Completion(prefs: TravelPrefs, companyCount = 0): number {
  const filled = [
    prefs.airlines.length,
    prefs.hotelTypes.length,
    prefs.hotelChains.length,
    prefs.hotelAmenities.length,
    prefs.hotelMaxKm ? 1 : 0,
    prefs.carBrands.length,
    prefs.carCompanies.length,
    prefs.cuisines.length,
    prefs.diets.length,
    prefs.interests.length,
    prefs.music.length,
    ...EXTRA_ANSWER_FIELDS.map((field) => (prefs.extraAnswers[field]?.length ? 1 : 0)),
    prefs.accessibilityNote ? 1 : 0,
    prefs.avoidNote ? 1 : 0,
    companyCount,
  ].filter((count) => count > 0).length;
  const total = 11 + EXTRA_ANSWER_FIELDS.length + 3;
  return Math.min(100, Math.round((filled / total) * 100));
}

/** Label lookup for the summary and Preferences page. */
export function labelFor(field: string, value: string): string {
  for (const q of QUESTIONS) {
    for (const def of [...(q.singles ?? []), ...(q.multis ?? [])]) {
      if (def.field !== field) continue;
      const hit = def.options.find((o) => o.value === value);
      if (hit) return hit.label;
    }
  }
  return value;
}
