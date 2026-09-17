/** Referral code, invitations and the travel-credit ledger for the signed-in traveller. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CreditEntry = {
  id: string;
  kind: string;
  amountMinor: number;
  reason: string;
  createdAt: string;
};

export type ReferralSummary = {
  code: string;
  invited: number;
  booked: number;
  balanceMinor: number;
  entries: CreditEntry[];
  referrerRewardMinor: number;
  friendRewardMinor: number;
};

export const getMyReferral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferralSummary> => {
    const { balanceOf, ensureReferralCode, FRIEND_REWARD_MINOR, REFERRER_REWARD_MINOR } =
      await import("@/lib/referrals.server");
    const supabase = context.supabase;
    const userId = context.userId;

    const code = await ensureReferralCode(supabase as never, userId);

    const invitedRes = await supabase.from("referrals").select("status").eq("referrer_id", userId);
    const invited = (invitedRes.data ?? []) as Array<{ status: string }>;

    const creditRes = await supabase
      .from("credits")
      .select("id, kind, amount_minor, reason, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (creditRes.data ?? []) as Array<{
      id: string;
      kind: string;
      amount_minor: number;
      reason: string;
      created_at: string;
    }>;

    return {
      code,
      invited: invited.length,
      booked: invited.filter((row) => row.status === "granted").length,
      balanceMinor: balanceOf(rows),
      entries: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        amountMinor: row.amount_minor,
        reason: row.reason,
        createdAt: row.created_at,
      })),
      referrerRewardMinor: REFERRER_REWARD_MINOR,
      friendRewardMinor: FRIEND_REWARD_MINOR,
    };
  });

/**
 * Attribute the signed-in traveller to the code they arrived with. Records the
 * invitation only; nothing is paid until their first booking confirms.
 */
export const attributeReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => z.object({ code: z.string().max(40) }).parse(input))
  .handler(async ({ data, context }): Promise<{ attributed: boolean }> => {
    const { normaliseCode } = await import("@/lib/referrals.server");
    const code = normaliseCode(data.code);
    if (!code) return { attributed: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const owner = await supabaseAdmin
      .from("referral_codes")
      .select("user_id")
      .eq("code", code)
      .maybeSingle();
    const referrerId = (owner.data as { user_id?: string } | null)?.user_id;
    // Your own code, or a code that does not exist, attributes nothing.
    if (!referrerId || referrerId === context.userId) return { attributed: false };

    const existing = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq("referred_user_id", context.userId)
      .maybeSingle();
    if (existing.data) return { attributed: false };

    const res = await supabaseAdmin.from("referrals").insert({
      code,
      referrer_id: referrerId,
      referred_user_id: context.userId,
      status: "attributed",
    });
    return { attributed: !res.error };
  });
