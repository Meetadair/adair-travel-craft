/** Help requests from signed-in customers, with the trip attached automatically. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SUPPORT_CATEGORIES = [
  { value: "change", label: "Change my trip" },
  { value: "cancel", label: "Cancel my trip" },
  { value: "airport", label: "Problem at the airport" },
  { value: "payment", label: "Payment" },
  { value: "other", label: "Something else" },
] as const;

export const SUPPORT_URGENCIES = [
  { value: "normal", label: "Not urgent" },
  { value: "soon", label: "Travelling soon" },
  { value: "now", label: "I am travelling right now" },
] as const;

export type SupportRequest = {
  id: string;
  tripId: string | null;
  tripReference: string | null;
  category: string;
  urgency: string;
  description: string;
  status: string;
  createdAt: string;
};

const createSchema = z.object({
  tripId: z.string().uuid().nullable().default(null),
  category: z.enum(["change", "cancel", "airport", "payment", "other"]).default("other"),
  urgency: z.enum(["normal", "soon", "now"]).default("normal"),
  description: z.string().trim().min(5).max(4000),
});

type Row = Record<string, unknown>;

const toRequest = (row: Row): SupportRequest => ({
  id: row["id"] as string,
  tripId: (row["trip_id"] as string | null) ?? null,
  tripReference: (row["trip_reference"] as string | null) ?? null,
  category: row["category"] as string,
  urgency: row["urgency"] as string,
  description: (row["description"] as string) ?? "",
  status: row["status"] as string,
  createdAt: row["created_at"] as string,
});

export const createSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string; emailed: boolean }> => {
    const { supabase, userId } = context;

    let tripReference: string | null = null;
    let tripTitle: string | null = null;
    if (data.tripId) {
      const trip = await supabase
        .from("trips")
        .select("document_number, title")
        .eq("user_id", userId)
        .eq("id", data.tripId)
        .maybeSingle();
      tripReference = (trip.data?.["document_number"] as string | null) ?? null;
      tripTitle = (trip.data?.["title"] as string | null) ?? null;
    }

    const contactEmail = (context.claims as { email?: string } | null)?.email ?? null;

    const res = await supabase
      .from("support_requests")
      .insert({
        user_id: userId,
        trip_id: data.tripId,
        trip_reference: tripReference,
        category: data.category,
        urgency: data.urgency,
        description: data.description,
        contact_email: contactEmail,
      })
      .select("id")
      .single();
    if (res.error) throw new Error(res.error.message);

    const { notifySupport } = await import("@/lib/support-email.server");
    const mailed = await notifySupport({
      id: (res.data as { id: string }).id,
      category: data.category,
      urgency: data.urgency,
      description: data.description,
      tripReference,
      tripTitle,
      contactEmail,
    });

    await supabase.from("audit_log").insert({
      actor: userId,
      action: "support.created",
      entity: `support_request:${(res.data as { id: string }).id}`,
      after: { category: data.category, urgency: data.urgency, trip_reference: tripReference },
    });

    return { id: (res.data as { id: string }).id, emailed: mailed.sent };
  });

export const listMySupportRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SupportRequest[]> => {
    const res = await context.supabase
      .from("support_requests")
      .select("id, trip_id, trip_reference, category, urgency, description, status, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (res.error) throw new Error(res.error.message);
    return ((res.data ?? []) as Row[]).map(toRequest);
  });
