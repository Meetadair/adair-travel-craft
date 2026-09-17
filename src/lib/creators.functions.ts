/**
 * Creator programme: application, dashboard, public profile, place submissions.
 * Creators only ever see counts and amounts — never a traveller's name.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  byMonth,
  normaliseCreatorCode,
  normaliseHandle,
  payableMinor,
  PAYOUT_MINIMUM_MINOR,
  reachedPayoutFloor,
  type EarningStatus,
  type MonthTotals,
} from "@/lib/creators/commission";

const platformSchema = z.object({
  network: z.enum(["instagram", "tiktok", "youtube", "blog"]),
  url: z.string().trim().url().max(300),
});

export type CreatorStatus = "applied" | "approved" | "paused" | "rejected";

export type CreatorSelf = {
  id: string;
  displayName: string;
  handle: string;
  shortCode: string;
  bio: string | null;
  avatarUrl: string | null;
  platforms: Array<{ network: string; url: string }>;
  status: CreatorStatus;
  payoutIbanLast4: string | null;
  payoutEntity: string | null;
  payoutVatStatus: string | null;
  licenceAcceptedAt: string | null;
  appliedAt: string;
  reviewNote: string | null;
};

export type CreatorDashboard = {
  creator: CreatorSelf;
  clicks: number;
  signups: number;
  bookings: number;
  balanceMinor: number;
  pendingMinor: number;
  payoutMinimumMinor: number;
  readyForPayout: boolean;
  months: MonthTotals[];
  earnings: Array<{
    id: string;
    createdAt: string;
    lineType: string | null;
    basis: string;
    amountMinor: number;
    status: EarningStatus;
  }>;
  payouts: Array<{
    id: string;
    periodMonth: string;
    amountMinor: number;
    status: string;
    reference: string | null;
    paidAt: string | null;
  }>;
  submissions: Array<{
    id: string;
    name: string;
    kind: string;
    destination: string | null;
    reviewStatus: string;
    reviewNote: string | null;
  }>;
};

function mapSelf(row: Record<string, unknown>): CreatorSelf {
  return {
    id: String(row["id"]),
    displayName: String(row["display_name"]),
    handle: String(row["handle"]),
    shortCode: String(row["short_code"]),
    bio: (row["bio"] as string | null) ?? null,
    avatarUrl: (row["avatar_url"] as string | null) ?? null,
    platforms: Array.isArray(row["platforms"])
      ? (row["platforms"] as Array<{ network: string; url: string }>)
      : [],
    status: String(row["status"]) as CreatorStatus,
    payoutIbanLast4: (row["payout_iban_last4"] as string | null) ?? null,
    payoutEntity: (row["payout_entity"] as string | null) ?? null,
    payoutVatStatus: (row["payout_vat_status"] as string | null) ?? null,
    licenceAcceptedAt: (row["licence_accepted_at"] as string | null) ?? null,
    appliedAt: String(row["applied_at"]),
    reviewNote: (row["review_note"] as string | null) ?? null,
  };
}

const SELF_COLUMNS =
  "id, display_name, handle, short_code, bio, avatar_url, platforms, status, payout_iban_last4, payout_entity, payout_vat_status, licence_accepted_at, applied_at, review_note";

/** Apply, or update an application that has not been approved yet. */
export const applyAsCreator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        displayName: z.string().trim().min(2).max(80),
        handle: z.string().trim().min(3).max(30),
        bio: z.string().trim().max(600).optional(),
        platforms: z.array(platformSchema).min(1).max(6),
        payoutIban: z.string().trim().min(8).max(40).optional(),
        payoutEntity: z.string().trim().max(160).optional(),
        payoutVatStatus: z.string().trim().max(80).optional(),
        acceptLicence: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ handle: string; status: CreatorStatus }> => {
    const handleWanted = normaliseHandle(data.handle);
    if (!handleWanted) throw new Error("handle-invalid");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { uniqueCreatorCode, uniqueHandle } = await import("@/lib/creators.server");

    let ibanEncrypted: string | null = null;
    let ibanLast4: string | null = null;
    if (data.payoutIban) {
      const { encryptSecret } = await import("@/lib/loyalty/crypto.server");
      ibanEncrypted = await encryptSecret(data.payoutIban);
      ibanLast4 = data.payoutIban.slice(-4);
    }

    const existing = await supabaseAdmin
      .from("creators")
      .select("id, status, handle")
      .eq("user_id", context.userId)
      .maybeSingle();
    const found = existing.data as { id: string; status: string; handle: string } | null;

    const payload = {
      display_name: data.displayName,
      bio: data.bio ?? null,
      platforms: data.platforms as never,
      payout_iban_encrypted: ibanEncrypted,
      payout_iban_last4: ibanLast4,
      payout_entity: data.payoutEntity ?? null,
      payout_vat_status: data.payoutVatStatus ?? null,
      licence_accepted_at: new Date().toISOString(),
    };

    if (found) {
      const keepIban = ibanEncrypted === null;
      const update: Record<string, unknown> = { ...payload };
      if (keepIban) {
        delete update["payout_iban_encrypted"];
        delete update["payout_iban_last4"];
      }
      const { error } = await supabaseAdmin
        .from("creators")
        .update(update as never)
        .eq("id", found.id);
      if (error) throw new Error(error.message);
      return { handle: found.handle, status: found.status as CreatorStatus };
    }

    const handle = await uniqueHandle(supabaseAdmin as never, handleWanted);
    const shortCode = await uniqueCreatorCode(supabaseAdmin as never);
    const { error } = await supabaseAdmin.from("creators").insert({
      user_id: context.userId,
      handle,
      short_code: shortCode,
      status: "applied",
      ...payload,
    });
    if (error) throw new Error(error.message);
    return { handle, status: "applied" };
  });

/** The signed-in creator's own dashboard, or null when they never applied. */
export const getCreatorDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorDashboard | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { settleDueEarnings } = await import("@/lib/creators.server");

    const self = await supabaseAdmin
      .from("creators")
      .select(SELF_COLUMNS)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!self.data) return null;
    const creator = mapSelf(self.data as Record<string, unknown>);

    await settleDueEarnings(supabaseAdmin as never);

    const [clicks, attributions, earnings, payouts, places] = await Promise.all([
      supabaseAdmin
        .from("creator_clicks")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creator.id),
      supabaseAdmin
        .from("creator_attributions")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creator.id),
      supabaseAdmin
        .from("creator_earnings")
        .select("id, created_at, line_type, basis, amount_minor, status, trip_id")
        .eq("creator_id", creator.id)
        .order("created_at", { ascending: false })
        .limit(300),
      supabaseAdmin
        .from("creator_payouts")
        .select("id, period_month, amount_minor, status, reference, paid_at")
        .eq("creator_id", creator.id)
        .order("period_month", { ascending: false }),
      supabaseAdmin
        .from("getaway_places")
        .select("id, name, kind, review_status, review_note, getaway_destinations(name)")
        .eq("submitted_by_creator_id", creator.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const rows = ((earnings.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row["id"]),
      createdAt: String(row["created_at"]),
      lineType: (row["line_type"] as string | null) ?? null,
      basis: String(row["basis"]),
      amountMinor: Number(row["amount_minor"] ?? 0),
      status: String(row["status"]) as EarningStatus,
      tripId: (row["trip_id"] as string | null) ?? null,
    }));

    const balanceMinor = payableMinor(rows);
    return {
      creator,
      clicks: clicks.count ?? 0,
      signups: attributions.count ?? 0,
      bookings: new Set(rows.filter((r) => r.status !== "reversed").map((r) => r.tripId)).size,
      balanceMinor,
      pendingMinor: rows
        .filter((r) => r.status === "pending")
        .reduce((sum, r) => sum + r.amountMinor, 0),
      payoutMinimumMinor: PAYOUT_MINIMUM_MINOR,
      readyForPayout: reachedPayoutFloor(balanceMinor),
      months: byMonth(rows),
      earnings: rows.map(({ tripId: _tripId, ...rest }) => rest),
      payouts: ((payouts.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row["id"]),
        periodMonth: String(row["period_month"]),
        amountMinor: Number(row["amount_minor"] ?? 0),
        status: String(row["status"]),
        reference: (row["reference"] as string | null) ?? null,
        paidAt: (row["paid_at"] as string | null) ?? null,
      })),
      submissions: ((places.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row["id"]),
        name: String(row["name"]),
        kind: String(row["kind"]),
        destination:
          ((row["getaway_destinations"] as { name?: string } | null)?.name as string | null) ??
          null,
        reviewStatus: String(row["review_status"]),
        reviewNote: (row["review_note"] as string | null) ?? null,
      })),
    };
  });

/** Destinations a creator can submit a place for. */
export const listGetawayDestinationsForCreators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<Array<{ id: string; name: string; country: string }>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin
      .from("getaway_destinations")
      .select("id, name, country")
      .eq("active", true)
      .order("name");
    return ((res.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row["id"]),
      name: String(row["name"]),
      country: String(row["country"] ?? ""),
    }));
  });

/** Submit a place. It stays invisible until the editorial team approves it. */
export const submitCreatorPlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        destinationId: z.string().uuid(),
        kind: z.enum(["hotel", "restaurant", "sight"]),
        name: z.string().trim().min(2).max(120),
        whyThisOne: z.string().trim().min(10).max(600),
        visitedOn: z.string().trim().max(10).optional(),
        postUrl: z.string().trim().url().max(300).optional(),
        photos: z.array(z.string().trim().url().max(500)).max(3).default([]),
        acceptLicence: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const self = await supabaseAdmin
      .from("creators")
      .select("id, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    const creator = self.data as { id: string; status: string } | null;
    if (!creator || creator.status !== "approved") throw new Error("not-an-approved-creator");

    const { error } = await supabaseAdmin.from("getaway_places").insert({
      destination_id: data.destinationId,
      kind: data.kind,
      name: data.name,
      why_this_one: data.whyThisOne,
      visited_on: data.visitedOn || null,
      post_url: data.postUrl ?? null,
      photos: data.photos as never,
      submitted_by_creator_id: creator.id,
      review_status: "pending",
      active: false,
      licence_accepted_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------- public profile ---------------------------- */

export type CreatorPublicProfile = {
  displayName: string;
  handle: string;
  bio: string | null;
  avatarUrl: string | null;
  platforms: Array<{ network: string; url: string }>;
  picks: Array<{
    id: string;
    name: string;
    kind: string;
    destination: string | null;
    whyThisOne: string | null;
    visitedOn: string | null;
    postUrl: string | null;
    photos: string[];
  }>;
};

/** Public: an approved creator and their approved picks. Nothing pending shows. */
export const getCreatorProfile = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ handle: z.string().trim().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data }): Promise<CreatorPublicProfile | null> => {
    const handle = normaliseHandle(data.handle);
    if (!handle) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin
      .from("creators")
      .select("id, display_name, handle, bio, avatar_url, platforms, status")
      .eq("handle", handle)
      .maybeSingle();
    const creator = res.data as Record<string, unknown> | null;
    if (!creator || creator["status"] !== "approved") return null;

    const places = await supabaseAdmin
      .from("getaway_places")
      .select(
        "id, name, kind, why_this_one, visited_on, post_url, photos, getaway_destinations(name)",
      )
      .eq("submitted_by_creator_id", creator["id"] as string)
      .eq("review_status", "approved")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(60);

    return {
      displayName: String(creator["display_name"]),
      handle: String(creator["handle"]),
      bio: (creator["bio"] as string | null) ?? null,
      avatarUrl: (creator["avatar_url"] as string | null) ?? null,
      platforms: Array.isArray(creator["platforms"])
        ? (creator["platforms"] as Array<{ network: string; url: string }>)
        : [],
      picks: ((places.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row["id"]),
        name: String(row["name"]),
        kind: String(row["kind"]),
        destination:
          ((row["getaway_destinations"] as { name?: string } | null)?.name as string | null) ??
          null,
        whyThisOne: (row["why_this_one"] as string | null) ?? null,
        visitedOn: (row["visited_on"] as string | null) ?? null,
        postUrl: (row["post_url"] as string | null) ?? null,
        photos: Array.isArray(row["photos"]) ? (row["photos"] as string[]) : [],
      })),
    };
  });

/** A real visit through a creator link. No invented counts anywhere. */
export const recordCreatorClick = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ handle: z.string().trim().max(40), source: z.enum(["profile", "link"]) })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const handle = normaliseHandle(data.handle);
    if (!handle) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin
      .from("creators")
      .select("id, status")
      .eq("handle", handle)
      .maybeSingle();
    const creator = res.data as { id: string; status: string } | null;
    if (!creator || creator.status !== "approved") return { ok: false };
    await supabaseAdmin
      .from("creator_clicks")
      .insert({ creator_id: creator.id, source: data.source });
    return { ok: true };
  });

/**
 * Attribute the signed-in traveller to the creator whose link or code they
 * arrived with: 90 days to sign up, then 12 months of earning from that point.
 */
export const attributeCreator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().trim().max(60) }).parse(input))
  .handler(async ({ context, data }): Promise<{ attributed: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ATTRIBUTION_DAYS, loadCommissionRules } = await import("@/lib/creators.server");

    const handle = normaliseHandle(data.token);
    const code = normaliseCreatorCode(data.token);
    let creator: { id: string; user_id: string } | null = null;

    if (handle) {
      const byHandle = await supabaseAdmin
        .from("creators")
        .select("id, user_id, status")
        .eq("handle", handle)
        .eq("status", "approved")
        .maybeSingle();
      creator = (byHandle.data as { id: string; user_id: string } | null) ?? null;
    }
    if (!creator && code) {
      const byCode = await supabaseAdmin
        .from("creators")
        .select("id, user_id, status")
        .eq("short_code", code)
        .eq("status", "approved")
        .maybeSingle();
      creator = (byCode.data as { id: string; user_id: string } | null) ?? null;
    }
    // Your own link attributes nothing.
    if (!creator || creator.user_id === context.userId) return { attributed: false };

    const existing = await supabaseAdmin
      .from("creator_attributions")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing.data) return { attributed: false };

    const rules = await loadCommissionRules(supabaseAdmin as never);
    const months = rules[0]?.earning_window_months ?? 12;
    const now = new Date();
    const res = await supabaseAdmin.from("creator_attributions").insert({
      user_id: context.userId,
      creator_id: creator.id,
      code: handle || code,
      attributed_at: now.toISOString(),
      attribution_expires_at: new Date(now.getTime() + ATTRIBUTION_DAYS * 86_400_000).toISOString(),
      earning_until: new Date(
        now.getTime() + Math.round(months * 30.44) * 86_400_000,
      ).toISOString(),
    });
    return { attributed: !res.error };
  });
