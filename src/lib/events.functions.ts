/**
 * Lightweight first-party event log. No external analytics service: the app
 * writes named events with small property bags, the admin page aggregates them
 * with SQL. Signed-out visitors are counted too, by session id only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** The only names we accept, so the funnel query stays meaningful. */
export const EVENT_NAMES = [
  "sentence_typed",
  "search_run",
  "search_failed",
  "card_created",
  "booking_started",
  "booking_completed",
  "booking_failed",
  "booking_cancelled",
  "onboarding_step",
  "onboarding_skip",
  "onboarding_abandoned",
  "cheaper_dates_accepted",
  "cheaper_dates_dismissed",
  "line_swapped",
  "match_score",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

const schema = z.object({
  name: z.enum(EVENT_NAMES),
  sessionId: z.string().trim().min(6).max(64),
  props: z.record(z.string(), z.unknown()).optional(),
  /** Set when the visitor is signed in; we never trust it for access. */
  userId: z.string().uuid().nullable().optional(),
});

export const logEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Keep the bag small: analytics, not a data dump.
      const props = JSON.parse(JSON.stringify(data.props ?? {})) as Record<string, unknown>;
      const trimmed = Object.fromEntries(Object.entries(props).slice(0, 20));
      const res = await supabaseAdmin.from("events").insert({
        name: data.name,
        session_id: data.sessionId,
        user_id: data.userId ?? null,
        props: trimmed as never,
      });
      if (res.error) console.error("event insert failed", res.error.message);
      return { ok: !res.error };
    } catch (error) {
      console.error("event insert threw", error);
      return { ok: false };
    }
  });

/** Global error boundary sink: keeps a blank page from being the only signal. */
export const logAppError = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        message: z.string().trim().min(1).max(500),
        stack: z.string().max(4000).optional(),
        route: z.string().max(300).optional(),
        userId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const res = await supabaseAdmin.from("error_log").insert({
        message: data.message,
        stack: data.stack ?? null,
        route: data.route ?? null,
        user_id: data.userId ?? null,
      });
      return { ok: !res.error };
    } catch {
      return { ok: false };
    }
  });
