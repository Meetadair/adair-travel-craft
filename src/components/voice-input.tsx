/**
 * Microphone button for the assistant field, using the browser's built-in
 * Web Speech API only. No transcription service, no audio leaves the device.
 * When the browser has no support we render nothing at all.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import {
  composeTranscript,
  foldSettled,
  interimPart,
  shouldRestart,
  type SpeechResult,
} from "@/lib/voice/transcript";

const MAX_SECONDS = 60;

type SpeechResultList = {
  length: number;
  [index: number]: { 0: { transcript: string }; isFinal: boolean };
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechCtor = new () => SpeechRecognitionLike;

function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Props = {
  /** Called with the transcript so far, as it grows. */
  onTranscript: (text: string) => void;
  /**
   * Called once with the finished sentence — when the traveller presses stop,
   * or after they have clearly finished talking. This is what makes it a
   * conversation: you speak, and something happens, without a button.
   */
  onSubmit?: ((text: string) => void) | undefined;
  /** Language hint: Polish page → pl-PL, otherwise English. */
  locale: string;
};

/**
 * How long a silence has to be, after real words, before we take the sentence
 * as finished. Long enough for a breath and a "…erm", short enough that the
 * traveller is not left wondering whether anything heard them.
 */
const SILENCE_MS = 2200;

export function VoiceInput({ onTranscript, onSubmit, locale }: Props) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [denied, setDenied] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const baseText = useRef("");
  /** Everything the engine has finalised, across every restart. */
  const settled = useRef("");
  /** Whether the traveller still wants to dictate, as opposed to the engine
      having ended on its own. onend cannot tell the difference by itself. */
  const wanted = useRef(false);
  const lastError = useRef<string | null>(null);
  const elapsed = useRef(0);
  /** Settled text including the run currently in progress. */
  const runSettled = useRef("");
  /** The full sentence as last shown, so stop can hand it over. */
  const lastShown = useRef("");
  const silenceTimer = useRef<number | null>(null);

  const clearSilence = () => {
    if (silenceTimer.current !== null) {
      window.clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  };

  /** Hand the sentence over and switch off, once. */
  const finish = () => {
    clearSilence();
    wanted.current = false;
    recognition.current?.stop();
    const sentence = lastShown.current.trim();
    if (sentence && onSubmit) onSubmit(sentence);
  };

  // Support is a browser fact, so only check after hydration.
  useEffect(() => {
    setSupported(speechCtor() !== null);
  }, []);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      elapsed.current += 1;
      setSeconds(elapsed.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => {
    // At the cap, stopping must also clear the intent — otherwise onend would
    // dutifully start another run and the microphone would never switch off.
    if (recording && seconds >= MAX_SECONDS) {
      wanted.current = false;
      recognition.current?.stop();
    }
  }, [recording, seconds]);

  useEffect(
    () => () => {
      clearSilence();
      wanted.current = false;
      recognition.current?.stop();
    },
    [],
  );

  /**
   * One run of the speech engine.
   *
   * The engine ends itself at every natural pause and empties its results
   * list, which is why dictation used to die after three or four words. Each
   * run folds what it finalised into `settled` and, unless the traveller has
   * pressed stop, another run is started straight away.
   */
  const runEngine = () => {
    const Ctor = speechCtor();
    if (!Ctor) return false;
    const rec = new Ctor();
    rec.lang = locale.startsWith("pl") ? "pl-PL" : "en-US";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      const results: SpeechResult[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const item = event.results[i];
        if (!item) continue;
        results.push({ transcript: item[0]?.transcript ?? "", isFinal: item.isFinal });
      }
      // The settled text of *previous* runs, plus this run's own.
      const wholeSettled = foldSettled(settled.current, results);
      const shown = composeTranscript(baseText.current, wholeSettled, interimPart(results));
      lastShown.current = shown;
      onTranscript(shown);
      runSettled.current = wholeSettled;
      // Words arrived, so the traveller is still talking. A pause after real
      // words — not before any — is what ends the sentence.
      clearSilence();
      if (wholeSettled.trim() && onSubmit) {
        silenceTimer.current = window.setTimeout(finish, SILENCE_MS);
      }
    };

    rec.onerror = (event) => {
      lastError.current = event.error;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setDenied(true);
        wanted.current = false;
      }
    };

    rec.onend = () => {
      // Whatever this run finalised is now permanent; its results list is gone.
      settled.current = runSettled.current;
      if (shouldRestart(wanted.current, elapsed.current, MAX_SECONDS, lastError.current)) {
        lastError.current = null;
        if (runEngine()) return;
      }
      wanted.current = false;
      setRecording(false);
    };

    recognition.current = rec;
    try {
      rec.start();
      return true;
    } catch {
      return false;
    }
  };

  const start = (currentText: string) => {
    if (!speechCtor()) return;
    baseText.current = currentText.trim();
    settled.current = "";
    runSettled.current = "";
    lastShown.current = "";
    clearSilence();
    lastError.current = null;
    elapsed.current = 0;
    wanted.current = true;
    setSeconds(0);
    setRecording(true);
    // Permission is requested here, on first use — never on page load.
    if (!runEngine()) {
      wanted.current = false;
      setRecording(false);
    }
  };

  if (!supported) return null;

  // One round button, sized to sit inside the voice pill beside the speaker.
  // The timer lives inline rather than stacked beneath, so the row never
  // changes height when recording starts.
  const shape =
    "inline-flex size-9 items-center justify-center rounded-full transition-colors disabled:opacity-40";
  const label = denied
    ? "No microphone access — please type instead."
    : recording
      ? "Stop recording"
      : "Dictate your trip";

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={recording}
        disabled={denied}
        onClick={(e) => {
          if (recording) {
            finish();
            return;
          }
          const field = e.currentTarget
            .closest("form")
            ?.querySelector("textarea") as HTMLTextAreaElement | null;
          start(field?.value ?? "");
        }}
        className={`${shape} ${
          recording
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        {recording ? <Square className="size-3.5" /> : <Mic className="size-4" />}
      </button>
      {recording && (
        <span className="flex items-center gap-1.5 px-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
          {String(Math.floor(seconds / 60)).padStart(2, "0")}:
          {String(seconds % 60).padStart(2, "0")}
        </span>
      )}
    </>
  );
}
