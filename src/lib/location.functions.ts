/**
 * The one thing we keep about location: whether they said yes.
 *
 * No coordinate is ever stored. The answer to the permission question is a
 * preference, so a refusal is remembered and never asked again.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LOCATION_CONSENTS, asConsent, type LocationConsent } from "@/lib/agent/location";

const inputSchema = z.object({
  consent: z.enum(LOCATION_CONSENTS as [LocationConsent, ...LocationConsent[]]),
});

export const setLocationConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ consent: LocationConsent }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("preferences")
      .upsert({ user_id: userId, location_consent: data.consent }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { consent: data.consent };
  });

export const getLocationConsent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ consent: LocationConsent }> => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("preferences")
      .select("location_consent")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      consent: asConsent((res.data as Record<string, unknown> | null)?.["location_consent"]),
    };
  });
