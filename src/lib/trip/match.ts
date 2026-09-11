/**
 * Name matching for "book this exact hotel / this exact car" requests.
 * Accent- and punctuation-insensitive, allows partial and substring hits.
 */

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Words that carry no identity of their own. */
const STOP = new Set(["hotel", "hotels", "the", "a", "an", "de", "la", "le", "du", "del", "of", "and"]);

function tokens(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** True when `candidate` plausibly is the requested venue. */
export function nameMatches(candidate: string, requested: string): boolean {
  const a = normalizeName(candidate);
  const b = normalizeName(requested);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const wanted = tokens(requested);
  if (!wanted.length) return false;
  const have = new Set(tokens(candidate));
  const hits = wanted.filter((t) => have.has(t) || a.includes(t)).length;
  return hits / wanted.length >= 0.6;
}

/** Best match out of a list, or null when nothing is close enough. */
export function findByName<T>(
  items: T[],
  requested: string,
  nameOf: (item: T) => string,
): T | null {
  const exact = items.find((i) => normalizeName(nameOf(i)) === normalizeName(requested));
  if (exact) return exact;
  return items.find((i) => nameMatches(nameOf(i), requested)) ?? null;
}
