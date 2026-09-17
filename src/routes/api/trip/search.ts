import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import type { TripRequest, TripSearchResponse } from "@/lib/trip/types";

const requestSchema = z.object({
  originCity: z.string().min(1).max(60),
  originIata: z.string().length(3),
  destinationCity: z.string().min(1).max(60),
  destinationIata: z.string().length(3),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
  passengers: z.number().int().min(1).max(9),
  hotelWish: z.string().max(200).nullable(),
  hotelNameExact: z.string().max(120).nullable().default(null),
  carNameExact: z.string().max(120).nullable().default(null),

  needsCar: z.boolean(),
  invoiceToCompany: z.boolean(),
});

/** Identical searches are served from memory for 10 minutes. */
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: TripSearchResponse }>();

/** 10 searches per IP per hour. */
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT = 10;
const hits = new Map<string, number[]>();

function cacheKey(req: TripRequest): string {
  return [
    req.originIata,
    req.destinationIata,
    req.departDate,
    req.returnDate,
    req.cabinClass,
    req.passengers,
    req.needsCar ? "car" : "nocar",
    req.hotelNameExact ?? "",
    req.carNameExact ?? "",
  ].join("|");
}

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function overRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export const Route = createFileRoute("/api/trip/search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = requestSchema.safeParse(raw);
        if (!parsed.success) return new Response("Invalid body", { status: 400 });
        const tripRequest = parsed.data as TripRequest;

        if (overRateLimit(clientIp(request))) {
          return Response.json(
            { error: "rate-limited" },
            { status: 429, headers: { "retry-after": "600" } },
          );
        }

        const key = cacheKey(tripRequest);
        const cached = cache.get(key);
        if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
          return Response.json(cached.value, {
            headers: { "cache-control": "no-store", "x-adair-cache": "hit" },
          });
        }

        const { searchTripWithDuffel } = await import("@/lib/trip/duffel.server");
        let result: TripSearchResponse;
        try {
          result = await searchTripWithDuffel(tripRequest);
        } catch (error) {
          console.error("Trip search failed", error);
          return Response.json(
            {
              request: tripRequest,
              flight: null,
              stay: null,
              car: null,
              totalEur: 0,
              approx: false,
              savedEur: 0,
              savedMinutes: 160,
              testMode: true,
              hotelRequested: tripRequest.hotelNameExact,
              hotelNotFound: false,
              hotelAlternatives: [],
              carRequested: tripRequest.carNameExact,
              carNotFound: false,
              carAlternatives: [],
              errors: { flights: "unavailable", stays: "unavailable" },
            } satisfies TripSearchResponse,

            { headers: { "cache-control": "no-store" } },
          );
        }

        if (result.flight || result.stay) cache.set(key, { at: Date.now(), value: result });
        return Response.json(result, {
          headers: { "cache-control": "no-store", "x-adair-cache": "miss" },
        });
      },
    },
  },
});
