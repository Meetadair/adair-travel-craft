/**
 * What we have noticed from the traveller's own swaps.
 *
 * Deliberately small and explainable: two rejections of the same airline or
 * chain rank it down, repeated "too far" tightens distance, repeated
 * "too expensive" weighs price higher. Every adjustment can be shown in one
 * sentence on the Preferences page, and every one can be corrected or reset.
 *
 * Precedence, without exception: a stated preference or dealbreaker wins over
 * anything learned. We never quietly rank down something they asked for.
 */
import { BRAND_SEED, brandWords, type BrandKind } from "@/lib/brands/catalogue";

export type FeedbackKind = "flight" | "hotel" | "car";

export type FeedbackRow = {
  itemKind: string;
  /** Free-text reason the traveller gave, if any. */
  reason: string | null;
  /** Title of the option they rejected. */
  rejectedTitle: string;
};

export type AvoidedBrand = {
  kind: FeedbackKind;
  /** Brand id from the catalogue. */
  brandId: string;
  times: number;
};

export type Learned = {
  avoid: AvoidedBrand[];
  /** 1 = as stated. Above 1 means keep hotels closer than asked. */
  distanceWeight: number;
  /** 1 = as stated. Above 1 means price matters more than the rest. */
  priceWeight: number;
};

export const NO_LEARNING: Learned = { avoid: [], distanceWeight: 1, priceWeight: 1 };

const TOO_FAR = /too far|far from|za daleko|daleko od/i;
const TOO_EXPENSIVE = /too expensive|too dear|price|za drogo|drogie|cena/i;

const KIND_TO_BRAND: Record<FeedbackKind, BrandKind> = {
  flight: "airline",
  hotel: "hotel_chain",
  car: "car_rental",
};

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const asKind = (value: string): FeedbackKind | null =>
  value === "flight" || value === "hotel" || value === "car" ? value : null;

/** The catalogue brand a rejected option belongs to, or null when unclear. */
export function brandOf(kind: FeedbackKind, title: string): string | null {
  const haystack = fold(title);
  const match = BRAND_SEED.filter((b) => b.kind === KIND_TO_BRAND[kind]).find((b) =>
    brandWords(b.id).some((word) => word.length > 2 && haystack.includes(fold(word))),
  );
  return match?.id ?? null;
}

/**
 * Turns the traveller's swap history into adjustments. Two of the same signal
 * is the threshold — one swap is a one-off, not a pattern.
 */
export function learnFrom(rows: FeedbackRow[]): Learned {
  const rejections = new Map<string, AvoidedBrand>();
  let tooFar = 0;
  let tooExpensive = 0;

  for (const row of rows) {
    const kind = asKind(row.itemKind);
    if (kind) {
      const brandId = brandOf(kind, row.rejectedTitle);
      if (brandId) {
        const key = `${kind}:${brandId}`;
        const entry = rejections.get(key) ?? { kind, brandId, times: 0 };
        entry.times += 1;
        rejections.set(key, entry);
      }
    }
    const reason = row.reason ?? "";
    if (TOO_FAR.test(reason)) tooFar += 1;
    if (TOO_EXPENSIVE.test(reason)) tooExpensive += 1;
  }

  const weight = (count: number) => (count >= 4 ? 1.5 : count >= 2 ? 1.25 : 1);

  return {
    avoid: [...rejections.values()]
      .filter((entry) => entry.times >= 2)
      .sort((a, b) => b.times - a.times),
    distanceWeight: weight(tooFar),
    priceWeight: weight(tooExpensive),
  };
}

export type StatedPrefs = {
  /** Brand ids the traveller chose themselves. */
  airlines: string[];
  hotelChains: string[];
  carBrands: string[];
  carCompanies: string[];
  dealbreakers: string[];
};

const statedFor = (kind: FeedbackKind, stated: StatedPrefs): string[] =>
  kind === "flight"
    ? stated.airlines
    : kind === "hotel"
      ? stated.hotelChains
      : [...stated.carBrands, ...stated.carCompanies];

/**
 * Stated wins over learned: an adjustment against something the traveller
 * asked for, or against a dealbreaker, is dropped. Adjustments the traveller
 * has reset are dropped too.
 */
export function applyPrecedence(
  learned: Learned,
  stated: StatedPrefs,
  ignored: string[] = [],
): Learned {
  return {
    ...learned,
    avoid: learned.avoid.filter(
      (entry) =>
        !statedFor(entry.kind, stated).includes(entry.brandId) &&
        !ignored.includes(entry.brandId) &&
        !ignored.includes(`${entry.kind}:${entry.brandId}`),
    ),
    distanceWeight: ignored.includes("distance") ? 1 : learned.distanceWeight,
    priceWeight: ignored.includes("price") ? 1 : learned.priceWeight,
  };
}

/** One sentence per adjustment, in the traveller's own terms. */
export function noticedSentences(learned: Learned, nameOf: (id: string) => string): string[] {
  const lines = learned.avoid.map((entry) => {
    const what =
      entry.kind === "flight" ? "flying with" : entry.kind === "hotel" ? "staying at" : "renting from";
    return `you tend to avoid ${what} ${nameOf(entry.brandId)} — swapped ${entry.times} times`;
  });
  if (learned.distanceWeight > 1) lines.push("you tend to prefer hotels closer to the centre");
  if (learned.priceWeight > 1) lines.push("you tend to prefer the better price");
  return lines;
}
