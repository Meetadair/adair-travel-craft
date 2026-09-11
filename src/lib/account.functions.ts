/** Signed-in account: profile, travel preferences, invoice companies. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Preferences = {
  seat: string;
  cabinClass: string;
  maxConnections: number;
  hotelMinRating: number;
  hotelRules: string | null;
  carTransmission: string;
};

export type Company = {
  id: string;
  name: string;
  vatId: string | null;
  address: string | null;
  invoiceEmail: string | null;
  isDefault: boolean;
};

export type Account = {
  userId: string;
  fullName: string | null;
  homeAirport: string;
  plan: string;
  onboarded: boolean;
  preferences: Preferences;
  companies: Company[];
};

const DEFAULT_PREFS: Preferences = {
  seat: "window",
  cabinClass: "economy",
  maxConnections: 1,
  hotelMinRating: 4,
  hotelRules: null,
  carTransmission: "automatic",
};

export const getAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Account> => {
    const { supabase, userId } = context;

    const [profileRes, prefsRes, companiesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, home_airport, plan, onboarded")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("preferences")
        .select("seat, cabin_class, max_connections, hotel_min_rating, hotel_rules, car_transmission")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("companies")
        .select("id, name, vat_id, address, invoice_email, is_default")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ]);

    const profile = profileRes.data as
      | { full_name: string | null; home_airport: string; plan: string; onboarded: boolean }
      | null;
    const prefs = prefsRes.data as
      | {
          seat: string;
          cabin_class: string;
          max_connections: number;
          hotel_min_rating: number;
          hotel_rules: string | null;
          car_transmission: string;
        }
      | null;

    return {
      userId,
      fullName: profile?.full_name ?? null,
      homeAirport: profile?.home_airport ?? "WAW",
      plan: profile?.plan ?? "free",
      onboarded: profile?.onboarded ?? false,
      preferences: prefs
        ? {
            seat: prefs.seat,
            cabinClass: prefs.cabin_class,
            maxConnections: prefs.max_connections,
            hotelMinRating: Number(prefs.hotel_min_rating),
            hotelRules: prefs.hotel_rules,
            carTransmission: prefs.car_transmission,
          }
        : DEFAULT_PREFS,
      companies: ((companiesRes.data ?? []) as Array<{
        id: string;
        name: string;
        vat_id: string | null;
        address: string | null;
        invoice_email: string | null;
        is_default: boolean;
      }>).map((c) => ({
        id: c.id,
        name: c.name,
        vatId: c.vat_id,
        address: c.address,
        invoiceEmail: c.invoice_email,
        isDefault: c.is_default,
      })),
    };
  });

const onboardingSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  homeAirport: z.string().trim().regex(/^[A-Za-z]{3}$/),
  preferences: z.object({
    seat: z.enum(["window", "aisle", "any"]),
    cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
    maxConnections: z.number().int().min(0).max(3),
    hotelMinRating: z.number().min(0).max(5),
    hotelRules: z.string().trim().max(500).nullable(),
    carTransmission: z.enum(["automatic", "manual", "any"]),
  }),
  company: z
    .object({
      name: z.string().trim().min(1).max(160),
      vatId: z.string().trim().max(40).nullable(),
      address: z.string().trim().max(300).nullable(),
      invoiceEmail: z.string().trim().email().nullable(),
    })
    .nullable(),
  complete: z.boolean().default(true),
});

export const saveOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => onboardingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const profile = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        full_name: data.fullName,
        home_airport: data.homeAirport.toUpperCase(),
        onboarded: data.complete,
      })
      .select("id")
      .single();
    if (profile.error) throw new Error(profile.error.message);

    const prefs = await supabase.from("preferences").upsert({
      user_id: userId,
      seat: data.preferences.seat,
      cabin_class: data.preferences.cabinClass,
      max_connections: data.preferences.maxConnections,
      hotel_min_rating: data.preferences.hotelMinRating,
      hotel_rules: data.preferences.hotelRules,
      car_transmission: data.preferences.carTransmission,
    });
    if (prefs.error) throw new Error(prefs.error.message);

    if (data.company) {
      const existing = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", userId)
        .limit(1);
      const isFirst = !existing.data?.length;
      const inserted = await supabase.from("companies").insert({
        user_id: userId,
        name: data.company.name,
        vat_id: data.company.vatId,
        address: data.company.address,
        invoice_email: data.company.invoiceEmail,
        is_default: isFirst,
      });
      if (inserted.error) throw new Error(inserted.error.message);
    }

    return { ok: true };
  });

const companySchema = z.object({
  name: z.string().trim().min(1).max(160),
  vatId: z.string().trim().max(40).nullable(),
  address: z.string().trim().max(300).nullable(),
  invoiceEmail: z.string().trim().email().nullable(),
  isDefault: z.boolean().default(false),
});

export const addCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => companySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.isDefault) {
      await supabase.from("companies").update({ is_default: false }).eq("user_id", userId);
    }
    const res = await supabase
      .from("companies")
      .insert({
        user_id: userId,
        name: data.name,
        vat_id: data.vatId,
        address: data.address,
        invoice_email: data.invoiceEmail,
        is_default: data.isDefault,
      })
      .select("id")
      .single();
    if (res.error) throw new Error(res.error.message);
    return { id: (res.data as { id: string }).id };
  });

export const setDefaultCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("companies").update({ is_default: false }).eq("user_id", userId);
    const res = await supabase
      .from("companies")
      .update({ is_default: true })
      .eq("user_id", userId)
      .eq("id", data.id);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export const deleteCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("companies")
      .delete()
      .eq("user_id", context.userId)
      .eq("id", data.id);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export const savePreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => onboardingSchema.shape.preferences.parse(input))
  .handler(async ({ data, context }) => {
    const res = await context.supabase.from("preferences").upsert({
      user_id: context.userId,
      seat: data.seat,
      cabin_class: data.cabinClass,
      max_connections: data.maxConnections,
      hotel_min_rating: data.hotelMinRating,
      hotel_rules: data.hotelRules,
      car_transmission: data.carTransmission,
    });
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });
