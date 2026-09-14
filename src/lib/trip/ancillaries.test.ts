import { describe, expect, it } from "vitest";
import {
  ANCILLARY_NONE_NOTE,
  ancillariesNetEur,
  ancillariesTotalEur,
  ancillaryLines,
  bagLabel,
  buildSeatMap,
  customerPriceEur,
  preselectAncillaries,
  seatDetail,
  type AncillaryOption,
  type RawSeatMapCabin,
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

describe("buildSeatMap", () => {
  const seatEl = (designator: string, netEur: number | null, disclosures: string[] = []) => ({
    type: "seat",
    designator,
    disclosures,
    available_services:
      netEur === null
        ? []
        : [{ id: `svc-${designator}`, total_amount: String(netEur), total_currency: "EUR" }],
  });

  it("groups a single-aisle 3-3 row into two sections with the aisle as the gap", () => {
    const cabins: RawSeatMapCabin[] = [
      {
        rows: [
          {
            sections: [
              { elements: [seatEl("12A", 10), seatEl("12B", 8), seatEl("12C", 12)] },
              { elements: [seatEl("12D", 12), seatEl("12E", 8), seatEl("12F", 10)] },
            ],
          },
        ],
      },
    ];

    const { rows, options } = buildSeatMap(cabins, rule);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.label).toBe("12");
    expect(rows[0]?.sections).toHaveLength(2);
    expect(rows[0]?.sections[0]?.map((c) => (c.kind === "seat" ? c.column : c.kind))).toEqual([
      "A",
      "B",
      "C",
    ]);

    // Left block: A is by the window, C is by the aisle (touches the gap).
    expect(options.find((o) => o.id === "svc-12A")?.seat?.position).toBe("window");
    expect(options.find((o) => o.id === "svc-12C")?.seat?.position).toBe("aisle");
    expect(options.find((o) => o.id === "svc-12B")?.seat?.position).toBe("middle");
    // Right block is the mirror image: D is by the aisle, F is by the window.
    expect(options.find((o) => o.id === "svc-12D")?.seat?.position).toBe("aisle");
    expect(options.find((o) => o.id === "svc-12F")?.seat?.position).toBe("window");
  });

  it("marks a seat with no available_services as taken, still keeping its place in the grid", () => {
    const cabins: RawSeatMapCabin[] = [
      {
        rows: [
          { sections: [{ elements: [seatEl("1A", 20), seatEl("1B", null), seatEl("1C", 20)] }] },
        ],
      },
    ];
    const { rows, options } = buildSeatMap(cabins, rule);
    expect(rows[0]?.sections[0]?.[1]).toEqual({ kind: "taken", column: "B" });
    expect(options.some((o) => o.id.includes("1B"))).toBe(false);
  });

  it("renders galley and lavatory elements as blank spacers, not seats", () => {
    const cabins: RawSeatMapCabin[] = [
      {
        rows: [
          {
            sections: [{ elements: [seatEl("1A", 20), { type: "lavatory" }, seatEl("1C", 20)] }],
          },
        ],
      },
    ];
    const { rows } = buildSeatMap(cabins, rule);
    expect(rows[0]?.sections[0]?.[1]).toEqual({ kind: "blank" });
  });

  it("drops a row with no seat at all, so nothing renders as a mystery empty line", () => {
    const cabins: RawSeatMapCabin[] = [
      { rows: [{ sections: [{ elements: [{ type: "galley" }, { type: "lavatory" }] }] }] },
    ];
    expect(buildSeatMap(cabins, rule).rows).toHaveLength(0);
  });

  it("flags extra-legroom seats from their disclosures", () => {
    const cabins: RawSeatMapCabin[] = [
      { rows: [{ sections: [{ elements: [seatEl("14A", 25, ["Extra legroom seat"])] }] }] },
    ];
    const { options } = buildSeatMap(cabins, rule);
    expect(options[0]?.seat?.extraLegroom).toBe(true);
  });

  it("prices seats with the extras markup, same as any other ancillary", () => {
    const cabins: RawSeatMapCabin[] = [
      { rows: [{ sections: [{ elements: [seatEl("1A", 30)] }] }] },
    ];
    const { options } = buildSeatMap(cabins, rule);
    expect(options[0]?.priceEur).toBe(customerPriceEur(30, rule));
  });
});
