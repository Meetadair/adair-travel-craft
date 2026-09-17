/**
 * Why is this trip so expensive? We re-price the same route on nearby dates
 * (real supplier searches only), and when the requested dates are clearly
 * above the cheapest nearby date we ask Claude whether a big event is likely.
 * Nothing here ever invents a spike or states an event as fact.
 */
import type { PriceContext, TripRequest } from "./types";

/** Days we compare against, including the requested dates themselves (0). */
const OFFSETS = [-14, -7, -3, 0, 3, 7, 14] as const;

/** A trip counts as peak-priced when it is more than 25% above the cheapest date. */
const PEAK_THRESHOLD = 1.25;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const cache = new Map<string, { at: number; value: PriceContext }>();

function shiftDate(iso: string, days: number): string {
  const at = Date.parse(`${iso}T12:00:00Z`);
  return new Date(at + days * 86_400_000).toISOString().slice(0, 10);
}

function cacheKey(req: TripRequest): string {
  return [
    req.originIata,
    req.destinationIata,
    req.departDate,
    req.returnDate,
    req.cabinClass,
    req.passengers,
  ].join("|");
}

/** Asks Claude for a likely event name; null whenever we cannot be reasonably sure. */
async function likelyEvent(city: string, departDate: string): Promise<string | null> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 120,
        system:
          "You name large recurring events (trade fairs, festivals, congresses, major sport) " +
          'that plausibly raise hotel prices. Answer with raw JSON only: {"event": string|null}. ' +
          "Use null unless a well-known event is likely in that city around that date. Never guess a generic name.",
        messages: [{ role: "user", content: `City: ${city}. Dates around: ${departDate}.` }],
      }),
    });
    if (!res.ok) {
      console.error(`Anthropic event lookup failed [${res.status}]`);
      return null;
    }
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (json.content ?? [])
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("")
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "");
    const value = JSON.parse(text) as { event?: unknown };
    const name = typeof value.event === "string" ? value.event.trim() : "";
    return name.length > 1 && name.length < 80 ? name : null;
  } catch (error) {
    console.error("Anthropic event lookup failed", error);
    return null;
  }
}

/** Real comparison searches on nearby dates. Never called before the main card renders. */
export async function buildPriceContext(req: TripRequest): Promise<PriceContext> {
  const key = cacheKey(req);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const { searchTripWithDuffel } = await import("./duffel.server");
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const candidates = OFFSETS.map((offset) => ({
    offset,
    departDate: shiftDate(req.departDate, offset),
    returnDate: shiftDate(req.returnDate, offset),
  })).filter((c) => c.departDate >= tomorrow);

  const results = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const search = await searchTripWithDuffel({
          ...req,
          departDate: candidate.departDate,
          returnDate: candidate.returnDate,
          hotelNameExact: null,
          carNameExact: null,
        });
        const total = search.totalEur;
        return total > 0 ? { ...candidate, total } : null;
      } catch {
        return null;
      }
    }),
  );

  const priced = results.filter((r): r is NonNullable<typeof r> => r !== null);
  const requested = priced.find((r) => r.offset === 0) ?? null;
  const cheapest = priced.slice().sort((a, b) => a.total - b.total)[0] ?? null;

  const empty: PriceContext = {
    peak: false,
    ratio: 1,
    requestedTotalEur: requested?.total ?? 0,
    cheapestTotalEur: cheapest?.total ?? 0,
    cheapestDepartDate: null,
    cheapestReturnDate: null,
    offsetDays: null,
    savingEur: 0,
    eventName: null,
    city: req.destinationCity,
  };

  if (!requested || !cheapest || cheapest.offset === 0) {
    cache.set(key, { at: Date.now(), value: empty });
    return empty;
  }

  const ratio = Math.round((requested.total / cheapest.total) * 100) / 100;
  if (ratio <= PEAK_THRESHOLD) {
    cache.set(key, { at: Date.now(), value: empty });
    return empty;
  }

  const value: PriceContext = {
    peak: true,
    ratio,
    requestedTotalEur: Math.round(requested.total * 100) / 100,
    cheapestTotalEur: Math.round(cheapest.total * 100) / 100,
    cheapestDepartDate: cheapest.departDate,
    cheapestReturnDate: cheapest.returnDate,
    offsetDays: cheapest.offset,
    savingEur: Math.round((requested.total - cheapest.total) * 100) / 100,
    eventName: await likelyEvent(req.destinationCity, req.departDate),
    city: req.destinationCity,
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}
