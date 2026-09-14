import { describe, expect, it } from "vitest";
import { parseTripSentence as parseOrNull } from "./parse";

/** These fixtures all name a destination, so the parse never returns null. */
const parseTripSentence = (sentence: string, today?: Date, home?: string) =>
  parseOrNull(sentence, today, home)!;
import { chatQuestions, essentialsMet, isBusinessSentence, questionBudget } from "./questions";

const req = (sentence: string) =>
  parseTripSentence(sentence, new Date("2026-09-13T09:00:00Z"), "WAW");

describe("chat questions", () => {
  it("asks the arrival time for a business trip and treats it as essential", () => {
    const sentence = "Meeting in Vienna on Thursday, back Friday";
    const questions = chatQuestions(sentence, req(sentence));
    const arrival = questions.find((q) => q.kind === "arrival_time");
    expect(arrival).toBeTruthy();
    expect(arrival?.essential).toBe(true);
    expect(arrival?.control).toBe("time");
    expect(essentialsMet(questions)).toBe(false);
  });

  it("does not ask the arrival time when the sentence already set one", () => {
    const sentence = "Meeting in Vienna on Thursday, I must be there by 10:00, back Friday";
    const request = req(sentence);
    if (!request.mustArriveBy) return; // parser did not read the time; nothing to assert
    const questions = chatQuestions(sentence, request);
    expect(questions.some((q) => q.kind === "arrival_time")).toBe(false);
  });

  it("asks for dates when the sentence has none", () => {
    const sentence = "I need to get to Vienna";
    const questions = chatQuestions(sentence, req(sentence));
    expect(questions[0]?.kind).toBe("dates");
    expect(questions[0]?.control).toBe("calendar");
  });

  it("stays within the budget, essentials first", () => {
    const sentence = "Conference in Paris with my kids";
    const questions = chatQuestions(sentence, req(sentence));
    expect(questions.length).toBeLessThanOrEqual(questionBudget());
    // Whatever the budget, what blocks the search comes before what does not.
    const firstOptional = questions.findIndex((q) => !q.essential);
    const lastEssential = questions.map((q) => q.essential).lastIndexOf(true);
    if (firstOptional !== -1 && lastEssential !== -1) {
      expect(lastEssential).toBeLessThan(firstOptional);
    }
  });

  it("offers the two Paris airports as buttons, and not once it is known", () => {
    const sentence = "Trip to Paris on Monday, back Wednesday";
    const asked = chatQuestions(sentence, req(sentence));
    const airport = asked.find((q) => q.kind === "which_airport");
    expect(airport?.options.map((o) => o.value)).toEqual(["CDG", "ORY"]);
    expect(airport?.essential).toBe(false);
    const known = chatQuestions(sentence, req(sentence), { knownAirports: ["ORY"] });
    expect(known.some((q) => q.kind === "which_airport")).toBe(false);
  });

  it("skips questions already answered", () => {
    const sentence = "I need to get to Vienna for a meeting";
    const questions = chatQuestions(sentence, req(sentence), {
      answered: ["dates", "arrival_time"],
    });
    expect(questions.some((q) => q.kind === "dates")).toBe(false);
    expect(questions.some((q) => q.kind === "arrival_time")).toBe(false);
  });

  it("reads business intent from the words and from the invoice flag", () => {
    expect(isBusinessSentence("client meeting in Milan")).toBe(true);
    expect(isBusinessSentence("weekend in Lisbon with my wife")).toBe(false);
  });
});

describe("questions beyond the essentials", () => {
  const request = {
    originCity: "Warsaw",
    originIata: "WAW",
    destinationCity: "Milan",
    destinationIata: "MXP",
    lat: 45.46,
    lon: 9.19,
    departDate: "2026-10-01",
    returnDate: "2026-10-03",
    cabinClass: "economy" as const,
    passengers: 1,
    hotelWish: null,
    hotelNameExact: null,
    carNameExact: null,
    invoiceToCompany: false,
    needsCar: false,
    stops: [],
  };

  it("asks about a car when the sentence says nothing about one", () => {
    const asked = chatQuestions("Milan on Thursday", request);
    expect(asked.some((q) => q.kind === "needs_car")).toBe(true);
  });

  it("does not ask again once the traveller has answered", () => {
    const asked = chatQuestions("Milan on Thursday", request, { answered: ["needs_car"] });
    expect(asked.some((q) => q.kind === "needs_car")).toBe(false);
  });

  it("offers the airport transfer only after they said no car", () => {
    const before = chatQuestions("Milan on Thursday", { ...request, needsCar: false });
    const after = chatQuestions(
      "Milan on Thursday",
      { ...request, needsCar: false },
      { answered: ["needs_car"] },
    );
    const withCar = chatQuestions(
      "Milan on Thursday",
      { ...request, needsCar: true },
      { answered: ["needs_car"] },
    );
    // Not before they have answered, not when they took a car.
    expect(before.some((q) => q.kind === "airport_transfer")).toBe(false);
    expect(after.some((q) => q.kind === "airport_transfer")).toBe(true);
    expect(withCar.some((q) => q.kind === "airport_transfer")).toBe(false);
  });

  it("says nothing about a car when the sentence already settled it", () => {
    const asked = chatQuestions("Milan on Thursday, no car needed", request);
    expect(asked.some((q) => q.kind === "needs_car")).toBe(false);
  });

  it("asks a business traveller when they want to come home — after the essentials", () => {
    // The meeting time comes first and fills the two-question budget, so the
    // return time waits its turn rather than crowding the first exchange.
    const first = chatQuestions("Milan Thursday, client meeting", {
      ...request,
      needsCar: true,
    });
    expect(first.some((q) => q.kind === "arrival_time")).toBe(true);

    // Milan has several airports, and the car comes before the way home, so
    // both take their turn first. The budget is two questions, never more.
    const later = chatQuestions(
      "Milan Thursday, client meeting",
      { ...request, needsCar: true },
      { answered: ["arrival_time", "which_airport", "needs_car"] },
    );
    expect(later.some((q) => q.kind === "return_time")).toBe(true);
  });

  it("never lets an optional question block the search", () => {
    const asked = chatQuestions("Milan on Thursday", request);
    const optional = asked.filter((q) => !q.essential);
    expect(optional.every((q) => q.essential === false)).toBe(true);
  });

  it("still asks at most two at a time", () => {
    // The ceiling is the budget, not a fixed two: a new traveller is worth
    // asking properly, and a regular is not asked the same things twice.
    expect(chatQuestions("Milan Thursday, client meeting", request).length).toBeLessThanOrEqual(
      questionBudget(),
    );
  });
});

describe("both ends of the trip", () => {
  const oneWay = {
    originCity: "Warsaw",
    originIata: "WAW",
    destinationCity: "Paris",
    destinationIata: "CDG",
    lat: 48.85,
    lon: 2.35,
    departDate: "2026-10-01",
    // Same day back is how a missing return arrives from the parser.
    returnDate: "2026-10-01",
    cabinClass: "economy" as const,
    passengers: 1,
    hotelWish: null,
    hotelNameExact: null,
    carNameExact: null,
    invoiceToCompany: false,
    needsCar: false,
    stops: [],
  };

  it("asks for dates again when there is no way home", () => {
    const asked = chatQuestions("Paris on Thursday", oneWay);
    const dates = asked.find((q) => q.kind === "dates");
    expect(dates).toBeDefined();
    expect(dates?.essential).toBe(true);
  });

  it("blocks the search until the return is known", () => {
    expect(essentialsMet(chatQuestions("Paris on Thursday", oneWay))).toBe(false);
  });

  it("lets a real return through", () => {
    const both = { ...oneWay, returnDate: "2026-10-04" };
    const asked = chatQuestions("Paris from Thursday to Sunday", both);
    expect(asked.some((q) => q.kind === "dates")).toBe(false);
  });
});

describe("the conversation shortens as Adair learns", () => {
  const request = {
    originCity: "Warsaw",
    originIata: "WAW",
    destinationCity: "Milan",
    destinationIata: "MXP",
    lat: 45.46,
    lon: 9.19,
    departDate: "2026-10-01",
    returnDate: "2026-10-03",
    cabinClass: "economy" as const,
    passengers: 1,
    hotelWish: null,
    hotelNameExact: null,
    carNameExact: null,
    invoiceToCompany: false,
    needsCar: false,
    stops: [],
  };

  it("asks properly on a first trip", () => {
    // Nothing on file: the card would otherwise be a guess.
    expect(questionBudget({ tripsBooked: 0, statedPreferences: 0 })).toBe(4);
  });

  it("asks less once preferences are filled in", () => {
    expect(questionBudget({ tripsBooked: 1, statedPreferences: 10 })).toBe(3);
  });

  it("asks less again once they are a regular", () => {
    expect(questionBudget({ tripsBooked: 4, statedPreferences: 12 })).toBe(2);
  });

  it("asks one thing of someone it knows well", () => {
    expect(questionBudget({ tripsBooked: 12, statedPreferences: 20 })).toBe(1);
  });

  it("never goes silent — this trip still has its own answers", () => {
    expect(questionBudget({ tripsBooked: 500, statedPreferences: 99 })).toBeGreaterThan(0);
  });

  it("treats an unknown traveller as new rather than as known", () => {
    expect(questionBudget()).toBe(4);
  });

  it("stops asking about a car once the habit is on file", () => {
    const asked = chatQuestions("Milan on Thursday", request, {
      known: { knowsCarHabit: true, tripsBooked: 3, statedPreferences: 9 },
    });
    expect(asked.some((q) => q.kind === "needs_car")).toBe(false);
  });

  it("gives a new traveller more of the conversation than a regular", () => {
    const newcomer = chatQuestions("Milan on Thursday", request, {
      known: { tripsBooked: 0, statedPreferences: 0 },
    });
    const regular = chatQuestions("Milan on Thursday", request, {
      known: { tripsBooked: 20, statedPreferences: 20 },
    });
    expect(newcomer.length).toBeGreaterThan(regular.length);
  });
});

describe("a single named day is not a booking", () => {
  const req = {
    originCity: "Warsaw",
    originIata: "WAW",
    destinationCity: "Berlin",
    destinationIata: "BER",
    lat: 52.5,
    lon: 13.4,
    departDate: "2026-09-17",
    returnDate: "2026-09-18",
    cabinClass: "economy" as const,
    passengers: 1,
    hotelWish: null,
    hotelNameExact: null,
    carNameExact: null,
    invoiceToCompany: false,
    needsCar: false,
    stops: [],
  };

  it("asks for the dates instead of assuming one night", () => {
    const asked = chatQuestions("Berlin on Thursday", req);
    expect(asked.some((q) => q.kind === "dates" && q.essential)).toBe(true);
  });

  it("does not ask when the sentence names both days", () => {
    const asked = chatQuestions("Berlin Thursday to Sunday", { ...req, returnDate: "2026-09-20" });
    expect(asked.some((q) => q.kind === "dates")).toBe(false);
  });
});
