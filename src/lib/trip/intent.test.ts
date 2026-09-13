import { describe, expect, it } from "vitest";

import { normaliseIntent, replyFor, ruleIntent } from "./intent";
import { hasDestination, parseTripSentence } from "./parse";

describe("intent classification", () => {
  it("treats a bare greeting as a greeting", () => {
    expect(ruleIntent("hi")).toBe("greeting");
    expect(ruleIntent("Hello!")).toBe("greeting");
    expect(ruleIntent("cześć")).toBe("greeting");
    expect(ruleIntent("thanks")).toBe("greeting");
  });

  it("recognises a trip", () => {
    expect(ruleIntent("Milan Tuesday to Thursday")).toBe("trip");
    expect(ruleIntent("I need to be in Paris on Monday morning")).toBe("trip");
  });

  it("reads a change to the trip on screen as an amendment", () => {
    expect(ruleIntent("an earlier flight please", true)).toBe("amendment");
    expect(ruleIntent("cheaper hotel", true)).toBe("amendment");
    // Without a card there is nothing to amend.
    expect(ruleIntent("cheaper hotel")).not.toBe("amendment");
  });

  it("separates questions about the product from questions about a booking", () => {
    expect(ruleIntent("how does this work?")).toBe("product_question");
    expect(ruleIntent("what do you charge?")).toBe("product_question");
    expect(ruleIntent("when is my flight?")).toBe("booking_question");
    expect(ruleIntent("cancel my trip")).toBe("booking_question");
  });

  it("calls nonsense unclear instead of inventing a trip", () => {
    expect(ruleIntent("asdfgh")).toBe("unclear");
    expect(ruleIntent("")).toBe("unclear");
  });

  it("only accepts known categories from the model", () => {
    expect(normaliseIntent("Trip\n")).toBe("trip");
    expect(normaliseIntent("something else")).toBe("unclear");
  });

  it("answers with copy for everything that is not searchable", () => {
    const copy = {
      greeting: "g",
      product: "p",
      booking: "b",
      unclear: "u",
      needsDestination: "d",
    };
    expect(replyFor("greeting", copy)).toBe("g");
    expect(replyFor("product_question", copy)).toBe("p");
    expect(replyFor("booking_question", copy)).toBe("b");
    expect(replyFor("unclear", copy)).toBe("u");
    expect(replyFor("trip", copy)).toBeNull();
  });
});

describe("no guessed destination", () => {
  it("returns null when no place is named", () => {
    expect(parseTripSentence("hi")).toBeNull();
    expect(parseTripSentence("two nights, business class")).toBeNull();
    expect(hasDestination("hi there")).toBe(false);
  });

  it("still parses a sentence with a destination", () => {
    expect(hasDestination("Milan on Tuesday")).toBe(true);
    expect(parseTripSentence("Milan on Tuesday")?.destinationIata).toBe("LIN");
  });
});
