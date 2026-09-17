/**
 * The questions that decide whether a booking matches what someone actually
 * wanted: where they leave from, what the trip is for, and who it is with.
 *
 * These exist because of a real booking. "Can you look for a nice option in
 * Paris" came back with a trip card — dates, a hotel, a price — and nobody had
 * been asked which city the flight left from, whether it was work, or whether
 * the second traveller was a colleague or a wife on an anniversary. The card
 * was confident and wrong, which is worse than no card.
 */
import { describe, expect, it } from "vitest";
import { chatQuestions, essentialsMet } from "./questions";
import { parseTripSentence, partyOf, occasionOf, purposeOf } from "./parse";
import { applyAnswer } from "./clarify";
import { stayScore, styleScore } from "./rank";
import type { TripRequest } from "./types";

const base = (over: Partial<TripRequest> = {}): TripRequest =>
  ({
    originCity: "Warsaw",
    originIata: "WAW",
    originStated: true,
    destinationCity: "Paris",
    destinationIata: "CDG",
    lat: 48.85,
    lon: 2.35,
    departDate: "2026-09-26",
    returnDate: "2026-09-30",
    cabinClass: "economy",
    passengers: 1,
    hotelWish: null,
    hotelNameExact: null,
    carNameExact: null,
    needsCar: false,
    invoiceToCompany: false,
    purpose: null,
    party: null,
    occasion: null,
    stops: [],
    ...over,
  }) as TripRequest;

describe("where the traveller is flying from", () => {
  it("is never invented: a sentence with no origin leaves the request unstated", () => {
    const parsed = parseTripSentence("a nice option in Paris");
    expect(parsed?.originStated).toBe(false);
  });

  it("counts as stated when the sentence names it", () => {
    const parsed = parseTripSentence("Paris from Berlin on Thursday");
    expect(parsed?.originStated).toBe(true);
    expect(parsed?.originIata).toBe("BER");
  });

  it("counts as stated when it is already on file as the home airport", () => {
    const parsed = parseTripSentence("a nice option in Paris", new Date(), "WAW");
    expect(parsed?.originStated).toBe(true);
    expect(parsed?.originIata).toBe("WAW");
  });

  it("is asked, and blocks the search, when nobody has said it", () => {
    const asked = chatQuestions("a nice option in Paris", base({ originStated: false }));
    const origin = asked.find((q) => q.kind === "origin");
    expect(origin?.essential).toBe(true);
    expect(origin?.control).toBe("airport");
    expect(essentialsMet(asked)).toBe(false);
  });

  it("is not asked again once it is known", () => {
    const asked = chatQuestions("a nice option in Paris", base());
    expect(asked.some((q) => q.kind === "origin")).toBe(false);
  });
});

describe("what kind of trip it is", () => {
  it("is asked rather than guessed from wording that settles nothing", () => {
    expect(purposeOf("a nice option in Paris")).toBeNull();
    const asked = chatQuestions("a nice option in Paris", base());
    const kind = asked.find((q) => q.kind === "trip_kind");
    expect(kind?.essential).toBe(true);
    // The values are plain English on purpose: one surface maps them straight
    // to fields, another folds the answer back into the sentence and re-parses
    // it, and both have to arrive at the same trip.
    expect(kind?.options.map((o) => o.value)).toEqual([
      "business trip",
      "solo",
      "with my partner",
      "with family",
      "with friends",
    ]);
    expect(purposeOf("business trip")).toBe("business");
    expect(partyOf("with my partner")).toBe("partner");
  });

  it("is read straight from the sentence when the sentence is explicit", () => {
    expect(purposeOf("Paris for a client meeting")).toBe("business");
    expect(partyOf("Paris with my wife")).toBe("partner");
    expect(occasionOf("Paris with my wife for our anniversary")).toBe("anniversary");
  });

  it("stops asking the headcount from someone travelling alone", () => {
    const asked = chatQuestions("Paris in October", base({ purpose: "personal", party: "solo" }));
    expect(asked.some((q) => q.kind === "travellers")).toBe(false);
  });

  it("asks about an occasion only on a trip with a partner", () => {
    const withPartner = chatQuestions(
      "Paris in October",
      base({ purpose: "personal", party: "partner" }),
    );
    expect(withPartner.some((q) => q.kind === "occasion")).toBe(true);

    const atWork = chatQuestions(
      "Paris in October",
      base({ purpose: "business", party: "colleagues" }),
    );
    expect(atWork.some((q) => q.kind === "occasion")).toBe(false);
  });
});

describe("the question budget", () => {
  it("never hides an essential question to stay inside it", () => {
    // Four essentials at once on a first trip: origin, kind, who, when. The
    // budget may shorten the optional tail and nothing else — dropping one of
    // these would let the search run on an answer nobody gave.
    const asked = chatQuestions("Paris", base({ originStated: false }));
    const essential = asked.filter((q) => q.essential).map((q) => q.kind);
    expect(essential).toContain("origin");
    expect(essential).toContain("trip_kind");
    expect(essentialsMet(asked)).toBe(false);
  });
});

describe("what the answers change", () => {
  const boutique = "Relais Saint-Germain";
  const corporate = "Courtyard Paris La Défense";

  it("puts a business hotel first on a work trip", () => {
    const style = { purpose: "business" as const, party: "colleagues" as const, occasion: null };
    expect(styleScore(corporate, 4.3, style)).toBeGreaterThan(styleScore(boutique, 4.3, style));
  });

  it("puts somewhere worth arriving at first on an anniversary", () => {
    const style = {
      purpose: "personal" as const,
      party: "partner" as const,
      occasion: "anniversary" as const,
    };
    expect(styleScore(boutique, 4.7, style)).toBeGreaterThan(styleScore(corporate, 4.7, style));
  });

  it("leans on price less when the trip is being marked", () => {
    const celebrating = {
      purpose: "personal" as const,
      party: "partner" as const,
      occasion: "anniversary" as const,
    };
    const ordinary = {
      purpose: "personal" as const,
      party: "partner" as const,
      occasion: "none" as const,
    };
    const dearer = 900;
    // The same dear hotel is penalised less once there is something to mark.
    expect(stayScore("Hotel Lutetia", 4.6, dearer, undefined, celebrating)).toBeGreaterThan(
      stayScore("Hotel Lutetia", 4.6, dearer, undefined, ordinary),
    );
  });

  it("changes nothing at all until the traveller has answered", () => {
    expect(styleScore(boutique, 4.7, { purpose: null, party: null, occasion: null })).toBe(0);
  });
});

describe("answering where the trip starts", () => {
  it("is folded into the sentence as an origin, not as a loose word", () => {
    // The loop this prevents: the answer was appended bare, the parser read it
    // as more noise, the origin stayed unstated, and the same question came
    // straight back. Typing "warsaw", then "warszawa", then anything at all.
    const sentence = applyAnswer("I need to go to paris", "origin", "warsaw");
    expect(sentence).toBe("I need to go to paris from warsaw");
    expect(parseTripSentence(sentence)?.originStated).toBe(true);
  });

  it("accepts the airport code the picker sends", () => {
    const sentence = applyAnswer("I need to go to paris", "origin", "WAW");
    expect(parseTripSentence(sentence)?.originStated).toBe(true);
    expect(parseTripSentence(sentence)?.originIata).toBe("WAW");
  });

  it("does not double the word when the answer already carries it", () => {
    expect(applyAnswer("Paris in October", "origin", "from Berlin")).toBe(
      "Paris in October from Berlin",
    );
  });

  it("stops asking once the question is answered", () => {
    const sentence = applyAnswer("I need to go to paris", "origin", "warsaw");
    const parsed = parseTripSentence(sentence)!;
    expect(chatQuestions(sentence, parsed).some((q) => q.kind === "origin")).toBe(false);
  });
});

describe("the departure airport cannot be the destination", () => {
  it("names the destination as barred on the origin question", () => {
    // What went wrong: asked where the trip started, the picker offered CDG on a
    // trip to Paris. It was taken, and the conversation moved on to dates with a
    // Paris-to-Paris trip behind it.
    const asked = chatQuestions("I need to go to paris", base({ originStated: false }));
    const origin = asked.find((q) => q.kind === "origin");
    expect(origin?.excludeIata).toEqual(["CDG"]);
  });

  it("refuses it in the parse as well, not only in the picker", () => {
    const parsed = parseTripSentence("I need to go to paris from CDG");
    expect(parsed?.originStated).toBe(false);
    expect(parsed?.originIata).not.toBe(parsed?.destinationIata);
  });

  it("accepts any other airport as the start", () => {
    const parsed = parseTripSentence("I need to go to paris from WAW");
    expect(parsed?.originStated).toBe(true);
    expect(parsed?.originIata).toBe("WAW");
  });
});

describe("what the departure picker offers before anything is known", () => {
  it("offers the traveller's own country, not the world", () => {
    const asked = chatQuestions("I need to go to paris", base({ originStated: false }), {
      homeCountry: "Poland",
    });
    const origin = asked.find((q) => q.kind === "origin");
    expect(origin?.options.map((o) => o.value)).toEqual(["WAW", "KRK", "GDN", "WRO", "KTW"]);
  });

  it("leads with airports this traveller has used before", () => {
    const asked = chatQuestions("I need to go to paris", base({ originStated: false }), {
      homeCountry: "Poland",
      knownAirports: ["BER"],
    });
    expect(asked.find((q) => q.kind === "origin")?.options[0]?.value).toBe("BER");
  });

  it("never offers the airport they are flying to", () => {
    const asked = chatQuestions(
      "I need to go to paris",
      base({ originStated: false, destinationIata: "CDG" }),
      { homeCountry: "France" },
    );
    const offered = asked.find((q) => q.kind === "origin")?.options.map((o) => o.value) ?? [];
    expect(offered).not.toContain("CDG");
  });

  it("offers nothing rather than the wrong country when the region is unknown", () => {
    const asked = chatQuestions("I need to go to paris", base({ originStated: false }));
    expect(asked.find((q) => q.kind === "origin")?.options).toEqual([]);
  });
});
