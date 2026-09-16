import { describe, expect, it } from "vitest";
import { FEEDBACK_SCALE, feedbackOptions, needsFollowUp, ratingOf } from "./feedback";

describe("the question at the end of a booking", () => {
  it("offers four answers, worst to best", () => {
    expect(FEEDBACK_SCALE.map((o) => o.key)).toEqual([
      "not_satisfied",
      "satisfied",
      "good",
      "fantastic",
    ]);
    expect(FEEDBACK_SCALE.map((o) => o.rating)).toEqual([1, 2, 3, 4]);
  });

  it("falls back to English for a locale that has not been translated", () => {
    const options = feedbackOptions({ fantastic: "Fantastycznie" });
    expect(options.map((o) => o.label)).toEqual([
      "Not satisfied",
      "Satisfied",
      "Good",
      "Fantastycznie",
    ]);
  });

  it("treats a merely satisfied trip as a miss worth following up", () => {
    // The promise is a trip that matches what someone wanted. "Satisfied" is
    // what people answer when it nearly did, and that is the answer worth
    // chasing — nobody writes a complaint about a trip that was fine.
    expect(needsFollowUp("not_satisfied")).toBe(true);
    expect(needsFollowUp("satisfied")).toBe(true);
    expect(needsFollowUp("good")).toBe(false);
    expect(needsFollowUp("fantastic")).toBe(false);
  });

  it("scores every answer on the same scale it stores", () => {
    expect(ratingOf("not_satisfied")).toBe(1);
    expect(ratingOf("fantastic")).toBe(4);
  });
});
