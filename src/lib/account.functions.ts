/** Signed-in account: profile, travel preferences, invoice companies. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_PREFS, type TravelPrefs } from "@/lib/prefs/questions";

export type Preferences = TravelPrefs;

export type Company = {
  id: string;
  name: string;
  legalForm: string | null;
  country: string | null;
  city: string | null;
  postcode: string | null;
  street: string | null;
  building: string | null;
  addressExtra: string | null;
  vatId: string | null;
  address: string | null;
  invoiceEmails: string[];
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
  /** Overrides for work trips. Empty object means business uses the base. */
  businessPrefs: BusinessPrefsPayload;
  companies: Company[];
};

const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

const asAnswerMap = (value: unknown): Record<string, string[]> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, asList(val)]),
  );
};

export type BusinessPrefsPayload = {
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  seat?: "window" | "aisle" | "any";
  maxConnections?: number;
  hotelTypes?: string[];
  hotelChains?: string[];
  hotelStars?: string[];
  hotelMinRating?: number;
  hotelAmenities?: string[];
  hotelMaxKm?: number | null;
  carClass?: string | null;
  carTransmission?: "automatic" | "manual" | "any";
  budgetBand?: string | null;
};

type PrefRow = Record<string, unknown>;

function rowToPrefs(row: PrefRow | null): TravelPrefs {
  if (!row) return DEFAULT_PREFS;
  return {
    seat: (row["seat"] as string) ?? DEFAULT_PREFS.seat,
    cabinClass: (row["cabin_class"] as string) ?? DEFAULT_PREFS.cabinClass,
    maxConnections: Number(row["max_connections"] ?? DEFAULT_PREFS.maxConnections),
    hotelMinRating: Number(row["hotel_min_rating"] ?? DEFAULT_PREFS.hotelMinRating),
    hotelRules: (row["hotel_rules"] as string | null) ?? null,
    carTransmission: (row["car_transmission"] as string) ?? DEFAULT_PREFS.carTransmission,
    tripPurpose: asList(row["trip_purpose"]),
    airlines: asList(row["airlines"]),
    cabinRule: (row["cabin_rule"] as string | null) ?? null,
    seatFront: Boolean(row["seat_front"]),
    seatLegroom: Boolean(row["seat_legroom"]),
    hotelTypes: asList(row["hotel_types"]),
    hotelChains: asList(row["hotel_chains"]),
    hotelStars: asList(row["hotel_stars"]),
    hotelRatingLevel: (row["hotel_rating_level"] as string | null) ?? null,
    hotelAmenities: asList(row["hotel_amenities"]),
    hotelMaxKm: row["hotel_max_km"] == null ? null : Number(row["hotel_max_km"]),
    carBrands: asList(row["car_brands"]),
    carClass: (row["car_class"] as string | null) ?? null,
    carNavigation: Boolean(row["car_navigation"]),
    carChildSeat: Boolean(row["car_child_seat"]),
    carCompanies: asList(row["car_companies"]),
    cuisines: asList(row["cuisines"]),
    diets: asList(row["diets"]),
    interests: asList(row["interests"]),
    music: asList(row["music"]),
    budgetBand: (row["budget_band"] as string | null) ?? null,
    dealbreakers: asList(row["dealbreakers"]),
    extraAnswers: asAnswerMap(row["extra_answers"]),
    accessibilityNote: (row["accessibility_note"] as string | null) ?? null,
    avoidNote: (row["avoid_note"] as string | null) ?? null,
  };
}

function prefsToRow(userId: string, p: TravelPrefs) {
  return {
    user_id: userId,
    seat: p.seat,
    cabin_class: p.cabinClass,
    max_connections: p.maxConnections,
    hotel_min_rating: p.hotelMinRating,
    hotel_rules: p.hotelRules,
    car_transmission: p.carTransmission,
    trip_purpose: p.tripPurpose,
    airlines: p.airlines,
    cabin_rule: p.cabinRule,
    seat_front: p.seatFront,
    seat_legroom: p.seatLegroom,
    hotel_types: p.hotelTypes,
    hotel_chains: p.hotelChains,
    hotel_stars: p.hotelStars,
    hotel_rating_level: p.hotelRatingLevel,
    hotel_amenities: p.hotelAmenities,
    hotel_max_km: p.hotelMaxKm,
    car_brands: p.carBrands,
    car_class: p.carClass,
    car_navigation: p.carNavigation,
    car_child_seat: p.carChildSeat,
    car_companies: p.carCompanies,
    cuisines: p.cuisines,
    diets: p.diets,
    interests: p.interests,
    music: p.music,
    budget_band: p.budgetBand,
    dealbreakers: p.dealbreakers,
    extra_answers: p.extraAnswers,
    accessibility_note: p.accessibilityNote,
    avoid_note: p.avoidNote,
  };
}

type CompanyRow = Record<string, unknown>;

function rowToCompany(row: CompanyRow): Company {
  const emails = asList(row["invoice_emails"]);
  const legacy = (row["invoice_email"] as string | null) ?? null;
  const all = emails.length ? emails : legacy ? [legacy] : [];
  return {
    id: row["id"] as string,
    name: row["name"] as string,
    legalForm: (row["legal_form"] as string | null) ?? null,
    country: (row["country"] as string | null) ?? null,
    city: (row["city"] as string | null) ?? null,
    postcode: (row["postcode"] as string | null) ?? null,
    street: (row["street"] as string | null) ?? null,
    building: (row["building"] as string | null) ?? null,
    addressExtra: (row["address_extra"] as string | null) ?? null,
    vatId: (row["vat_id"] as string | null) ?? null,
    address: (row["address"] as string | null) ?? null,
    invoiceEmails: all,
    invoiceEmail: all[0] ?? null,
    isDefault: Boolean(row["is_default"]),
  };
}

const COMPANY_COLUMNS =
  "id, name, legal_form, country, city, postcode, street, building, address_extra, vat_id, address, invoice_email, invoice_emails, is_default";

const PREF_COLUMNS =
  "seat, cabin_class, max_connections, hotel_min_rating, hotel_rules, car_transmission, trip_purpose, airlines, cabin_rule, seat_front, seat_legroom, hotel_types, hotel_chains, hotel_stars, hotel_rating_level, hotel_amenities, hotel_max_km, car_brands, car_class, car_navigation, car_child_seat, car_companies, cuisines, diets, interests, music, budget_band, dealbreakers, extra_answers, accessibility_note, avoid_note, business_prefs";

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
      supabase.from("preferences").select(PREF_COLUMNS).eq("user_id", userId).maybeSingle(),
      supabase
        .from("companies")
        .select(COMPANY_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ]);

    const profile = profileRes.data as {
      full_name: string | null;
      home_airport: string;
      plan: string;
      onboarded: boolean;
    } | null;

    return {
      userId,
      fullName: profile?.full_name ?? null,
      homeAirport: profile?.home_airport ?? "WAW",
      plan: profile?.plan ?? "free",
      onboarded: profile?.onboarded ?? false,
      preferences: rowToPrefs((prefsRes.data as PrefRow | null) ?? null),
      businessPrefs:
        ((prefsRes.data as PrefRow | null)?.["business_prefs"] as BusinessPrefsPayload) ?? {},
      companies: ((companiesRes.data ?? []) as CompanyRow[]).map(rowToCompany),
    };
  });

/* ------------------------------- validation ------------------------------- */

const strList = z.array(z.string().trim().min(1).max(60)).max(60).default([]);

const prefsSchema = z.object({
  seat: z.enum(["window", "aisle", "any"]).default("any"),
  cabinClass: z.enum(["economy", "premium_economy", "business", "first"]).default("economy"),
  maxConnections: z.number().int().min(0).max(3).default(1),
  hotelMinRating: z.number().min(0).max(5).default(4),
  hotelRules: z.string().trim().max(500).nullable().default(null),
  carTransmission: z.enum(["automatic", "manual", "any"]).default("automatic"),
  tripPurpose: strList,
  airlines: strList,
  cabinRule: z.string().trim().max(40).nullable().default(null),
  seatFront: z.boolean().default(false),
  seatLegroom: z.boolean().default(false),
  hotelTypes: strList,
  hotelChains: strList,
  hotelStars: strList,
  hotelRatingLevel: z.string().trim().max(40).nullable().default(null),
  hotelAmenities: strList,
  hotelMaxKm: z.number().int().min(1).max(50).nullable().default(null),
  carBrands: strList,
  carClass: z.string().trim().max(40).nullable().default(null),
  carNavigation: z.boolean().default(false),
  carChildSeat: z.boolean().default(false),
  carCompanies: strList,
  cuisines: strList,
  diets: strList,
  interests: strList,
  music: strList,
  budgetBand: z.string().trim().max(40).nullable().default(null),
  dealbreakers: strList,
  extraAnswers: z.record(z.string().max(40), strList).default({}),
  accessibilityNote: z.string().trim().max(500).nullable().default(null),
  avoidNote: z.string().trim().max(500).nullable().default(null),
});

const companySchema = z.object({
  name: z.string().trim().min(1).max(160),
  legalForm: z.string().trim().max(60).nullable().default(null),
  country: z.string().trim().max(60).nullable().default(null),
  city: z.string().trim().max(80).nullable().default(null),
  postcode: z.string().trim().max(20).nullable().default(null),
  street: z.string().trim().max(120).nullable().default(null),
  building: z.string().trim().max(40).nullable().default(null),
  addressExtra: z.string().trim().max(160).nullable().default(null),
  vatId: z.string().trim().max(40).nullable().default(null),
  invoiceEmails: z.array(z.string().trim().email()).max(10).default([]),
  isDefault: z.boolean().default(false),
});

type CompanyInput = z.infer<typeof companySchema>;

function companyToRow(userId: string, c: CompanyInput, isDefault: boolean) {
  const address = [c.street, c.building, c.postcode, c.city, c.addressExtra]
    .filter((part) => part && part.length)
    .join(", ");
  return {
    user_id: userId,
    name: c.name,
    legal_form: c.legalForm,
    country: c.country,
    city: c.city,
    postcode: c.postcode,
    street: c.street,
    building: c.building,
    address_extra: c.addressExtra,
    vat_id: c.vatId,
    address: address || null,
    invoice_emails: c.invoiceEmails,
    invoice_email: c.invoiceEmails[0] ?? null,
    is_default: isDefault,
  };
}

const onboardingSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  /**
   * Required, and validated the same way the form validates it: country code
   * plus digits. Bookings depend on it — the airline's gate change, the hotel
   * confirming a late arrival — so an account without one cannot be served.
   */
  phone: z
    .string()
    .trim()
    .regex(/^\+\d[\d\s-]{6,17}\d$/),
  homeAirport: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/),
  preferences: prefsSchema,
  companies: z.array(companySchema).max(20).default([]),
  complete: z.boolean().default(true),
});

/* --------------------------------- writes --------------------------------- */

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
        traveller_phone: data.phone,
        home_airport: data.homeAirport.toUpperCase(),
        onboarded: data.complete,
      })
      .select("id")
      .single();
    if (profile.error) throw new Error(profile.error.message);

    const prefs = await supabase.from("preferences").upsert(prefsToRow(userId, data.preferences));
    if (prefs.error) throw new Error(prefs.error.message);

    if (data.companies.length) {
      const existing = await supabase.from("companies").select("id").eq("user_id", userId).limit(1);
      const hadAny = Boolean(existing.data?.length);
      const explicitDefault = data.companies.findIndex((c) => c.isDefault);
      const defaultIndex = explicitDefault >= 0 ? explicitDefault : hadAny ? -1 : 0;
      if (defaultIndex >= 0) {
        await supabase.from("companies").update({ is_default: false }).eq("user_id", userId);
      }
      const rows = data.companies.map((c, i) => companyToRow(userId, c, i === defaultIndex));
      const inserted = await supabase.from("companies").insert(rows);
      if (inserted.error) throw new Error(inserted.error.message);
    }

    return { ok: true };
  });

export const addCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => companySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const existing = await supabase.from("companies").select("id").eq("user_id", userId).limit(1);
    const isDefault = data.isDefault || !existing.data?.length;
    if (isDefault) {
      await supabase.from("companies").update({ is_default: false }).eq("user_id", userId);
    }
    const res = await supabase
      .from("companies")
      .insert(companyToRow(userId, data, isDefault))
      .select("id")
      .single();
    if (res.error) throw new Error(res.error.message);
    return { id: (res.data as { id: string }).id };
  });

export const updateCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => companySchema.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    if (rest.isDefault) {
      await supabase.from("companies").update({ is_default: false }).eq("user_id", userId);
    }
    const row = companyToRow(userId, rest, rest.isDefault);
    const res = await supabase.from("companies").update(row).eq("user_id", userId).eq("id", id);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
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
  .inputValidator((input: unknown) =>
    z
      .object({
        fullName: z.string().trim().min(1).max(120).nullable().default(null),
        homeAirport: z
          .string()
          .trim()
          .regex(/^[A-Za-z]{3}$/)
          .nullable()
          .default(null),
        preferences: prefsSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.fullName || data.homeAirport) {
      const up = await supabase.from("profiles").upsert({
        id: userId,
        ...(data.fullName ? { full_name: data.fullName } : {}),
        ...(data.homeAirport ? { home_airport: data.homeAirport.toUpperCase() } : {}),
      });
      if (up.error) throw new Error(up.error.message);
    }
    const res = await supabase.from("preferences").upsert(prefsToRow(userId, data.preferences));
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

/** The overlay schema: only the fields business may change, all optional. */
const businessPrefsSchema = z
  .object({
    cabinClass: z.enum(["economy", "premium_economy", "business", "first"]).optional(),
    seat: z.enum(["window", "aisle", "any"]).optional(),
    maxConnections: z.number().int().min(0).max(3).optional(),
    hotelTypes: strList.optional(),
    hotelChains: strList.optional(),
    hotelStars: strList.optional(),
    hotelMinRating: z.number().min(0).max(5).optional(),
    hotelAmenities: strList.optional(),
    hotelMaxKm: z.number().int().min(1).max(50).nullable().optional(),
    carClass: z.string().trim().max(40).nullable().optional(),
    carTransmission: z.enum(["automatic", "manual", "any"]).optional(),
    budgetBand: z.string().trim().max(40).nullable().optional(),
  })
  .strict();

export const saveBusinessPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ overlay: businessPrefsSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Replace, not merge: the form sends the whole overlay, and a field the
    // traveller cleared must actually clear.
    const res = await supabase
      .from("preferences")
      .upsert({ user_id: userId, business_prefs: data.overlay });
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export type Noticed = { subject: string; sentence: string };

/**
 * "Adair has noticed…" — the adjustments learned from the traveller's own
 * swaps, each one resettable. Stated preferences already win over these.
 */
export const getNoticed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Noticed[]> => {
    const { loadLearned } = await import("@/lib/trip/learned.server");
    const { brandName } = await import("@/lib/brands/catalogue");
    const prefsRes = await context.supabase
      .from("preferences")
      .select("airlines, hotel_chains, car_brands, car_companies, dealbreakers")
      .eq("user_id", context.userId)
      .maybeSingle();
    const row = (prefsRes.data ?? {}) as Record<string, unknown>;
    const list = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    const learned = await loadLearned(context.supabase, context.userId, {
      airlines: list(row["airlines"]),
      hotelChains: list(row["hotel_chains"]),
      carBrands: list(row["car_brands"]),
      carCompanies: list(row["car_companies"]),
      dealbreakers: list(row["dealbreakers"]),
    });
    const { noticedSentences } = await import("@/lib/trip/learning");
    const subjects = [
      ...learned.avoid.map((entry) => `${entry.kind}:${entry.brandId}`),
      ...(learned.distanceWeight > 1 ? ["distance"] : []),
      ...(learned.priceWeight > 1 ? ["price"] : []),
    ];
    return noticedSentences(learned, (id) => brandName(id) ?? id).map((sentence, index) => ({
      subject: subjects[index] ?? String(index),
      sentence,
    }));
  });

/** Forget one learned adjustment. The traveller always has the last word. */
export const resetNoticed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ subject: z.string().min(1).max(80) }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("learned_overrides").insert({
      user_id: context.userId,
      kind: "ranking",
      subject: data.subject,
      action: "ignore",
    });
    if (error) throw error;
    return { ok: true };
  });
