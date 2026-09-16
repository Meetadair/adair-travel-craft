/**
 * Public read of the live FX table, so the browser can convert a shown price
 * without a round trip per line. Never used for what a supplier actually
 * charges — that stays in the currency the offer was quoted in.
 */
import { createServerFn } from "@tanstack/react-start";

export const getFxRates = createServerFn({ method: "GET" }).handler(async () => {
  const { allFxRates, DISPLAY_CURRENCIES } = await import("@/lib/fx.server");
  return { rates: allFxRates(), currencies: DISPLAY_CURRENCIES as unknown as string[] };
});
