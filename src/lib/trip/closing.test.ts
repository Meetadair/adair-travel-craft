import { describe, expect, it } from "vitest";
import { buildClosing, extrasSentence, nothingToAsk, summaryLine } from "./closing";

const base = {
  companies: [],
  cards: [],
  invoiceMentioned: false,
  extras: [],
  passportRequired: false,
  travellerComplete: true,
  partySize: 1,
  companionsChosen: 0,
};

const company = (id: string, name: string) => ({ id, name, isDefault: true });
const card = (id: string, last4: string) => ({
  id,
  brand: "visa",
  last4,
  isDefault: true,
});

describe("buildClosing", () => {
  it("asks nothing when one company and one card are saved", () => {
    const closing = buildClosing({
      ...base,
      companies: [company("c1", "KRAM Development")],
      cards: [card("k1", "4417")],
    });
    expect(nothingToAsk(closing)).toBe(true);
    expect(closing.companyId).toBe("c1");
    expect(closing.cardId).toBe("k1");
  });

  it("asks once when several companies are saved", () => {
    const closing = buildClosing({
      ...base,
      companies: [company("c1", "KRAM Development"), company("c2", "KRAM Investment")],
      cards: [card("k1", "4417")],
    });
    expect(closing.questions).toHaveLength(1);
    expect(closing.questions[0]!.kind).toBe("invoice_choose");
    expect(closing.questions[0]!.options.map((o) => o.label)).toContain("No invoice");
    expect(closing.companyId).toBeNull();
  });

  it("asks for the company once when an invoice was mentioned and none is saved", () => {
    const closing = buildClosing({ ...base, invoiceMentioned: true, cards: [card("k1", "4417")] });
    expect(closing.questions.map((q) => q.kind)).toEqual(["invoice_company_name"]);
  });

  it("does not mention invoicing when none is saved and none was asked for", () => {
    const closing = buildClosing({ ...base, cards: [card("k1", "4417")] });
    expect(closing.questions).toHaveLength(0);
  });

  it("renders the card form inline when no card is saved", () => {
    const closing = buildClosing({ ...base, companies: [company("c1", "KRAM")] });
    expect(closing.questions.map((q) => q.kind)).toEqual(["card_new"]);
    expect(closing.cardId).toBeNull();
  });

  it("asks which card when several are saved", () => {
    const closing = buildClosing({
      ...base,
      companies: [company("c1", "KRAM")],
      cards: [card("k1", "4417"), { ...card("k2", "1002"), isDefault: false }],
    });
    expect(closing.questions.map((q) => q.kind)).toEqual(["card_choose"]);
    expect(closing.questions[0]!.options).toHaveLength(3);
  });

  it("asks for ticket details once when they are not on file", () => {
    const closing = buildClosing({
      ...base,
      travellerComplete: false,
      companies: [company("c1", "KRAM")],
      cards: [card("k1", "4417")],
    });
    expect(closing.questions.map((q) => q.kind)).toEqual(["traveller_details"]);
    expect(closing.questions[0]!.essential).toBe(true);
  });

  it("hands passport routes to the booking page", () => {
    const closing = buildClosing({ ...base, passportRequired: true, cards: [card("k1", "4417")] });
    expect(closing.fallback).toBe("passport");
  });

  it("asks who else is travelling when the party is more than one", () => {
    const closing = buildClosing({
      ...base,
      partySize: 2,
      companionsChosen: 0,
      cards: [card("k1", "4417")],
    });
    expect(closing.questions.map((q) => q.kind)).toEqual(["companions_choose"]);
    expect(closing.questions[0]!.essential).toBe(true);
  });

  it("keeps asking until enough companions are picked", () => {
    const closing = buildClosing({
      ...base,
      partySize: 3,
      companionsChosen: 1,
      cards: [card("k1", "4417")],
    });
    expect(closing.questions.map((q) => q.kind)).toEqual(["companions_choose"]);
  });

  it("stops asking once every seat has a name on it", () => {
    const closing = buildClosing({
      ...base,
      partySize: 2,
      companionsChosen: 1,
      cards: [card("k1", "4417")],
    });
    expect(closing.questions).toHaveLength(0);
  });

  it("asks nothing extra for a solo trip", () => {
    const closing = buildClosing({
      ...base,
      partySize: 1,
      companionsChosen: 0,
      cards: [card("k1", "4417")],
    });
    expect(closing.questions).toHaveLength(0);
  });

  it("confirms extras in one line instead of asking", () => {
    const closing = buildClosing({
      ...base,
      cards: [card("k1", "4417")],
      extras: [
        { id: "table", label: "the 7pm table" },
        { id: "ride", label: "the airport transfer" },
      ],
    });
    expect(closing.extrasLine).toBe("Adding the 7pm table and the airport transfer.");
    expect(closing.questions).toHaveLength(0);
  });
});

describe("extrasSentence", () => {
  it("is empty with no extras", () => {
    expect(extrasSentence([])).toBeNull();
  });

  it("reads naturally with one extra", () => {
    expect(extrasSentence([{ id: "bag", label: "a checked bag" }])).toBe("Adding a checked bag.");
  });
});

describe("summaryLine", () => {
  it("states everything decided, the price, then the ask", () => {
    expect(
      summaryLine({
        parts: ["Milan", "Thu–Fri", "LOT 6:55", "Park Hyatt", "transfer"],
        companyName: "KRAM Development",
        cardLabel: "card 4417",
        totalLabel: "€1,240",
      }),
    ).toBe(
      "Milan, Thu–Fri, LOT 6:55, Park Hyatt, transfer, invoice to KRAM Development, card 4417 — €1,240. Book it?",
    );
  });

  it("leaves out what does not apply", () => {
    expect(
      summaryLine({
        parts: ["Milan", "Thu–Fri"],
        companyName: null,
        cardLabel: null,
        totalLabel: "€300",
      }),
    ).toBe("Milan, Thu–Fri — €300. Book it?");
  });
});
