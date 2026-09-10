import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { parseTripSentence } from "@/lib/trip/parse";

const bodySchema = z.object({ sentence: z.string().max(1000).default("") });

export const Route = createFileRoute("/api/trip/parse")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) return new Response("Invalid body", { status: 400 });

        return Response.json(parseTripSentence(parsed.data.sentence), {
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
