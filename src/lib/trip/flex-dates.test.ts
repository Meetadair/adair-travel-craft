import { describe, expect, it } from "vitest";
import { rangeSentence } from "./answers";
import { flexDaysOf, parseTripSentence } from "./parse";

describe("flexible dates travel from the picker to the parser", () => {
  it("reads the ways people write it", () => {
    expect(flexDaysOf("Milan, +/- 3 days")).toBe(3);
    expect(flexDaysOf("Milan, ± 3 days")).toBe(3);
    expect(flexDaysOf("Milan, plus minus 2 days")).toBe(2);
    expect(flexDaysOf("Mediolan, ± 3 dni")).toBe(3);
  });

  it("is never assumed", () => {
    expect(flexDaysOf("Milan Thursday to Sunday")).toBeNull();
    expect(flexDaysOf("Milan for 3 days")).toBeNull();
    expect(parseTripSentence("Milan Thursday to Sunday")?.flexDays).toBeUndefined();
  });

  it("ignores a window nobody means", () => {
    // Beyond a fortnight they are choosing a month, not flexing a date.
    expect(flexDaysOf("Milan, +/- 40 days")).toBeNull();
    expect(flexDaysOf("Milan, +/- 0 days")).toBeNull();
  });

  it("survives the round trip from the picker", () => {
    const sentence = rangeSentence({
      departDate: "2026-10-05",
      returnDate: "2026-10-09",
      flexDays: 3,
    });
    expect(sentence).toBe("from 2026-10-05 to 2026-10-09, +/- 3 days");
    const parsed = parseTripSentence(`Milan ${sentence}`);
    expect(parsed?.flexDays).toBe(3);
    // And the dates themselves are still read correctly, not confused by "3 days".
    expect(parsed?.departDate).toBe("2026-10-05");
    expect(parsed?.returnDate).toBe("2026-10-09");
  });

  it("combines with a one-way", () => {
    const sentence = rangeSentence({ departDate: "2026-10-05", oneWay: true, flexDays: 3 });
    expect(sentence).toBe("on 2026-10-05, one way, +/- 3 days");
    const parsed = parseTripSentence(`Milan ${sentence}`);
    expect(parsed?.oneWay).toBe(true);
    expect(parsed?.flexDays).toBe(3);
  });
});
