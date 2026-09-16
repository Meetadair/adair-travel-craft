/**
 * The pure arithmetic behind the currency picker, split out from the React
 * context so it can be tested without mounting anything: convert an amount
 * quoted in one currency into another, by way of EUR, using the same
 * EUR-per-unit rate table fx.server.ts publishes.
 */

/** `rates[code]` is the EUR value of one unit of `code`; EUR itself is always 1. */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();
  if (fromUpper === toUpper) return amount;
  const fromRate = fromUpper === "EUR" ? 1 : rates[fromUpper];
  const toRate = toUpper === "EUR" ? 1 : rates[toUpper];
  // An unknown currency on either side is not a rate to guess at — the
  // amount is shown as-is rather than silently wrong.
  if (!fromRate || !toRate) return amount;
  return (amount * fromRate) / toRate;
}
