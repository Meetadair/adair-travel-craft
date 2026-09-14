/**
 * Flexible dates.
 *
 * "± 3 days" means one thing to a traveller: would it be cheaper if I left a
 * few days either side? It does not mean "search every one of the forty-nine
 * combinations of outbound and return" — that is a minute of waiting and forty
 * nine supplier calls to answer a question nobody asked.
 *
 * So we move the whole trip, keeping its length, and price the flight only.
 * Three or five quick comparisons, one honest sentence back.
 */

const DAY_MS = 86_400_000;

export function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export type FlexWindow = { departDate: string; returnDate?: string | undefined; offset: number };

/**
 * The alternative departure days to price, nearest first, never in the past.
 * `today` is passed in rather than read so this stays pure and testable.
 */
export function flexWindows(
  departDate: string,
  returnDate: string | undefined,
  flexDays: number,
  today: string,
): FlexWindow[] {
  if (!Number.isFinite(flexDays) || flexDays <= 0) return [];
  // Whole days either side, nearest first: -1, +1, -2, +2, … A traveller cares
  // far more about one day than about three, and the nearest alternatives are
  // the ones worth spending a supplier call on.
  const offsets: number[] = [];
  for (let step = 1; step <= Math.min(flexDays, 7); step += 1) {
    offsets.push(-step, step);
  }
  const out: FlexWindow[] = [];
  for (const offset of offsets) {
    const depart = shiftIso(departDate, offset);
    if (depart < today) continue;
    out.push({
      departDate: depart,
      returnDate: returnDate ? shiftIso(returnDate, offset) : undefined,
      offset,
    });
  }
  return out;
}

export type FlexPrice = { window: FlexWindow; amount: number; currency: string };

export type FlexSaving = {
  departDate: string;
  returnDate?: string | undefined;
  offset: number;
  saveAmount: number;
  currency: string;
};

/**
 * The cheapest alternative worth mentioning. Worth mentioning means: a real
 * saving, in the same currency, and more than a rounding error — telling
 * somebody to move their trip by two days to save four euro is an insult.
 */
export function bestSaving(
  baseAmount: number,
  baseCurrency: string,
  priced: FlexPrice[],
  minimumSaving = 15,
): FlexSaving | null {
  let best: FlexSaving | null = null;
  for (const entry of priced) {
    if (entry.currency !== baseCurrency) continue;
    const saving = baseAmount - entry.amount;
    if (saving < minimumSaving) continue;
    if (best && saving <= best.saveAmount) continue;
    best = {
      departDate: entry.window.departDate,
      returnDate: entry.window.returnDate,
      offset: entry.window.offset,
      saveAmount: Math.round(saving),
      currency: entry.currency,
    };
  }
  return best;
}
