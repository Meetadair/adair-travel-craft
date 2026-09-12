/**
 * Short, destination-specific notes written by the editorial team and attached
 * to a booked trip. There is no generated filler here: when a category is
 * empty we show nothing at all.
 */
export const TIP_CATEGORIES = [
  { key: "airport", label: "Getting from the airport" },
  { key: "payment", label: "Local payment and tipping" },
  { key: "transport", label: "Transport" },
  { key: "know", label: "One thing worth knowing" },
  { key: "avoid", label: "When to avoid" },
] as const;

export type TipKey = (typeof TIP_CATEGORIES)[number]["key"];

export type TravelTips = Partial<Record<TipKey, string>>;

/** Keep only the known categories that actually carry text. */
export function parseTravelTips(raw: unknown): TravelTips {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const tips: TravelTips = {};
  for (const { key } of TIP_CATEGORIES) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) tips[key] = value.trim();
  }
  return tips;
}

/** Ordered, labelled tips ready to render; empty when nothing is written yet. */
export function listTravelTips(raw: unknown): Array<{ key: TipKey; label: string; text: string }> {
  const tips = parseTravelTips(raw);
  return TIP_CATEGORIES.filter((c) => tips[c.key]).map((c) => ({
    key: c.key,
    label: c.label,
    text: tips[c.key] as string,
  }));
}
