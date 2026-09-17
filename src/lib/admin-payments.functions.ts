/**
 * Admin view over the payment provider switch and recent payment records.
 * Switching provider is a config change — no deploy, no code edit.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PaymentMethodKind, SettlementModel } from "@/lib/payments/types";

export type ProviderRow = {
  provider: string;
  label: string;
  enabled: boolean;
  priority: number;
  settlementModel: SettlementModel;
  /** Credential present in this environment. */
  configured: boolean;
  testMode: boolean;
  methods: PaymentMethodKind[];
};

export type PaymentRow = {
  id: string;
  provider: string | null;
  providerRef: string | null;
  method: string | null;
  settlementModel: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  idempotencyKey: string;
  createdAt: string;
};

async function assertAdmin(
  supabase: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> };
      };
    };
  },
  userId: string,
): Promise<void> {
  const res = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (!(res.data as { is_admin?: boolean } | null)?.is_admin) throw new Error("forbidden");
}

export const getPaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ providers: ProviderRow[]; payments: PaymentRow[] }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as never, userId);
    const { paymentAdapters } = await import("@/lib/payments/registry.server");

    const rowsRes = await supabase
      .from("payment_providers")
      .select("provider, label, enabled, priority, settlement_model")
      .order("priority", { ascending: true });
    const rows = (rowsRes.data ?? []) as Array<{
      provider: string;
      label: string;
      enabled: boolean;
      priority: number;
      settlement_model: string;
    }>;

    const providers: ProviderRow[] = rows.map((row) => {
      const adapter = paymentAdapters.find((candidate) => candidate.id === row.provider);
      return {
        provider: row.provider,
        label: row.label,
        enabled: row.enabled,
        priority: row.priority,
        settlementModel: (row.settlement_model as SettlementModel) ?? "supplier-of-record",
        configured: adapter?.isConfigured() ?? false,
        testMode: adapter?.isTestMode() ?? false,
        methods: adapter?.supportedMethods() ?? [],
      };
    });

    const payRes = await supabase
      .from("payments")
      .select(
        "id, provider, provider_ref, method, settlement_model, amount_minor, currency, status, idempotency_key, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    const payments = ((payRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row["id"] as string,
      provider: (row["provider"] as string | null) ?? null,
      providerRef: (row["provider_ref"] as string | null) ?? null,
      method: (row["method"] as string | null) ?? null,
      settlementModel: (row["settlement_model"] as string | null) ?? null,
      amountMinor: Number(row["amount_minor"] ?? 0),
      currency: (row["currency"] as string) ?? "EUR",
      status: (row["status"] as string) ?? "",
      idempotencyKey: (row["idempotency_key"] as string) ?? "",
      createdAt: (row["created_at"] as string) ?? "",
    }));

    return { providers, payments };
  });

/** Turns one provider on and every other one off, and records who did it. */
export const setActivePaymentProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ provider: z.string().trim().min(2).max(40) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as never, userId);

    const all = await supabase.from("payment_providers").select("provider, enabled");
    for (const row of (all.data ?? []) as Array<{ provider: string; enabled: boolean }>) {
      const enabled = row.provider === data.provider;
      if (enabled !== row.enabled) {
        const res = await supabase
          .from("payment_providers")
          .update({ enabled })
          .eq("provider", row.provider);
        if (res.error) throw new Error(res.error.message);
      }
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("audit_log").insert({
        actor: userId,
        action: "payment_provider_switched",
        entity: "payment_providers",
        after: { provider: data.provider } as never,
      });
    } catch (error) {
      console.error("audit_log insert failed", error);
    }
    return { ok: true };
  });
