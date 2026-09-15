import { describe, expect, it } from "vitest";
import { bestImage, toEvent } from "./ticketmaster.server";

describe("toEvent", () => {
  const base = {
    id: "evt-1",
    name: "Test Band Live",
    url: "https://www.ticketmaster.com/event/evt-1",
    dates: { start: { localDate: "2026-10-05", localTime: "20:00:00" } },
  };

  it("maps a full event, including venue distance", () => {
    const event = toEvent(
      {
        ...base,
        classifications: [{ segment: { name: "Music" } }],
        priceRanges: [{ min: 40, max: 120, currency: "EUR" }],
        images: [
          { url: "https://img/small.jpg", width: 200 },
          { url: "https://img/large.jpg", width: 1600 },
        ],
        _embedded: {
          venues: [
            {
              name: "Test Arena",
              city: { name: "Lisbon" },
              location: { latitude: "38.7223", longitude: "-9.1393" },
            },
          ],
        },
      },
      { lat: 38.7223, lon: -9.1393 },
    );

    expect(event).not.toBeNull();
    expect(event?.name).toBe("Test Band Live");
    expect(event?.date).toBe("2026-10-05");
    expect(event?.time).toBe("20:00");
    expect(event?.venueName).toBe("Test Arena");
    expect(event?.city).toBe("Lisbon");
    expect(event?.category).toBe("Music");
    expect(event?.priceFrom).toBe(40);
    expect(event?.priceTo).toBe(120);
    expect(event?.currency).toBe("EUR");
    expect(event?.imageUrl).toBe("https://img/large.jpg");
    expect(event?.distanceKm).toBe(0);
  });

  it("drops an event missing a name, date, id or url rather than guessing", () => {
    const { name: _name, ...noName } = base;
    const { id: _id, ...noId } = base;
    const { url: _url, ...noUrl } = base;
    expect(toEvent(noName, null)).toBeNull();
    expect(toEvent(noId, null)).toBeNull();
    expect(toEvent(noUrl, null)).toBeNull();
    expect(toEvent({ ...base, dates: {} }, null)).toBeNull();
  });

  it("leaves price and venue fields null when Ticketmaster gives none", () => {
    const event = toEvent(base, null);
    expect(event?.priceFrom).toBeNull();
    expect(event?.venueName).toBeNull();
    expect(event?.distanceKm).toBeNull();
    expect(event?.time).toBe("20:00");
  });

  it("has no confirmed time when Ticketmaster gives none", () => {
    const event = toEvent({ ...base, dates: { start: { localDate: "2026-10-05" } } }, null);
    expect(event?.time).toBeNull();
  });
});

describe("bestImage", () => {
  it("picks the widest image", () => {
    expect(
      bestImage([
        { url: "a", width: 100 },
        { url: "b", width: 900 },
        { url: "c", width: 300 },
      ]),
    ).toBe("b");
  });

  it("is null with no images", () => {
    expect(bestImage(undefined)).toBeNull();
    expect(bestImage([])).toBeNull();
  });
});
