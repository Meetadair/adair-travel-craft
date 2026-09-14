/**
 * Who is on the booking, counted the way airlines count.
 *
 * Every airline site asks this the same way, in the same five bands, because
 * the bands are what the fare rules key off — and a traveller who has booked a
 * flight before expects to see them. Getting the bands wrong is not cosmetic:
 * a fifteen-year-old sold an adult fare costs the traveller real money, and a
 * lap infant with no adult to sit on is a booking the airline will reject.
 *
 * Counts are for the SEARCH. Exact dates of birth are collected at booking,
 * where the airline requires them — see family.ts. Searching on a
 * representative age is what every airline site does, and it is honest as long
 * as the price is confirmed against the real ages before payment.
 */

export type PartyCounts = {
  /** 16 and over. */
  adults: number;
  /** 12–15. Priced as a youth by many carriers, as an adult by some. */
  teenagers: number;
  /** 2–11. */
  children: number;
  /** Under 2, in their own seat. */
  infantsWithSeat: number;
  /** Under 2, on an adult's lap. */
  infantsOnLap: number;
};

export const EMPTY_PARTY: PartyCounts = {
  adults: 1,
  teenagers: 0,
  children: 0,
  infantsWithSeat: 0,
  infantsOnLap: 0,
};

/** Airlines will not sell more than nine seats on one booking. */
export const MAX_SEATS = 9;

/** The age we search on for each band. Replaced by the real one at booking. */
const SEARCH_AGE = { teenager: 15, child: 8, infantWithSeat: 1 } as const;

export function seatCount(party: PartyCounts): number {
  return party.adults + party.teenagers + party.children + party.infantsWithSeat;
}

export function headCount(party: PartyCounts): number {
  return seatCount(party) + party.infantsOnLap;
}

export type PartyProblem =
  | "no_adult"
  | "too_many_seats"
  | "too_many_lap_infants"
  | "unaccompanied_minor";

/**
 * Why this party cannot be searched for, in the order worth telling somebody.
 * Empty means it is bookable.
 */
export function partyProblems(party: PartyCounts): PartyProblem[] {
  const problems: PartyProblem[] = [];
  if (party.adults < 1) {
    // A booking of only under-16s is an unaccompanied-minor booking, which
    // airlines handle by phone and paperwork, never through an API.
    problems.push(party.teenagers + party.children > 0 ? "unaccompanied_minor" : "no_adult");
  }
  if (seatCount(party) > MAX_SEATS) problems.push("too_many_seats");
  // Every lap infant needs a lap, and nobody has two.
  if (party.infantsOnLap > party.adults) problems.push("too_many_lap_infants");
  return problems;
}

export function isBookableParty(party: PartyCounts): boolean {
  return partyProblems(party).length === 0;
}

export type DuffelPassenger = { type?: string; age?: number };

/**
 * The party as Duffel wants it. A seated infant is an `age`, because
 * `infant_without_seat` means exactly what it says — sending it for a child we
 * are buying a seat for would book them onto somebody's lap.
 */
export function duffelPassengers(party: PartyCounts): DuffelPassenger[] {
  return [
    ...Array.from({ length: party.adults }, () => ({ type: "adult" })),
    ...Array.from({ length: party.teenagers }, () => ({ age: SEARCH_AGE.teenager })),
    ...Array.from({ length: party.children }, () => ({ age: SEARCH_AGE.child })),
    ...Array.from({ length: party.infantsWithSeat }, () => ({ age: SEARCH_AGE.infantWithSeat })),
    ...Array.from({ length: party.infantsOnLap }, () => ({ type: "infant_without_seat" })),
  ];
}

/**
 * Hotel guests. A room is counted in people, not fares, so both kinds of
 * infant are a guest — a hotel that allows two adults and one child does not
 * care whose lap anyone sat on getting there.
 */
export function stayGuestAges(party: PartyCounts): number[] {
  return [
    ...Array.from({ length: party.teenagers }, () => SEARCH_AGE.teenager),
    ...Array.from({ length: party.children }, () => SEARCH_AGE.child),
    ...Array.from({ length: party.infantsWithSeat + party.infantsOnLap }, () => 1),
  ];
}

/** One clamped change, so a counter can never make an unbookable party. */
export function adjust(party: PartyCounts, band: keyof PartyCounts, delta: number): PartyCounts {
  const floor = band === "adults" ? 1 : 0;
  const next: PartyCounts = { ...party, [band]: Math.max(floor, party[band] + delta) };
  // Fewer adults means fewer laps. Drop the infants that no longer have one
  // rather than leaving a party that cannot be booked.
  if (next.infantsOnLap > next.adults) next.infantsOnLap = next.adults;
  if (seatCount(next) > MAX_SEATS) return party;
  return next;
}

/** "2 adults, 1 child" — for the chat, the card and the sentence we search on. */
export function describeParty(party: PartyCounts): string {
  const parts: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (party.adults) parts.push(plural(party.adults, "adult", "adults"));
  if (party.teenagers) parts.push(plural(party.teenagers, "teenager", "teenagers"));
  if (party.children) parts.push(plural(party.children, "child", "children"));
  const infants = party.infantsWithSeat + party.infantsOnLap;
  if (infants) parts.push(plural(infants, "infant", "infants"));
  return parts.join(", ");
}
