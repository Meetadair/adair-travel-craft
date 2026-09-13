import { describe, expect, it } from "vitest";
import {
  ageOn,
  ageQuestion,
  bedLines,
  categoryOn,
  childSeatBand,
  childSeatsFor,
  familyFromSentence,
  familyRoomReason,
  fareTypeFor,
  fareTypesFor,
  freeChildrenNote,
  partyOf,
  roomFits,
  seatsNeeded,
} from "./family";

describe("age category as of the return date", () => {
  it("counts whole years on the day", () => {
    expect(ageOn("2020-06-15", "2026-06-14")).toBe(5);
    expect(ageOn("2020-06-15", "2026-06-15")).toBe(6);
    expect(ageOn(null, "2026-06-15")).toBeNull();
  });

  it("treats a child who turns two during the trip as a child, not an infant", () => {
    // Outbound 2026-09-10, home 2026-09-20; second birthday on the 15th.
    expect(categoryOn("2024-09-15", "2026-09-10")).toBe("infant");
    expect(categoryOn("2024-09-15", "2026-09-20")).toBe("child");
  });

  it("moves a twelfth birthday to adult", () => {
    expect(categoryOn("2014-09-15", "2026-09-20")).toBe("adult");
    expect(categoryOn("2015-09-15", "2026-09-20")).toBe("child");
  });

  it("assumes adult when no date of birth is known", () => {
    expect(categoryOn(null, "2026-09-20")).toBe("adult");
  });

  it("breaks a party into adults, children with ages, and infants", () => {
    const party = partyOf(
      [
        { bornOn: "1988-01-01" },
        { bornOn: "1990-01-01" },
        { bornOn: "2019-03-01" },
        { bornOn: "2024-09-15" },
      ],
      "2026-09-20",
    );
    expect(party.adults).toBe(2);
    expect(party.children).toBe(2);
    expect(party.childAges).toEqual([7, 2]);
    expect(party.infants).toBe(0);
    expect(party.total).toBe(4);
  });
});

describe("infant on lap versus own seat", () => {
  const travellers = [{ bornOn: "1988-01-01" }, { bornOn: "2025-06-01" }];

  it("asks for a lap infant fare by default and takes no seat", () => {
    expect(fareTypesFor(travellers, "2026-03-01")).toEqual(["adult", "infant_without_seat"]);
    expect(seatsNeeded(partyOf(travellers, "2026-03-01"))).toBe(1);
  });

  it("asks for a seated infant fare when the family chooses a seat", () => {
    const seated = [travellers[0]!, { bornOn: "2025-06-01", infantOwnSeat: true }];
    expect(fareTypesFor(seated, "2026-03-01")).toEqual(["adult", "infant_with_seat"]);
    expect(seatsNeeded(partyOf(seated, "2026-03-01"))).toBe(2);
  });

  it("maps categories to fare types", () => {
    expect(fareTypeFor("adult")).toBe("adult");
    expect(fareTypeFor("child")).toBe("child");
    expect(fareTypeFor("infant")).toBe("infant_without_seat");
    expect(fareTypeFor("infant", true)).toBe("infant_with_seat");
  });
});

describe("room occupancy", () => {
  const family = partyOf(
    [
      { bornOn: "1988-01-01" },
      { bornOn: "1990-01-01" },
      { bornOn: "2018-01-01" },
      { bornOn: "2020-01-01" },
    ],
    "2026-09-20",
  );

  it("rejects a room whose policy the family exceeds", () => {
    expect(roomFits({ maxAdults: 2, maxChildren: 1 }, family)).toBe(false);
    expect(roomFits({ maxOccupancy: 3 }, family)).toBe(false);
  });

  it("rejects a room whose child age limit is exceeded", () => {
    expect(roomFits({ maxOccupancy: 4, maxChildAge: 6 }, family)).toBe(false);
    expect(roomFits({ maxOccupancy: 4, maxChildAge: 12 }, family)).toBe(true);
  });

  it("says plainly why a family room is needed", () => {
    expect(familyRoomReason(family)).toBe(
      "This hotel requires a family room for 2 adults and 2 children.",
    );
  });

  it("quotes a free-children policy only when the hotel gives one", () => {
    expect(freeChildrenNote({ childrenFreeUnder: 6 })).toBe(
      "Children under 6 stay free in existing beds.",
    );
    expect(freeChildrenNote({})).toBeNull();
  });

  it("adds a cot per infant and an extra bed per child, price or on request", () => {
    const withBaby = partyOf([{ bornOn: "1988-01-01" }, { bornOn: "2025-06-01" }], "2026-03-01");
    expect(bedLines(withBaby)).toEqual([
      { kind: "cot", label: "Cot", count: 1, priceEur: null, note: "On request at check-in" },
    ]);
    expect(bedLines(family, { extraBedEur: 25 })[0]).toMatchObject({
      kind: "extra_bed",
      count: 2,
      priceEur: 25,
      note: "Per night",
    });
  });
});

describe("child car seats", () => {
  it("matches the band to the age", () => {
    expect(childSeatBand(1)).toBe("infant carrier");
    expect(childSeatBand(3)).toBe("child seat");
    expect(childSeatBand(8)).toBe("booster");
    expect(childSeatBand(13)).toBeNull();
  });

  it("counts a seat for every child and infant", () => {
    const party = partyOf(
      [{ bornOn: "1988-01-01" }, { bornOn: "2025-06-01" }, { bornOn: "2018-01-01" }],
      "2026-03-01",
    );
    expect(childSeatsFor(party)).toEqual([
      { band: "infant carrier", count: 1 },
      { band: "booster", count: 1 },
    ]);
  });
});

describe("family phrases", () => {
  it("reads English ages", () => {
    const read = familyFromSentence("Rome for a week with two kids aged 4 and 7");
    expect(read.children).toBe(2);
    expect(read.ages).toEqual([4, 7]);
    expect(read.needsAges).toBe(false);
  });

  it("reads Polish ages", () => {
    const read = familyFromSentence("Rzym na tydzień z dwójką dzieci 4 i 7 lat");
    expect(read.children).toBe(2);
    expect(read.ages).toEqual([4, 7]);
    expect(read.needsAges).toBe(false);
  });

  it("reads a baby in both languages", () => {
    expect(familyFromSentence("Lisbon with a baby").infants).toBe(1);
    expect(familyFromSentence("Lizbona z niemowlakiem").infants).toBe(1);
  });

  it("asks one question when children are mentioned without ages", () => {
    const read = familyFromSentence("Paris with the kids");
    expect(read.needsAges).toBe(true);
    expect(ageQuestion(read)).toContain("How old");
  });

  it("asks nothing when nobody under twelve is mentioned", () => {
    const read = familyFromSentence("Berlin for two next Friday");
    expect(read.children).toBe(0);
    expect(read.infants).toBe(0);
    expect(ageQuestion(read)).toBeNull();
  });
});
