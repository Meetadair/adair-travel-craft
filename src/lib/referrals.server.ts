/**
 * Referrals and travel credit.
 *
 * Credit is our own voucher: it comes off the next trip total and is never
 * money we hold, never refundable in cash. Both sides of a referral are paid
 * only when the invited traveller's first booking confirms — signing up alone
 * earns nothing, which is what keeps this honest.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";

type AnyDb = SupabaseClient<any, any, any>;

export const REFERRER_REWARD_MINOR = 4000; // €40
export const FRIEND_REWARD_MINOR = 2000; // €20

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode(): string {
  let out = "";
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return `AD-${out}`;
}

export function normaliseCode(value: string): string {
  const cleaned = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return cleaned.startsWith("AD") ? `AD-${cleaned.slice(2)}` : cleaned;
}

/** The traveller's own code, created on first use. */
export async function ensureReferralCode(db: AnyDb, userId: string): Promise<string> {
  const existing = await db
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();
  const found = (existing.data as { code?: string } | null)?.code;
  if (found) return found;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeCode();
    const res = await db.from("referral_codes").insert({ user_id: userId, code }).select("code");
    if (!res.error) return code;
    const retry = await db
      .from("referral_codes")
      .select("code")
      .eq("user_id", userId)
      .maybeSingle();
    const now = (retry.data as { code?: string } | null)?.code;
    if (now) return now;
  }
  throw new Error("referral-code-failed");
}

type LedgerRow = { kind: string; amount_minor: number };

/** Grants minus spends, in minor units. Never negative. */
export function balanceOf(rows: LedgerRow[]): number {
  const total = rows.reduce(
    (sum, row) =>
      sum + (row.kind === "spend" ? -Math.abs(row.amount_minor) : Math.abs(row.amount_minor)),
    0,
  );
  return Math.max(0, total);
}

export async function availableCreditMinor(db: AnyDb, userId: string): Promise<number> {
  const res = await db.from("credits").select("kind, amount_minor").eq("user_id", userId);
  if (res.error) return 0;
  return balanceOf((res.data ?? []) as LedgerRow[]);
}

/** How much credit this total can absorb: never more than the trip costs. */
export function creditToApply(balanceMinor: number, totalMinor: number): number {
  return Math.max(0, Math.min(balanceMinor, totalMinor));
}

/**
 * Spend credit against a trip. Uses the privileged client because the ledger is
 * written by the app, never by the customer.
 */
export async function spendCredit(
  admin: AnyDb,
  userId: string,
  tripId: string,
  amountMinor: number,
): Promise<void> {
  if (amountMinor <= 0) return;
  await admin.from("credits").insert({
    user_id: userId,
    kind: "spend",
    amount_minor: amountMinor,
    reason: "Applied to a trip",
    trip_id: tripId,
  });
}

/**
 * Pay both sides of a referral, once, when the invited traveller's first
 * booking confirms. Safe to call after every booking.
 */
export async function grantReferralRewards(
  admin: AnyDb,
  userId: string,
  tripId: string,
): Promise<{ granted: boolean }> {
  const referral = await admin
    .from("referrals")
    .select("id, referrer_id, status")
    .eq("referred_user_id", userId)
    .maybeSingle();
  const row = referral.data as { id: string; referrer_id: string; status: string } | null;
  if (!row || row.status === "granted") return { granted: false };

  // First booking only.
  const earlier = await admin
    .from("trips")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "booked")
    .neq("id", tripId)
    .limit(1);
  if ((earlier.data ?? []).length) {
    await admin.from("referrals").update({ status: "not_eligible" }).eq("id", row.id);
    return { granted: false };
  }

  const marked = await admin
    .from("referrals")
    .update({ status: "granted", granted_at: new Date().toISOString() })
    .eq("id", row.id)
    .neq("status", "granted")
    .select("id")
    .maybeSingle();
  if (marked.error || !marked.data) return { granted: false };

  await admin.from("credits").insert([
    {
      user_id: row.referrer_id,
      kind: "grant",
      amount_minor: REFERRER_REWARD_MINOR,
      reason: "A friend you invited made their first booking",
      referral_id: row.id,
    },
    {
      user_id: userId,
      kind: "grant",
      amount_minor: FRIEND_REWARD_MINOR,
      reason: "Welcome credit for joining through an invitation",
      referral_id: row.id,
    },
  ]);
  return { granted: true };
}
