/**
 * How well one line of the card matches what the traveller asked for.
 *
 * Built from the offer text and their saved preferences, so the dots beside a
 * hotel say what was actually checked rather than a general impression. A
 * criterion only appears when they stated something — we never invent a
 * standard and then score against it.
 *
 * Pure; safe on the client.
 */
import { matchesAirline, matchesAmenity, matchesCarBrand, matchesChain } from "@/lib/trip/rank";
import type { SearchPrefs } from "@/lib/trip/rank";
import type { Criterion, LineMatch } from "@/lib/trip/match";

export type OfferLike = {
  kind: "flight" | "hotel" | "car";
  title: string;
  detail: string;
  amount: number;
};

const some = (keys: string[] | undefined, test: (key: string) => boolean): boolean =>
  Boolean(keys?.length) && keys!.some(test);

function flightCriteria(text: string, prefs: SearchPrefs): Criterion[] {
  const out: Criterion[] = [];
  if (prefs.airlines?.length) {
    out.push({
      ok: some(prefs.airlines, (key) => matchesAirline(key, text)),
      label: "One of your airlines",
    });
  }
  if (prefs.cabinClass) {
    out.push({
      ok: text.toLowerCase().includes(prefs.cabinClass.replace(/_/g, " ")),
      label: `${prefs.cabinClass.replace(/_/g, " ")} cabin`,
    });
  }
  if (typeof prefs.maxConnections === "number") {
    const stops = (text.match(/(\d+)\s*stop/i)?.[1] ?? "0") as string;
    out.push({
      ok: Number(stops) <= prefs.maxConnections,
      label:
        prefs.maxConnections === 0
          ? "Direct, as you prefer"
          : `At most ${prefs.maxConnections} connection${prefs.maxConnections === 1 ? "" : "s"}`,
    });
  }
  return out;
}

function hotelCriteria(text: string, prefs: SearchPrefs): Criterion[] {
  const out: Criterion[] = [];
  if (prefs.hotelChains?.length) {
    out.push({
      ok: some(prefs.hotelChains, (key) => matchesChain(key, text)),
      label: "A group you stay with",
    });
  }
  if (prefs.hotelAmenities?.length) {
    for (const amenity of prefs.hotelAmenities) {
      out.push({ ok: matchesAmenity(amenity, text), label: amenity });
    }
  }
  if (prefs.hotelTypes?.length) {
    out.push({
      ok: some(prefs.hotelTypes, (key) => matchesAmenity(key, text)),
      label: "The kind of place you like",
    });
  }
  if (typeof prefs.hotelMinRating === "number" && prefs.hotelMinRating > 0) {
    const rating = Number(text.match(/(\d(?:\.\d)?)\s*(?:★|stars?)/i)?.[1] ?? NaN);
    out.push({
      ok: Number.isFinite(rating) && rating >= prefs.hotelMinRating,
      label: `At least ${prefs.hotelMinRating} stars`,
    });
  }
  return out;
}

function carCriteria(text: string, prefs: SearchPrefs): Criterion[] {
  const out: Criterion[] = [];
  if (prefs.carBrands?.length) {
    out.push({
      ok: some(prefs.carBrands, (key) => matchesCarBrand(key, text)),
      label: "A make you asked for",
    });
  }
  if (prefs.carTransmission && prefs.carTransmission !== "any") {
    out.push({
      ok: new RegExp(prefs.carTransmission, "i").test(text),
      label: `${prefs.carTransmission} gearbox`,
    });
  }
  if (prefs.carClass) {
    out.push({ ok: matchesAmenity(prefs.carClass, text), label: `${prefs.carClass} class` });
  }
  return out;
}

/**
 * Null when they have stated nothing we can check on this line — dots against
 * an empty profile would be a score nobody earned.
 */
export function offerMatch(offer: OfferLike, prefs: SearchPrefs | null): LineMatch | null {
  if (!prefs) return null;
  const text = `${offer.title} ${offer.detail}`;

  const criteria =
    offer.kind === "flight"
      ? flightCriteria(text, prefs)
      : offer.kind === "hotel"
        ? hotelCriteria(text, prefs)
        : carCriteria(text, prefs);

  if (criteria.length === 0) return null;
  return {
    met: criteria.filter((criterion) => criterion.ok).length,
    total: criteria.length,
    criteria,
  };
}
