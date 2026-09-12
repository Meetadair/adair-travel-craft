/**
 * Server-only: read a traveller's loyalty memberships in full so they can be
 * passed to the supplier at booking time.
 */
import type { LoyaltyCategory } from "@/lib/loyalty/programmes";
import { DEFAULT_EARNING_RULES, type EarningRule } from "@/lib/loyalty/earning";

export type BookingMembership = {
  id: string;
  category: LoyaltyCategory;
  programmeCode: string;
  programmeLabel: string;
  airlineIata: string | null;
  /** Empty when the traveller saved the programme without a number. */
  memberNumber: string;
  last4: string;
  tier: string | null;
  hasNumber: boolean;
};

export async function loadMemberships(userId: string): Promise<BookingMembership[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecret } = await import("@/lib/loyalty/crypto.server");
    const res = await supabaseAdmin
      .from("loyalty_memberships")
      .select(
        "id, category, programme_code, programme_label, airline_iata, member_number_encrypted, member_number_last4, tier",
      )
      .eq("user_id", userId);
    if (res.error) throw new Error(res.error.message);

    const rows = (res.data ?? []) as Array<{
      id: string;
      category: string;
      programme_code: string;
      programme_label: string;
      airline_iata: string | null;
      member_number_encrypted: string | null;
      member_number_last4: string | null;
      tier: string | null;
    }>;

    const out: BookingMembership[] = [];
    for (const row of rows) {
      try {
        out.push({
          id: row.id,
          category: row.category as LoyaltyCategory,
          programmeCode: row.programme_code,
          programmeLabel: row.programme_label,
          airlineIata: row.airline_iata,
          memberNumber: row.member_number_encrypted
            ? await decryptSecret(row.member_number_encrypted)
            : "",
          last4: row.member_number_last4 ?? "",
          tier: row.tier,
          hasNumber: Boolean(row.member_number_encrypted),
        });
      } catch (error) {
        console.error("loyalty decrypt failed", row.id, error);
      }
    }
    return out;
  } catch (error) {
    console.error("loyalty load failed", error);
    return [];
  }
}

/**
 * The editable programme → supplier mapping. Falls back to the shipped defaults
 * so a booking never loses loyalty just because the table is unreachable.
 */
export async function loadEarningRules(): Promise<EarningRule[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin
      .from("loyalty_earning_rules")
      .select("category, programme_code, matcher");
    if (res.error) throw new Error(res.error.message);
    const rows = (res.data ?? []) as Array<{
      category: string;
      programme_code: string;
      matcher: string;
    }>;
    if (!rows.length) return DEFAULT_EARNING_RULES;
    return rows.map((r) => ({
      category: r.category,
      programmeCode: r.programme_code,
      matcher: r.matcher,
    }));
  } catch (error) {
    console.error("loyalty earning rules load failed", error);
    return DEFAULT_EARNING_RULES;
  }
}
