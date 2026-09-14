import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

import { speakableReply } from "@/lib/voice/speech";

/**
 * Adair reading its replies aloud, using the browser's own speech synthesis.
 *
 * No service, no key, no audio leaving the device, nothing to pay per minute.
 * The voice is plainly a browser voice — the point of shipping this first is
 * to find out whether anyone wants to be read to at all, before paying eight
 * cents a minute to find out.
 *
 * Off by default and remembered per browser. Sound nobody asked for is the
 * fastest way to lose a tab.
 */

const KEY = "adair.speak-replies";

type Synth = {
  speak: (u: SpeechSynthesisUtterance) => void;
  cancel: () => void;
  getVoices: () => SpeechSynthesisVoice[];
  speaking: boolean;
};

function synth(): Synth | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { speechSynthesis?: Synth }).speechSynthesis ?? null;
}

/** The best available voice for this language, or none and let the browser choose. */
export function pickVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | null {
  const want = locale.startsWith("pl") ? "pl" : "en";
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(want));
  if (matching.length === 0) return null;
  // A local voice does not need the network and does not stall mid-sentence.
  return matching.find((v) => v.localService) ?? matching[0] ?? null;
}

export function useSpeech(locale: string) {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);
  const spokenAlready = useRef<string | null>(null);

  useEffect(() => {
    setSupported(synth() !== null);
    try {
      setEnabled(window.localStorage.getItem(KEY) === "on");
    } catch {
      /* private browsing — stays off, which is the safe default */
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((was) => {
      const next = !was;
      try {
        window.localStorage.setItem(KEY, next ? "on" : "off");
      } catch {
        /* nothing to remember it in; the session still works */
      }
      if (!next) synth()?.cancel();
      return next;
    });
  }, []);

  /** Say this, replacing anything currently being said. */
  const say = useCallback(
    (text: string) => {
      const engine = synth();
      if (!engine || !enabled) return;
      const words = speakableReply(text, locale);
      if (!words) return;
      // Never say the same reply twice: React re-renders, the assistant does
      // not repeat itself.
      if (spokenAlready.current === words) return;
      spokenAlready.current = words;

      engine.cancel();
      const utterance = new SpeechSynthesisUtterance(words);
      utterance.lang = locale.startsWith("pl") ? "pl-PL" : "en-US";
      const voice = pickVoice(engine.getVoices(), locale);
      if (voice) utterance.voice = voice;
      utterance.rate = 1.05;
      engine.speak(utterance);
    },
    [enabled, locale],
  );

  // Leaving the page must stop the voice; a tab that keeps talking after it is
  // closed is the reason people switch this kind of thing off for ever.
  useEffect(() => () => synth()?.cancel(), []);

  return { enabled, supported, toggle, say };
}

export function SpeechToggle({
  enabled,
  supported,
  onToggle,
  labelOn,
  labelOff,
}: {
  enabled: boolean;
  supported: boolean;
  onToggle: () => void;
  labelOn: string;
  labelOff: string;
}) {
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      title={enabled ? labelOn : labelOff}
      aria-label={enabled ? labelOn : labelOff}
      className={
        enabled
          ? "inline-flex size-9 items-center justify-center rounded-xl border border-primary bg-primary/5 text-primary transition-colors"
          : "inline-flex size-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      {enabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
    </button>
  );
}
