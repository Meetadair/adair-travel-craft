/**
 * "People I travel with" — the account holder's own traveller profile plus
 * anyone saved for reuse on later bookings (spouse, kids, colleagues). One
 * table, one set of rules, per the comment on the traveller_profiles
 * migration: a person is a person, whether they are the account holder or
 * someone they fly with.
 *
 * Names, date of birth, passport number, phone, email and address are
 * encrypted at rest with the same key as the loyalty wallet; only the last
 * four passport digits are kept in the clear so the traveller can recognise
 * which document is stored without decrypting it.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Relationship =
  "self" | "spouse" | "partner" | "child" | "parent" | "sibling" | "colleague" | "friend" | "other";

export type Traveller = {
  id: string;
  isSelf: boolean;
  relationship: Relationship | null;
  label: string;
  givenName: string;
  familyName: string;
  title: "mr" | "ms" | "mrs" | "dr" | "mx" | null;
  gender: "m" | "f" | "x" | null;
  bornOn: string | null;
  email: string | null;
  phone: string | null;
  passportLast4: string | null;
  passportNumber: string | null;
  documentType: "passport" | "national_id";
  passportCountry: string | null;
  passportExpiry: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressPostcode: string | null;
  addressCountry: string | null;
};

const RELATIONSHIPS = [
  "self",
  "spouse",
  "partner",
  "child",
  "parent",
  "sibling",
  "colleague",
  "friend",
  "other",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const travellerSchema = z.object({
  id: z.string().uuid().optional(),
  isSelf: z.boolean().default(false),
  relationship: z.enum(RELATIONSHIPS).nullable().optional(),
  givenName: z.string().trim().min(1).max(60),
  familyName: z.string().trim().min(1).max(60),
  title: z.enum(["mr", "ms", "mrs", "dr", "mx"]).nullable().optional(),
  gender: z.enum(["m", "f", "x"]).nullable().optional(),
  bornOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  email: z
    .string()
    .trim()
    .email()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  phone: optionalText(30),
  /** Which document the number below is. Airlines only ever get a passport. */
  documentType: z.enum(["passport", "national_id"]).default("passport"),
  passportNumber: optionalText(40),
  passportCountry: optionalText(2),
  passportExpiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  addressLine1: optionalText(120),
  addressLine2: optionalText(120),
  addressCity: optionalText(80),
  addressPostcode: optionalText(20),
  addressCountry: optionalText(2),
});

type TravellerRow = {
  id: string;
  is_self: boolean;
  relationship: string | null;
  label: string;
  given_name_encrypted: string;
  family_name_encrypted: string;
  title: string | null;
  gender: string | null;
  born_on_encrypted: string | null;
  email_encrypted: string | null;
  phone_encrypted: string | null;
  passport_number_encrypted: string | null;
  passport_last4: string | null;
  document_type: string | null;
  passport_country: string | null;
  passport_expiry: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_postcode: string | null;
  address_country: string | null;
};

const SELECT_COLUMNS =
  "id, is_self, relationship, label, given_name_encrypted, family_name_encrypted, title, gender, " +
  "born_on_encrypted, email_encrypted, phone_encrypted, passport_number_encrypted, passport_last4, " +
  "document_type, passport_country, passport_expiry, address_line1, address_line2, address_city, address_postcode, address_country";

async function decryptRow(row: TravellerRow): Promise<Traveller | null> {
  const { decryptSecret } = await import("@/lib/loyalty/crypto.server");
  try {
    return {
      id: row.id,
      isSelf: row.is_self,
      relationship: (row.relationship as Relationship | null) ?? (row.is_self ? "self" : null),
      label: row.label,
      givenName: await decryptSecret(row.given_name_encrypted),
      familyName: await decryptSecret(row.family_name_encrypted),
      title: row.title as Traveller["title"],
      gender: row.gender as Traveller["gender"],
      bornOn: row.born_on_encrypted ? await decryptSecret(row.born_on_encrypted) : null,
      email: row.email_encrypted ? await decryptSecret(row.email_encrypted) : null,
      phone: row.phone_encrypted ? await decryptSecret(row.phone_encrypted) : null,
      passportNumber: row.passport_number_encrypted
        ? await decryptSecret(row.passport_number_encrypted)
        : null,
      passportLast4: row.passport_last4,
      documentType: row.document_type === "national_id" ? "national_id" : "passport",
      passportCountry: row.passport_country,
      passportExpiry: row.passport_expiry,
      addressLine1: row.address_line1,
      addressLine2: row.address_line2,
      addressCity: row.address_city,
      addressPostcode: row.address_postcode,
      addressCountry: row.address_country,
    };
  } catch {
    // A row we can no longer read is skipped rather than breaking the list.
    return null;
  }
}

/** The account holder first, then everyone they fly with. */
export const listTravellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Traveller[]> => {
    const { data } = await context.supabase
      .from("travel_companions")
      .select(SELECT_COLUMNS)
      .eq("user_id", context.userId)
      .order("is_self", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const rows = (data ?? []) as unknown as TravellerRow[];
    const decrypted = await Promise.all(rows.map(decryptRow));
    return decrypted.filter((t): t is Traveller => t !== null);
  });

/**
 * Creates or updates one traveller. The account holder's own row is found by
 * is_self rather than id where possible, so "save my details" always lands
 * on the same row instead of accumulating duplicate selves.
 */
export const saveTraveller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => travellerSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { encryptSecret } = await import("@/lib/loyalty/crypto.server");
    const passport = data.passportNumber?.trim() || null;

    const row = {
      user_id: context.userId,
      is_self: data.isSelf,
      relationship: data.isSelf ? "self" : (data.relationship ?? null),
      label: `${data.givenName} ${data.familyName}`.trim(),
      given_name_encrypted: await encryptSecret(data.givenName),
      family_name_encrypted: await encryptSecret(data.familyName),
      title: data.title ?? null,
      gender: data.gender ?? null,
      born_on_encrypted: data.bornOn ? await encryptSecret(data.bornOn) : null,
      email_encrypted: data.email ? await encryptSecret(data.email) : null,
      phone_encrypted: data.phone ? await encryptSecret(data.phone) : null,
      passport_number_encrypted: passport ? await encryptSecret(passport) : null,
      passport_last4: passport ? passport.slice(-4) : null,
      document_type: data.documentType,
      passport_country: data.passportCountry ?? null,
      passport_expiry: data.passportExpiry ?? null,
      address_line1: data.addressLine1 ?? null,
      address_line2: data.addressLine2 ?? null,
      address_city: data.addressCity ?? null,
      address_postcode: data.addressPostcode ?? null,
      address_country: data.addressCountry ?? null,
    };

    let targetId = data.id ?? null;
    if (data.isSelf && !targetId) {
      const { data: existingSelf } = await context.supabase
        .from("travel_companions")
        .select("id")
        .eq("user_id", context.userId)
        .eq("is_self", true)
        .maybeSingle();
      targetId = (existingSelf as { id: string } | null)?.id ?? null;
    }

    if (targetId) {
      const { error } = await context.supabase
        .from("travel_companions")
        .update(row)
        .eq("id", targetId)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: targetId };
    }

    const { data: inserted, error } = await context.supabase
      .from("travel_companions")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

export const deleteTraveller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    // The account holder's own row is never deletable from here — it comes
    // and goes with the account, not with a "remove companion" click.
    await context.supabase
      .from("travel_companions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("is_self", false);
    return { ok: true };
  });

// Back-compat aliases: the booking page pre-fills passenger forms from this
// same table under its older name. Kept so unrelated call sites don't need
// touching in the same change as the new profile screen.
export const listCompanions = listTravellers;
export type Companion = Traveller;
