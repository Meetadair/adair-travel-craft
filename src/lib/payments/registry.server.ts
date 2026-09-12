/**
 * Which payment provider is active right now: the `payment_providers` switch
 * plus the provider's own credential check. Switching provider is a row edit in
 * the admin panel — no deploy, no change to the booking flow.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { duffelPayments } from "./duffel-payments";
import { stripePayments } from "./stripe";
import { paymentOk, paymentUnavailable, type PaymentAdapter, type PaymentResult } from "./types";

const ADAPTERS: PaymentAdapter[] = [duffelPayments, stripePayments];

export const paymentAdapters = ADAPTERS;

export function adapterById(id: string): PaymentAdapter | null {
  return ADAPTERS.find((adapter) => adapter.id === id) ?? null;
}

type Row = { provider: string; enabled: boolean; priority: number };

/** The enabled, credentialled adapter with the lowest priority number. */
export async function paymentProvider(
  supabase: SupabaseClient,
): Promise<PaymentResult<PaymentAdapter>> {
  const { data } = await supabase
    .from("payment_providers")
    .select("provider, enabled, priority")
    .order("priority", { ascending: true });
  const rows = ((data ?? []) as Row[]).filter((row) => row.enabled);
  // No table row yet: Duffel Payments is the default.
  if (!rows.length) {
    return duffelPayments.isConfigured()
      ? paymentOk(duffelPayments)
      : paymentUnavailable("no-provider");
  }
  for (const row of rows) {
    const adapter = adapterById(row.provider);
    if (adapter?.isConfigured()) return paymentOk(adapter);
  }
  return paymentUnavailable("missing-key");
}
