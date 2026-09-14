/**
 * The assistant may not claim a booking that has not happened.
 *
 * The parser prompt asks for "one short sentence summarising the request", and
 * the model answered "I've booked your trip from Warsaw to Lisbon" — before
 * anything was reserved, before anyone had paid, above a card with a Book
 * button still on it. A traveller who reads that and closes the tab believes
 * they have a seat.
 *
 * Prompts drift and models change, so the prompt is not the defence. This is:
 * a reply that claims a booking is dropped and replaced with our own sentence,
 * which can only say what is true.
 */

/**
 * Past-tense booking claims in the languages Adair speaks. Deliberately narrow:
 * it must catch "I've booked" and leave "Book this trip" and "ready to book"
 * alone, or the assistant would lose the ability to talk about booking at all.
 */
const CLAIMS: RegExp[] = [
  /\b(?:i(?:'ve| have)?|we(?:'ve| have)?)\s+(?:successfully\s+)?(?:booked|reserved|confirmed)\b/i,
  /\b(?:your|the)\s+(?:trip|flight|hotel|booking)\s+(?:is|has been)\s+(?:booked|reserved|confirmed)\b/i,
  /\byour\s+booking\s+is\s+(?:complete|confirmed)\b/i,
  // Polish: zarezerwowałem / zarezerwowaliśmy / jest zarezerwowany
  /\bzarezerwowa(?:łem|liśmy|łam|ne|ny|na)\b/i,
  /\b(?:jest|została|zostało|został)\s+zarezerwowan/i,
  // German: ich habe gebucht / ist gebucht
  /\b(?:habe|haben)\s+(?:ich\s+|wir\s+)?[^.]{0,30}\bgebucht\b/i,
  /\b(?:ist|wurde)\s+gebucht\b/i,
  // French / Spanish / Italian / Portuguese.
  //
  // No \b next to an accented letter: JavaScript's word boundary is ASCII-only
  // even under the u flag, so /réservé\b/ never matches and /\bè/ never does
  // either. Whitespace-or-start is the boundary that works for every language
  // here.
  /(?:^|\s)j'ai\s+réservé/i,
  /(?:^|\s)est\s+réservé/i,
  /(?:^|\s)he\s+reservado/i,
  /(?:^|\s)est[áa]\s+reservad/i,
  /(?:^|\s)ho\s+prenotato/i,
  /(?:^|\s)è\s+stat[oa]\s+prenotat/i,
  /(?:^|\s)reservei/i,
];

/** Does this sentence tell the traveller something is already booked? */
export function claimsBooking(reply: string): boolean {
  return CLAIMS.some((pattern) => pattern.test(reply));
}

/**
 * The reply to show. The model's sentence when it is honest, ours when it is
 * not — never a corrected version of theirs, because editing a false claim
 * into a true one is guesswork about what they meant.
 */
export function safeReply(modelReply: string | null | undefined, fallback: string): string {
  const reply = modelReply?.trim();
  if (!reply) return fallback;
  return claimsBooking(reply) ? fallback : reply;
}
