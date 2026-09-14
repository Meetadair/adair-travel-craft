/**
 * Building a sentence out of what the microphone heard.
 *
 * The browser's speech engine does not hand you a growing transcript. It hands
 * you a results list that is emptied every time the engine restarts — and it
 * restarts on its own, after any natural pause, whatever `continuous` is set
 * to. Safari ignores `continuous` outright.
 *
 * So dictation stopped after three or four words: the engine ended at the
 * first breath, onend set recording to false, and nothing started it again.
 *
 * The fix has two halves. The component restarts the engine; this module keeps
 * the words. Finalised text is folded into a string that survives a restart,
 * and only the still-changing tail comes from the current results list.
 */

export type SpeechResult = { transcript: string; isFinal: boolean };

/** Everything the engine has settled on, in this run of the engine. */
export function finalPart(results: SpeechResult[]): string {
  return results
    .filter((r) => r.isFinal)
    .map((r) => r.transcript.trim())
    .filter(Boolean)
    .join(" ");
}

/** The tail it is still revising. Shown, but never folded in until settled. */
export function interimPart(results: SpeechResult[]): string {
  return results
    .filter((r) => !r.isFinal)
    .map((r) => r.transcript.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * What belongs in the field right now.
 *
 * `typed` is whatever the traveller had already written before pressing the
 * microphone — dictation adds to it rather than replacing it. `settled` is
 * everything finalised across every restart so far.
 */
export function composeTranscript(typed: string, settled: string, interim: string): string {
  return [typed.trim(), settled.trim(), interim.trim()].filter(Boolean).join(" ");
}

/**
 * The settled text after this batch of results. Kept separately from the
 * engine's own list precisely because that list is emptied on restart.
 */
export function foldSettled(previousSettled: string, results: SpeechResult[]): string {
  const addition = finalPart(results);
  if (!addition) return previousSettled.trim();
  return [previousSettled.trim(), addition].filter(Boolean).join(" ");
}

/**
 * Should the engine be started again after it ended by itself?
 *
 * Only while the traveller still wants to dictate and the overall time limit
 * has not run out. An engine that restarts after the user pressed stop is a
 * microphone that will not switch off.
 */
export function shouldRestart(
  wanted: boolean,
  seconds: number,
  maxSeconds: number,
  lastError: string | null,
): boolean {
  if (!wanted) return false;
  if (seconds >= maxSeconds) return false;
  // Permission errors are permanent for this page; restarting would spin.
  if (lastError === "not-allowed" || lastError === "service-not-allowed") return false;
  if (lastError === "audio-capture") return false;
  return true;
}
