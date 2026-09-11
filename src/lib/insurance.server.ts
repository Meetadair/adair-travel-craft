/**
 * Server-only travel insurance pricing. The rate lives in `insurance_rates`
 * so it can be changed without a deploy, like `pricing_rules`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InsuranceQuote } from "@/lib/trip/insurance";
import { fromMinor, grossMinor, type PricingTable } from "@/lib/pricing.server";

export type InsuranceRate = {
  currency: string;
  baseDailyMinor: number;
  minimumMinor: number;
};

const FALLBACK_RATE: InsuranceRate = {
  currency: "EUR",
  baseDailyMinor: 450,
  minimumMinor: 1200,
};

export async function loadInsuranceRate(supabase: SupabaseClient): Promise<InsuranceRate> {
  const { data } = await supabase
    .from("insurance_rates")
    .select("currency, base_daily_minor, minimum_minor")
    .eq("active", true)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as {
    currency: string;
    base_daily_minor: number;
    minimum_minor: number;
  } | null;
  if (!row) return FALLBACK_RATE;

  return {
    currency: row.currency,
    baseDailyMinor: row.base_daily_minor,
    minimumMinor: row.minimum_minor,
  };
}

/** Nights between two YYYY-MM-DD dates, never below one. */
export function tripNights(departDate: string, returnDate: string): number {
  const diff = new Date(returnDate).getTime() - new Date(departDate).getTime();
  if (!Number.isFinite(diff)) return 1;
  return Math.max(1, Math.round(diff / 86_400_000));
}

/** premium = max(minimum, base daily x nights x passengers), plus extras markup. */
export function quoteInsurance(
  rate: InsuranceRate,
  nights: number,
  passengers: number,
  table: PricingTable,
): InsuranceQuote {
  const pax = Math.max(1, passengers);
  const netMinor = Math.max(rate.minimumMinor, rate.baseDailyMinor * nights * pax);
  const netEur = fromMinor(netMinor);
  return {
    nights,
    passengers: pax,
    currency: rate.currency,
    netEur,
    grossEur: fromMinor(grossMinor(netEur, table.extras)),
  };
}

export async function insuranceQuoteFor(
  supabase: SupabaseClient,
  table: PricingTable,
  departDate: string,
  returnDate: string,
  passengers: number,
): Promise<InsuranceQuote> {
  const rate = await loadInsuranceRate(supabase);
  return quoteInsurance(rate, tripNights(departDate, returnDate), passengers, table);
}
