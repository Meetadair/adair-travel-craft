/**
 * The tools Adair may call during a conversation.
 *
 * Every tool returns something we can stand behind: a place someone wrote up,
 * a distance computed from coordinates, what this traveller has actually done
 * before. Nothing here invents a venue, a price or a table — if a tool has no
 * answer it says so and Adair says so too.
 */
import { z } from "zod";

import { PLACE_CATEGORIES } from "@/lib/places/types";

export type ToolName =
  | "find_places"
  | "get_curated"
  | "get_events"
  | "distance_and_time"
  | "get_traveller_context"
  | "get_current_location";

/** A tool definition in the shape the Anthropic messages API expects. */
export type ToolSpec = {
  name: ToolName;
  description: string;
  input_schema: Record<string, unknown>;
};

/* ---------------------------------------------------------------- schemas */

export const findPlacesInput = z.object({
  city: z.string().min(1).max(60),
  category: z
    .enum(PLACE_CATEGORIES as [string, ...string[]])
    .nullable()
    .default(null),
  near: z
    .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
    .nullable()
    .default(null),
  radiusMetres: z.number().int().min(200).max(5000).default(2000),
  limit: z.number().int().min(1).max(8).default(4),
});

export const getCuratedInput = z.object({
  city: z.string().min(1).max(60),
  kind: z.string().max(40).nullable().default(null),
  familyFriendly: z.boolean().nullable().default(null),
  limit: z.number().int().min(1).max(8).default(4),
});

export const getEventsInput = z.object({
  city: z.string().min(1).max(60),
  near: z
    .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
    .nullable()
    .default(null),
  /** "YYYY-MM-DD". Null defaults to the trip's own dates, then today. */
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  limit: z.number().int().min(1).max(8).default(4),
});

export const distanceAndTimeInput = z.object({
  from: z.object({
    label: z.string().max(120).default(""),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  to: z.object({
    label: z.string().max(120).default(""),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
});

export const travellerContextInput = z.object({
  city: z.string().max(60).nullable().default(null),
});

export const currentLocationInput = z.object({
  /** True only when exact position is the point of the question. */
  precise: z.boolean().default(false),
});

export type FindPlacesInput = z.infer<typeof findPlacesInput>;
export type GetCuratedInput = z.infer<typeof getCuratedInput>;
export type GetEventsInput = z.infer<typeof getEventsInput>;
export type DistanceAndTimeInput = z.infer<typeof distanceAndTimeInput>;
export type TravellerContextInput = z.infer<typeof travellerContextInput>;
export type CurrentLocationInput = z.infer<typeof currentLocationInput>;

export const TOOL_INPUT_SCHEMAS = {
  find_places: findPlacesInput,
  get_curated: getCuratedInput,
  get_events: getEventsInput,
  distance_and_time: distanceAndTimeInput,
  get_traveller_context: travellerContextInput,
  get_current_location: currentLocationInput,
} as const;

/* ------------------------------------------------------------ definitions */

export const TOOLS: ToolSpec[] = [
  {
    name: "find_places",
    description:
      "Venues around a point or in a city, from public map data. Use for 'where can I eat near the hotel', " +
      "'is there a coffee place nearby'. Returns name, category, coordinates and distance when a reference " +
      "point is given. Map data carries no opening hours, no prices and no tables — never state any. " +
      "Returns an empty list when nothing is known; say so plainly rather than guessing.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City the traveller is asking about." },
        category: {
          type: ["string", "null"],
          enum: [...PLACE_CATEGORIES, null],
          description: "Narrow to one category, or null for all.",
        },
        near: {
          type: ["object", "null"],
          description: "Reference point, normally the hotel. Null to search the city centre.",
          properties: { lat: { type: "number" }, lon: { type: "number" } },
          required: ["lat", "lon"],
        },
        radiusMetres: { type: "integer", minimum: 200, maximum: 5000, default: 2000 },
        limit: { type: "integer", minimum: 1, maximum: 8, default: 4 },
      },
      required: ["city"],
    },
  },
  {
    name: "get_curated",
    description:
      "Places someone wrote up — our own entries and creator recommendations — with the editorial note and " +
      "the reason to go. Prefer this over find_places when the traveller asks what is good rather than what " +
      "is near. Each entry may carry an attribution that must be shown when the recommendation is used.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string" },
        kind: {
          type: ["string", "null"],
          description: "Restaurant, bar, shop, sight — or null for everything.",
        },
        familyFriendly: {
          type: ["boolean", "null"],
          description: "True to return only entries suitable with children.",
        },
        limit: { type: "integer", minimum: 1, maximum: 8, default: 4 },
      },
      required: ["city"],
    },
  },
  {
    name: "get_events",
    description:
      "Real concerts, shows and sport happening near the traveller, from Ticketmaster's own listings — not " +
      "something to remember or guess. Use for 'what's on', 'anything good happening while I'm there', or to " +
      "offer something unprompted once a trip is settled. Every result links to Ticketmaster's own page to " +
      "buy — you never sell or hold a ticket. Null dates default to the trip's own dates; returns an empty " +
      "list rather than an invented one when nothing is on.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City the traveller is asking about." },
        near: {
          type: ["object", "null"],
          description: "Reference point, normally the hotel. Null to use the trip's own point.",
          properties: { lat: { type: "number" }, lon: { type: "number" } },
          required: ["lat", "lon"],
        },
        dateFrom: {
          type: ["string", "null"],
          description: "YYYY-MM-DD. Null defaults to the trip's own start date, then today.",
        },
        dateTo: {
          type: ["string", "null"],
          description: "YYYY-MM-DD. Null defaults to the trip's own end date, then 30 days out.",
        },
        limit: { type: "integer", minimum: 1, maximum: 8, default: 4 },
      },
      required: ["city"],
    },
  },
  {
    name: "distance_and_time",
    description:
      "Straight-line distance between two coordinates with walking and driving estimates. Use for 'how far " +
      "is the YSL boutique from the hotel'. Estimates are approximations over the direct line, not routed " +
      "directions — present them as approximate.",
    input_schema: {
      type: "object",
      properties: {
        from: {
          type: "object",
          properties: {
            label: { type: "string" },
            lat: { type: "number" },
            lon: { type: "number" },
          },
          required: ["lat", "lon"],
        },
        to: {
          type: "object",
          properties: {
            label: { type: "string" },
            lat: { type: "number" },
            lon: { type: "number" },
          },
          required: ["lat", "lon"],
        },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "get_traveller_context",
    description:
      "What Adair already knows about this traveller: stated preferences, dealbreakers, patterns learned " +
      "from past bookings, and places they have chosen before in a given city. Call this before making any " +
      "recommendation so the answer respects what they have already told us. Dealbreakers always win over " +
      "learned patterns.",
    input_schema: {
      type: "object",
      properties: {
        city: {
          type: ["string", "null"],
          description: "Limit place memory to one city, or null for the general profile only.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_current_location",
    description:
      "Where the traveller is right now, as a starting point for anything about distance or what is " +
      "nearby. Returns device coordinates when they have allowed it, otherwise their hotel, otherwise " +
      "the city centre — and always says which one, in `source`. Say which starting point you used: " +
      "'about 12 minutes on foot from your hotel'. Never imply you know their exact position when " +
      "source is not 'device'. Set precise to true only when the question cannot be answered without " +
      "exact position ('what is near me right now'); that is the only case where permission is asked.",
    input_schema: {
      type: "object",
      properties: {
        precise: {
          type: "boolean",
          default: false,
          description: "True when only exact position can answer the question.",
        },
      },
      required: [],
    },
  },
];

/* ----------------------------------------------------------------- shared */

/** Rough walking and driving minutes over a straight-line distance. */
export function travelMinutes(km: number): { walking: number | null; driving: number } {
  const walking = km <= 6 ? Math.max(1, Math.round((km / 4.8) * 60)) : null;
  // Town speeds are slower than the map suggests; the detour factor is built in.
  const driving = Math.max(1, Math.round((km / 28) * 60 * 1.3));
  return { walking, driving };
}

/** A tool call we could not run — Adair is told why, in words it can repeat. */
export function toolFailure(name: ToolName, reason: string): string {
  return JSON.stringify({ tool: name, ok: false, reason, results: [] });
}
