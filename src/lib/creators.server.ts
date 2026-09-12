/**
 * Creator programme, server side.
 *
 * Two ways a creator earns, both only on a CONFIRMED booking:
 *  1. attribution — the traveller arrived through their link or code, and keeps
 *     earning for them for the configured window (12 months by default);
 *  2. curation — the traveller booked a place that creator recommended, even
 *     without their link.
 *
 * Nobody can pay to be placed or recommended, so there is deliberately no
 * "sponsored" flag anywhere in here.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CANCELLATION_WINDOW_DAYS,
  commissionMinor,
  confirmableAt,
  makeCreatorCode,
  marginMinor,
  withinEarningWindow,
} from "@/lib/creators/commission";

type AnyDb = SupabaseClient<any, any, any>;

export const ATTRIBUTION_DAYS = 90;

type CommissionRule = {
  kind: string;
  line_type: string | null;
  plan: string | null;
  share_bps: number;
  flat_minor: number;
  earning_window_months: number;
  active: boolean;
};

export async function loadCommissionRules(db: AnyDb): Promise<CommissionRule[]> {
  const res = await db
    .from("creator_commission_rules")
    .select("kind, line_type, plan, share_bps, flat_minor, earning_window_months, active")
    .eq("active", true);
  return (res.data ?? []) as CommissionRule[];
}

/** A free short code that nobody holds yet. */
export async function uniqueCreatorCode(db: AnyDb): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = makeCreatorCode();
    const taken = await db.from("creators").select("id").eq("short_code", code).maybeSingle();
    if (!taken.data) return code;
  }
  throw new Error("creator-code-failed");
}

/** A free handle, suffixed only if the wanted one is taken. */
export async function uniqueHandle(db: AnyDb, wanted: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? wanted : `${wanted}-${attempt + 1}`;
    const taken = await db.from("creators").select("id").eq("handle", candidate).maybeSingle();
    if (!taken.data) return candidate;
  }
  throw new Error("creator-handle-failed");
}

/** The traveller's live attribution, if any and if still inside the earning window. */
async function activeAttribution(
  admin: AnyDb,
  userId: string,
): Promise<{ creator_id: string } | null> {
  const res = await admin
    .from("creator_attributions")
    .select("creator_id, earning_until")
    .eq("user_id", userId)
    .order("attributed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = res.data as { creator_id: string; earning_until: string } | null;
  if (!row) return null;
  if (!withinEarningWindow(row.earning_until)) return null;
  const creator = await admin
    .from("creators")
    .select("id, status")
    .eq("id", row.creator_id)
    .maybeSingle();
  const status = (creator.data as { status?: string } | null)?.status;
  if (status !== "approved") return null;
  return { creator_id: row.creator_id };
}

async function markupFor(admin: AnyDb, plan: string, lineType: string): Promise<number> {
  const res = await admin
    .from("pricing_rules")
    .select("plan, line_type, markup_bps")
    .eq("line_type", lineType);
  const rows = (res.data ?? []) as Array<{ plan: string; markup_bps: number }>;
  const exact = rows.find((row) => row.plan === plan);
  const free = rows.find((row) => row.plan === "free");
  return Number(exact?.markup_bps ?? free?.markup_bps ?? 0);
}

export type AccrualLine = {
  tripItemId: string | null;
  kind: string;
  grossMinor: number;
  netMinor: number | null;
  status: string;
  /** Present when the traveller booked a creator-recommended place. */
  getawayPlaceId?: string | null;
};

/**
 * Write the pending commission for a confirmed booking. Safe to call after
 * every booking: without an attribution and without a curated place, nothing
 * is written at all.
 */
export async function accrueCreatorEarnings(
  admin: AnyDb,
  userId: string,
  tripId: string,
  lines: AccrualLine[],
): Promise<{ written: number }> {
  const attribution = await activeAttribution(admin, userId);

  // Which lines came from a creator's recommendation.
  const placeIds = lines
    .map((line) => line.getawayPlaceId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const curators = new Map<string, string>();
  if (placeIds.length) {
    const res = await admin
      .from("getaway_places")
      .select("id, submitted_by_creator_id, review_status")
      .in("id", placeIds);
    for (const row of (res.data ?? []) as Array<{
      id: string;
      submitted_by_creator_id: string | null;
      review_status: string;
    }>) {
      if (row.submitted_by_creator_id && row.review_status === "approved") {
        curators.set(row.id, row.submitted_by_creator_id);
      }
    }
  }

  if (!attribution && !curators.size) return { written: 0 };

  const rules = await loadCommissionRules(admin);
  const profile = await admin.from("profiles").select("plan").eq("id", userId).maybeSingle();
  const plan = String((profile.data as { plan?: string } | null)?.plan ?? "free");

  const now = new Date();
  const rows: Array<Record<string, unknown>> = [];

  for (const line of lines) {
    if (line.status === "failed" || line.status === "cancelled") continue;
    const lineType = line.kind === "insurance" || line.kind === "restaurant" ? "extras" : line.kind;
    const rule = rules.find((r) => r.kind === "line" && r.line_type === lineType);
    if (!rule) continue;

    const markup = await markupFor(admin, plan, lineType);
    const margin = marginMinor(line.grossMinor, line.netMinor, markup);
    const amount = commissionMinor(margin, rule.share_bps);
    if (amount <= 0) continue;

    const curatorId = line.getawayPlaceId ? curators.get(line.getawayPlaceId) : undefined;
    const creatorId = curatorId ?? attribution?.creator_id;
    if (!creatorId) continue;

    rows.push({
      creator_id: creatorId,
      trip_id: tripId,
      trip_item_id: line.tripItemId,
      kind: "line",
      line_type: lineType,
      basis: curatorId ? "recommendation" : "attribution",
      margin_minor: margin,
      share_bps: rule.share_bps,
      amount_minor: amount,
      currency: "EUR",
      status: "pending",
      confirmable_at: confirmableAt(now, CANCELLATION_WINDOW_DAYS),
    });
  }

  if (!rows.length) return { written: 0 };
  const res = await admin.from("creator_earnings").insert(rows as never);
  if (res.error) return { written: 0 };
  return { written: rows.length };
}

/**
 * A cancelled or refunded booking reverses whatever it accrued. Paid lines are
 * left alone — they are recovered against the next payout instead.
 */
export async function reverseCreatorEarnings(admin: AnyDb, tripId: string): Promise<void> {
  await admin
    .from("creator_earnings")
    .update({ status: "reversed", note: "Booking cancelled or refunded" })
    .eq("trip_id", tripId)
    .in("status", ["pending", "confirmed"]);
}

/**
 * Promote pending lines whose free-cancellation window has passed and whose
 * trip is still booked. Cheap enough to run on any read.
 */
export async function settleDueEarnings(admin: AnyDb): Promise<{ confirmed: number }> {
  const due = await admin
    .from("creator_earnings")
    .select("id, trip_id")
    .eq("status", "pending")
    .lte("confirmable_at", new Date().toISOString())
    .limit(200);
  const rows = (due.data ?? []) as Array<{ id: string; trip_id: string | null }>;
  if (!rows.length) return { confirmed: 0 };

  const tripIds = [...new Set(rows.map((row) => row.trip_id).filter(Boolean))] as string[];
  const trips = tripIds.length
    ? await admin.from("trips").select("id, status").in("id", tripIds)
    : { data: [] };
  const statusById = new Map(
    ((trips.data ?? []) as Array<{ id: string; status: string }>).map((t) => [t.id, t.status]),
  );

  const confirm = rows.filter((row) => !row.trip_id || statusById.get(row.trip_id) === "booked");
  const reverse = rows.filter((row) => row.trip_id && statusById.get(row.trip_id) !== "booked");

  if (confirm.length) {
    await admin
      .from("creator_earnings")
      .update({ status: "confirmed" })
      .in(
        "id",
        confirm.map((row) => row.id),
      );
  }
  if (reverse.length) {
    await admin
      .from("creator_earnings")
      .update({ status: "reversed", note: "Booking no longer active" })
      .in(
        "id",
        reverse.map((row) => row.id),
      );
  }
  return { confirmed: confirm.length };
}
