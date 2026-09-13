/**
 * Payment cards saved ahead of time, from Settings → Saved details.
 *
 * Everything here goes through the payment adapter interface, so whichever
 * provider is switched on in the admin panel is the one that collects the card
 * in its own hosted form. We store only the provider's token plus the brand,
 * last four and expiry — never the number and never the security code.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PaymentMethodKind } from "@/lib/payments/types";

export type WalletCard = {
  id: string;
  provider: string;
  providerCardId: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
};

export type CardWallet = {
  provider: string;
  providerLabel: string;
  testMode: boolean;
  /** Only what the active provider truly offers — never a guess. */
  methods: PaymentMethodKind[];
  cards: WalletCard[];
  /** Hosted-form handles for adding a card, when the provider can do it. */
  clientKey: string | null;
  publishableKey: string | null;
  clientSecret: string | null;
  /** Set when a card cannot be added here; the reason is shown plainly. */
  unavailable: "not-configured" | "not-supported" | "failed" | null;
};

const toCard = (row: Record<string, unknown>): WalletCard => ({
  id: row["id"] as string,
  provider: (row["provider"] as string | null) ?? "unknown",
  providerCardId: row["provider_card_id"] as string,
  brand: (row["brand"] as string | null) ?? null,
  last4: (row["last4"] as string | null) ?? null,
  expMonth: (row["exp_month"] as number | null) ?? null,
  expYear: (row["exp_year"] as number | null) ?? null,
  isDefault: Boolean(row["is_default"]),
});

/** The saved cards plus a hosted-form session for adding one more. */
export const getCardWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CardWallet> => {
    const { supabase, userId } = context;
    const { paymentProvider } = await import("@/lib/payments/registry.server");

    const savedRes = await supabase
      .from("saved_cards")
      .select("id, provider, provider_card_id, brand, last4, exp_month, exp_year, is_default")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (savedRes.error) throw new Error(savedRes.error.message);
    const cards = ((savedRes.data ?? []) as Array<Record<string, unknown>>).map(toCard);

    const chosen = await paymentProvider(supabase);
    if (chosen.status !== "ok") {
      return {
        provider: "none",
        providerLabel: "No payment provider",
        testMode: false,
        methods: [],
        cards,
        clientKey: null,
        publishableKey: null,
        clientSecret: null,
        unavailable: "not-configured",
      };
    }

    const adapter = chosen.data;
    const session = await adapter.vaultSession(userId);
    const base = {
      provider: adapter.id,
      providerLabel: adapter.label,
      testMode: adapter.isTestMode(),
      methods: adapter.supportedMethods(),
      cards,
    };
    if (session.status !== "ok") {
      return {
        ...base,
        clientKey: null,
        publishableKey: null,
        clientSecret: null,
        unavailable: session.reason === "not-supported" ? "not-supported" : "failed",
      };
    }
    return {
      ...base,
      clientKey: session.data.clientKey,
      publishableKey: session.data.publishableKey,
      clientSecret: session.data.clientSecret,
      unavailable: null,
    };
  });

/** Makes one saved card the one pre-selected at checkout. */
export const setDefaultCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const cleared = await supabase
      .from("saved_cards")
      .update({ is_default: false })
      .eq("user_id", userId);
    if (cleared.error) throw new Error(cleared.error.message);
    const res = await supabase
      .from("saved_cards")
      .update({ is_default: true })
      .eq("user_id", userId)
      .eq("id", data.id);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });
