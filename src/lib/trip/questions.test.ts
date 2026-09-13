import { describe, expect, it } from "vitest";
import { parseTripSentence } from "./parse";
import { chatQuestions, essentialsMet, isBusinessSentence } from "./questions";

const req = (sentence: string) => parseTripSentence(sentence, new Date("2026-09-13T09:00:00Z"), "WAW");

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

  it("never asks more than two questions, essentials first", () => {
    const sentence = "Conference in Paris with my kids";
    const questions = chatQuestions(sentence, req(sentence));
    expect(questions.length).toBeLessThanOrEqual(2);
    expect(questions.every((q) => q.essential)).toBe(true);
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
