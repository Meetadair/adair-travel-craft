import { systemPrompt } from "../.agent-probe-build/system-prompt.mjs";
const key = process.env.ANTHROPIC_API_KEY;
const system = systemPrompt({
  today: "2026-09-16",
  locale: "en",
  firstName: "Andrzej",
  city: "Paris",
  hotel: { name: "Hôtel Le Pigalle", lat: 48.882, lon: 2.337 },
});

const tools = [
  {
    name: "find_places",
    description:
      "Venues around a point or in a city, from public map data. No opening hours, no prices, no tables.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string" },
        category: { type: ["string", "null"] },
        limit: { type: "integer" },
      },
      required: ["city"],
    },
  },
  {
    name: "get_curated",
    description:
      "Places someone wrote up — our own entries and creator recommendations — with the editorial note and attribution.",
    input_schema: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
  },
  {
    name: "distance_and_time",
    description:
      "Approximate straight-line distance between two points, and rough walking and driving minutes.",
    input_schema: {
      type: "object",
      properties: { from: { type: "object" }, to: { type: "object" } },
      required: ["from", "to"],
    },
  },
  {
    name: "get_traveller_context",
    description: "What this traveller has stated and what we have learned.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_current_location",
    description: "Where the traveller is: device position, their hotel, or the city.",
    input_schema: { type: "object", properties: {} },
  },
];

// Canned answers, deliberately thin — this is what the tools really return.
const RESULTS = {
  get_traveller_context: {
    stated: ["boutique hotels", "no flight before 08:00"],
    dealbreakers: [],
    chosenBefore: [],
  },
  get_current_location: { source: "hotel", city: "Paris", lat: 48.882, lon: 2.337 },
  distance_and_time: { km: 2.1, walkingMinutes: 26, drivingMinutes: 9, note: "straight line" },
  find_places: {
    places: [
      { name: "Le Bon Georges", category: "restaurant", km: 0.4 },
      { name: "Bouillon Pigalle", category: "restaurant", km: 0.3 },
      { name: "Le Pantruche", category: "restaurant", km: 0.5 },
    ],
  },
  get_curated: {
    places: [
      {
        name: "Musée de la Vie Romantique",
        note: "A garden courtyard nobody finds by accident.",
        attribution: "Adair editorial",
      },
    ],
  },
};

const scenarios = [
  {
    label: "A. MUSEUMS — what does it finally say?",
    turns: [["user", "anything good on at the museums while we're there?"]],
  },
  {
    label: "B. RESTAURANT + ANNIVERSARY — honest about booking? one question?",
    turns: [
      [
        "user",
        "can you book us a restaurant for Saturday night, somewhere nice, it's our anniversary",
      ],
    ],
  },
  {
    label: "C. FIRST TIME — does it re-ask what it was told?",
    turns: [["user", "it's our first time in Paris — what should we see?"]],
  },
  {
    label: "D. JUST BOOKED — does it offer one real thing?",
    turns: [
      ["user", "Warsaw to Paris, 26 to 30 September, with my wife, private"],
      [
        "assistant",
        "Booked — Warsaw to Paris, 26 to 30 September, four nights at Hôtel Le Pigalle.",
      ],
      ["user", "thanks"],
    ],
  },
];

for (const s of scenarios) {
  const messages = s.turns.map(([role, content]) => ({ role, content }));
  console.log("\n" + "=".repeat(72) + "\n" + s.label + "\n" + "-".repeat(72));
  for (let step = 0; step < 4; step++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 600,
        system,
        tools,
        messages,
      }),
    });
    const j = await r.json();
    if (!j.content) {
      console.log("ERR", JSON.stringify(j).slice(0, 180));
      break;
    }
    const calls = j.content.filter((c) => c.type === "tool_use");
    for (const c of j.content) if (c.type === "text" && c.text.trim()) console.log(c.text.trim());
    if (!calls.length) break;
    console.log(calls.map((c) => `   · asked for ${c.name}`).join("\n"));
    messages.push({ role: "assistant", content: j.content });
    messages.push({
      role: "user",
      content: calls.map((c) => ({
        type: "tool_result",
        tool_use_id: c.id,
        content: JSON.stringify(RESULTS[c.name] ?? { error: "no such tool" }),
      })),
    });
  }
}
