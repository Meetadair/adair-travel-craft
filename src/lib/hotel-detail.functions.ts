/**
 * Full detail for one hotel, fetched only when a traveller opens it: every
 * room and rate liteAPI actually has for these dates, the property's
 * check-in window, and a handful of real reviews. Public, like composeTrip
 * — a traveller is still deciding whether to sign in when they want to see
 * what a room looks like.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { StayDetail } from "@/lib/trip/types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const inputSchema = z.object({
  hotelId: z.string().trim().min(1).max(64),
  checkIn: isoDate,
  checkOut: isoDate,
  adults: z.number().int().min(1).max(9).default(1),
  childAges: z.array(z.number().int().min(0).max(17)).max(8).optional(),
  currency: z.string().trim().length(3).default("EUR"),
});

export const getHotelDetail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<StayDetail | null> => {
    const { getStayDetail } = await import("@/lib/suppliers/stays/liteapi");
    try {
      return await getStayDetail({
        hotelId: data.hotelId,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        adults: data.adults,
        childrenAges: data.childAges ?? [],
        currency: data.currency.toUpperCase(),
      });
    } catch (error) {
      console.error("getHotelDetail failed", error);
      return null;
    }
  });
