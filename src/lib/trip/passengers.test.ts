import { describe, expect, it } from "vitest";
import {
  guestsPerRoom,
  needsOccupancyQuestion,
  occupancyNote,
  passengersFromSentence,
  passengersLabel,
  roomsFor,
  scaleFor,
  vehiclesFor,
} from "@/lib/trip/passengers";

describe("passengersFromSentence", () => {
  it("defaults to one traveller", () => {
    expect(passengersFromSentence("Milan on Tuesday, back Thursday")).toBe(1);
  });

  it("reads a digit next to a people word", () => {
    expect(passengersFromSentence("Rome for 3 people next week")).toBe(3);
    expect(passengersFromSentence("Lizbona dla 4 osób w maju")).toBe(4);
  });

  it("reads written English numbers", () => {
    expect(passengersFromSentence("Paris for two, Friday to Sunday")).toBe(2);
    expect(passengersFromSentence("Vienna, the two of us")).toBe(2);
  });

  it("reads written Polish numbers", () => {
    expect(passengersFromSentence("Rzym dla dwóch osób w piątek")).toBe(2);
    expect(passengersFromSentence("Lizbona we trójkę na weekend")).toBe(3);
  });

  it("counts a named companion as two", () => {
    expect(passengersFromSentence("Barcelona with my wife in June")).toBe(2);
    expect(passengersFromSentence("Barcelona z żoną w czerwcu")).toBe(2);
  });

  it("never guesses above two from a vague group phrase", () => {
    expect(passengersFromSentence("Athens with my family")).toBe(2);
    expect(passengersFromSentence("Kraków z dziećmi")).toBe(2);
  });

  it("clamps to the supplier ceiling and to one", () => {
    expect(passengersFromSentence("Madrid for 40 people")).toBe(9);
    expect(passengersFromSentence("Madrid for 0 people")).toBe(1);
  });
});

describe("occupancy", () => {
  it("puts two in one room and splits larger parties", () => {
    expect(roomsFor(1)).toBe(1);
    expect(roomsFor(2)).toBe(1);
    expect(roomsFor(3)).toBe(2);
    expect(roomsFor(5)).toBe(3);
  });

  it("asks only from three travellers up", () => {
    expect(needsOccupancyQuestion(2)).toBe(false);
    expect(needsOccupancyQuestion(3)).toBe(true);
  });

  it("states what it assumed", () => {
    expect(occupancyNote(1)).toBeNull();
    expect(occupancyNote(2)).toContain("One room for two");
    expect(occupancyNote(4)).toContain("2 rooms for 4 travellers");
  });

  it("keeps guests per room within a double", () => {
    expect(guestsPerRoom(2)).toBe(2);
    expect(guestsPerRoom(3)).toBe(2);
  });
});

describe("scaling", () => {
  it("scales flights and insurance per traveller, stays per room, cars not at all", () => {
    expect(scaleFor("flight", 3)).toBe(3);
    expect(scaleFor("insurance", 3)).toBe(3);
    expect(scaleFor("stay", 3)).toBe(2);
    expect(scaleFor("car", 3)).toBe(1);
  });

  it("adds a vehicle once the party outgrows one car", () => {
    expect(vehiclesFor(4)).toBe(1);
    expect(vehiclesFor(5)).toBe(2);
  });

  it("labels the party", () => {
    expect(passengersLabel(1)).toBe("1 traveller");
    expect(passengersLabel(3)).toBe("3 travellers");
  });
});
