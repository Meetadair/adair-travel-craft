/**
 * Who is actually travelling, not just how many.
 *
 * Airlines price by age and hotels count children against a room's occupancy
 * policy, so a party is a list of dates of birth — never a head count. Ages
 * are worked out as of the RETURN date: a child who turns two during the trip
 * needs their own seat on the way home.
 *
 * Pure and browser-safe: the parser, the card, the passenger form and the
 * confirmation all read these same rules.
 */

export type AgeCategory = "infant" | "child" | "adult";

export const CATEGORY_LABEL: Record<AgeCategory, string> = {
  infant: "Infant (under 2)",
  child: "Child (2–11)",
  adult: "Adult",
};

export type Traveller = {
  /** "YYYY-MM-DD". Required for everyone — fares depend on it. */
  bornOn: string | null;
  /** Only meaningful for an infant; a lap infant by default. */
  infantOwnSeat?: boolean;
};

const day = (value: string) => new Date(`${value}T00:00:00Z`);

/** Whole years old on a given date, or null when we were not told. */
export function ageOn(bornOn: string | null, asOf: string): number | null {
  if (!bornOn) return null;
  const born = day(bornOn);
  const at = day(asOf);
  if (Number.isNaN(born.getTime()) || Number.isNaN(at.getTime())) return null;
  let age = at.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday =
    at.getUTCMonth() < born.getUTCMonth() ||
    (at.getUTCMonth() === born.getUTCMonth() && at.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Category as of the return date, so a birthday during the trip counts. With
 * no date of birth we assume an adult rather than quietly cheapen the fare.
 */
export function categoryOn(bornOn: string | null, returnDate: string): AgeCategory {
  const age = ageOn(bornOn, returnDate);
  if (age == null) return "adult";
  if (age < 2) return "infant";
  if (age < 12) return "child";
  return "adult";
}

export type Party = {
  adults: number;
  children: number;
  /** Ages of the children as of the return date, for the hotel search. */
  childAges: number[];
  infants: number;
  /** Infants the family chose to buy a seat for. */
  infantsWithSeat: number;
  categories: AgeCategory[];
  total: number;
};

export function partyOf(travellers: Traveller[], returnDate: string): Party {
  const categories = travellers.map((t) => categoryOn(t.bornOn, returnDate));
  const childAges = travellers
    .map((t, index) => (categories[index] === "child" ? ageOn(t.bornOn, returnDate) : null))
    .filter((age): age is number => age != null);

  return {
    adults: categories.filter((c) => c === "adult").length,
    children: categories.filter((c) => c === "child").length,
    childAges,
    infants: categories.filter((c) => c === "infant").length,
    infantsWithSeat: travellers.filter(
      (t, index) => categories[index] === "infant" && t.infantOwnSeat === true,
    ).length,
    categories,
    total: travellers.length,
  };
}

/* --------------------------------------------------------------- flights */

export type FareType = "adult" | "child" | "infant_without_seat" | "infant_with_seat";

/** The fare we ask the airline for, per traveller. */
export function fareTypeFor(category: AgeCategory, ownSeat = false): FareType {
  if (category === "adult") return "adult";
  if (category === "child") return "child";
  return ownSeat ? "infant_with_seat" : "infant_without_seat";
}

export function fareTypesFor(travellers: Traveller[], returnDate: string): FareType[] {
  return travellers.map((t) => fareTypeFor(categoryOn(t.bornOn, returnDate), t.infantOwnSeat));
}

/** Seats occupied on board: lap infants take none. */
export function seatsNeeded(party: Party): number {
  return party.adults + party.children + party.infantsWithSeat;
}

/* ----------------------------------------------------------------- hotels */

/** What a room's own policy allows, as the supplier states it. */
export type RoomPolicy = {
  maxOccupancy?: number | null;
  maxAdults?: number | null;
  maxChildren?: number | null;
  /** Children above this age count as adults for occupancy. */
  maxChildAge?: number | null;
  /** "Children under 6 stay free in existing beds." */
  childrenFreeUnder?: number | null;
  cotAvailable?: boolean;
  extraBedAvailable?: boolean;
};

/** True only when the family provably fits. An unknown policy is not a yes. */
export function roomFits(policy: RoomPolicy, party: Party): boolean {
  const heads = party.adults + party.children + party.infants;
  if (policy.maxOccupancy != null && heads > policy.maxOccupancy) return false;
  if (policy.maxAdults != null && party.adults > policy.maxAdults) return false;
  if (policy.maxChildren != null && party.children + party.infants > policy.maxChildren)
    return false;
  if (policy.maxChildAge != null && party.childAges.some((age) => age > policy.maxChildAge!))
    return false;
  return true;
}

const people = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** Said plainly, so a parent knows why a cheaper room is not on the list. */
export function familyRoomReason(party: Party, hotel?: string): string {
  const who = [
    people(party.adults, "adult", "adults"),
    party.children ? people(party.children, "child", "children") : null,
    party.infants ? people(party.infants, "infant", "infants") : null,
  ]
    .filter(Boolean)
    .join(" and ");
  return `${hotel ? `${hotel} requires` : "This hotel requires"} a family room for ${who}.`;
}

export function freeChildrenNote(policy: RoomPolicy): string | null {
  if (policy.childrenFreeUnder == null) return null;
  return `Children under ${policy.childrenFreeUnder} stay free in existing beds.`;
}

export type BedLine = {
  kind: "cot" | "extra_bed";
  label: string;
  count: number;
  /** Null when the hotel gives no price; we say so instead of guessing. */
  priceEur: number | null;
  note: string;
};

/**
 * A cot for each infant and an extra bed for each child — never an assumption
 * that a child shares the parents' bed.
 */
export function bedLines(
  party: Party,
  prices: { cotEur?: number | null; extraBedEur?: number | null } = {},
): BedLine[] {
  const lines: BedLine[] = [];
  if (party.infants > 0) {
    lines.push({
      kind: "cot",
      label: party.infants === 1 ? "Cot" : `${party.infants} cots`,
      count: party.infants,
      priceEur: prices.cotEur ?? null,
      note: prices.cotEur == null ? "On request at check-in" : "Per night",
    });
  }
  if (party.children > 0) {
    lines.push({
      kind: "extra_bed",
      label: party.children === 1 ? "Extra bed" : `${party.children} extra beds`,
      count: party.children,
      priceEur: prices.extraBedEur ?? null,
      note: prices.extraBedEur == null ? "On request at check-in" : "Per night",
    });
  }
  return lines;
}

/* ------------------------------------------------------------------- cars */

export type SeatBand = "infant carrier" | "child seat" | "booster";

/** The band rental companies actually sell, by age. */
export function childSeatBand(age: number): SeatBand | null {
  if (age < 0) return null;
  if (age < 2) return "infant carrier";
  if (age < 4) return "child seat";
  if (age < 12) return "booster";
  return null;
}

export function childSeatsFor(party: Party): Array<{ band: SeatBand; count: number }> {
  const ages = [...Array.from({ length: party.infants }, () => 1), ...party.childAges];
  const counts = new Map<SeatBand, number>();
  for (const age of ages) {
    const band = childSeatBand(age);
    if (band) counts.set(band, (counts.get(band) ?? 0) + 1);
  }
  return [...counts].map(([band, count]) => ({ band, count }));
}

/* ---------------------------------------------------------------- parsing */

const NL = String.raw`(?<![\p{L}])`;
const NR = String.raw`(?![\p{L}])`;
const w = (body: string) => new RegExp(`${NL}(?:${body})${NR}`, "u");

const NUMBER_WORDS: Array<[RegExp, number]> = [
  [w(String.raw`one|jedn\w*|a|an`), 1],
  [w(String.raw`two|dwa|dwie|dw[oó]ch|dwoje|dw[oó]jk[aąę]|dw[oó]jk[ią]`), 2],
  [w(String.raw`three|trzy|trzech|troje|tr[oó]jk[aąę]`), 3],
  [w(String.raw`four|cztery|czterech|czworo|czw[oó]rk[aąę]`), 4],
];

const CHILD_WORD = String.raw`kids?|child(?:ren)?|dzieci\w*|dziecko|dzieciak\w*`;
const BABY_WORD = String.raw`bab(?:y|ies)|infants?|newborn|niemowla\w*|niemowlak\w*`;

export type FamilyRead = {
  /** Children mentioned (2–11 where ages are known). */
  children: number;
  /** Ages as stated, in the order they were said. */
  ages: number[];
  infants: number;
  /** Children mentioned with no ages — the one question we must ask. */
  needsAges: boolean;
};

/**
 * Family phrases in English and Polish. We only read what is written: "with
 * kids" tells us children are coming, not how old they are.
 */
export function familyFromSentence(sentence: string): FamilyRead {
  const text = ` ${sentence.toLowerCase().replace(/\s+/g, " ")} `;

  const infantsMatch = new RegExp(`(\\d+)\\s*(?:${BABY_WORD})`, "u").exec(text);
  let infants = infantsMatch?.[1] ? Number(infantsMatch[1]) : 0;
  if (!infants && new RegExp(`(?:${BABY_WORD})`, "u").test(text)) infants = 1;

  // "aged 4 and 7", "4 i 7 lat", "4 and 7 years old"
  const ages: number[] = [];
  const ageBlock =
    /(?:aged|ages?|w\s+wieku)\s+([\d\s,adiknorz]+?)(?:\b(?:years?|lat\w*)\b|[.,;]|$)/u.exec(text) ??
    /(?:kids?|child(?:ren)?|dzieci\w*)\s+([\d\s,adiknorz]{2,20}?)\s*(?:years?\s*old|lat\w*)/u.exec(text);
  if (ageBlock?.[1]) {
    for (const found of ageBlock[1].matchAll(/\d+/g)) {
      const age = Number(found[0]);
      if (age >= 0 && age <= 17) ages.push(age);
    }
  }

  const countMatch = new RegExp(`(\\d+)\\s*(?:${CHILD_WORD})`, "u").exec(text);
  let children = countMatch?.[1] ? Number(countMatch[1]) : 0;
  if (!children) {
    const wordCount = new RegExp(`(?:${CHILD_WORD})`, "u").test(text)
      ? (NUMBER_WORDS.find(([pattern]) =>
          new RegExp(`${pattern.source}\\s+(?:${CHILD_WORD})|(?:${CHILD_WORD})\\s+${pattern.source}`, "u").test(
            text,
          ),
        )?.[1] ?? 0)
      : 0;
    children = wordCount;
  }
  if (!children && new RegExp(`(?:${CHILD_WORD})`, "u").test(text)) children = ages.length || 1;

  // Ages stated separately from the count still win.
  const statedChildAges = ages.filter((age) => age >= 2);
  const statedInfantAges = ages.filter((age) => age < 2);
  if (statedChildAges.length) children = Math.max(children, statedChildAges.length);
  if (statedInfantAges.length) infants = Math.max(infants, statedInfantAges.length);

  const childrenOnly = Math.max(0, children - statedInfantAges.length);

  return {
    children: childrenOnly,
    ages,
    infants,
    needsAges: childrenOnly > 0 && statedChildAges.length < childrenOnly,
  };
}

/** The one question we must ask before searching, or null when we can search. */
export function ageQuestion(read: FamilyRead): string | null {
  if (!read.needsAges) return null;
  return read.children === 1
    ? "How old is your child? Their age changes both the fare and the room."
    : "How old are the children? Their ages change both the fares and the room.";
}
