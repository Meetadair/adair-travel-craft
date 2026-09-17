/**
 * Turning what is on the screen into something worth hearing.
 *
 * Reading the interface aloud verbatim is the thing that makes spoken
 * assistants annoying. The card says:
 *
 *   "2026-10-20 – 2026-10-24 · some items from provider APIs · Lufthansa
 *    LH1615 · WAW → LIS · off_0000BAPYPXA7AcbIhW · 226 EUR"
 *
 * Spoken, that is: "two thousand twenty six dash ten dash twenty… off
 * underscore zero zero zero zero…". Nobody listens twice.
 *
 * So this module does not read the screen. It says the same facts the way a
 * person would say them, and leaves out everything that exists only because
 * a screen needed something to show — reference codes, provider labels,
 * separators.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTHS_PL = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

/** "2026-10-20" → "20 October" (or "20 października"). */
export function spokenDate(iso: string, locale = "en"): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return iso;
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const names = locale.startsWith("pl") ? MONTHS_PL : MONTHS;
  const name = names[month];
  if (!name) return iso;
  return locale.startsWith("pl") ? `${day} ${name}` : `${day} ${name}`;
}

/** "226.5 EUR" → "226 euros". Cents are noise out loud. */
export function spokenPrice(amount: number, currency: string, locale = "en"): string {
  const whole = Math.round(amount);
  if (locale.startsWith("pl")) {
    const word = currency === "EUR" ? "euro" : currency === "PLN" ? "złotych" : currency;
    return `${whole} ${word}`;
  }
  const word = currency === "EUR" ? (whole === 1 ? "euro" : "euros") : currency;
  return `${whole} ${word}`;
}

/** "07:55" → "seven fifty-five"-ish. The browser handles digits; we only
 *  remove the colon, which some voices read as "colon". */
export function spokenTime(time: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return time;
  return `${Number(match[1])} ${match[2] === "00" ? "o'clock" : match[2]}`;
}

/**
 * Everything that exists only for the screen. Reference codes are the worst
 * offender: a voice spells out "off underscore zero zero zero zero B A P Y"
 * for eleven seconds.
 */
export function stripScreenFurniture(text: string): string {
  return (
    text
      // Supplier reference codes: off_…, rat_…, ord_…, CR-XXXX
      .replace(/\b(?:off|rat|ord|qt|seg|pas|ans)_[A-Za-z0-9]+/g, "")
      // Middots and arrows used as separators
      .replace(/\s*[·•]\s*/g, ". ")
      .replace(/\s*[→↔⇄]\s*/g, " to ")
      // Bare IATA pairs like "WAW – LIS" keep the words around them
      .replace(/\s+[–—]\s+/g, " to ")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/**
 * The sentence to speak for one of Adair's replies.
 *
 * Deliberately conservative: dates and prices are rewritten because they are
 * unlistenable otherwise, and reference codes are dropped because they are
 * useless out loud. Everything else is left exactly as written — an assistant
 * that paraphrases itself when spoken is an assistant saying two different
 * things.
 */
export function speakableReply(reply: string, locale = "en"): string {
  let out = stripScreenFurniture(reply);
  out = out.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (iso) => spokenDate(iso, locale));
  out = out.replace(/\b(\d{1,2}):(\d{2})\b/g, (time) => spokenTime(time));
  return out.replace(/\s{2,}/g, " ").trim();
}

export type SpokenTripCard = {
  originCity: string;
  destinationCity: string;
  departDate: string;
  returnDate?: string | undefined;
  oneWay?: boolean | undefined;
  carrier?: string | undefined;
  totalAmount: number;
  currency: string;
  hotelName?: string | undefined;
  /** Never spoken as booked unless it is. */
  isSample?: boolean | undefined;
};

/**
 * The card, said out loud. The order is what a person asks about: where, when,
 * how much — then the detail. What is a sample is called a sample, because a
 * voice makes everything sound equally settled.
 */
export function speakableCard(card: SpokenTripCard, locale = "en"): string {
  const pl = locale.startsWith("pl");
  const when =
    card.oneWay || !card.returnDate
      ? spokenDate(card.departDate, locale)
      : pl
        ? `od ${spokenDate(card.departDate, locale)} do ${spokenDate(card.returnDate, locale)}`
        : `${spokenDate(card.departDate, locale)} to ${spokenDate(card.returnDate, locale)}`;

  const parts: string[] = [];
  parts.push(
    pl
      ? `${card.originCity} do ${card.destinationCity}, ${when}.`
      : `${card.originCity} to ${card.destinationCity}, ${when}.`,
  );
  if (card.carrier) {
    parts.push(pl ? `Lot ${card.carrier}.` : `Flying ${card.carrier}.`);
  }
  if (card.hotelName) {
    parts.push(
      card.isSample
        ? pl
          ? `Hotel ${card.hotelName} — to przykład, nie prawdziwa oferta.`
          : `Hotel ${card.hotelName} — that one is a sample, not a real offer.`
        : pl
          ? `Hotel ${card.hotelName}.`
          : `Hotel ${card.hotelName}.`,
    );
  }
  parts.push(
    pl
      ? `Razem ${spokenPrice(card.totalAmount, card.currency, locale)}.`
      : `${spokenPrice(card.totalAmount, card.currency, locale)} in total.`,
  );
  return parts.join(" ");
}
