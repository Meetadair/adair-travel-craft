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
  /** False when the traveller kept the programme but hasn't given the number. */
  hasNumber: boolean;
};

type Row = {
  id: string;
  category: string;
  programme_code: string;
  programme_label: string;
  airline_iata: string | null;
  member_number_last4: string | null;
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
  last4: row.member_number_last4 ?? "",
  tier: row.tier,
  hasNumber: Boolean(row.member_number_last4),
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
  // A programme with no number is kept, but marked incomplete: miles are only
  // credited when the number reaches the supplier at booking.
  memberNumber: z.string().trim().max(40),
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
    const hasNumber = number.length >= 4;
    const row = {
      user_id: context.userId,
      category: data.category,
      programme_code: data.programmeCode,
      programme_label: data.programmeLabel,
      airline_iata: data.airlineIata ?? null,
      member_number_encrypted: hasNumber ? await encryptSecret(number) : null,
      member_number_last4: hasNumber ? number.slice(-4) : null,
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
    const stored = (res.data as { member_number_encrypted: string | null })
      .member_number_encrypted;
    if (!stored) return { memberNumber: "" };
    const { decryptSecret } = await import("@/lib/loyalty/crypto.server");
    return {
      memberNumber: await decryptSecret(stored),
    };
  });

/**
 * Whether the home screen should remind the traveller to add their numbers:
 * they said in onboarding that they hold programmes, but nothing is saved yet.
 */
export const getLoyaltyReminder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ show: boolean }> => {
    const prefs = await context.supabase
      .from("preferences")
      .select("extra_answers")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (prefs.error) return { show: false };
    const answers = (prefs.data?.["extra_answers"] ?? {}) as Record<string, unknown>;
    const said = answers["loyalty"];
    const holds = Array.isArray(said) ? said.includes("yes") : said === "yes";
    if (!holds) return { show: false };

    const saved = await context.supabase
      .from("loyalty_memberships")
      .select("id")
      .eq("user_id", context.userId)
      .limit(1);
    if (saved.error) return { show: false };
    return { show: (saved.data ?? []).length === 0 };
  });
