/** Admin: creator applications, commission settings, place submissions, payouts. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { payableMinor, PAYOUT_MINIMUM_MINOR } from "@/lib/creators/commission";

async function assertAdmin(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not verify your account");
  if (!data?.["is_admin"]) throw new Error("Admins only");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type AdminCreatorRow = {
  id: string;
  displayName: string;
  handle: string;
  shortCode: string;
  status: string;
  platforms: Array<{ network: string; url: string }>;
  appliedAt: string;
  approvedAt: string | null;
  payoutIbanLast4: string | null;
  payoutEntity: string | null;
  payoutVatStatus: string | null;
  reviewNote: string | null;
  clicks: number;
  signups: number;
  confirmedMinor: number;
  pendingMinor: number;
  payableMinor: number;
};

export type AdminPlaceSubmission = {
  id: string;
  name: string;
  kind: string;
  destination: string | null;
  whyThisOne: string | null;
  visitedOn: string | null;
  postUrl: string | null;
  photos: string[];
  creatorName: string | null;
  creatorHandle: string | null;
  reviewStatus: string;
  reviewNote: string | null;
  createdAt: string;
};

export type AdminCreatorOverview = {
  creators: AdminCreatorRow[];
  submissions: AdminPlaceSubmission[];
  rules: Array<{
    id: string;
    kind: string;
    lineType: string | null;
    plan: string | null;
    shareBps: number;
    flatMinor: number;
    earningWindowMonths: number;
    active: boolean;
  }>;
  payouts: Array<{
    id: string;
    creatorHandle: string | null;
    periodMonth: string;
    amountMinor: number;
    status: string;
    reference: string | null;
    paidAt: string | null;
  }>;
  payoutMinimumMinor: number;
};

export const getCreatorAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCreatorOverview> => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { settleDueEarnings } = await import("@/lib/creators.server");
    await settleDueEarnings(db as never);

    const [creators, clicks, attributions, earnings, submissions, rules, payouts] =
      await Promise.all([
        db
          .from("creators")
          .select(
            "id, display_name, handle, short_code, status, platforms, applied_at, approved_at, payout_iban_last4, payout_entity, payout_vat_status, review_note",
          )
          .order("applied_at", { ascending: false })
          .limit(200),
        db.from("creator_clicks").select("creator_id"),
        db.from("creator_attributions").select("creator_id"),
        db.from("creator_earnings").select("creator_id, amount_minor, status"),
        db
          .from("getaway_places")
          .select(
            "id, name, kind, why_this_one, visited_on, post_url, photos, review_status, review_note, created_at, getaway_destinations(name), creators(display_name, handle)",
          )
          .not("submitted_by_creator_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(100),
        db
          .from("creator_commission_rules")
          .select("id, kind, line_type, plan, share_bps, flat_minor, earning_window_months, active")
          .order("kind")
          .order("line_type"),
        db
          .from("creator_payouts")
          .select("id, period_month, amount_minor, status, reference, paid_at, creators(handle)")
          .order("period_month", { ascending: false })
          .limit(100),
      ]);

    const count = (rows: Array<{ creator_id: string }>, id: string) =>
      rows.filter((row) => row.creator_id === id).length;
    const clickRows = (clicks.data ?? []) as Array<{ creator_id: string }>;
    const attrRows = (attributions.data ?? []) as Array<{ creator_id: string }>;
    const earnRows = (earnings.data ?? []) as Array<{
      creator_id: string;
      amount_minor: number;
      status: string;
    }>;

    return {
      creators: ((creators.data ?? []) as Array<Record<string, unknown>>).map((row) => {
        const id = String(row["id"]);
        const mine = earnRows.filter((e) => e.creator_id === id);
        return {
          id,
          displayName: String(row["display_name"]),
          handle: String(row["handle"]),
          shortCode: String(row["short_code"]),
          status: String(row["status"]),
          platforms: Array.isArray(row["platforms"])
            ? (row["platforms"] as Array<{ network: string; url: string }>)
            : [],
          appliedAt: String(row["applied_at"]),
          approvedAt: (row["approved_at"] as string | null) ?? null,
          payoutIbanLast4: (row["payout_iban_last4"] as string | null) ?? null,
          payoutEntity: (row["payout_entity"] as string | null) ?? null,
          payoutVatStatus: (row["payout_vat_status"] as string | null) ?? null,
          reviewNote: (row["review_note"] as string | null) ?? null,
          clicks: count(clickRows, id),
          signups: count(attrRows, id),
          confirmedMinor: mine
            .filter((e) => e.status === "confirmed")
            .reduce((sum, e) => sum + e.amount_minor, 0),
          pendingMinor: mine
            .filter((e) => e.status === "pending")
            .reduce((sum, e) => sum + e.amount_minor, 0),
          payableMinor: payableMinor(
            mine.map((e) => ({ amountMinor: e.amount_minor, status: e.status as never })),
          ),
        };
      }),
      submissions: ((submissions.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row["id"]),
        name: String(row["name"]),
        kind: String(row["kind"]),
        destination: ((row["getaway_destinations"] as { name?: string } | null)?.name ?? null) as
          | string
          | null,
        whyThisOne: (row["why_this_one"] as string | null) ?? null,
        visitedOn: (row["visited_on"] as string | null) ?? null,
        postUrl: (row["post_url"] as string | null) ?? null,
        photos: Array.isArray(row["photos"]) ? (row["photos"] as string[]) : [],
        creatorName:
          ((row["creators"] as { display_name?: string } | null)?.display_name ?? null) as
            | string
            | null,
        creatorHandle: ((row["creators"] as { handle?: string } | null)?.handle ?? null) as
          | string
          | null,
        reviewStatus: String(row["review_status"]),
        reviewNote: (row["review_note"] as string | null) ?? null,
        createdAt: String(row["created_at"]),
      })),
      rules: ((rules.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row["id"]),
        kind: String(row["kind"]),
        lineType: (row["line_type"] as string | null) ?? null,
        plan: (row["plan"] as string | null) ?? null,
        shareBps: Number(row["share_bps"] ?? 0),
        flatMinor: Number(row["flat_minor"] ?? 0),
        earningWindowMonths: Number(row["earning_window_months"] ?? 12),
        active: Boolean(row["active"]),
      })),
      payouts: ((payouts.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row["id"]),
        creatorHandle: ((row["creators"] as { handle?: string } | null)?.handle ?? null) as
          | string
          | null,
        periodMonth: String(row["period_month"]),
        amountMinor: Number(row["amount_minor"] ?? 0),
        status: String(row["status"]),
        reference: (row["reference"] as string | null) ?? null,
        paidAt: (row["paid_at"] as string | null) ?? null,
      })),
      payoutMinimumMinor: PAYOUT_MINIMUM_MINOR,
    };
  });

export const setCreatorStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["applied", "approved", "paused", "rejected"]),
        note: z.string().trim().max(500).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { error } = await db
      .from("creators")
      .update({
        status: data.status,
        review_note: data.note,
        approved_at: data.status === "approved" ? new Date().toISOString() : null,
        approved_by: data.status === "approved" ? context.userId : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await db.from("audit_log").insert({
      actor: context.userId,
      action: "creator.status",
      entity: `creators:${data.id}`,
      after: { status: data.status } as never,
    });
    return { ok: true };
  });

export const saveCreatorCommissionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        shareBps: z.number().int().min(0).max(10000),
        flatMinor: z.number().int().min(0).max(1000000),
        earningWindowMonths: z.number().int().min(1).max(60),
        active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { error } = await db
      .from("creator_commission_rules")
      .update({
        share_bps: data.shareBps,
        flat_minor: data.flatMinor,
        earning_window_months: data.earningWindowMonths,
        active: data.active,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await db.from("audit_log").insert({
      actor: context.userId,
      action: "creator.commission",
      entity: `creator_commission_rules:${data.id}`,
      after: data as never,
    });
    return { ok: true };
  });

/** Editorial approval — the same bar as our own content. */
export const reviewCreatorPlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "pending"]),
        editorialNote: z.string().trim().max(1000).nullable().default(null),
        reviewNote: z.string().trim().max(500).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const update: Record<string, unknown> = {
      review_status: data.decision,
      review_note: data.reviewNote,
      active: data.decision === "approved",
    };
    if (data.editorialNote !== null) update["editorial_note"] = data.editorialNote;
    const { error } = await db
      .from("getaway_places")
      .update(update as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await db.from("audit_log").insert({
      actor: context.userId,
      action: "creator.place_review",
      entity: `getaway_places:${data.id}`,
      after: { decision: data.decision } as never,
    });
    return { ok: true };
  });

/** Draw a monthly payout for one creator from their confirmed, unpaid lines. */
export const createCreatorPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ creatorId: z.string().uuid() }).parse(input),
  )
  .handler(
    async ({ context, data }): Promise<{ created: boolean; amountMinor: number; reason?: string }> => {
      await assertAdmin(context.supabase, context.userId);
      const db = await admin();
      const res = await db
        .from("creator_earnings")
        .select("id, amount_minor")
        .eq("creator_id", data.creatorId)
        .eq("status", "confirmed")
        .is("payout_id", null);
      const rows = (res.data ?? []) as Array<{ id: string; amount_minor: number }>;
      const amountMinor = rows.reduce((sum, row) => sum + row.amount_minor, 0);
      if (amountMinor < PAYOUT_MINIMUM_MINOR) {
        return { created: false, amountMinor, reason: "below-minimum" };
      }

      const month = new Date();
      const payout = await db
        .from("creator_payouts")
        .insert({
          creator_id: data.creatorId,
          period_month: `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}-01`,
          amount_minor: amountMinor,
          currency: "EUR",
          status: "due",
        })
        .select("id")
        .single();
      if (payout.error) throw new Error(payout.error.message);
      const payoutId = (payout.data as { id: string }).id;
      await db
        .from("creator_earnings")
        .update({ payout_id: payoutId })
        .in(
          "id",
          rows.map((row) => row.id),
        );
      return { created: true, amountMinor };
    },
  );

/** We do not move money here — this records that the transfer was made. */
export const markCreatorPayoutPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), reference: z.string().trim().min(2).max(120) })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { error } = await db
      .from("creator_payouts")
      .update({
        status: "paid",
        reference: data.reference,
        paid_at: new Date().toISOString(),
        paid_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await db.from("creator_earnings").update({ status: "paid" }).eq("payout_id", data.id);
    await db.from("audit_log").insert({
      actor: context.userId,
      action: "creator.payout_paid",
      entity: `creator_payouts:${data.id}`,
      after: { reference: data.reference } as never,
    });
    return { ok: true };
  });
