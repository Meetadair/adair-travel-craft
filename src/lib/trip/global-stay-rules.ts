/**
 * Standards Adair applies to every stay search for every customer — nobody has
 * to ask not to be shown a hostel. The rules live in the `global_stay_rules`
 * config table so the team can see and adjust them; these defaults are the
 * fallback when the table cannot be read.
 */
export type GlobalStayRule = {
  ruleKey: string;
  label: string;
  hint: string | null;
  /** Words that, found in the property or room text, exclude the option. */
  terms: string[];
  /** When set, the property type must match one of these to be offered. */
  allowedTypes: string[];
  enabled: boolean;
};

export const DEFAULT_GLOBAL_STAY_RULES: GlobalStayRule[] = [
  {
    ruleKey: "no_hostel",
    label: "Exclude hostels",
    hint: "Any property described as a hostel is never offered.",
    terms: ["hostel", "hostal", "backpacker"],
    allowedTypes: [],
    enabled: true,
  },
  {
    ruleKey: "no_shared_bathroom",
    label: "Exclude shared-bathroom rooms",
    hint: "Rooms without a private bathroom are never offered.",
    terms: ["shared bathroom", "shared bath", "communal bathroom", "bathroom down the hall"],
    allowedTypes: [],
    enabled: true,
  },
  {
    ruleKey: "no_dormitory",
    label: "Exclude dormitories",
    hint: "Dorms, bunk rooms and shared rooms are never offered.",
    terms: ["dormitory", "dorm bed", "dorm room", "bunk bed", "shared room", "mixed dorm"],
    allowedTypes: [],
    enabled: true,
  },
  {
    ruleKey: "no_smoking_rooms",
    label: "Exclude smoking rooms",
    hint: "Only non-smoking rooms are offered.",
    terms: ["smoking room", "smoking permitted", "smoking allowed"],
    allowedTypes: [],
    enabled: true,
  },
  {
    ruleKey: "standard_floor",
    label: "Only hotel, apartment, villa or resort standard",
    hint: "Property types below this standard are never offered.",
    terms: [],
    allowedTypes: [
      "hotel",
      "aparthotel",
      "apartment",
      "apartments",
      "serviced apartment",
      "villa",
      "resort",
      "residence",
    ],
    enabled: true,
  },
];

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** What we know about a candidate property, in the supplier's own words. */
export type StayDescription = {
  /** Name, description, room names — anything the supplier published. */
  text: string;
  /** The supplier's property type, when it publishes one. */
  propertyType?: string | null;
};

/** True when the property clears every enabled global rule. */
export function passesGlobalStayRules(
  stay: StayDescription,
  rules: GlobalStayRule[] = DEFAULT_GLOBAL_STAY_RULES,
): boolean {
  const haystack = fold(stay.text);
  const type = stay.propertyType ? fold(stay.propertyType) : null;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.terms.some((term) => haystack.includes(fold(term)))) return false;
    if (rule.allowedTypes.length && type) {
      const allowed = rule.allowedTypes.some((allowedType) => type.includes(fold(allowedType)));
      if (!allowed) return false;
    }
  }
  return true;
}

/** Filters supplier results through the global rules before any ranking. */
export function staysPassingGlobalRules<T>(
  items: T[],
  read: (item: T) => StayDescription,
  rules: GlobalStayRule[] = DEFAULT_GLOBAL_STAY_RULES,
): T[] {
  return items.filter((item) => passesGlobalStayRules(read(item), rules));
}
