/**
 * Tiny client-side parser for the hero demo input. It only personalises the
 * sample trip card (city, airport code, hotel, weekdays, invoice line) —
 * everything else on the card stays sample data.
 */

type CityPreset = {
  city: string;
  code: string;
  hotel: string;
  /** Match terms, incl. common local spellings. */
  match: string[];
};

const CITIES: CityPreset[] = [
  { city: "Milan", code: "LIN", hotel: "Park Hyatt Milano", match: ["milan", "mediolan", "milano", "mailand"] },
  { city: "Rome", code: "FCO", hotel: "Hotel de la Ville Roma", match: ["rome", "roma", "rzym", "rom"] },
  { city: "Lisbon", code: "LIS", hotel: "Bairro Alto Hotel", match: ["lisbon", "lisboa", "lizbona", "lissabon"] },
  { city: "Vienna", code: "VIE", hotel: "Hotel Sacher Wien", match: ["vienna", "wien", "wiedeń", "wieden", "viena"] },
  { city: "Berlin", code: "BER", hotel: "Hotel de Rome", match: ["berlin", "berlino"] },
  { city: "Paris", code: "CDG", hotel: "Hôtel Le Pigalle", match: ["paris", "paryż", "paryz", "parigi"] },
  { city: "Barcelona", code: "BCN", hotel: "Hotel Neri", match: ["barcelona", "barcelone", "barcellona"] },
  { city: "London", code: "LHR", hotel: "The Ned London", match: ["london", "londyn", "londres", "londra"] },
  { city: "Tokyo", code: "HND", hotel: "Hotel Toranomon Hills", match: ["tokyo", "tokio", "東京"] },
];

/** English weekday keys, index 0 = Monday. */
const WEEKDAYS_EN = [
  ["monday", "mon"],
  ["tuesday", "tue"],
  ["wednesday", "wed"],
  ["thursday", "thu"],
  ["friday", "fri"],
  ["saturday", "sat"],
  ["sunday", "sun"],
];

export type ParsedDemo = {
  city: string;
  code: string;
  hotel: string;
  /** 0 = Monday … 6 = Sunday */
  day1: number;
  day2: number;
  invoice: boolean;
};

/**
 * @param sentence what the visitor typed
 * @param localWeekdays localized weekday names (Monday first) used as extra hints
 */
export function parseDemoSentence(
  sentence: string,
  localWeekdays: readonly string[] = [],
): ParsedDemo {
  const text = sentence.toLowerCase();

  const city = CITIES.find((c) => c.match.some((m) => text.includes(m))) ?? CITIES[0]!;

  const hits: number[] = [];
  const seen = new Set<number>();
  const terms: { index: number; term: string }[] = [];
  WEEKDAYS_EN.forEach((words, i) => words.forEach((w) => terms.push({ index: i, term: w })));
  localWeekdays.forEach((w, i) => {
    const term = w.toLowerCase();
    if (term.length > 2) terms.push({ index: i, term });
    // Slavic / Romance inflections: match on a shortened stem too.
    if (term.length > 5) terms.push({ index: i, term: term.slice(0, term.length - 1) });
  });

  const found = terms
    .map((t) => ({ ...t, at: text.indexOf(t.term) }))
    .filter((t) => t.at >= 0)
    .sort((a, b) => a.at - b.at);

  for (const f of found) {
    if (seen.has(f.index)) continue;
    seen.add(f.index);
    hits.push(f.index);
    if (hits.length === 2) break;
  }

  const isWeekend = /weekend|week-end|wochenende/.test(text);
  let day1 = hits[0] ?? 3; // Thursday
  let day2 = hits[1] ?? (day1 + 1) % 7;
  if (hits.length === 0 && isWeekend) {
    day1 = 5; // Saturday
    day2 = 6; // Sunday
  } else if (hits.length === 1 && isWeekend) {
    day2 = 6;
  }

  return {
    city: city.city,
    code: city.code,
    hotel: city.hotel,
    day1,
    day2,
    invoice: /invoice|company|vat|faktur|firm|rechnung|société|societa|società|empresa/.test(text),
  };
}

/** Fills `{key}` placeholders in a dictionary string. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

/** Six-character referral code for the placeholder referral link. */
export function referralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
