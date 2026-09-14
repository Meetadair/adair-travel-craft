/**
 * What the card may be charged, before anything is booked.
 *
 * The payment intent used to be opened for the card's whole total. On an
 * account where Duffel Stays is not enabled, that meant authorising the
 * traveller's card for a hotel that the booking step would immediately record
 * as "requested, supplier-not-enabled" and never buy. Charge for three things,
 * deliver one.
 *
 * A line can only be charged for if somebody will actually sell it to us, and
 * the proof of that is a supplier identifier: an offer for a flight, a rate for
 * a stay, a quote for a car. No identifier, no charge.
 */

export type PricedLines = {
  flight?: number | null | undefined;
  stay?: number | null | undefined;
  car?: number | null | undefined;
  total?: number | null | undefined;
};

export type SearchLines = {
  flight?: { offerId?: string | null } | null | undefined;
  stay?: { rateId?: string | null } | null | undefined;
  car?: { quoteId?: string | null; offerId?: string | null } | null | undefined;
};

const money = (value: number | null | undefined): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

const sellable = (id: string | null | undefined): boolean =>
  typeof id === "string" && id.trim().length > 0;

/** The lines a supplier will actually sell, and what each costs. */
export function bookableLines(
  priced: PricedLines,
  search: SearchLines,
): Array<{ kind: "flight" | "stay" | "car"; amount: number }> {
  const out: Array<{ kind: "flight" | "stay" | "car"; amount: number }> = [];
  if (sellable(search.flight?.offerId) && money(priced.flight)) {
    out.push({ kind: "flight", amount: money(priced.flight) });
  }
  if (sellable(search.stay?.rateId) && money(priced.stay)) {
    out.push({ kind: "stay", amount: money(priced.stay) });
  }
  if (
    (sellable(search.car?.quoteId) || sellable(search.car?.offerId)) &&
    money(priced.car)
  ) {
    out.push({ kind: "car", amount: money(priced.car) });
  }
  return out;
}

/** The amount to authorise, in minor units. Never more than we can deliver. */
export function bookableTotalMinor(priced: PricedLines, search: SearchLines): number {
  const total = bookableLines(priced, search).reduce((sum, line) => sum + line.amount, 0);
  return Math.round(total * 100);
}

/** What is on the card but cannot be bought, so the traveller can be told. */
export function unsellableKinds(priced: PricedLines, search: SearchLines): string[] {
  const bookable = new Set(bookableLines(priced, search).map((l) => l.kind));
  return (["flight", "stay", "car"] as const).filter(
    (kind) => money(priced[kind]) > 0 && !bookable.has(kind),
  );
}
