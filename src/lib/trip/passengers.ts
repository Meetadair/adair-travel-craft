/**
 * How many people are travelling, and what that means for each line.
 *
 * Pure and browser-safe: the parser, the card and the booking screen all read
 * the same rules, so a sentence, a price and a passenger form can never
 * disagree about the count.
 */

/** Hard ceiling — beyond this the suppliers want a group booking anyway. */
export const MAX_PASSENGERS = 9;

/** Written numbers we accept, English and Polish, 1–9. */
const W = String.raw`(?<![\p{L}])`;
const WE = String.raw`(?![\p{L}])`;
const word = (body: string) => new RegExp(`${W}(?:${body})${WE}`, "u");

const WORD_NUMBERS: Array<[RegExp, number]> = [
  [word(String.raw`one|jedn[aey]|solo|myself|sam|sama`), 1],
  [
    word(
      String.raw`two|both\s+of\s+us|dwie|dwa|dw[oó]ch|dwoje|dwojga|we\s+dwoje|we\s+dw[oó]jk[eę]`,
    ),
    2,
  ],
  [word(String.raw`three|trzy|trzech|troje|w?e?\s*tr[oó]jk[eę]`), 3],
  [word(String.raw`four|cztery|czterech|czworo|we\s+czw[oó]rk[eę]`), 4],
  [word(String.raw`five|pi[eę][cć]|pi[eę]ciu|pi[eę]cioro`), 5],
  [word(String.raw`six|sze[sś][cć]|sze[sś]ciu`), 6],
  [word(String.raw`seven|siedem|siedmiu`), 7],
  [word(String.raw`eight|osiem|o[sś]miu`), 8],
  [word(String.raw`nine|dziewi[eę][cć]|dziewi[eę]ciu`), 9],
];

/** A named companion implies at least two people. */
const ONE_COMPANION = word(
  String.raw`with\s+my\s+(?:wife|husband|partner|girlfriend|boyfriend|spouse|son|daughter|mother|father|mum|mom|dad|colleague|assistant|friend)|z\s+(?:[zż]on[aą]|m[eę][zż]em|partner(?:k[aą]|em)|dziewczyn[aą]|ch[lł]opakiem|synem|c[oó]rk[aą]|mam[aą]|tat[aą]|koleg[aą]|kole[zż]ank[aą]|asystentk[aą])`,
);

/** Explicit plural companions without a number, e.g. "with my family". */
const MANY_COMPANIONS = word(
  String.raw`with\s+(?:my\s+)?(?:family|kids|children|team)|z\s+rodzin[aą]|z\s+dzie[cć]mi`,
);

/**
 * Passenger count read from a free-text sentence. Defaults to 1: we never
 * guess upwards from a vague phrase, because an extra seat costs real money.
 */
export function passengersFromSentence(sentence: string): number {
  const text = ` ${sentence.toLowerCase().replace(/\s+/g, " ")} `;

  // A digit next to a people word is the most reliable signal.
  const digit =
    /(\d+)\s*(?:passengers?|people|persons?|adults?|travellers?|travelers?|pax|os[oó]b\w*|osoby|pasa[zż]er\w*|doros[lł]\w*)/.exec(
      text,
    ) ?? /(?:for|dla|na)\s+(\d+)\b/.exec(text);
  if (digit?.[1]) return clamp(Number(digit[1]));

  // "for two", "dla dwóch osób", "we trójkę", "the two of us".
  for (const [pattern, value] of WORD_NUMBERS) {
    if (pattern.test(text)) return clamp(value);
  }

  if (MANY_COMPANIONS.test(text)) return 2; // Ask rather than assume a number.
  if (ONE_COMPANION.test(text)) return 2;
  return 1;
}

function clamp(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(Math.floor(value), MAX_PASSENGERS);
}

/**
 * Rooms for a party. Two share one room by default; three or more we split
 * into doubles rather than quietly booking one room for everybody.
 */
export function roomsFor(passengers: number): number {
  const count = clamp(passengers);
  if (count <= 2) return 1;
  return Math.ceil(count / 2);
}

/** Guests per room, so the stay search asks for the right occupancy. */
export function guestsPerRoom(passengers: number): number {
  const count = clamp(passengers);
  const rooms = roomsFor(count);
  return Math.ceil(count / rooms);
}

/**
 * Three or more travellers is where room splitting stops being obvious, so we
 * say what we assumed and let them change it.
 */
export function needsOccupancyQuestion(passengers: number): boolean {
  return clamp(passengers) >= 3;
}

export function occupancyNote(passengers: number): string | null {
  const count = clamp(passengers);
  if (count < 2) return null;
  const rooms = roomsFor(count);
  if (rooms === 1) return "One room for two — say the word if you want two rooms.";
  return `${rooms} rooms for ${count} travellers — tell me if you would rather split them differently.`;
}

/** Vehicles needed for a party, by the capacity of the cars we can book. */
export function vehiclesFor(passengers: number, seatsPerVehicle = 4): number {
  const count = clamp(passengers);
  const seats = Math.max(1, Math.floor(seatsPerVehicle));
  return Math.ceil(count / seats);
}

/**
 * Which lines scale with the head count. Flights are per seat, insurance is
 * per traveller, stays scale by rooms, a hire car does not scale at all.
 */
export function scaleFor(kind: string, passengers: number): number {
  const count = clamp(passengers);
  if (kind === "flight" || kind === "insurance") return count;
  if (kind === "stay") return roomsFor(count);
  return 1;
}

export function passengersLabel(passengers: number): string {
  const count = clamp(passengers);
  return count === 1 ? "1 traveller" : `${count} travellers`;
}
