/**
 * Payment step server functions.
 *
 * These go through the payment adapter interface in `src/lib/payments`, never a
 * provider SDK, so the active provider can be switched from the admin panel.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PaymentMethodKind, SettlementModel } from "@/lib/payments/types";

export type SavedCard = {
  id: string;
  providerCardId: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

export type PaymentSession = {
  clientKey: string | null;
  /** Set when the payment step cannot run, e.g. the supplier key is missing. */
  unavailable: "supplier-not-configured" | "card-payments-not-enabled" | null;
  testMode: boolean;
  currency: string;
  /** Duffel offer the 3-D Secure session must be created against. */
  offerId: string | null;
  savedCards: SavedCard[];
};

/** Mints a client key for the hosted card form and lists the traveller's saved cards. */
export const getPaymentSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ cardId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PaymentSession> => {
    const { supabase, userId } = context;
    const { isTestKey } = await import("@/lib/trip/duffel.server");

    const cardRes = await supabase
      .from("trip_cards")
      .select("items, currency")
      .eq("user_id", userId)
      .eq("id", data.cardId)
      .maybeSingle();
    if (cardRes.error) throw new Error(cardRes.error.message);
    const items = (cardRes.data as { items?: { search?: { flight?: { offerId?: string } } } } | null)
      ?.items;
    const offerId = items?.search?.flight?.offerId ?? null;

    const savedRes = await supabase
      .from("saved_cards")
      .select("id, provider_card_id, brand, last4, exp_month, exp_year")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const savedCards = ((savedRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row["id"] as string,
      providerCardId: row["provider_card_id"] as string,
      brand: (row["brand"] as string | null) ?? null,
      last4: (row["last4"] as string | null) ?? null,
      expMonth: (row["exp_month"] as number | null) ?? null,
      expYear: (row["exp_year"] as number | null) ?? null,
    }));

    let clientKey: string | null = null;
    let unavailable: PaymentSession["unavailable"] = null;
    try {
      const { createComponentClientKey } = await import("@/lib/trip/duffel-cards.server");
      clientKey = await createComponentClientKey();
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      unavailable = message === "missing-key" ? "supplier-not-configured" : "card-payments-not-enabled";
      console.error("payment session unavailable", message);
    }

    return {
      clientKey,
      unavailable,
      testMode: isTestKey(),
      currency: (cardRes.data as { currency?: string } | null)?.currency ?? "EUR",
      offerId,
      savedCards,
    };
  });

/** Stores only the provider's card token — never the number and never the CVC. */
export const saveCardToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        providerCardId: z.string().trim().min(3).max(120),
        brand: z.string().trim().max(40).nullable(),
        last4: z.string().trim().regex(/^\d{4}$/).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const res = await supabase.from("saved_cards").upsert(
      {
        user_id: userId,
        provider: "duffel",
        provider_card_id: data.providerCardId,
        brand: data.brand,
        last4: data.last4,
      },
      { onConflict: "user_id,provider,provider_card_id" },
    );
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

/** Removes a saved card token. */
export const deleteSavedCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("saved_cards")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });
