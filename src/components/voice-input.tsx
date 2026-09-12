/**
 * Microphone button for the assistant field, using the browser's built-in
 * Web Speech API only. No transcription service, no audio leaves the device.
 * When the browser has no support we render nothing at all.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

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
  /** Called with the transcript so far; never submits anything. */
  onTranscript: (text: string) => void;
  /** Language hint: Polish page → pl-PL, otherwise English. */
  locale: string;
};

export function VoiceInput({ onTranscript, locale }: Props) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [denied, setDenied] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const baseText = useRef("");

  // Support is a browser fact, so only check after hydration.
  useEffect(() => {
    setSupported(speechCtor() !== null);
  }, []);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) recognition.current?.stop();
  }, [recording, seconds]);

  useEffect(() => () => recognition.current?.stop(), []);

  const start = (currentText: string) => {
    const Ctor = speechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = locale.startsWith("pl") ? "pl-PL" : "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    baseText.current = currentText.trim();
    rec.onresult = (event) => {
      let heard = "";
      for (let i = 0; i < event.results.length; i += 1) {
        heard += `${event.results[i]?.[0]?.transcript ?? ""} `;
      }
      const prefix = baseText.current ? `${baseText.current} ` : "";
      onTranscript(`${prefix}${heard.trim()}`);
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") setDenied(true);
      setRecording(false);
    };
    rec.onend = () => setRecording(false);
    recognition.current = rec;
    setSeconds(0);
    setRecording(true);
    // Permission is requested here, on first use — never on page load.
    try {
      rec.start();
    } catch {
      setRecording(false);
    }
  };

  if (!supported) return null;

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        aria-label={recording ? "Stop recording" : "Dictate your trip"}
        aria-pressed={recording}
        disabled={denied}
        onClick={(e) => {
          if (recording) {
            recognition.current?.stop();
            return;
          }
          const field = e.currentTarget
            .closest("form")
            ?.querySelector("textarea") as HTMLTextAreaElement | null;
          start(field?.value ?? "");
        }}
        className={`inline-flex size-11 items-center justify-center rounded-xl border transition-colors ${
          recording
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-foreground hover:border-primary disabled:opacity-50"
        }`}
      >
        {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
      </button>
      {recording && (
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
          {String(Math.floor(seconds / 60)).padStart(2, "0")}:
          {String(seconds % 60).padStart(2, "0")}
        </span>
      )}
      {denied && (
        <span className="max-w-[9rem] text-right text-[11px] leading-snug text-muted-foreground">
          No microphone access — please type instead.
        </span>
      )}
    </div>
  );
}
