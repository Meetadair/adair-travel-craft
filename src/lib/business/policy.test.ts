import { describe, expect, it } from "vitest";
import {
  BAND_MULTIPLIER,
  DEFAULT_GRADES,
  bandFor,
  cabinFor,
  carAllowed,
  checkTrip,
  hotelCapMinor,
  lowestLogicalFare,
  noticeDays,
  preferRail,
  railAllowed,
  type Grade,
} from "./policy";

const grade = (id: string): Grade => DEFAULT_GRADES.find((g) => g.id === id)!;
const TODAY = "2026-09-14";

describe("grades", () => {
  it("ships the five the booklet sold", () => {
    expect(DEFAULT_GRADES.map((g) => g.id)).toEqual([
      "board",
      "director",
      "manager",
      "standard",
      "entry",
    ]);
  });

  it("never lets a lower grade out-spend a higher one on a room", () => {
    const caps = DEFAULT_GRADES.map((g) => g.hotelCapMinor);
    expect([...caps].sort((a, b) => b - a)).toEqual(caps);
  });

  it("asks more notice of lower grades, not less", () => {
    const notice = DEFAULT_GRADES.map((g) => g.noticeDays);
    expect([...notice].sort((a, b) => a - b)).toEqual(notice);
  });
});

describe("cabin", () => {
  it("gives the board business class on a long flight and economy on a hop", () => {
    expect(cabinFor(grade("board"), 9)).toBe("business");
    expect(cabinFor(grade("board"), 1.5)).toBe("economy");
  });

  it("holds the line at exactly the threshold", () => {
    expect(cabinFor(grade("board"), 4)).toBe("business");
    expect(cabinFor(grade("board"), 3.99)).toBe("economy");
  });

  it("keeps everyone else in economy however long the flight", () => {
    for (const id of ["manager", "standard", "entry"]) {
      expect(cabinFor(grade(id), 14)).toBe("economy");
    }
  });
});

describe("city bands", () => {
  it("knows Zurich is not Poznań", () => {
    expect(bandFor("Zurich")).toBe("1");
    expect(bandFor("Poznań")).toBe("4");
  });

  it("treats an unknown city as the cheapest band, never the dearest", () => {
    // Guessing upwards would quietly hand every traveller a bigger budget for
    // any city we have not classified.
    expect(bandFor("Ostrołęka")).toBe("4");
    expect(BAND_MULTIPLIER[bandFor("Ostrołęka")]).toBe(1);
  });

  it("is case and whitespace insensitive, because the parser is not tidy", () => {
    expect(bandFor("  new york ")).toBe("1");
  });

  it("makes a standard cap workable in an expensive city", () => {
    // The whole point of bands: €110 flat would exclude every hotel in Zurich.
    expect(hotelCapMinor(grade("standard"), "Zurich")).toBe(19_800);
    expect(hotelCapMinor(grade("standard"), "Warsaw")).toBe(11_000);
  });

  it("lifts the cap during a fair, when every hotel in town triples", () => {
    expect(hotelCapMinor(grade("standard"), "Barcelona", true)).toBe(24_200);
  });
});

describe("the worked example from the booklet", () => {
  it("lets the president fly business and stay on Fifth Avenue", () => {
    const verdict = checkTrip(
      grade("board"),
      {
        destinationCity: "New York",
        departDate: "2026-09-20",
        cabin: "business",
        flightHours: 8.5,
        hotelNightlyMinor: 30_000,
        carClass: "executive",
      },
      TODAY,
    );
    expect(verdict.ok).toBe(true);
  });

  it("puts Kowalski in second class and a room by the station", () => {
    const verdict = checkTrip(
      grade("standard"),
      {
        destinationCity: "Poznań",
        departDate: "2026-10-20",
        railClass: "second",
        hotelNightlyMinor: 9_500,
        carClass: "economy",
      },
      TODAY,
    );
    expect(verdict.ok).toBe(true);
  });

  it("stops Kowalski booking the president's trip", () => {
    const verdict = checkTrip(
      grade("standard"),
      {
        destinationCity: "New York",
        departDate: "2026-09-20",
        cabin: "business",
        flightHours: 8.5,
        hotelNightlyMinor: 30_000,
        carClass: "executive",
      },
      TODAY,
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.violations.map((v) => v.rule).sort()).toEqual([
      "cabin",
      "car",
      "hotel",
      "notice",
    ]);
  });

  it("says what it would cost to come back inside the standard", () => {
    const verdict = checkTrip(
      grade("standard"),
      { destinationCity: "Warsaw", departDate: "2026-10-20", hotelNightlyMinor: 14_000 },
      TODAY,
    );
    expect(verdict.violations[0]?.overMinor).toBe(3_000);
  });

  it("explains itself in words a traveller can act on", () => {
    const verdict = checkTrip(
      grade("standard"),
      { destinationCity: "Warsaw", departDate: "2026-10-20", hotelNightlyMinor: 14_000 },
      TODAY,
    );
    // Not "HOTEL_CAP_EXCEEDED". A person has to read this.
    expect(verdict.violations[0]?.detail).toContain("€140");
    expect(verdict.violations[0]?.detail).toContain("Warsaw");
  });
});

describe("notice", () => {
  it("counts the days to departure", () => {
    expect(noticeDays("2026-09-24", TODAY)).toBe(10);
    expect(noticeDays("2026-09-14", TODAY)).toBe(0);
  });

  it("never lets a past departure read as plenty of notice", () => {
    const verdict = checkTrip(
      grade("standard"),
      { destinationCity: "Warsaw", departDate: "2026-09-01" },
      TODAY,
    );
    expect(verdict.violations.some((v) => v.rule === "notice")).toBe(true);
  });

  it("asks nothing of the board, who book the same morning", () => {
    const verdict = checkTrip(
      grade("board"),
      { destinationCity: "Warsaw", departDate: TODAY },
      TODAY,
    );
    expect(verdict.ok).toBe(true);
  });
});

describe("cars and rail", () => {
  it("gives the entry grade no car at all", () => {
    expect(carAllowed(grade("entry"), "none")).toBe(true);
    expect(carAllowed(grade("entry"), "economy")).toBe(false);
  });

  it("lets a grade take less than it is entitled to", () => {
    expect(carAllowed(grade("board"), "economy")).toBe(true);
    expect(railAllowed(grade("board"), "second")).toBe(true);
  });

  it("does not let a second-class grade ride first", () => {
    expect(railAllowed(grade("standard"), "first")).toBe(false);
  });
});

describe("lowest logical fare", () => {
  const fares = [
    { id: "cheap-slow", amountMinor: 14_000, durationMinutes: 600 },
    { id: "dearer-fast", amountMinor: 17_000, durationMinutes: 260 },
    { id: "dear-fast", amountMinor: 30_000, durationMinutes: 240 },
  ];

  it("pays a little more to save a lot of time", () => {
    expect(lowestLogicalFare(fares)?.id).toBe("dearer-fast");
  });

  it("will not pay a lot more for a little more time", () => {
    expect(lowestLogicalFare([fares[0]!, fares[2]!])?.id).toBe("cheap-slow");
  });

  it("takes the cheapest when nothing saves real time", () => {
    const close = [
      { id: "a", amountMinor: 14_000, durationMinutes: 300 },
      { id: "b", amountMinor: 15_000, durationMinutes: 280 },
    ];
    expect(lowestLogicalFare(close)?.id).toBe("a");
  });

  it("has nothing to say about an empty list", () => {
    expect(lowestLogicalFare([])).toBeNull();
  });
});

describe("rail before air", () => {
  it("prefers the train Warsaw to Kraków", () => {
    expect(preferRail(250)).toBe(true);
  });

  it("does not put anyone on a train to Lisbon", () => {
    expect(preferRail(2_900)).toBe(false);
  });
});
