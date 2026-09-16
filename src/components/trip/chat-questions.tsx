import { useState } from "react";
import type { ChatQuestion, ChatQuestionKind } from "@/lib/trip/questions";
import { rangeSentence, type DateRange } from "@/lib/trip/answers";
import {
  AirportAnswer,
  ChoiceAnswer,
  DateAnswer,
  TimeAnswer,
  TravellersAnswer,
  type AnswerControlsCopy,
} from "./answer-controls";

export type QuestionsCopy = { skip: string; done: string; controls: AnswerControlsCopy };

/**
 * The one or two things Adair asks in the chat, with the real answer control
 * right under the question: shortcut chips first, the full control underneath.
 * Essential questions cannot be skipped.
 */
export function ChatQuestions({
  questions,
  copy,
  childAges,
  companions,
  onAnswer,
  onSkip,
}: {
  questions: ChatQuestion[];
  copy: QuestionsCopy;
  childAges?: number[] | undefined;
  companions?: { id: string; label: string }[] | undefined;
  onAnswer: (kind: ChatQuestionKind, value: string | number[]) => void;
  onSkip: (kind: ChatQuestionKind) => void;
}) {
  const [range, setRange] = useState<DateRange | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [travellers, setTravellers] = useState(1);
  // What has been picked per question, so a chosen button stays lit while the
  // rest of the questions are still being answered.
  const [chosen, setChosen] = useState<Partial<Record<ChatQuestionKind, string>>>({});

  if (!questions.length) return null;
  return (
    <div data-testid="chat-questions" className="mt-3 space-y-3">
      {questions.map((question) => (
        <div key={question.kind} className="rounded-xl border border-border bg-card p-4 text-left">
          <p className="text-sm text-foreground">{question.question}</p>

          <div className="mt-2.5">
            {question.control === "calendar" && (
              <DateAnswer
                value={range}
                copy={copy.controls}
                onChange={(next) => {
                  setRange(next);
                  // A single tap is still an open range; only answer once the
                  // traveller has finished choosing.
                  onAnswer(question.kind, rangeSentence(next));
                }}
              />
            )}

            {question.control === "time" && (
              <TimeAnswer
                value={time}
                copy={copy.controls}
                onChange={(next) => {
                  setTime(next);
                  onAnswer(question.kind, next);
                }}
              />
            )}

            {question.control === "travellers" && (
              <TravellersAnswer
                value={travellers}
                companions={companions ?? []}
                copy={copy.controls}
                onChange={(count) => {
                  setTravellers(count);
                  onAnswer(question.kind, String(count));
                }}
              />
            )}

            {question.control === "ages" && (
              <input
                type="text"
                inputMode="numeric"
                placeholder="4 and 7"
                aria-label={question.question}
                defaultValue={(childAges ?? []).join(" and ")}
                onBlur={(e) => {
                  const ages = (e.target.value.match(/\d{1,2}/g) ?? []).map(Number);
                  if (ages.length) onAnswer(question.kind, ages);
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none"
              />
            )}

            {question.control === "options" && (
              <AirportAnswer
                value={chosen[question.kind] ?? null}
                suggestions={question.options.map((option) => ({
                  iata: option.value,
                  label: option.label,
                }))}
                copy={copy.controls}
                onChange={(iata) => {
                  setChosen((prev) => ({ ...prev, [question.kind]: iata }));
                  onAnswer(question.kind, iata);
                }}
              />
            )}

            {question.control === "airport" && (
              <AirportAnswer
                value={chosen[question.kind] ?? null}
                exclude={question.excludeIata ?? []}
                suggestions={question.options.map((option) => ({
                  iata: option.value,
                  label: option.label,
                }))}
                copy={copy.controls}
                onChange={(iata) => {
                  setChosen((prev) => ({ ...prev, [question.kind]: iata }));
                  onAnswer(question.kind, iata);
                }}
              />
            )}

            {question.control === "choice" && (
              <ChoiceAnswer
                value={chosen[question.kind] ?? null}
                options={question.options}
                onChange={(value) => {
                  setChosen((prev) => ({ ...prev, [question.kind]: value }));
                  onAnswer(question.kind, value);
                }}
              />
            )}
          </div>

          {!question.essential && (
            <button
              type="button"
              onClick={() => onSkip(question.kind)}
              className="mt-2.5 text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
            >
              {copy.skip}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
