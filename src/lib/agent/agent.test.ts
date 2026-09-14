import { describe, expect, it } from "vitest";

import { runAgent, textOf, toolCallsOf } from "./loop.server";
import { systemPrompt } from "./system-prompt";
import { TOOLS, distanceAndTimeInput, findPlacesInput, travelMinutes, toolFailure } from "./tools";

const promptContext = {
  today: "2026-09-13",
  locale: "en",
  city: null,
  hotel: null,
};

const toolContext = {
  supabase: {} as never,
  userId: "user-1",
};

describe("tool definitions", () => {
  it("exposes the tools the assistant needs", () => {
    expect(TOOLS.map((t) => t.name)).toEqual([
      "find_places",
      "get_curated",
      "distance_and_time",
      "get_traveller_context",
      "get_current_location",
    ]);
  });

  it("tells the model that map data carries no prices or hours", () => {
    const findPlaces = TOOLS.find((t) => t.name === "find_places");
    expect(findPlaces?.description).toMatch(/no opening hours, no prices/i);
  });

  it("rejects a radius outside the allowed range", () => {
    expect(findPlacesInput.safeParse({ city: "Paris", radiusMetres: 50_000 }).success).toBe(false);
  });

  it("requires coordinates on both ends of a distance", () => {
    expect(distanceAndTimeInput.safeParse({ from: { lat: 1, lon: 2 } }).success).toBe(false);
  });
});

describe("travelMinutes", () => {
  it("offers walking only within a walkable distance", () => {
    expect(travelMinutes(1.2).walking).toBeGreaterThan(0);
    expect(travelMinutes(40).walking).toBeNull();
  });

  it("never returns zero minutes for a real distance", () => {
    expect(travelMinutes(0.05).driving).toBeGreaterThanOrEqual(1);
  });
});

describe("toolFailure", () => {
  it("returns an honest empty result rather than throwing", () => {
    const parsed = JSON.parse(toolFailure("get_curated", "nothing on file"));
    expect(parsed.ok).toBe(false);
    expect(parsed.results).toEqual([]);
  });
});

describe("systemPrompt", () => {
  it("forbids naming a supplier to the traveller", () => {
    expect(systemPrompt(promptContext)).toMatch(/never name a supplier/i);
  });

  it("forbids calling itself an AI", () => {
    expect(systemPrompt(promptContext)).toMatch(/never say AI/i);
  });

  it("mentions the hotel as the reference point when one is open", () => {
    const withHotel = systemPrompt({
      ...promptContext,
      city: "Paris",
      hotel: { name: "Le Bristol", lat: 48.87, lon: 2.31 },
    });
    expect(withHotel).toContain("Le Bristol");
    expect(withHotel).toContain("Paris");
  });
});

describe("response parsing", () => {
  it("joins every text block", () => {
    expect(
      textOf([
        { type: "text", text: "One." },
        { type: "tool_use", id: "a", name: "find_places", input: {} },
        { type: "text", text: "Two." },
      ]),
    ).toBe("One.\nTwo.");
  });

  it("reads tool calls in order", () => {
    const calls = toolCallsOf([
      { type: "tool_use", id: "a", name: "get_traveller_context", input: {} },
      { type: "tool_use", id: "b", name: "get_curated", input: { city: "Paris" } },
    ]);
    expect(calls.map((c) => c.name)).toEqual(["get_traveller_context", "get_curated"]);
  });
});

describe("runAgent", () => {
  it("returns the answer when the model needs no tool", async () => {
    const result = await runAgent(
      [{ role: "user", content: "hello" }],
      promptContext,
      toolContext,
      {
        callModelFn: async () => ({
          content: [{ type: "text", text: "Where are you heading?" }],
          stopReason: "end_turn",
        }),
      },
    );
    expect(result.reply).toBe("Where are you heading?");
    expect(result.toolsUsed).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("runs a tool, feeds the result back, and answers", async () => {
    let turn = 0;
    const result = await runAgent(
      [{ role: "user", content: "how far is the station" }],
      promptContext,
      toolContext,
      {
        callModelFn: async (_system, messages) => {
          turn += 1;
          if (turn === 1) {
            return {
              content: [
                {
                  type: "tool_use",
                  id: "call-1",
                  name: "distance_and_time",
                  input: {
                    from: { label: "Hotel", lat: 48.87, lon: 2.31 },
                    to: { label: "Gare du Nord", lat: 48.88, lon: 2.35 },
                  },
                },
              ],
              stopReason: "tool_use",
            };
          }
          // The tool result must have been handed back before the second call.
          const last = messages[messages.length - 1];
          expect(Array.isArray(last?.content)).toBe(true);
          return {
            content: [{ type: "text", text: "About 3 km, roughly 35 minutes on foot." }],
            stopReason: "end_turn",
          };
        },
      },
    );
    expect(result.toolsUsed).toEqual(["distance_and_time"]);
    expect(result.reply).toMatch(/3 km/);
  });

  it("stops at the ceiling instead of looping forever", async () => {
    const result = await runAgent([{ role: "user", content: "loop" }], promptContext, toolContext, {
      callModelFn: async () => ({
        content: [
          { type: "tool_use", id: "x", name: "get_traveller_context", input: {} },
          { type: "text", text: "Still looking." },
        ],
        stopReason: "tool_use",
      }),
    });
    expect(result.truncated).toBe(true);
    expect(result.toolsUsed.length).toBeLessThanOrEqual(5);
  });

  it("stays silent rather than guessing when no key is configured", async () => {
    const saved = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];
    const result = await runAgent([{ role: "user", content: "hi" }], promptContext, toolContext);
    expect(result.reply).toBe("");
    if (saved) process.env["ANTHROPIC_API_KEY"] = saved;
  });
});
