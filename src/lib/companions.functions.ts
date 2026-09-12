/**
 * "People I travel with" — companions saved for reuse on later bookings.
 * Names, dates of birth and passport numbers are encrypted at rest with the
 * same key as the loyalty wallet; only the last four passport digits are kept
 * in the clear so the traveller can recognise which document is stored.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Companion = {
  id: string;
  label: string;
  givenName: string;
  familyName: string;
  bornOn: string | null;
  passportLast4: string | null;
};

const companionSchema = z.object({
  id: z.string().uuid().optional(),
  givenName: z.string().trim().min(1).max(60),
  familyName: z.string().trim().min(1).max(60),
  bornOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  passportNumber: z.string().trim().max(40).nullable().optional(),
});

export const listCompanions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Companion[]> => {
    const { decryptSecret } = await import("@/lib/loyalty/crypto.server");
    const { data } = await context.supabase
      .from("travel_companions")
      .select(
        "id, label, given_name_encrypted, family_name_encrypted, born_on_encrypted, passport_last4",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });

    const rows = (data ?? []) as Array<{
      id: string;
      label: string;
      given_name_encrypted: string;
      family_name_encrypted: string;
      born_on_encrypted: string | null;
      passport_last4: string | null;
    }>;

    const out: Companion[] = [];
    for (const row of rows) {
      try {
        out.push({
          id: row.id,
          label: row.label,
          givenName: await decryptSecret(row.given_name_encrypted),
          familyName: await decryptSecret(row.family_name_encrypted),
          bornOn: row.born_on_encrypted ? await decryptSecret(row.born_on_encrypted) : null,
          passportLast4: row.passport_last4,
        });
      } catch {
        // A row we can no longer read is skipped rather than breaking the list.
      }
    }
    return out;
  });

export const saveCompanion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => companionSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { encryptSecret } = await import("@/lib/loyalty/crypto.server");
    const passport = data.passportNumber?.trim() || null;
    const row = {
      user_id: context.userId,
      label: `${data.givenName} ${data.familyName}`.trim(),
      given_name_encrypted: await encryptSecret(data.givenName),
      family_name_encrypted: await encryptSecret(data.familyName),
      born_on_encrypted: data.bornOn ? await encryptSecret(data.bornOn) : null,
      passport_number_encrypted: passport ? await encryptSecret(passport) : null,
      passport_last4: passport ? passport.slice(-4) : null,
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("travel_companions")
        .update(row)
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: inserted, error } = await context.supabase
      .from("travel_companions")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

export const deleteCompanion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await context.supabase
      .from("travel_companions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });
