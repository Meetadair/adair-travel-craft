/**
 * Server-only: read a traveller's loyalty memberships in full so they can be
 * passed to the supplier at booking time.
 */
import type { LoyaltyCategory } from "@/lib/loyalty/programmes";

export type BookingMembership = {
  id: string;
  category: LoyaltyCategory;
  programmeLabel: string;
  airlineIata: string | null;
  memberNumber: string;
  last4: string;
  tier: string | null;
};

export async function loadMemberships(userId: string): Promise<BookingMembership[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecret } = await import("@/lib/loyalty/crypto.server");
    const res = await supabaseAdmin
      .from("loyalty_memberships")
      .select(
        "id, category, programme_label, airline_iata, member_number_encrypted, member_number_last4, tier",
      )
      .eq("user_id", userId);
    if (res.error) throw new Error(res.error.message);

    const rows = (res.data ?? []) as Array<{
      id: string;
      category: string;
      programme_label: string;
      airline_iata: string | null;
      member_number_encrypted: string;
      member_number_last4: string;
      tier: string | null;
    }>;

    const out: BookingMembership[] = [];
    for (const row of rows) {
      try {
        out.push({
          id: row.id,
          category: row.category as LoyaltyCategory,
          programmeLabel: row.programme_label,
          airlineIata: row.airline_iata,
          memberNumber: await decryptSecret(row.member_number_encrypted),
          last4: row.member_number_last4,
          tier: row.tier,
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
