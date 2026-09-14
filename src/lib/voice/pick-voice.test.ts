import { describe, expect, it } from "vitest";
import { pickVoice } from "@/components/voice-output";

const voice = (lang: string, name: string, localService = false) =>
  ({ lang, name, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;

describe("choosing a voice", () => {
  it("matches the language of the page", () => {
    const voices = [voice("en-US", "Samantha"), voice("pl-PL", "Zosia")];
    expect(pickVoice(voices, "pl")?.name).toBe("Zosia");
    expect(pickVoice(voices, "en")?.name).toBe("Samantha");
  });

  it("prefers a local voice, which cannot stall mid-sentence", () => {
    const voices = [voice("pl-PL", "Cloud"), voice("pl-PL", "Zosia", true)];
    expect(pickVoice(voices, "pl")?.name).toBe("Zosia");
  });

  it("accepts any variant of the language", () => {
    expect(pickVoice([voice("en-GB", "Daniel")], "en")?.name).toBe("Daniel");
  });

  it("lets the browser decide when it has nothing in that language", () => {
    expect(pickVoice([voice("de-DE", "Anna")], "pl")).toBeNull();
    expect(pickVoice([], "en")).toBeNull();
  });
});
