import { describe, expect, it } from "vitest";

import { calendarDates } from "./parse";
import { parseTripSentence } from "./parse";

const from = new Date(Date.UTC(2026, 8, 14)); // 14 September 2026
const iso = (date: Date) => date.toISOString().slice(0, 10);

describe("calendarDates", () => {
  it("reads a written month, both ways round", () => {
    expect(
      calendarDates("Berlin from 8 October to 12 October", from).map((h) => iso(h.date)),
    ).toEqual(["2026-10-08", "2026-10-12"]);
    expect(calendarDates("Berlin October 8 to October 12", from).map((h) => iso(h.date))).toEqual([
      "2026-10-08",
      "2026-10-12",
    ]);
  });

  it("reads Polish months", () => {
    expect(calendarDates("Berlin 8 października", from).map((h) => iso(h.date))).toEqual([
      "2026-10-08",
    ]);
  });

  it("reads numeric dates the European way round", () => {
    // 8.10 is October, not August. Getting this backwards books the wrong month.
    expect(calendarDates("Berlin 8.10 to 12.10", from).map((h) => iso(h.date))).toEqual([
      "2026-10-08",
      "2026-10-12",
    ]);
  });

  it("reads an ISO date", () => {
    expect(calendarDates("Berlin 2026-10-08", from).map((h) => iso(h.date))).toEqual([
      "2026-10-08",
    ]);
  });

  it("reads a date already past as next year", () => {
    expect(calendarDates("Berlin 8 March", from).map((h) => iso(h.date))).toEqual(["2027-03-08"]);
  });

  it("refuses a day that does not exist", () => {
    expect(calendarDates("Berlin 31 February", from)).toEqual([]);
  });

  it("keeps them in the order they were written", () => {
    const hits = calendarDates("out 12 October, back 20 October", from);
    expect(hits.map((h) => iso(h.date))).toEqual(["2026-10-12", "2026-10-20"]);
  });
});

describe("the parser honours written dates", () => {
  it("uses the dates in the sentence rather than a default week", () => {
    const parsed = parseTripSentence("Berlin from 8 October to 12 October");
    expect(parsed?.departDate).toBe("2026-10-08");
    expect(parsed?.returnDate).toBe("2026-10-12");
  });

  it("prefers a written date over a weekday in the same sentence", () => {
    // "Thursday" must not quietly overrule a date they typed out.
    const parsed = parseTripSentence("Berlin 8 October, back Thursday");
    expect(parsed?.departDate).toBe("2026-10-08");
  });
});
