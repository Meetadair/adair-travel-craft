import type { ChatQuestion, ChatQuestionKind } from "@/lib/trip/questions";


export type QuestionsCopy = { skip: string; done: string };

/**
 * The one or two things Adair asks in the chat, with the answer control right
 * under the question. Essential questions cannot be skipped.
 */
export function ChatQuestions({
  questions,
  copy,
  childAges,
  onAnswer,
  onSkip,
}: {
  questions: ChatQuestion[];
  copy: QuestionsCopy;
  childAges?: number[] | undefined;
  onAnswer: (kind: ChatQuestionKind, value: string | number[]) => void;
  onSkip: (kind: ChatQuestionKind) => void;
}) {
  if (!questions.length) return null;
  return (
    <div data-testid="chat-questions" className="mt-3 space-y-3">
      {questions.map((question) => (
        <div key={question.kind} className="rounded-xl border border-border bg-card p-4 text-left">
          <p className="text-sm text-foreground">{question.question}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {question.control === "calendar" && (
              <input
                type="date"
                aria-label={question.question}
                onChange={(e) => e.target.value && onAnswer(question.kind, e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none"
              />
            )}
            {question.control === "time" && (
              <input
                type="time"
                aria-label={question.question}
                onChange={(e) => e.target.value && onAnswer(question.kind, e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none"
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

            {question.control === "options" &&
              question.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onAnswer(question.kind, option.value)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40"
                >
                  {option.label}
                </button>
              ))}
            {!question.essential && (
              <button
                type="button"
                onClick={() => onSkip(question.kind)}
                className="text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
              >
                {copy.skip}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
