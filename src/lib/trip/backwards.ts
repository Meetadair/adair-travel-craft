/**
 * Planning backwards from a fixed arrival time.
 *
 * "I need to be in Milan tomorrow at 3pm" — we pick the latest flight that
 * still lands in time once the airport, the ground transfer and a safety
 * margin are paid for, and we show that arithmetic on the card so the
 * traveller can check it themselves.
 */
import type { FlightResult } from "./types";

export type PlanningRules = {
  schengenClearMin: number;
  nonSchengenClearMin: number;
  safetyMarginMin: number;
  businessExtraMarginMin: number;
  transferBaseMin: number;
  transferMinPerKm: number;
};

export const DEFAULT_PLANNING_RULES: PlanningRules = {
  schengenClearMin: 45,
  nonSchengenClearMin: 75,
  safetyMarginMin: 30,
  businessExtraMarginMin: 20,
  transferBaseMin: 12,
  transferMinPerKm: 1.6,
};

/** Airports inside the Schengen area, where arrival is quick. */
const SCHENGEN = new Set([
  "LIN", "MXP", "BGY", "FCO", "CIA", "NAP", "VCE", "FLR", "BLQ", "TRN", "PSA", "CTA",
  "CDG", "ORY", "NCE", "LYS", "MRS", "TLS", "BOD", "NTE",
  "MAD", "BCN", "AGP", "VLC", "SVQ", "BIO", "PMI", "IBZ", "ALC", "LPA", "TFS",
  "BER", "MUC", "FRA", "HAM", "CGN", "DUS", "STR", "NUE", "LEJ", "BRE", "HAJ",
  "VIE", "SZG", "INN", "ZRH", "GVA", "BSL", "AMS", "EIN", "RTM", "BRU", "CRL",
  "CPH", "BLL", "ARN", "BMA", "GOT", "OSL", "BGO", "TRD", "HEL", "TLL", "RIX", "VNO",
  "WAW", "WMI", "KRK", "GDN", "WRO", "POZ", "KTW", "PRG", "BTS", "BUD", "LJU", "ZAG",
  "LIS", "OPO", "FAO", "ATH", "SKG", "MLA", "KEF", "OTP", "SOF",
]);

export function isSchengen(iata: string): boolean {
  return SCHENGEN.has(iata.trim().toUpperCase());
}

/** Ground transfer estimate for a city-centre run from the arrival airport. */
export function transferMinutes(distanceKm: number, rules: PlanningRules): number {
  const km = Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 20;
  return Math.round(rules.transferBaseMin + km * rules.transferMinPerKm);
}

export type ArrivalPlanAlternative = {
  title: string;
  landAt: string;
  arriveAt: string;
  slackMin: number;
  extraEur: number;
  /** Index in the alternatives list on the card, so the swap flow can use it. */
  index: number;
};

export type ArrivalPlan = {
  mustArriveBy: string;
  meetingLocation: string | null;
  /** Landing time of the flight we chose. */
  landAt: string;
  clearMin: number;
  transferMin: number;
  safetyMin: number;
  /** When they are realistically standing at the meeting. */
  arriveAt: string;
  /** Minutes to spare; negative means they would be late. */
  slackMin: number;
  tight: boolean;
  feasible: boolean;
  /** Plain-language arithmetic shown on the card. */
  reasoning: string;
  /** Set when nothing lands in time. */
  shortfall: string | null;
  /** A calmer flight, when the chosen one is tight. */
  saferOption: ArrivalPlanAlternative | null;
  /** Pickup time for the airport → meeting ride, from the real landing time. */
  transferPickupAt: string;
  /** True when we suggest flying the evening before instead. */
  suggestNightBefore: boolean;
};

const MIN = 60_000;
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

function durationLabel(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export type BackwardsInput = {
  candidates: FlightResult[];
  mustArriveBy: string;
  meetingLocation: string | null;
  destinationIata: string;
  /** Airport → meeting distance in km, used to estimate the transfer. */
  transferDistanceKm: number;
  rules: PlanningRules;
  business: boolean;
};

/** Minutes of ground time between wheels-down and being at the meeting. */
export function groundMinutes(input: BackwardsInput): {
  clearMin: number;
  transferMin: number;
  safetyMin: number;
  total: number;
} {
  const clearMin = isSchengen(input.destinationIata)
    ? input.rules.schengenClearMin
    : input.rules.nonSchengenClearMin;
  const transferMin = transferMinutes(input.transferDistanceKm, input.rules);
  const safetyMin =
    input.rules.safetyMarginMin + (input.business ? input.rules.businessExtraMarginMin : 0);
  return { clearMin, transferMin, safetyMin, total: clearMin + transferMin + safetyMin };
}

/** How tight is too tight to feel comfortable. */
const TIGHT_MIN = 45;

/**
 * Picks the latest flight that still gets them there in time. Returns the
 * chosen flight and the reasoning to show; never silently drops the request.
 */
export function planBackwards(input: BackwardsInput): {
  chosen: FlightResult | null;
  chosenIndex: number;
  plan: ArrivalPlan;
} {
  const ground = groundMinutes(input);
  const deadline = Date.parse(input.mustArriveBy);

  const scored = input.candidates
    .map((flight, index) => {
      const land = Date.parse(flight.arriveAt);
      const arrive = land + ground.total * MIN;
      return { flight, index, land, arrive, slackMin: Math.round((deadline - arrive) / MIN) };
    })
    .filter((row) => Number.isFinite(row.land));

  const inTime = scored.filter((row) => row.slackMin >= 0).sort((a, b) => b.land - a.land);
  const feasible = inTime.length > 0;
  // Latest one that works; otherwise the earliest arrival we can offer at all.
  const picked =
    inTime[0] ?? scored.slice().sort((a, b) => a.arrive - b.arrive)[0] ?? null;

  const build = (row: (typeof scored)[number] | null): ArrivalPlan => {
    const landAt = row ? row.flight.arriveAt : input.mustArriveBy;
    const arriveIso = row ? new Date(row.arrive).toISOString() : input.mustArriveBy;
    const slackMin = row?.slackMin ?? 0;
    const tight = feasible && slackMin < TIGHT_MIN;

    // A calmer flight: more slack than the chosen one, cheapest such option.
    const safer = feasible
      ? scored
          .filter((r) => r.index !== row?.index && r.slackMin >= TIGHT_MIN)
          .sort((a, b) => a.flight.amountEur - b.flight.amountEur)[0]
      : undefined;

    const chain = [
      `Lands ${hhmm(landAt)}`,
      `${ground.clearMin} min to clear the airport`,
      `${ground.transferMin} min transfer`,
      `${ground.safetyMin} min safety margin`,
    ].join(" · ");

    const reasoning = feasible
      ? `${chain} · arrives ${hhmm(arriveIso)}, ${durationLabel(slackMin)} before your meeting.`
      : `${chain} · earliest arrival is ${hhmm(arriveIso)}, ${durationLabel(slackMin)} after your meeting.`;

    return {
      mustArriveBy: input.mustArriveBy,
      meetingLocation: input.meetingLocation,
      landAt,
      clearMin: ground.clearMin,
      transferMin: ground.transferMin,
      safetyMin: ground.safetyMin,
      arriveAt: arriveIso,
      slackMin,
      tight,
      feasible,
      reasoning,
      shortfall: feasible
        ? null
        : `No flight lands in time — earliest arrival is ${hhmm(arriveIso)}, ${durationLabel(
            slackMin,
          )} after your meeting. Travelling the evening before with a hotel night added gets you there calmly.`,
      saferOption:
        tight && safer
          ? {
              title: `${safer.flight.carrier} ${safer.flight.flightNumbers.join(" / ")}`,
              landAt: safer.flight.arriveAt,
              arriveAt: new Date(safer.arrive).toISOString(),
              slackMin: safer.slackMin,
              extraEur:
                Math.round((safer.flight.amountEur - (row?.flight.amountEur ?? 0)) * 100) / 100,
              index: safer.index,
            }
          : null,
      transferPickupAt: row
        ? new Date(Date.parse(row.flight.arriveAt) + ground.clearMin * MIN).toISOString()
        : input.mustArriveBy,
      suggestNightBefore: !feasible,
    };
  };

  return { chosen: picked?.flight ?? null, chosenIndex: picked?.index ?? -1, plan: build(picked ?? null) };
}
