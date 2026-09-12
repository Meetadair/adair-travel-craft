/** Server-only pricing: supplier net price -> traveller gross price. */
import type { SupabaseClient } from "@supabase/supabase-js";

export type LineType = "flight" | "stay" | "car" | "extras" | "ride" | "restaurant";

export type PricingRule = {
  markupBps: number;
  discountBps: number;
  changeFeeMinor: number;
};

export type PricingTable = Record<LineType, PricingRule>;

const FALLBACK: PricingTable = {
  flight: { markupBps: 600, discountBps: 0, changeFeeMinor: 2000 },
  stay: { markupBps: 1200, discountBps: 0, changeFeeMinor: 2000 },
  car: { markupBps: 1000, discountBps: 0, changeFeeMinor: 2000 },
  extras: { markupBps: 4000, discountBps: 0, changeFeeMinor: 2000 },
  ride: { markupBps: 1000, discountBps: 0, changeFeeMinor: 0 },
  // Reservations are commission-from-the-venue, so the traveller is not marked up.
  restaurant: { markupBps: 0, discountBps: 0, changeFeeMinor: 0 },
};

export async function loadPricing(
  supabase: SupabaseClient,
  plan: string,
): Promise<PricingTable> {
  const { data } = await supabase
    .from("pricing_rules")
    .select("line_type, markup_bps, discount_bps, change_fee_minor")
    .eq("plan", plan);

  if (!data?.length) return FALLBACK;

  const table = { ...FALLBACK };
  for (const row of data as Array<{
    line_type: string;
    markup_bps: number;
    discount_bps: number;
    change_fee_minor: number;
  }>) {
    if (row.line_type in table) {
      table[row.line_type as LineType] = {
        markupBps: row.markup_bps,
        discountBps: row.discount_bps,
        changeFeeMinor: row.change_fee_minor,
      };
    }
  }
  return table;
}

export const toMinor = (amountEur: number) => Math.round(amountEur * 100);
export const fromMinor = (minor: number) => Math.round(minor) / 100;

/** Gross traveller price in minor units for one line. */
export function grossMinor(netEur: number, rule: PricingRule): number {
  const bps = 10_000 + rule.markupBps - rule.discountBps;
  return Math.round(toMinor(netEur) * (bps / 10_000));
}
