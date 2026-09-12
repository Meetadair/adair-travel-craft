import { describe, expect, it } from "vitest";
import { eventToHint, eventsToHints, hintSentence, type RawEvent } from "./hints";

const NOW = new Date("2026-09-12T09:00:00Z");
const base: RawEvent = {
  id: "e1",
  title: "Conference",
  location: "Fira Barcelona, Barcelona",
  start: "2026-10-12T09:00:00Z",
  end: "2026-10-14T17:00:00Z",
  allDay: false,
  recurring: false,
};
const opts = { homeIata: "WAW", now: NOW };

describe("calendar trip hints", () => {
  it("keeps an away-from-home event with a location", () => {
    const hint = eventToHint(base, opts);
    expect(hint?.city).toBe("Barcelona");
    expect(hint?.iata).toBe("BCN");
  });

  it("ignores events without a location", () => {
    expect(eventToHint({ ...base, location: null }, opts)).toBeNull();
    expect(eventToHint({ ...base, location: "   " }, opts)).toBeNull();
  });

  it("ignores recurring and all-day events", () => {
    expect(eventToHint({ ...base, recurring: true }, opts)).toBeNull();
    expect(eventToHint({ ...base, allDay: true }, opts)).toBeNull();
  });

  it("ignores events in the home city", () => {
    expect(eventToHint({ ...base, location: "Warsaw, Rondo Daszynskiego" }, opts)).toBeNull();
  });

  it("ignores the past and anything beyond 90 days", () => {
    expect(eventToHint({ ...base, start: "2026-09-01T09:00:00Z" }, opts)).toBeNull();
    expect(eventToHint({ ...base, start: "2027-03-01T09:00:00Z" }, opts)).toBeNull();
  });

  it("ignores locations that resolve to no known city", () => {
    expect(eventToHint({ ...base, location: "Zoom" }, opts)).toBeNull();
  });

  it("deduplicates by event id", () => {
    expect(eventsToHints([base, base], opts)).toHaveLength(1);
  });

  it("prefills a sentence with a must-arrive-by time", () => {
    const sentence = hintSentence(
      { city: "Barcelona", startsAt: "2026-10-12T09:00:00Z", endsAt: "2026-10-14T17:00:00Z" },
      "Warsaw",
    );
    expect(sentence).toBe(
      "Warsaw to Barcelona on 2026-10-12, I need to be there by 09:00, back 2026-10-14.",
    );
  });
});
