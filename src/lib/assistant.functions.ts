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
});

export type AskAdairInput = z.infer<typeof inputSchema>;
export type AskAdairResult = AgentResult & { configured: boolean };

export const askAdair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AskAdairResult> => {
    const { supabase, userId } = context;

    if (!process.env["ANTHROPIC_API_KEY"]) {
      return { reply: "", toolsUsed: [], truncated: false, configured: false };
    }

    const history: ChatMessage[] = data.messages.slice(-MAX_HISTORY);

    const result = await runAgent(
      history,
      {
        today: new Date().toISOString().slice(0, 10),
        locale: data.locale,
        city: data.city,
        hotel: data.hotel,
      },
      { supabase, userId },
    );

    return { ...result, configured: true };
  });
