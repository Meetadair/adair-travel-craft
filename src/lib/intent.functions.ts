/**
 * Intent classification: one short, cheap model call that decides what the
 * customer said before any parsing or searching happens.
 *
 * The rule-based classifier in ./trip/intent.ts is both the first filter and
 * the fallback, so the chat keeps working without a key.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normaliseIntent, ruleIntent, type IntentKind } from "./trip/intent";

const schema = z.object({
  sentence: z.string().trim().min(1).max(400),
  /** True when a trip card is already on screen. */
  hasCard: z.boolean().optional(),
});

/** Same input, same answer: nothing to pay for twice. */
const cache = new Map<string, IntentKind>();
const CACHE_MAX = 500;

const PROMPT = `Classify one message from a customer of a travel assistant.
Answer with exactly one word, nothing else, from this list:
greeting - a greeting, thanks or small talk
trip - asking to plan or find a trip
amendment - changing the trip already on screen
product_question - a question about what the assistant does or costs
booking_question - a question about a booking they already have
unclear - anything else, including nonsense`;

async function classifyWithClaude(sentence: string, hasCard: boolean): Promise<IntentKind | null> {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) return null;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8,
        system: PROMPT,
        messages: [
          {
            role: "user",
            content: `${hasCard ? "A trip is already on screen. " : ""}Message: ${sentence}`,
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { content?: { text?: string }[] };
    const text = body.content?.[0]?.text;
    if (!text) return null;
    const kind = normaliseIntent(text);
    return kind === "unclear" && !/unclear/i.test(text) ? null : kind;
  } catch {
    return null;
  }
}

export const classifyIntent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<{ kind: IntentKind; fromRules: boolean }> => {
    const hasCard = data.hasCard ?? false;
    const cacheKey = `${hasCard ? "card" : "new"}:${data.sentence.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) return { kind: cached, fromRules: false };

    const rules = ruleIntent(data.sentence, hasCard);
    // Clear-cut greetings and questions need no model call at all.
    const decided =
      rules === "greeting" || rules === "product_question" || rules === "booking_question"
        ? rules
        : ((await classifyWithClaude(data.sentence, hasCard)) ?? rules);

    if (cache.size > CACHE_MAX) cache.clear();
    cache.set(cacheKey, decided);
    return { kind: decided, fromRules: decided === rules };
  });
