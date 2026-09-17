import { describe, expect, it } from "vitest";
import {
  bedTypesFrom,
  breakfastFrom,
  cheapestRate,
  matchStaticRoom,
  nightsBetween,
  refundableFromTag,
} from "./liteapi";

describe("cheapestRate", () => {
  it("takes the lowest priced rate across every room type", () => {
    const best = cheapestRate({
      roomTypes: [
        {
          rates: [
            {
              rateId: "a",
              boardName: "Room Only",
              retailRate: { total: [{ amount: 420, currency: "EUR" }] },
            },
          ],
        },
        {
          rates: [
            {
              rateId: "b",
              boardName: "Breakfast",
              retailRate: { total: [{ amount: 380, currency: "EUR" }] },
            },
          ],
        },
      ],
    });
    expect(best?.rateId).toBe("b");
    expect(best?.amount).toBe(380);
  });

  it("ignores a room with no price rather than showing it as free", () => {
    const best = cheapestRate({
      roomTypes: [
        { rates: [{ rateId: "a", retailRate: { total: [{ amount: 0, currency: "EUR" }] } }] },
        { rates: [{ rateId: "b", retailRate: { total: [{ amount: 310, currency: "EUR" }] } }] },
      ],
    });
    expect(best?.rateId).toBe("b");
  });

  it("returns nothing when the hotel has no bookable rate", () => {
    expect(cheapestRate({ roomTypes: [] })).toBeNull();
  });
});

describe("breakfastFrom", () => {
  it("reads the board name rather than assuming", () => {
    expect(breakfastFrom("Breakfast included")).toBe(true);
    expect(breakfastFrom("Room Only")).toBe(false);
    expect(breakfastFrom("Half board")).toBeNull();
    expect(breakfastFrom(null)).toBeNull();
  });
});

describe("nightsBetween", () => {
  it("counts nights, not days", () => {
    expect(nightsBetween("2026-11-10", "2026-11-12")).toBe(2);
  });

  it("never returns zero, so a price is never divided by nothing", () => {
    expect(nightsBetween("2026-11-10", "2026-11-10")).toBe(1);
    expect(nightsBetween("nonsense", "also nonsense")).toBe(1);
  });
});

describe("refundableFromTag", () => {
  it("only trusts liteAPI's own refundable tag, nothing else", () => {
    expect(refundableFromTag("RFN")).toBe(true);
    expect(refundableFromTag("NRFN")).toBe(false);
    expect(refundableFromTag(undefined)).toBe(false);
  });
});

describe("bedTypesFrom", () => {
  it("carries the bed layout through as-is", () => {
    expect(bedTypesFrom([{ bedType: "Double bed", quantity: 1 }])).toEqual([
      { bedType: "Double bed", quantity: 1 },
    ]);
  });

  it("drops an entry with no bed type rather than showing a blank one", () => {
    expect(bedTypesFrom([{ quantity: 2 }])).toEqual([]);
  });

  it("floors quantity at one, never shows a room with zero beds", () => {
    expect(bedTypesFrom([{ bedType: "Twin bed", quantity: 0 }])).toEqual([
      { bedType: "Twin bed", quantity: 1 },
    ]);
  });

  it("returns nothing for an empty or missing list", () => {
    expect(bedTypesFrom(undefined)).toEqual([]);
    expect(bedTypesFrom([])).toEqual([]);
  });
});

describe("matchStaticRoom", () => {
  const staticRooms = [
    { roomName: 'Double Queen "Signature" Room', roomSizeSquare: 18 },
    { roomName: "Chambre Classique", roomSizeSquare: 14 },
  ];

  it("finds the room whose name shares most of the rate's words", () => {
    const match = matchStaticRoom("Signature Queen Room", staticRooms);
    expect(match?.roomSizeSquare).toBe(18);
  });

  it("returns nothing when no static room name overlaps enough to trust", () => {
    expect(matchStaticRoom("Run of House", staticRooms)).toBeNull();
  });

  it("returns nothing for an empty catalogue", () => {
    expect(matchStaticRoom("Chambre Classique", [])).toBeNull();
  });
});
