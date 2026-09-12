import { describe, expect, it } from "vitest";
import {
  ANCILLARY_NONE_NOTE,
  ancillariesNetEur,
  ancillariesTotalEur,
  ancillaryLines,
  bagLabel,
  customerPriceEur,
  preselectAncillaries,
  seatDetail,
  type AncillaryOption,
} from "./ancillaries";

const rule = { markupBps: 4000, discountBps: 0 };

const bag = (id: string, netEur: number, weightKg: number | null): AncillaryOption => ({
  id,
  kind: "bag",
  label: bagLabel(weightKg),
  detail: null,
  netEur,
  priceEur: customerPriceEur(netEur, rule),
  currency: "EUR",
  maxQuantity: 2,
  bag: { weightKg },
});

const seat = (
  id: string,
  netEur: number,
  position: "window" | "aisle" | "middle",
  extraLegroom = false,
): AncillaryOption => ({
  id,
  kind: "seat",
  label: `Seat ${id}`,
  detail: null,
  netEur,
  priceEur: customerPriceEur(netEur, rule),
  currency: "EUR",
  maxQuantity: 1,
  seat: { position, extraLegroom },
});

describe("extras pricing", () => {
  it("applies the extras markup", () => {
    expect(customerPriceEur(30, rule)).toBe(42);
  });

  it("totals the customer and supplier sides separately", () => {
    const options = [bag("b1", 30, 23), seat("12A", 10, "window")];
    const selection = [
      { id: "b1", quantity: 2 },
      { id: "12A", quantity: 1 },
    ];
    expect(ancillariesTotalEur(options, selection)).toBe(98);
    expect(ancillariesNetEur(options, selection)).toBe(70);
  });

  it("ignores selections the airline no longer offers", () => {
    expect(ancillariesTotalEur([bag("b1", 30, 23)], [{ id: "gone", quantity: 1 }])).toBe(0);
  });
});

describe("preselectAncillaries", () => {
  const options = [
    bag("b1", 30, 23),
    bag("b2", 45, 32),
    seat("12A", 15, "window"),
    seat("12C", 9, "aisle"),
    seat("1A", 25, "window", true),
  ];

  it("takes the stored seat preference over the cheapest seat", () => {
    const picked = preselectAncillaries(
      options,
      { seat: "window", seatFront: false, seatLegroom: false },
      { nights: 1, passengers: 1 },
    );
    expect(picked.some((p) => p.id === "12A")).toBe(true);
    expect(picked.some((p) => p.id === "12C")).toBe(false);
  });

  it("honours an extra legroom preference", () => {
    const picked = preselectAncillaries(
      options,
      { seat: "window", seatFront: false, seatLegroom: true },
      { nights: 1, passengers: 1 },
    );
    expect(picked[0]?.id).toBe("1A");
  });

  it("adds a bag only when the trip is longer than two nights", () => {
    const short = preselectAncillaries(
      options,
      { seat: "any", seatFront: false, seatLegroom: false },
      { nights: 2, passengers: 1 },
    );
    expect(short.some((p) => p.id === "b1")).toBe(false);

    const long = preselectAncillaries(
      options,
      { seat: "any", seatFront: false, seatLegroom: false },
      { nights: 5, passengers: 2 },
    );
    const chosenBag = long.find((p) => p.id === "b1");
    expect(chosenBag?.quantity).toBe(2);
  });

  it("selects nothing when the fare carries no extras", () => {
    expect(
      preselectAncillaries(
        [],
        { seat: "window", seatFront: true, seatLegroom: true },
        { nights: 9, passengers: 3 },
      ),
    ).toEqual([]);
    expect(ANCILLARY_NONE_NOTE).toContain("cabin bag only");
  });
});

describe("ancillaryLines", () => {
  it("makes one line per chosen extra with the multiplied price", () => {
    const options = [bag("b1", 30, 23), seat("12A", 10, "window", true)];
    const lines = ancillaryLines(options, [
      { id: "b1", quantity: 2 },
      { id: "12A", quantity: 1 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.title).toBe("Checked bag · 23 kg");
    expect(lines[0]?.priceEur).toBe(84);
    expect(lines[1]?.detail).toBe("window · extra legroom");
  });

  it("describes a seat without traits plainly", () => {
    expect(seatDetail(seat("12B", 5, "middle"))).toBe("middle");
  });
});
