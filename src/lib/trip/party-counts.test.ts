import { describe, expect, it } from "vitest";
import {
  EMPTY_PARTY,
  MAX_SEATS,
  adjust,
  describeParty,
  duffelPassengers,
  headCount,
  isBookableParty,
  partyProblems,
  seatCount,
  stayGuestAges,
  type PartyCounts,
} from "./party-counts";

const party = (over: Partial<PartyCounts> = {}): PartyCounts => ({ ...EMPTY_PARTY, ...over });

describe("counting", () => {
  it("does not count a lap infant as a seat", () => {
    const p = party({ adults: 2, infantsOnLap: 1 });
    expect(seatCount(p)).toBe(2);
    expect(headCount(p)).toBe(3);
  });

  it("does count a seated infant as a seat, because we are buying one", () => {
    const p = party({ adults: 2, infantsWithSeat: 1 });
    expect(seatCount(p)).toBe(3);
    expect(headCount(p)).toBe(3);
  });
});

describe("what airlines will not sell", () => {
  it("accepts an ordinary family", () => {
    expect(isBookableParty(party({ adults: 2, children: 2, infantsOnLap: 1 }))).toBe(true);
  });

  it("refuses a booking with nobody over sixteen on it", () => {
    expect(partyProblems(party({ adults: 0 }))).toContain("no_adult");
  });

  it("calls a party of only under-sixteens what it is", () => {
    // Unaccompanied minors are handled by phone and paperwork, never an API.
    expect(partyProblems(party({ adults: 0, teenagers: 2 }))).toContain("unaccompanied_minor");
  });

  it("refuses more lap infants than there are laps", () => {
    expect(partyProblems(party({ adults: 1, infantsOnLap: 2 }))).toContain("too_many_lap_infants");
    expect(partyProblems(party({ adults: 2, infantsOnLap: 2 }))).toEqual([]);
  });

  it("refuses more than nine seats", () => {
    expect(partyProblems(party({ adults: 10 }))).toContain("too_many_seats");
    expect(partyProblems(party({ adults: MAX_SEATS }))).toEqual([]);
  });

  it("does not count lap infants towards the seat limit", () => {
    expect(isBookableParty(party({ adults: 9, infantsOnLap: 9 }))).toBe(true);
  });
});

describe("what Duffel is sent", () => {
  it("sends adults by type and everyone else by age", () => {
    expect(duffelPassengers(party({ adults: 1, teenagers: 1, children: 1 }))).toEqual([
      { type: "adult" },
      { age: 15 },
      { age: 8 },
    ]);
  });

  it("never sends a seated infant as a lap infant", () => {
    // infant_without_seat means exactly that; sending it for a child we are
    // buying a seat for would book them onto somebody's lap.
    const sent = duffelPassengers(party({ adults: 1, infantsWithSeat: 1 }));
    expect(sent).toEqual([{ type: "adult" }, { age: 1 }]);
    expect(JSON.stringify(sent)).not.toContain("infant_without_seat");
  });

  it("sends a lap infant as a lap infant", () => {
    expect(duffelPassengers(party({ adults: 1, infantsOnLap: 1 }))).toEqual([
      { type: "adult" },
      { type: "infant_without_seat" },
    ]);
  });

  it("sends one passenger per person, never a count", () => {
    const p = party({ adults: 2, teenagers: 1, children: 3, infantsWithSeat: 1, infantsOnLap: 2 });
    expect(duffelPassengers(p)).toHaveLength(headCount(p));
  });
});

describe("hotel guests", () => {
  it("counts both kinds of infant, because a room counts people", () => {
    expect(stayGuestAges(party({ adults: 2, infantsWithSeat: 1, infantsOnLap: 1 }))).toEqual([
      1, 1,
    ]);
  });

  it("leaves adults out — they are counted separately by the room", () => {
    expect(stayGuestAges(party({ adults: 3 }))).toEqual([]);
  });
});

describe("the counters", () => {
  it("never goes below one adult", () => {
    expect(adjust(party({ adults: 1 }), "adults", -1).adults).toBe(1);
  });

  it("never goes below zero for anyone else", () => {
    expect(adjust(party(), "children", -1).children).toBe(0);
  });

  it("drops a lap infant when the adult it belonged to is removed", () => {
    const p = party({ adults: 2, infantsOnLap: 2 });
    expect(adjust(p, "adults", -1)).toMatchObject({ adults: 1, infantsOnLap: 1 });
  });

  it("refuses to add a tenth seat rather than silently allowing it", () => {
    const full = party({ adults: MAX_SEATS });
    expect(adjust(full, "children", 1)).toEqual(full);
  });

  it("only ever produces a bookable party", () => {
    let p = party();
    const bands: Array<keyof PartyCounts> = [
      "adults",
      "teenagers",
      "children",
      "infantsWithSeat",
      "infantsOnLap",
    ];
    for (let i = 0; i < 200; i += 1) {
      const band = bands[i % bands.length]!;
      p = adjust(p, band, i % 3 === 0 ? -1 : 1);
      expect(isBookableParty(p), `unbookable after ${i}: ${JSON.stringify(p)}`).toBe(true);
    }
  });
});

describe("saying it out loud", () => {
  it("reads the way a person would say it", () => {
    expect(describeParty(party({ adults: 2, children: 1 }))).toBe("2 adults, 1 child");
    expect(describeParty(party({ adults: 1 }))).toBe("1 adult");
  });

  it("does not split infants into two kinds when talking to a person", () => {
    expect(describeParty(party({ adults: 2, infantsWithSeat: 1, infantsOnLap: 1 }))).toBe(
      "2 adults, 2 infants",
    );
  });
});
