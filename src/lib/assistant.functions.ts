/**
 * The traveller's side of the conversation.
 *
 * One entry point: the history so far goes in, Adair's next line comes out.
 * Tools run server-side with the traveller's own Supabase session, so a
 * recommendation can never read another traveller's memory.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runAgent, type AgentResult, type ChatMessage } from "@/lib/agent/loop.server";
import { asConsent, type LocationConsent } from "@/lib/agent/location";

/** Enough history for context, short enough to stay cheap. */
const MAX_HISTORY = 20;

const inputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(MAX_HISTORY),
  locale: z.string().min(2).max(8).default("en"),
  city: z.string().max(60).nullable().default(null),
  hotel: z
    .object({
      name: z.string().max(120),
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
    })
    .nullable()
    .default(null),
  /**
   * Coordinates the browser handed over for this one question. They are used
   * to answer and then dropped — nothing about position is written down.
   */
  device: z
    .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
    .nullable()
    .default(null),
  cityCentre: z
    .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
    .nullable()
    .default(null),
});

export type AskAdairInput = z.infer<typeof inputSchema>;
export type AskAdairResult = AgentResult & {
  configured: boolean;
  /** True when the answer would be better with exact position and we may ask. */
  askLocation: boolean;
  locationConsent: LocationConsent;
};

export const askAdair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AskAdairResult> => {
    const { supabase, userId } = context;

    const consentRes = await supabase
      .from("preferences")
      .select("location_consent")
      .eq("user_id", userId)
      .maybeSingle();
    const consent = asConsent(
      (consentRes.data as Record<string, unknown> | null)?.["location_consent"],
    );

    if (!process.env["ANTHROPIC_API_KEY"]) {
      return {
        reply: "",
        toolsUsed: [],
        truncated: false,
        configured: false,
        askLocation: false,
        locationConsent: consent,
      };
    }

    const history: ChatMessage[] = data.messages.slice(-MAX_HISTORY);

    // Read the name server-side: the browser could claim to be anyone.
    const profile = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const fullName = (profile.data as { full_name?: string | null } | null)?.full_name ?? "";
    const firstName = fullName.trim().split(/\s+/)[0] || null;

    const result = await runAgent(
      history,
      {
        today: new Date().toISOString().slice(0, 10),
        locale: data.locale,
        firstName,
        city: data.city,
        hotel: data.hotel,
      },
      {
        supabase,
        userId,
        location: {
          device: consent === "granted" ? data.device : null,
          consent,
          hotel: data.hotel,
          city:
            data.cityCentre && data.city
              ? { name: data.city, lat: data.cityCentre.lat, lon: data.cityCentre.lon }
              : null,
        },
      },
    );

    // Precision is only worth asking about once, and only when the traveller
    // actually asked something that needs it.
    const askLocation =
      consent === "not_asked" && !data.device && result.toolsUsed.includes("get_current_location");

    return { ...result, configured: true, askLocation, locationConsent: consent };
  });
