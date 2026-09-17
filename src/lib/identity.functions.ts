/**
 * Ticket details for the lead traveller.
 *
 * Asked once in the chat, remembered afterwards, so closing a booking in the
 * conversation needs no form on the next trip.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BookingIdentity = {
  givenName: string;
  familyName: string;
  email: string;
  phone: string;
  bornOn: string;
  gender: "m" | "f";
  title: "mr" | "ms" | "mrs";
  /** Everything the airline needs is on file. */
  complete: boolean;
};

const EMPTY: BookingIdentity = {
  givenName: "",
  familyName: "",
  email: "",
  phone: "",
  bornOn: "",
  gender: "m",
  title: "mr",
  complete: false,
};

const isComplete = (identity: Omit<BookingIdentity, "complete">) =>
  identity.givenName.trim().length > 0 &&
  identity.familyName.trim().length > 0 &&
  /.+@.+\..+/.test(identity.email) &&
  identity.phone.trim().length >= 6 &&
  /^\d{4}-\d{2}-\d{2}$/.test(identity.bornOn);

export const getBookingIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BookingIdentity> => {
    const { supabase, userId, claims } = context;
    const res = await supabase
      .from("profiles")
      .select(
        "full_name, traveller_given_name, traveller_family_name, traveller_email, traveller_phone, traveller_born_on, traveller_gender, traveller_title",
      )
      .eq("id", userId)
      .maybeSingle();
    const row = (res.data ?? null) as Record<string, unknown> | null;
    const fullName = ((row?.["full_name"] as string | null) ?? "").trim();
    const [firstFromName = "", ...restOfName] = fullName.split(/\s+/);

    const identity = {
      givenName: ((row?.["traveller_given_name"] as string | null) ?? firstFromName) || "",
      familyName: ((row?.["traveller_family_name"] as string | null) ?? restOfName.join(" ")) || "",
      email:
        ((row?.["traveller_email"] as string | null) ??
          (claims as { email?: string } | null)?.email ??
          "") ||
        "",
      phone: (row?.["traveller_phone"] as string | null) ?? "",
      bornOn: (row?.["traveller_born_on"] as string | null) ?? "",
      gender: ((row?.["traveller_gender"] as string | null) ?? "m") as "m" | "f",
      title: ((row?.["traveller_title"] as string | null) ?? "mr") as "mr" | "ms" | "mrs",
    };

    if (!row) return { ...EMPTY, email: identity.email };
    return { ...identity, complete: isComplete(identity) };
  });

const identitySchema = z.object({
  givenName: z.string().trim().min(1).max(60),
  familyName: z.string().trim().min(1).max(60),
  email: z.string().trim().email(),
  phone: z.string().trim().min(6).max(25),
  bornOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(["m", "f"]),
  title: z.enum(["mr", "ms", "mrs"]),
});

export const saveBookingIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => identitySchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const res = await supabase.from("profiles").upsert({
      id: userId,
      traveller_given_name: data.givenName,
      traveller_family_name: data.familyName,
      traveller_email: data.email,
      traveller_phone: data.phone,
      traveller_born_on: data.bornOn,
      traveller_gender: data.gender,
      traveller_title: data.title,
    });
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

/** Saves a company from one typed name, so the invoice question is asked once. */
export const saveInvoiceCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().trim().min(2).max(120) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string; name: string }> => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("companies")
      .insert({ user_id: userId, name: data.name, is_default: true })
      .select("id, name")
      .single();
    if (res.error) throw new Error(res.error.message);
    const row = res.data as { id: string; name: string };
    return { id: row.id, name: row.name };
  });
