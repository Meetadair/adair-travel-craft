import { describe, expect, it } from "vitest";

import { offerMatch } from "./offer-match";
import type { SearchPrefs } from "./rank";

const prefs = (over: Partial<SearchPrefs>): SearchPrefs =>
  ({
    airlines: [],
    seat: "any",
    cabinRule: null,
    hotelChains: [],
    hotelStars: [],
    hotelMinRating: 0,
    hotelAmenities: [],
    hotelTypes: [],
    carBrands: [],
    carCompanies: [],
    carClass: "",
    carTransmission: "any",
    cabinClass: "",
    maxConnections: null,
    hotelMaxKm: null,
    dealbreakers: [],
    ...over,
  }) as SearchPrefs;

const hotel = (title: string, detail = "") =>
  ({ kind: "hotel", title, detail, amount: 400 }) as const;

describe("offerMatch", () => {
  it("shows nothing when they have stated nothing", () => {
    expect(offerMatch(hotel("Some hotel"), prefs({}))).toBeNull();
  });

  it("shows nothing when they are signed out", () => {
    expect(offerMatch(hotel("Some hotel"), null)).toBeNull();
  });

  it("credits a hotel group they stay with", () => {
    const match = offerMatch(hotel("Park Hyatt Milano"), prefs({ hotelChains: ["hyatt"] }));
    expect(match?.met).toBe(1);
    expect(match?.total).toBe(1);
  });

  it("marks a group they do not stay with as unmet, rather than hiding it", () => {
    const match = offerMatch(hotel("Some independent place"), prefs({ hotelChains: ["hyatt"] }));
    expect(match?.met).toBe(0);
    expect(match?.total).toBe(1);
    expect(match?.criteria[0]?.ok).toBe(false);
  });

  it("checks each stated amenity separately", () => {
    const match = offerMatch(
      hotel("A hotel", "Spa and pool on site"),
      prefs({ hotelAmenities: ["spa", "pool", "sauna"] }),
    );
    expect(match?.total).toBe(3);
    expect(match?.met).toBe(2);
  });

  it("reads a star rating out of the line", () => {
    const good = offerMatch(hotel("A hotel", "5★ · city centre"), prefs({ hotelMinRating: 4 }));
    const short = offerMatch(hotel("A hotel", "3 stars"), prefs({ hotelMinRating: 4 }));
    expect(good?.met).toBe(1);
    expect(short?.met).toBe(0);
  });

  it("scores a flight against their airline and connections", () => {
    const match = offerMatch(
      { kind: "flight", title: "LOT Polish Airlines LO391", detail: "0 stops", amount: 340 },
      prefs({ airlines: ["lot"], maxConnections: 0 }),
    );
    expect(match?.met).toBe(2);
  });

  it("scores a car against gearbox and make", () => {
    const match = offerMatch(
      { kind: "car", title: "BMW 3 Series", detail: "Automatic", amount: 200 },
      prefs({ carBrands: ["bmw"], carTransmission: "automatic" }),
    );
    expect(match?.met).toBe(2);
    expect(match?.total).toBe(2);
  });
});
