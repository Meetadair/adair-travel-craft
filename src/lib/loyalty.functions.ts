/**
 * Loyalty memberships in the traveller's wallet: airlines, hotels, car rental.
 * Member numbers are encrypted at rest and only returned masked, unless the
 * traveller explicitly reveals one.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LOYALTY_CATEGORIES, type LoyaltyCategory } from "@/lib/loyalty/programmes";

export type Membership = {
  id: string;
  category: LoyaltyCategory;
  programmeCode: string;
  programmeLabel: string;
  airlineIata: string | null;
  last4: string;
  tier: string | null;
};

type Row = {
  id: string;
  category: string;
  programme_code: string;
  programme_label: string;
  airline_iata: string | null;
  member_number_last4: string;
  tier: string | null;
};

const toMembership = (row: Row): Membership => ({
  id: row.id,
  category: (LOYALTY_CATEGORIES as readonly string[]).includes(row.category)
    ? (row.category as LoyaltyCategory)
    : "airline",
  programmeCode: row.programme_code,
  programmeLabel: row.programme_label,
  airlineIata: row.airline_iata,
  last4: row.member_number_last4,
  tier: row.tier,
});

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  category: z.enum(LOYALTY_CATEGORIES),
  programmeCode: z.string().trim().min(1).max(60),
  programmeLabel: z.string().trim().min(1).max(120),
  airlineIata: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{2}$/)
    .nullable()
    .optional(),
  memberNumber: z.string().trim().min(4).max(40),
  tier: z.string().trim().max(40).nullable().optional(),
});

export const listMemberships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Membership[]> => {
    const res = await context.supabase
      .from("loyalty_memberships")
      .select("id, category, programme_code, programme_label, airline_iata, member_number_last4, tier")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (res.error) throw new Error(res.error.message);
    return ((res.data ?? []) as Row[]).map(toMembership);
  });

export const saveMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }): Promise<Membership> => {
    const { encryptSecret } = await import("@/lib/loyalty/crypto.server");
    const number = data.memberNumber.replace(/\s+/g, "");
    const row = {
      user_id: context.userId,
      category: data.category,
      programme_code: data.programmeCode,
      programme_label: data.programmeLabel,
      airline_iata: data.airlineIata ?? null,
      member_number_encrypted: await encryptSecret(number),
      member_number_last4: number.slice(-4),
      tier: data.tier?.trim() ? data.tier.trim() : null,
    };

    const query = data.id
      ? context.supabase
          .from("loyalty_memberships")
          .update(row)
          .eq("id", data.id)
          .eq("user_id", context.userId)
      : context.supabase.from("loyalty_memberships").insert(row);

    const res = await query
      .select("id, category, programme_code, programme_label, airline_iata, member_number_last4, tier")
      .single();
    if (res.error) throw new Error(res.error.message);
    return toMembership(res.data as Row);
  });

export const deleteMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const res = await context.supabase
      .from("loyalty_memberships")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

/** Full number, only on explicit request from the owner. */
export const revealMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ memberNumber: string }> => {
    const res = await context.supabase
      .from("loyalty_memberships")
      .select("member_number_encrypted")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error("not-found");
    const { decryptSecret } = await import("@/lib/loyalty/crypto.server");
    return {
      memberNumber: await decryptSecret(
        (res.data as { member_number_encrypted: string }).member_number_encrypted,
      ),
    };
  });
