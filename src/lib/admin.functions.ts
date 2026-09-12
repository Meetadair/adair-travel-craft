/**
 * Admin surface: everything Andrzej needs to change without a developer.
 * Every handler re-checks the admin flag through the caller's own session, so
 * the service-role client is only reached after that check passes.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

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

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type AnalyticsReport = Record<string, Json>;

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AnalyticsReport> => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("admin_analytics");
    if (error) throw new Error(error.message);
    return (data ?? {}) as AnalyticsReport;
  });

export type PricingRuleRow = {
  id: string;
  plan: string;
  line_type: string;
  markup_bps: number;
  discount_bps: number;
  change_fee_minor: number;
  currency: string;
};

export type ProviderRow = {
  id: string;
  category: string;
  provider: string;
  label: string;
  enabled: boolean;
  priority: number;
};

export type AdminBooking = {
  id: string;
  title: string;
  status: string;
  total_amount: number;
  currency: string;
  booked_at: string | null;
  user_email: string | null;
};

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  plan: string;
  is_admin: boolean;
  onboarded: boolean;
  preferences_filled: number;
};

export type AdminErrorRow = {
  id: string;
  message: string;
  route: string | null;
  created_at: string;
};

export type AdminOverview = {
  pricingRules: PricingRuleRow[];
  providers: ProviderRow[];
  bookings: AdminBooking[];
  users: AdminUser[];
  errors: AdminErrorRow[];
  secrets: Array<{ name: string; configured: boolean }>;
};

const SECRET_NAMES = [
  "DUFFEL_API_KEY",
  "ANTHROPIC_API_KEY",
  "LOVABLE_API_KEY",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "GOOGLE_CALENDAR_CLIENT_ID",
  "MICROSOFT_CALENDAR_CLIENT_ID",
  "THEFORK_API_KEY",
  "OPENTABLE_API_KEY",
  "UBER_API_KEY",
  "BOLT_API_KEY",
];

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();

    const [rules, providers, trips, profiles, errors] = await Promise.all([
      sb
        .from("pricing_rules")
        .select("id, plan, line_type, markup_bps, discount_bps, change_fee_minor, currency")
        .order("plan")
        .order("line_type"),
      sb
        .from("providers")
        .select("id, category, provider, label, enabled, priority")
        .order("category")
        .order("priority"),
      sb
        .from("trips")
        .select("id, user_id, title, status, total_amount, currency, booked_at")
        .order("created_at", { ascending: false })
        .limit(100),
      sb
        .from("profiles")
        .select("id, full_name, plan, is_admin, onboarded")
        .order("created_at", { ascending: false })
        .limit(200),
      sb
        .from("error_log")
        .select("id, message, route, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const emails = new Map<string, string | null>();
    try {
      const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
      for (const user of data?.users ?? []) emails.set(user.id, user.email ?? null);
    } catch {
      // Email display is a nicety; the panel still works without it.
    }

    const prefs = await sb
      .from("preferences")
      .select("user_id, airlines, hotel_chains, hotel_amenities, car_brands, cuisines, interests, music, budget_band");
    const filled = new Map<string, number>();
    for (const row of prefs.data ?? []) {
      const record = row as Record<string, unknown>;
      const keys = [
        "airlines",
        "hotel_chains",
        "hotel_amenities",
        "car_brands",
        "cuisines",
        "interests",
        "music",
      ];
      const count =
        keys.filter((key) => Array.isArray(record[key]) && (record[key] as unknown[]).length > 0)
          .length + (record["budget_band"] ? 1 : 0);
      filled.set(String(record["user_id"]), Math.round((count / 8) * 100));
    }

    return {
      pricingRules: (rules.data ?? []) as PricingRuleRow[],
      providers: (providers.data ?? []) as ProviderRow[],
      bookings: ((trips.data ?? []) as Array<Record<string, unknown>>).map((trip) => ({
        id: String(trip["id"]),
        title: String(trip["title"]),
        status: String(trip["status"]),
        total_amount: Number(trip["total_amount"] ?? 0),
        currency: String(trip["currency"] ?? "EUR"),
        booked_at: (trip["booked_at"] as string | null) ?? null,
        user_email: emails.get(String(trip["user_id"])) ?? null,
      })),
      users: ((profiles.data ?? []) as Array<Record<string, unknown>>).map((profile) => ({
        id: String(profile["id"]),
        email: emails.get(String(profile["id"])) ?? null,
        full_name: (profile["full_name"] as string | null) ?? null,
        plan: String(profile["plan"] ?? "free"),
        is_admin: Boolean(profile["is_admin"]),
        onboarded: Boolean(profile["onboarded"]),
        preferences_filled: filled.get(String(profile["id"])) ?? 0,
      })),
      errors: (errors.data ?? []) as AdminErrorRow[],
      secrets: SECRET_NAMES.map((name) => ({
        name,
        configured: Boolean(process.env[name]),
      })),
    };
  });

async function writeAudit(
  sb: SupabaseClient,
  actor: string,
  action: string,
  entity: string,
  before: unknown,
  after: unknown,
) {
  await sb.from("audit_log").insert({
    actor,
    action,
    entity,
    before: before as never,
    after: after as never,
  });
}

export const savePricingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        markupBps: z.number().int().min(0).max(20000),
        discountBps: z.number().int().min(0).max(20000),
        changeFeeMinor: z.number().int().min(0).max(1000000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const before = await sb.from("pricing_rules").select("*").eq("id", data.id).maybeSingle();
    const { error } = await sb
      .from("pricing_rules")
      .update({
        markup_bps: data.markupBps,
        discount_bps: data.discountBps,
        change_fee_minor: data.changeFeeMinor,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "pricing_rule.update", `pricing_rules:${data.id}`, before.data, {
      markup_bps: data.markupBps,
      discount_bps: data.discountBps,
      change_fee_minor: data.changeFeeMinor,
    });
    return { ok: true };
  });

export const setProviderEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb.from("providers").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "provider.toggle", `providers:${data.id}`, null, {
      enabled: data.enabled,
    });
    return { ok: true };
  });

export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), isAdmin: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb
      .from("profiles")
      .update({ is_admin: data.isAdmin })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await writeAudit(sb, context.userId, "user.admin_flag", `profiles:${data.userId}`, null, {
      is_admin: data.isAdmin,
    });
    return { ok: true };
  });

export type AdminTripDetail = {
  trip: Record<string, Json> | null;
  items: Array<Record<string, Json>>;
  payments: Array<Record<string, Json>>;
};

export const getAdminTrip = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tripId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<AdminTripDetail> => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const [trip, items, payments] = await Promise.all([
      sb.from("trips").select("*").eq("id", data.tripId).maybeSingle(),
      sb.from("trip_items").select("*").eq("trip_id", data.tripId).order("position"),
      sb.from("payments").select("*").eq("trip_id", data.tripId),
    ]);
    return {
      trip: (trip.data ?? null) as Record<string, Json> | null,
      items: (items.data ?? []) as Array<Record<string, Json>>,
      payments: (payments.data ?? []) as Array<Record<string, Json>>,
    };
  });

export const cancelTripAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ tripId: z.string().uuid(), reason: z.string().trim().max(200).optional() })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const before = await sb.from("trips").select("status").eq("id", data.tripId).maybeSingle();
    const { error } = await sb.from("trips").update({ status: "cancelled" }).eq("id", data.tripId);
    if (error) throw new Error(error.message);
    await sb.from("trip_items").update({ status: "cancelled" }).eq("trip_id", data.tripId);
    await sb.from("events").insert({
      name: "booking_cancelled",
      user_id: context.userId,
      props: { reason: data.reason ?? "", trip_id: data.tripId } as never,
    });
    await writeAudit(sb, context.userId, "trip.cancel", `trips:${data.tripId}`, before.data, {
      status: "cancelled",
      reason: data.reason ?? "",
    });
    return { ok: true };
  });

export type WaitlistRow = {
  id: string;
  email: string;
  type: string;
  createdAt: string;
  invitedAt: string | null;
  inviteError: string | null;
  hasAccount: boolean;
};

/** Everyone waiting, newest first, with whether they already have an account. */
export const listWaitlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WaitlistRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const res = await sb
      .from("waitlist")
      .select("id, email, type, created_at, invited_at, invite_error, user_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (res.error) throw new Error(res.error.message);
    return ((res.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row['id']),
      email: String(row['email']),
      type: String(row['type']),
      createdAt: String(row['created_at']),
      invitedAt: (row['invited_at'] as string | null) ?? null,
      inviteError: (row['invite_error'] as string | null) ?? null,
      hasAccount: Boolean(row['user_id']),
    }));
  });

/**
 * Turns waiting sign-ups into real account invitations, so the waitlist and the
 * accounts stop drifting apart. Already-invited rows are skipped.
 */
export const inviteWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ invited: number; skipped: number; failed: number }> => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const res = await sb
      .from("waitlist")
      .select("id, email, invited_at, user_id")
      .in("id", data.ids);
    if (res.error) throw new Error(res.error.message);

    let invited = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of (res.data ?? []) as Array<{
      id: string;
      email: string;
      invited_at: string | null;
      user_id: string | null;
    }>) {
      if (row.invited_at || row.user_id) {
        skipped += 1;
        continue;
      }
      const result = await sb.auth.admin.inviteUserByEmail(row.email);
      if (result.error) {
        // Already registered counts as reconciled, not as a failure.
        const message = result.error.message;
        const known = /already/i.test(message);
        await sb
          .from("waitlist")
          .update({
            invited_at: known ? new Date().toISOString() : null,
            invite_error: known ? null : message,
          })
          .eq("id", row.id);
        if (known) invited += 1;
        else failed += 1;
      } else {
        await sb
          .from("waitlist")
          .update({
            invited_at: new Date().toISOString(),
            invite_error: null,
            user_id: result.data.user?.id ?? null,
          })
          .eq("id", row.id);
        invited += 1;
      }
    }

    await writeAudit(sb, context.userId, "waitlist.invite", "waitlist", null, {
      invited,
      skipped,
      failed,
    });
    return { invited, skipped, failed };
  });

/* ------------------------------ help requests ------------------------------ */

export type AdminSupportRequest = {
  id: string;
  category: string;
  urgency: string;
  status: string;
  description: string;
  createdAt: string;
  contactEmail: string | null;
  tripId: string | null;
  tripReference: string | null;
  tripTitle: string | null;
  tripStatus: string | null;
  tripDates: string | null;
  tripTotalEur: number | null;
};

export const listSupportRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminSupportRequest[]> => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data, error } = await db
      .from("support_requests")
      .select(
        "id, category, urgency, status, description, created_at, contact_email, trip_id, trip_reference, trips(title, status, start_date, end_date, total_amount)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const trip = (row["trips"] ?? null) as Record<string, unknown> | null;
      const start = (trip?.["start_date"] as string | null) ?? null;
      const end = (trip?.["end_date"] as string | null) ?? null;
      return {
        id: row["id"] as string,
        category: row["category"] as string,
        urgency: row["urgency"] as string,
        status: row["status"] as string,
        description: (row["description"] as string) ?? "",
        createdAt: row["created_at"] as string,
        contactEmail: (row["contact_email"] as string | null) ?? null,
        tripId: (row["trip_id"] as string | null) ?? null,
        tripReference: (row["trip_reference"] as string | null) ?? null,
        tripTitle: (trip?.["title"] as string | null) ?? null,
        tripStatus: (trip?.["status"] as string | null) ?? null,
        tripDates: start ? `${start}${end ? ` → ${end}` : ""}` : null,
        tripTotalEur: trip?.["total_amount"] == null ? null : Number(trip["total_amount"]),
      };
    });
  });

export const setSupportStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "in progress", "resolved"]),
        adminNote: z.string().trim().max(2000).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { error } = await db
      .from("support_requests")
      .update({ status: data.status, admin_note: data.adminNote })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, "support.status", `support_request:${data.id}`, null, {
      status: data.status,
    });
    return { ok: true };
  });
