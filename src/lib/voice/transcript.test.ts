import { describe, expect, it } from "vitest";
import {
  composeTranscript,
  finalPart,
  foldSettled,
  interimPart,
  shouldRestart,
  type SpeechResult,
} from "./transcript";

const r = (transcript: string, isFinal: boolean): SpeechResult => ({ transcript, isFinal });

describe("what the microphone heard", () => {
  it("separates what is settled from what is still being revised", () => {
    const results = [r("I need to be in", true), r("Milan on Thurs", false)];
    expect(finalPart(results)).toBe("I need to be in");
    expect(interimPart(results)).toBe("Milan on Thurs");
  });

  it("keeps words across a restart, which is the whole bug", () => {
    // The engine ends at the first pause and empties its results list. Anything
    // that trusted that list lost everything said before the pause.
    let settled = foldSettled("", [r("I need to be in Milan", true)]);
    settled = foldSettled(settled, [r("on Thursday morning", true)]);
    expect(settled).toBe("I need to be in Milan on Thursday morning");
  });

  it("does not fold in a tail the engine has not settled on", () => {
    expect(foldSettled("", [r("Mila", false)])).toBe("");
  });

  it("adds to what the traveller had already typed", () => {
    expect(composeTranscript("Book me", "a flight to Rome", "next")).toBe(
      "Book me a flight to Rome next",
    );
  });

  it("does not leave stray spaces when a part is empty", () => {
    expect(composeTranscript("", "a flight to Rome", "")).toBe("a flight to Rome");
    expect(composeTranscript("", "", "")).toBe("");
  });
});

describe("restarting the engine", () => {
  it("restarts while the traveller is still dictating", () => {
    expect(shouldRestart(true, 5, 60, null)).toBe(true);
  });

  it("stops when they press stop", () => {
    // An engine that restarts after stop is a microphone that will not switch off.
    expect(shouldRestart(false, 5, 60, null)).toBe(false);
  });

  it("stops at the time limit", () => {
    expect(shouldRestart(true, 60, 60, null)).toBe(false);
  });

  it("does not spin on a permission refusal", () => {
    expect(shouldRestart(true, 5, 60, "not-allowed")).toBe(false);
    expect(shouldRestart(true, 5, 60, "service-not-allowed")).toBe(false);
    expect(shouldRestart(true, 5, 60, "audio-capture")).toBe(false);
  });

  it("does restart after a silence, which is not a failure", () => {
    // "no-speech" is what the engine reports for an ordinary pause for breath.
    expect(shouldRestart(true, 5, 60, "no-speech")).toBe(true);
  });
});
