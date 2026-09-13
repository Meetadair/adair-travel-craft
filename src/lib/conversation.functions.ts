/**
 * What Adair knows about this traveller's setup, so it can suggest the one
 * thing that would make next time easier — and nothing else.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ConversationContext = {
  calendarConnected: boolean;
  loyaltyCount: number;
  hasDefaultCompany: boolean;
};

export const getConversationContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConversationContext> => {
    const { supabase, userId } = context;
    const [calendars, loyalty, companies] = await Promise.all([
      supabase
        .from("calendar_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("loyalty_memberships")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase.from("companies").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    return {
      calendarConnected: (calendars.count ?? 0) > 0,
      loyaltyCount: loyalty.count ?? 0,
      hasDefaultCompany: (companies.count ?? 0) > 0,
    };
  });
