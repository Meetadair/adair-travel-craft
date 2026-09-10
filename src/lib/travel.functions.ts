import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const askSchema = z.object({
  message: z.string().min(3).max(1000),
  locale: z.string().max(8).optional(),
});

/** Language the assistant answers in, keyed by UI locale. */
const REPLY_LANGUAGE: Record<string, string> = {
  en: "English",
  de: "German",
  ja: "Japanese",
  uk: "Ukrainian",
  zh: "Simplified Chinese",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  it: "Italian",
  sr: "Serbian (Latin script)",
  fi: "Finnish",
  no: "Norwegian",
  sv: "Swedish",
  pl: "Polish",
};

const parsedSchema = z.object({
  originCity: z.string().default("Warsaw"),
  originIata: z.string().default("WAW"),
  destinationCity: z.string().default("Milan"),
  destinationIata: z.string().default("MIL"),
  departDate: z.string(),
  returnDate: z.string(),
  cabinClass: z.string().optional(),
  needsCar: z.boolean().optional(),
  notes: z.string().optional(),
  reply: z.string().optional(),
});

type ParsedRequest = z.infer<typeof parsedSchema>;

function fallbackParse(message: string): ParsedRequest {
  const today = new Date();
  const depart = new Date(today.getTime() + 7 * 86_400_000);
  const back = new Date(today.getTime() + 8 * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    originCity: "Warsaw",
    originIata: "WAW",
    destinationCity: "Milan",
    destinationIata: "MIL",
    departDate: iso(depart),
    returnDate: iso(back),
    needsCar: /auto|samoch|car/i.test(message),
    notes: message,
  };
}

/** Turns a free-form natural-language request into a structured trip search. */
async function understand(message: string, locale = "en"): Promise<ParsedRequest> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return fallbackParse(message);

  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.8-flash",
      messages: [
        {
          role: "system",
          content:
            `You are a travel request parser. Today is ${today}. Return ONLY JSON ` +
            `with fields: originCity, originIata (IATA code of the origin city), destinationCity, destinationIata ` +
            `(IATA code of the destination city), departDate (YYYY-MM-DD), returnDate (YYYY-MM-DD), ` +
            `cabinClass (economy|premium_economy|business), needsCar (boolean), notes, ` +
            `reply (one short sentence summarizing the understood request, written in ${REPLY_LANGUAGE[locale] ?? "English"}). ` +
            `If the origin city is not given, use Warsaw (WAW).`,
        },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    console.error(`AI gateway failed [${res.status}]: ${await res.text()}`);
    return fallbackParse(message);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    const raw = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    return parsedSchema.parse(raw);
  } catch (error) {
    console.error("AI parse failed", error);
    return fallbackParse(message);
  }
}

/** Public: composes a trip from live provider offers (or flagged samples). */
export const composeTrip = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => askSchema.parse(data))
  .handler(async ({ data }) => {
    const parsed = await understand(data.message, data.locale ?? "en");
    const { searchTrip } = await import("./travel-search.server");
    const result = await searchTrip({
      originCity: parsed.originCity,
      originIata: parsed.originIata.toUpperCase(),
      destinationCity: parsed.destinationCity,
      destinationIata: parsed.destinationIata.toUpperCase(),
      departDate: parsed.departDate,
      returnDate: parsed.returnDate,
      ...(parsed.cabinClass ? { cabinClass: parsed.cabinClass } : {}),
      ...(parsed.needsCar === undefined ? {} : { needsCar: parsed.needsCar }),
      ...(parsed.notes ? { notes: parsed.notes } : {}),
    });

    return {
      reply:
        parsed.reply ??
        `${parsed.destinationCity}: ${parsed.departDate} – ${parsed.returnDate}. Your composed trip is below.`,
      request: {
        originCity: parsed.originCity,
        destinationCity: parsed.destinationCity,
        departDate: parsed.departDate,
        returnDate: parsed.returnDate,
      },
      ...result,
    };
  });

const saveSchema = z.object({
  title: z.string().min(2),
  city: z.string().min(1),
  origin: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  currency: z.string().default("EUR"),
  source: z.string().default("demo"),
  items: z
    .array(
      z.object({
        kind: z.string(),
        title: z.string(),
        detail: z.string(),
        provider: z.string(),
        offerReference: z.string(),
        amount: z.number(),
        currency: z.string(),
      }),
    )
    .min(1),
});

export const saveTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const total = data.items.reduce((sum, i) => sum + i.amount, 0);
    const documentNumber = `ADR/${new Date().getFullYear()}/${Math.floor(
      100000 + Math.random() * 899999,
    )}`;

    const { data: trip, error } = await supabase
      .from("trips")
      .insert({
        user_id: userId,
        title: data.title,
        city: data.city,
        origin: data.origin,
        start_date: data.startDate,
        end_date: data.endDate,
        status: "confirmed",
        total_amount: total,
        currency: data.currency,
        document_number: documentNumber,
        data_source: data.source,
      })
      .select("id")
      .single();
    if (error || !trip) throw new Error(error?.message ?? "Failed to save the trip");

    const { error: itemsError } = await supabase.from("trip_items").insert(
      data.items.map((item, index) => ({
        trip_id: trip.id,
        user_id: userId,
        kind: item.kind,
        title: item.title,
        detail: item.detail,
        provider: item.provider,
        offer_reference: item.offerReference,
        amount: item.amount,
        currency: item.currency,
        position: index,
      })),
    );
    if (itemsError) throw new Error(itemsError.message);

    return { id: trip.id, documentNumber };
  });

export const listTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: trips, error } = await context.supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: items, error: itemsError } = await context.supabase
      .from("trip_items")
      .select("*")
      .order("position", { ascending: true });
    if (itemsError) throw new Error(itemsError.message);

    return (trips ?? []).map((trip) => ({
      ...trip,
      items: (items ?? []).filter((i) => i.trip_id === trip.id),
    }));
  });

export const deleteTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("trips").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const profileSchema = z.object({
  full_name: z.string().max(120).nullable(),
  company: z.string().max(160).nullable(),
  tax_id: z.string().max(40).nullable(),
  preferred_airlines: z.string().max(200).nullable(),
  cabin_class: z.string().max(60).nullable(),
  seat_preference: z.string().max(60).nullable(),
  hotel_chains: z.string().max(200).nullable(),
  diet: z.string().max(120).nullable(),
  budget_per_trip: z.number().nullable(),
  currency: z.string().max(3),
});

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => profileSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .upsert({ id: context.userId, ...data });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
