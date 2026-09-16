/**
 * GDPR: export everything we hold on the signed-in customer, and close the account.
 * Card details are never stored, so they can never appear in an export.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DataExport = {
  generatedAt: string;
  userId: string;
  summary: string[];
  /** The full export as pretty-printed JSON, ready to save as a file. */
  json: string;
};

const TABLES: Array<{ table: string; column: string }> = [
  { table: "profiles", column: "id" },
  { table: "preferences", column: "user_id" },
  { table: "companies", column: "user_id" },
  { table: "trips", column: "user_id" },
  { table: "trip_items", column: "user_id" },
  { table: "trip_requests", column: "user_id" },
  { table: "trip_cards", column: "user_id" },
  { table: "payments", column: "user_id" },
  { table: "calendar_connections", column: "user_id" },
  { table: "calendar_trip_hints", column: "user_id" },
  { table: "credits", column: "user_id" },
  { table: "referrals", column: "referrer_id" },
  { table: "choice_feedback", column: "user_id" },
  { table: "trip_feedback", column: "user_id" },
  { table: "support_requests", column: "user_id" },
  { table: "events", column: "user_id" },
  { table: "saved_cards", column: "user_id" },
  { table: "loyalty_memberships", column: "user_id" },
  { table: "traveller_place_memory", column: "user_id" },
  { table: "traveller_patterns", column: "user_id" },
];

/** Columns we must never hand back, even though we store a reference. */
const REDACT = new Set([
  "access_token",
  "refresh_token",
  "token",
  "provider_card_id",
  "member_number_encrypted",
]);

function scrub(rows: unknown): unknown {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    return Object.fromEntries(
      Object.entries(row as Record<string, unknown>).map(([key, value]) =>
        REDACT.has(key) ? [key, value ? "[removed from export]" : null] : [key, value],
      ),
    );
  });
}

export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DataExport> => {
    const { supabase, userId } = context;
    const data: Record<string, unknown> = {};

    for (const { table, column } of TABLES) {
      const res = await supabase.from(table as never).select("*").eq(column, userId);
      data[table] = res.error ? { error: res.error.message } : scrub(res.data);
    }

    const count = (key: string) => (Array.isArray(data[key]) ? (data[key] as unknown[]).length : 0);
    const summary = [
      `Export created ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.`,
      `Trips: ${count("trips")} · booked items: ${count("trip_items")}`,
      `Payments recorded: ${count("payments")} — card numbers are never stored, so none appear here.`,
      `Invoice companies: ${count("companies")}`,
      `Saved travel preferences: ${count("preferences") ? "yes" : "no"}`,
      `Calendar connections: ${count("calendar_connections")} · calendar trip hints: ${count("calendar_trip_hints")}`,
      `Credits: ${count("credits")} · referrals: ${count("referrals")}`,
      `Choices you corrected: ${count("choice_feedback")} · help requests: ${count("support_requests")}`,
      `Activity log entries: ${count("events")}`,
    ];

    await supabase.from("audit_log").insert({
      actor: userId,
      action: "gdpr.export",
      entity: `user:${userId}`,
      after: { tables: TABLES.map((t) => t.table) },
    });

    return {
      generatedAt: new Date().toISOString(),
      userId,
      summary,
      json: JSON.stringify({ generatedAt: new Date().toISOString(), userId, data }, null, 2),
    };
  });

export type DeletionResult = {
  ok: boolean;
  keptForTax: number;
  note: string;
};

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeletionResult> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const paid = await supabase.from("payments").select("id").eq("user_id", userId);
    const keptForTax = paid.data?.length ?? 0;

    // Personal data we have no reason to keep.
    const wipe = [
      "calendar_trip_hints",
      "calendar_connections",
      "calendar_feeds",
      "calendar_oauth_states",
      "choice_feedback",
      "traveller_place_memory",
      "traveller_patterns",
      "saved_cards",
      "loyalty_memberships",
      "preferences",
      "getaway_proposals",
      "getaway_theme_optouts",
      "events",
    ];
    for (const table of wipe) {
      await supabaseAdmin.from(table as never).delete().eq("user_id", userId);
    }

    // Records kept for tax and supplier reasons: keep the amounts, remove the person.
    await supabaseAdmin
      .from("companies")
      .update({
        name: "Deleted account",
        vat_id: null,
        address: null,
        street: null,
        building: null,
        address_extra: null,
        city: null,
        postcode: null,
        invoice_email: null,
        invoice_emails: [],
      })
      .eq("user_id", userId);
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: "Deleted account",
        company: null,
        tax_id: null,
        preferred_airlines: null,
        hotel_chains: null,
        diet: null,
      })
      .eq("id", userId);
    await supabaseAdmin
      .from("support_requests")
      .update({ contact_email: null, description: "[removed at the customer's request]" })
      .eq("user_id", userId);

    await supabaseAdmin.from("audit_log").insert({
      actor: userId,
      action: "gdpr.delete_account",
      entity: `user:${userId}`,
      after: { kept_for_tax: keptForTax },
    });

    // The sign-in itself is closed; the anonymised rows stay attached to it.
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: `deleted-${userId}@adair.invalid`,
      user_metadata: {},
      ban_duration: "876000h",
    });

    return {
      ok: true,
      keptForTax,
      note: "Anything already booked stays with the supplier — cancel those bookings first if you still need to.",
    };
  });
