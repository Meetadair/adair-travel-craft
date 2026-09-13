import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChatQuestions } from "@/components/trip/chat-questions";
import { en } from "@/lib/i18n/locales/en";

export const Route = createFileRoute("/dev/answers")({ component: DevAnswers });

function DevAnswers() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <ChatQuestions
        questions={[
          { kind: "dates", question: "Which dates?", options: [], control: "calendar", essential: true },
          { kind: "arrival_time", question: "What time?", options: [], control: "time", essential: false },
          { kind: "travellers", question: "Who is travelling?", options: [], control: "travellers", essential: false },
          {
            kind: "which_airport",
            question: "Which airport?",
            options: [{ value: "WAW", label: "Warsaw (WAW)" }],
            control: "options",
            essential: false,
          },
        ]}
        copy={en.assistant.questions}
        onAnswer={(kind, value) => setLog((p) => [...p, `${kind}=${String(value)}`])}
        onSkip={(kind) => setLog((p) => [...p, `skip ${kind}`])}
      />
      <pre data-testid="log">{log.join("\n")}</pre>
    </main>
  );
}
