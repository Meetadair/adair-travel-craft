import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const joinSchema = z.object({
  email: z.string().email().max(200),
  sentence: z.string().max(1000).optional(),
  referralCode: z.string().min(4).max(24),
  type: z.enum(["early_access", "teams"]),
});

/**
 * Stores an early-access / Teams waitlist sign-up. Public on purpose: the table
 * is write-only from the app (no read policies), so nothing can be read back.
 */
export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => joinSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("waitlist").insert({
      email: data.email.trim().toLowerCase(),
      sentence: data.sentence?.trim() || null,
      referral_code: data.referralCode,
      type: data.type,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
