import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import type { PriceContext, TripRequest } from "@/lib/trip/types";

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
  hotelWish: z.string().max(200).nullable().default(null),
  hotelNameExact: z.string().max(120).nullable().default(null),
  carNameExact: z.string().max(120).nullable().default(null),
  needsCar: z.boolean(),
  invoiceToCompany: z.boolean(),
});

const idle: PriceContext = {
  peak: false,
  ratio: 1,
  requestedTotalEur: 0,
  cheapestTotalEur: 0,
  cheapestDepartDate: null,
  cheapestReturnDate: null,
  offsetDays: null,
  savingEur: 0,
  eventName: null,
  city: "",
};

export const Route = createFileRoute("/api/trip/price-context")({
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

        const { buildPriceContext } = await import("@/lib/trip/price-context.server");
        try {
          const context = await buildPriceContext({
            ...parsed.data,
            // This endpoint is called with an origin already chosen, so the
            // chat has nothing left to ask about it.
            originStated: true,
            stops: [],
          } as TripRequest);
          return Response.json(context, { headers: { "cache-control": "no-store" } });
        } catch (error) {
          console.error("Price context failed", error);
          return Response.json(idle, { headers: { "cache-control": "no-store" } });
        }
      },
    },
  },
});
