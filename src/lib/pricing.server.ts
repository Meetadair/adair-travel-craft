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

/**
 * Early-booking reward: book far enough ahead and we take a smaller fee. It is
 * our own markup coming down, never a supplier discount, and it is configured
 * in `pricing_rules` as rows `lead_time_<days>` so an admin can change it.
 */
export type LeadTimeTier = { minDays: number; discountBps: number };

const LEAD_TIME_PREFIX = "lead_time_";

/** Used only when the rules table has no lead-time rows at all. */
export const FALLBACK_LEAD_TIME_TIERS: LeadTimeTier[] = [
  { minDays: 90, discountBps: 200 },
  { minDays: 60, discountBps: 100 },
];

export async function loadLeadTimeTiers(
  supabase: SupabaseClient,
  plan: string,
): Promise<LeadTimeTier[]> {
  const { data } = await supabase
    .from("pricing_rules")
    .select("line_type, discount_bps")
    .eq("plan", plan)
    .like("line_type", `${LEAD_TIME_PREFIX}%`);

  const tiers = ((data ?? []) as Array<{ line_type: string; discount_bps: number }>)
    .map((row) => ({
      minDays: Number(row.line_type.slice(LEAD_TIME_PREFIX.length)),
      discountBps: Number(row.discount_bps),
    }))
    .filter((tier) => Number.isFinite(tier.minDays) && tier.discountBps > 0);

  if (!tiers.length) return FALLBACK_LEAD_TIME_TIERS;
  // Best (largest) qualifying tier first.
  return tiers.sort((a, b) => b.minDays - a.minDays);
}

/** Whole days between today and departure; negative dates count as zero. */
export function daysUntilDeparture(departDate: string, now: Date = new Date()): number {
  const depart = Date.parse(`${departDate}T00:00:00Z`);
  if (!Number.isFinite(depart)) return 0;
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.round((depart - today) / 86_400_000));
}

/** Extra basis points off our markup for booking this far ahead. */
export function leadTimeDiscountBps(tiers: LeadTimeTier[], daysAhead: number): number {
  const qualifying = tiers
    .filter((tier) => daysAhead >= tier.minDays)
    .map((tier) => tier.discountBps);
  return qualifying.length ? Math.max(...qualifying) : 0;
}

/** Apply the lead-time reward to every line, never taking a markup below zero. */
export function withLeadTimeDiscount(table: PricingTable, extraBps: number): PricingTable {
  if (extraBps <= 0) return table;
  const next = { ...table };
  for (const key of Object.keys(next) as LineType[]) {
    const rule = next[key];
    // Floor at zero markup: the discount never exceeds what we were charging.
    const ceiling = Math.max(rule.markupBps, rule.discountBps);
    next[key] = { ...rule, discountBps: Math.min(rule.discountBps + extraBps, ceiling) };
  }
  return next;
}
