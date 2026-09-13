import { describe, expect, it } from "vitest";
import {
  dateShortcuts,
  isPastDate,
  monthRange,
  rangeSentence,
  searchAirports,
  timeSentence,
} from "./answers";

describe("date shortcuts", () => {
  it("this weekend is the coming Friday to Sunday", () => {
    // Wednesday 2026-09-16
    const [thisWeekend] = dateShortcuts("2026-09-16");
    expect(thisWeekend!.range).toEqual({ departDate: "2026-09-18", returnDate: "2026-09-20" });
  });

  it("on a Saturday, this weekend means the next one — never a past Friday", () => {
    const [thisWeekend] = dateShortcuts("2026-09-19");
    expect(isPastDate(thisWeekend!.range.departDate, "2026-09-19")).toBe(false);
  });

  it("next weekend is a week later, and tomorrow is a single day", () => {
    const [, next, tomorrow] = dateShortcuts("2026-09-16");
    expect(next!.range.departDate).toBe("2026-09-25");
    expect(tomorrow!.range).toEqual({ departDate: "2026-09-17" });
  });
});

describe("answers folded back into the sentence", () => {
  it("writes a range, and a single day when there is no return", () => {
    expect(rangeSentence({ departDate: "2026-10-18", returnDate: "2026-10-20" })).toBe(
      "from 2026-10-18 to 2026-10-20",
    );
    expect(rangeSentence({ departDate: "2026-10-18" })).toBe("on 2026-10-18");
    expect(rangeSentence({ departDate: "2026-10-18", returnDate: "2026-10-18" })).toBe(
      "on 2026-10-18",
    );
    expect(timeSentence("09:30")).toBe("there by 09:30");
  });
});

describe("calendar bounds", () => {
  it("opens on the current month and runs a year forward", () => {
    expect(monthRange("2026-10-18")).toEqual({ start: "2026-10-01", end: "2027-09-01" });
    expect(monthRange("2026-01-05")).toEqual({ start: "2026-01-01", end: "2026-12-01" });
  });

  it("disables yesterday and allows today", () => {
    expect(isPastDate("2026-10-17", "2026-10-18")).toBe(true);
    expect(isPastDate("2026-10-18", "2026-10-18")).toBe(false);
  });
});

describe("searchable airport list", () => {
  it("finds an airport by code, city, country or name", () => {
    expect(searchAirports("MXP")[0]!.iata).toBe("MXP");
    expect(searchAirports("mila").map((m) => m.iata).sort()).toEqual(["LIN", "MXP"]);
    expect(searchAirports("malpensa")[0]!.iata).toBe("MXP");
    expect(searchAirports("poland").length).toBeGreaterThan(3);
  });

  it("shows a short list before anything is typed", () => {
    expect(searchAirports("", 5)).toHaveLength(5);
  });
});
