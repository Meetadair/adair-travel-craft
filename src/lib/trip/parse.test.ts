import { describe, expect, it } from "vitest";

import { parseTripSentence as parseOrNull } from "./parse";

/** Every case below names a destination, so the result is never null. */
const parseTripSentence = (sentence: string, today?: Date, homeAirportIata?: string) =>
  parseOrNull(sentence, today, homeAirportIata)!;

/** A fixed Monday, so weekday resolution is deterministic. */
const TODAY = new Date("2026-03-09T09:00:00Z");

describe("parsing English sentences", () => {
  it("resolves two weekdays into a date range", () => {
    const r = parseTripSentence("Milan Tuesday to Thursday, business class", TODAY);
    expect(r.destinationIata).toBe("LIN");
    expect(r.departDate).toBe("2026-03-10");
    expect(r.returnDate).toBe("2026-03-12");
    expect(r.cabinClass).toBe("business");
  });

  it("honours an explicit number of nights", () => {
    const r = parseTripSentence("Rome on Friday for 3 nights", TODAY);
    expect(r.departDate).toBe("2026-03-13");
    expect(r.returnDate).toBe("2026-03-16");
  });

  it("reads the passenger count and the departure city", () => {
    const r = parseTripSentence("From Berlin to Barcelona for 3 people next weekend", TODAY);
    expect(r.originIata).toBe("BER");
    expect(r.destinationIata).toBe("BCN");
    expect(r.passengers).toBe(3);
  });

  it("uses the saved home airport when no origin is named", () => {
    const r = parseTripSentence("Paris on Wednesday", TODAY, "WAW");
    expect(r.originIata).toBe("WAW");
  });

  it("keeps a named hotel and a named car", () => {
    const r = parseTripSentence(
      'Milan Tuesday to Thursday, stay at "Hotel Milano Scala", car from Sixt',
      TODAY,
    );
    expect(r.hotelNameExact).toBe("Hotel Milano Scala");
    expect(r.carNameExact?.toLowerCase()).toContain("sixt");
    expect(r.needsCar).toBe(true);
  });

  it("flags an invoice to the company", () => {
    expect(parseTripSentence("Milan Tuesday, invoice to my company", TODAY).invoiceToCompany).toBe(
      true,
    );
    expect(parseTripSentence("Milan Tuesday", TODAY).invoiceToCompany).toBe(false);
  });

  it("reads a required arrival time and the meeting location", () => {
    const r = parseTripSentence(
      "I need to be in Milan tomorrow at 3pm, meeting at the Duomo",
      TODAY,
    );
    expect(r.mustArriveBy).toBe("2026-03-10T15:00:00.000Z");
    expect(r.departDate).toBe("2026-03-10");
    expect(r.meetingLocation?.toLowerCase()).toContain("duomo");
  });

  it("orders multi-city stops and excludes the departure city", () => {
    const r = parseTripSentence("From Warsaw to Rome then Athens then Milan", TODAY);
    expect(r.stops.map((s) => s.iata)).toEqual(["WAW", "FCO", "ATH", "LIN"]);
    expect(r.destinationIata).toBe("FCO");
  });
});

describe("parsing Polish sentences", () => {
  it("resolves Polish weekdays", () => {
    const r = parseTripSentence("Mediolan wtorek do czwartek, klasa biznes", TODAY);
    expect(r.destinationIata).toBe("LIN");
    expect(r.departDate).toBe("2026-03-10");
    expect(r.returnDate).toBe("2026-03-12");
    expect(r.cabinClass).toBe("business");
  });

  it("reads a Polish arrival deadline", () => {
    const r = parseTripSentence("Muszę być w Mediolanie jutro o 15:00", TODAY);
    expect(r.mustArriveBy).toBe("2026-03-10T15:00:00.000Z");
  });

  it("reads a Polish invoice request and passenger count", () => {
    const r = parseTripSentence("Rzym w piątek, 2 osoby, faktura na firmę", TODAY);
    expect(r.invoiceToCompany).toBe(true);
    expect(r.passengers).toBe(2);
  });
});

describe("fallbacks", () => {
  it("returns nothing for nonsense input instead of guessing a city", () => {
    expect(parseOrNull("asdf qwer", TODAY)).toBeNull();
  });

  it("fills in sensible dates once a destination is named", () => {
    const r = parseTripSentence("asdf qwer Milan", TODAY);
    expect(r.destinationIata).toMatch(/^[A-Z]{3}$/);
    expect(r.originIata).not.toBe(r.destinationIata);
    expect(Date.parse(r.returnDate)).toBeGreaterThan(Date.parse(r.departDate));
    expect(r.passengers).toBe(1);
  });
});

