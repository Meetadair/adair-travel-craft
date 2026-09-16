/**
 * One live exchange-rate source for the whole app, instead of two hand-typed
 * tables (duffel.server.ts and suppliers/rides/uber.ts) that could only ever
 * drift apart. Rates come from the European Central Bank's daily reference
 * rates via Frankfurter (frankfurter.dev — free, no key, no rate limit worth
 * worrying about for one fetch every few hours) and are kept in memory for
 * the life of the process, refreshed in the background.
 *
 * This is deliberately not exact-to-the-second: every amount converted here
 * is already labelled "approx." wherever it is shown, so a rate that is a
 * few hours old is exactly as good as one fetched this millisecond.
 */

/** Used until the first live fetch resolves, and if the source stays down. */
const FALLBACK_FX: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  PLN: 0.23,
  CHF: 1.05,
  SEK: 0.088,
  NOK: 0.086,
  DKK: 0.134,
  CZK: 0.04,
  HUF: 0.0026,
  RON: 0.2,
  JPY: 0.0061,
  AED: 0.25,
  TRY: 0.027,
};

let rates: Record<string, number> = { ...FALLBACK_FX };
let lastFetchedAt = 0;
const REFRESH_MS = 6 * 60 * 60 * 1000; // 6 hours

async function refresh(): Promise<void> {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR");
    if (!res.ok) throw new Error(`frankfurter-${res.status}`);
    const json = (await res.json()) as { rates?: Record<string, number> };
    if (!json.rates) throw new Error("frankfurter-no-rates");
    // Frankfurter publishes EUR -> X; we store the inverse (X -> EUR), which
    // is what every amount coming back from a supplier needs. Only currencies
    // the ECB actually publishes are overwritten — anything else (AED, for
    // instance, which the ECB doesn't cover) keeps its fallback value.
    const next: Record<string, number> = { EUR: 1 };
    for (const [code, eurToX] of Object.entries(json.rates)) {
      if (typeof eurToX === "number" && eurToX > 0) next[code] = 1 / eurToX;
    }
    rates = { ...FALLBACK_FX, ...next };
  } catch (error) {
    console.error("fx rate refresh failed, keeping previous rates", error);
  }
}

function ensureFresh(): void {
  if (Date.now() - lastFetchedAt > REFRESH_MS) {
    // Set before the fetch resolves so concurrent callers don't all trigger
    // their own refresh while one is already in flight.
    lastFetchedAt = Date.now();
    void refresh();
  }
}

// Warm the cache as soon as the process starts, rather than waiting for the
// first traveller to pay the cold-cache cost.
void refresh();

/** EUR value of one unit of `currency`, or null when we have never heard of it. */
export function fxRate(currency: string): number | null {
  ensureFresh();
  return rates[currency.toUpperCase()] ?? null;
}

/** The whole table, EUR value per unit — for a display-currency picker that
 *  converts client-side rather than round-tripping for every price shown. */
export function allFxRates(): Record<string, number> {
  ensureFresh();
  return { ...rates };
}

/** Currencies this app is willing to let someone pick as their display currency. */
export const DISPLAY_CURRENCIES = [
  "EUR", "USD", "GBP", "PLN", "CHF", "SEK", "NOK", "DKK", "CZK", "JPY",
] as const;
