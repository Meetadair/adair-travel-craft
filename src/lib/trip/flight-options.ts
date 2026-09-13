/**
 * Two or three flights, with the trade-off spelled out.
 *
 * Hotels show one recommendation because quality is a judgement we can make.
 * Flights show two or three because price is a decision only the traveller can
 * make — the same route at the same hour can differ threefold.
 *
 * The rule this module exists to enforce: a price difference is never shown on
 * its own. Every cost the traveller would meet later — a checked bag, a coach
 * from a secondary airport, an extra connection — is named alongside it.
 * "€230 cheaper" without "bag +€45" is misleading, and they blame us at the
 * airport, not at the search.
 *
 * Pure functions only; safe on the client.
 */
import { matchesAirline } from "@/lib/trip/rank";
import type { FlightResult } from "@/lib/trip/types";

/** At most three: more is a list, and a list is what a search engine gives. */
export const MAX_OPTIONS = 3;

/** Below this, two fares are the same price and not worth a second row. */
export const MEANINGFUL_DELTA_EUR = 25;

export type OptionPrefs = {
  /** Airline keys the traveller chose, e.g. ["lot", "lufthansa"]. */
  airlines?: string[];
  /** Carriers they collect miles with, matched on name. */
  loyaltyCarriers?: string[];
};

export type FlightOption = {
  flight: FlightResult;
  /** Our pick. Exactly one option carries this. */
  recommended: boolean;
  /** Fare difference against the recommendation. Negative is cheaper. */
  deltaEur: number;
  /**
   * The fare difference plus everything they would pay later. This is the
   * number the recommendation line reasons about, never the bare fare.
   */
  effectiveDeltaEur: number;
  /** What this option gives them that the others do not. */
  gives: string[];
  /** What it lacks, and what it would cost them after booking. */
  costsLater: string[];
  /** True when a cost exists that we could not price. */
  hasUnpricedCost: boolean;
};

export type FlightOptions = {
  options: FlightOption[];
  /** One line in Adair's voice, with a reason. Never a bare comparison. */
  recommendation: string;
};

const eur = (value: number): string => `€${Math.abs(Math.round(value)).toLocaleString("en-GB")}`;

/** Journey length in minutes, when both ends are known. */
export function durationMinutes(flight: FlightResult): number | null {
  const from = Date.parse(flight.departAt);
  const to = Date.parse(flight.arriveAt);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  return Math.round((to - from) / 60_000);
}

function hours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Whether this fare earns miles the traveller actually collects. */
function earnsMiles(flight: FlightResult, prefs: OptionPrefs): boolean {
  const carriers = prefs.loyaltyCarriers ?? [];
  if (!carriers.length) return false;
  const carrier = flight.carrier.toLowerCase();
  return carriers.some((c) => carrier.includes(c.toLowerCase()));
}

/**
 * Everything this option would cost after booking, and whether we could put a
 * number on it. An unpriced cost is still stated — silence is the failure.
 */
function laterCosts(
  option: FlightResult,
  against: FlightResult,
): { lines: string[]; pricedEur: number; unpriced: boolean } {
  const lines: string[] = [];
  let pricedEur = 0;
  let unpriced = false;

  // A checked bag is the cost that catches people out most often.
  if (option.checkedBags === 0) {
    if (typeof option.checkedBagPriceEur === "number") {
      pricedEur += option.checkedBagPriceEur;
      lines.push(`checked bag not included, ${eur(option.checkedBagPriceEur)} to add`);
    } else {
      unpriced = true;
      lines.push("checked bag not included, and the airline has not published the price");
    }
  }

  // A different airport is a coach ride and an hour nobody planned for.
  if (option.originIata && against.originIata && option.originIata !== against.originIata) {
    unpriced = true;
    lines.push(`departs from ${option.originIata}, not ${against.originIata} — transfer on top`);
  }
  if (
    option.destinationIata &&
    against.destinationIata &&
    option.destinationIata !== against.destinationIata
  ) {
    unpriced = true;
    lines.push(
      `lands at ${option.destinationIata}, not ${against.destinationIata} — transfer on top`,
    );
  }

  const theirStops = option.stops ?? 0;
  const ourStops = against.stops ?? 0;
  if (theirStops > ourStops) {
    lines.push(theirStops === 1 ? "one connection" : `${theirStops} connections`);
  }

  const mine = durationMinutes(option);
  const theirs = durationMinutes(against);
  if (mine !== null && theirs !== null && mine - theirs >= 45) {
    lines.push(`${hours(mine - theirs)} longer`);
  }

  if (option.refundable === false && against.refundable === true) {
    lines.push("non-refundable");
  }
  if (option.changeable === false && against.changeable === true) {
    lines.push("cannot be changed");
  }

  return { lines, pricedEur, unpriced };
}

function advantages(option: FlightResult, prefs: OptionPrefs): string[] {
  const out: string[] = [];
  if ((prefs.airlines ?? []).some((key) => matchesAirline(key, option.carrier))) {
    out.push(`${option.carrier}, your airline`);
  }
  if (option.checkedBags && option.checkedBags > 0) {
    out.push(option.checkedBags === 1 ? "bag included" : `${option.checkedBags} bags included`);
  }
  if (earnsMiles(option, prefs)) out.push("earns miles");
  if ((option.stops ?? 0) === 0) out.push("direct");
  if (option.refundable) out.push("refundable");
  return out;
}

/**
 * Keeps only alternatives worth a second row: a real price gap, a different
 * airline, or a different airport. Three near-identical fares are noise.
 */
function worthShowing(candidate: FlightResult, recommended: FlightResult): boolean {
  const gap = Math.abs(candidate.amountEur - recommended.amountEur);
  if (gap >= MEANINGFUL_DELTA_EUR) return true;
  if (candidate.carrier !== recommended.carrier) return true;
  if (candidate.originIata && candidate.originIata !== recommended.originIata) return true;
  if (candidate.destinationIata && candidate.destinationIata !== recommended.destinationIata) {
    return true;
  }
  return false;
}

/** The one line under the options: a choice, with a reason. */
function recommendationLine(options: FlightOption[]): string {
  const pick = options.find((o) => o.recommended);
  if (!pick) return "";
  const others = options.filter((o) => !o.recommended);
  if (!others.length) {
    return `Only one fare worth taking on this route — ${pick.flight.carrier}.`;
  }

  const cheapest = others.reduce((a, b) => (a.deltaEur < b.deltaEur ? a : b));

  // The cheaper fare stops being cheaper once the bag and the coach are in.
  if (cheapest.deltaEur < 0 && cheapest.effectiveDeltaEur >= -MEANINGFUL_DELTA_EUR) {
    return (
      `I'd stay with ${pick.flight.carrier}. The cheaper fare looks ${eur(cheapest.deltaEur)} ` +
      `less, but once ${cheapest.costsLater[0]} is in, you are back where you started.`
    );
  }

  if (cheapest.deltaEur < 0 && cheapest.hasUnpricedCost) {
    return (
      `${cheapest.flight.carrier} saves you ${eur(cheapest.effectiveDeltaEur)}, but ` +
      `${cheapest.costsLater[0]} — worth checking before you decide. I'd take ` +
      `${pick.flight.carrier} for the simpler day.`
    );
  }

  if (cheapest.effectiveDeltaEur <= -100) {
    return (
      `I'd take ${cheapest.flight.carrier} — ${eur(cheapest.effectiveDeltaEur)} less, ` +
      `everything included, same day.`
    );
  }

  return (
    `I'd take ${pick.flight.carrier} — ${pick.gives[0] ?? "the better fare conditions"}, ` +
    `and the gap is ${eur(cheapest.deltaEur)}.`
  );
}

export function buildFlightOptions(
  recommended: FlightResult | null,
  alternatives: FlightResult[],
  prefs: OptionPrefs = {},
): FlightOptions {
  if (!recommended) return { options: [], recommendation: "" };

  const kept = alternatives
    .filter((candidate) => worthShowing(candidate, recommended))
    .slice(0, MAX_OPTIONS - 1);

  const options: FlightOption[] = [
    {
      flight: recommended,
      recommended: true,
      deltaEur: 0,
      effectiveDeltaEur: 0,
      gives: advantages(recommended, prefs),
      costsLater: laterCosts(recommended, recommended).lines,
      hasUnpricedCost: false,
    },
    ...kept.map((candidate) => {
      const delta = Math.round((candidate.amountEur - recommended.amountEur) * 100) / 100;
      const { lines, pricedEur, unpriced } = laterCosts(candidate, recommended);
      return {
        flight: candidate,
        recommended: false,
        deltaEur: delta,
        effectiveDeltaEur: Math.round((delta + pricedEur) * 100) / 100,
        gives: advantages(candidate, prefs),
        costsLater: lines,
        hasUnpricedCost: unpriced,
      };
    }),
  ];

  return { options, recommendation: recommendationLine(options) };
}
