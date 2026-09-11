/**
 * Conversational onboarding: one question per screen, built from the question
 * config in `@/lib/prefs/questions`. Add a question there and it appears here.
 */
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { saveOnboarding } from "@/lib/account.functions";
import {
  QUESTIONS,
  answersToPrefs,
  countKnownPreferences,
  labelFor,
  type Answers,
  type Toggles,
} from "@/lib/prefs/questions";
import { airportByIata, airportLabel } from "@/lib/prefs/airports";
import { cleanCompany, type CompanyDraft } from "@/lib/prefs/company-draft";
import { AirportPicker } from "@/components/prefs/airport-picker";
import { CompanyEditor } from "@/components/prefs/company-editor";
import { MultiField, SingleField, ToggleRow } from "@/components/prefs/option-chips";

const primaryBtn =
  "inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60";

export function OnboardingPage() {
  const navigate = useNavigate();
  const save = useServerFn(saveOnboarding);

  // Screen 0 = name, 1..N = questions, N+1 = summary.
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [homeAirport, setHomeAirport] = useState("WAW");
  const [answers, setAnswers] = useState<Answers>({});
  const [toggles, setToggles] = useState<Toggles>({});
  const [companies, setCompanies] = useState<CompanyDraft[]>([]);

  const total = QUESTIONS.length + 2;
  const prefs = useMemo(() => answersToPrefs(answers, toggles), [answers, toggles]);
  const known = countKnownPreferences(prefs) + companies.length;

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          fullName: fullName.trim() || "Traveller",
          homeAirport: homeAirport.toUpperCase(),
          preferences: prefs,
          companies: companies.map(cleanCompany).filter((c) => c.name.length > 0),
          complete: true,
        },
      }),
    onSuccess: () => navigate({ to: "/dashboard" }),
  });

  const question = step >= 1 && step <= QUESTIONS.length ? QUESTIONS[step - 1] : null;
  const isSummary = step === total - 1;
  const canContinue = !question ? true : question.kind === "airport" ? Boolean(homeAirport) : true;

  const setAnswer = (field: string, value: string[]) =>
    setAnswers((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-xl px-6 pb-24 pt-12">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Step {step + 1} of {total} · about 3 minutes
        </p>

        <div
          className="mt-4 h-1 w-full overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          <span
            className="block h-full rounded-full bg-primary transition-all duration-300 motion-reduce:transition-none"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>

        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">
          {step === 0 && "What should we call you?"}
          {question && question.title}
          {isSummary && `Adair now knows ${known} preference${known === 1 ? "" : "s"}`}
        </h1>
        {question?.hint && <p className="mt-2 text-sm text-muted-foreground">{question.hint}</p>}
        {isSummary && (
          <p className="mt-2 text-sm text-muted-foreground">
            Every answer stays editable later under Preferences.
          </p>
        )}

        <div className="hairline-card mt-6 space-y-5 p-5 sm:p-6">
          {step === 0 && (
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Your name</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                placeholder="Anna Kowalska"
                className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </label>
          )}

          {question?.kind === "airport" && (
            <AirportPicker value={homeAirport} onChange={setHomeAirport} />
          )}

          {question?.kind === "fields" && (
            <>
              {question.singles?.map((def) => (
                <SingleField
                  key={def.field}
                  def={def}
                  value={answers[def.field] ?? []}
                  onChange={(next) => setAnswer(def.field, next)}
                />
              ))}
              {question.multis?.map((def) => (
                <MultiField
                  key={def.field}
                  def={def}
                  value={answers[def.field] ?? []}
                  onChange={(next) => setAnswer(def.field, next)}
                />
              ))}
              {question.toggles?.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {question.toggles.map((t) => (
                    <ToggleRow
                      key={t.field}
                      label={t.label}
                      checked={Boolean(toggles[t.field])}
                      onChange={(next) => setToggles((prev) => ({ ...prev, [t.field]: next }))}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}

          {question?.kind === "companies" && (
            <CompanyEditor companies={companies} onChange={setCompanies} />
          )}

          {isSummary && (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="size-4 text-primary" />
                Flying from{" "}
                <span className="font-medium text-foreground">
                  {airportByIata(homeAirport)
                    ? airportLabel(airportByIata(homeAirport)!)
                    : homeAirport}
                </span>
              </p>
              {QUESTIONS.filter((q) => q.kind === "fields").map((q) => {
                const parts = [...(q.singles ?? []), ...(q.multis ?? [])]
                  .flatMap((def) => (answers[def.field] ?? []).map((v) => labelFor(def.field, v)))
                  .concat(
                    (q.toggles ?? []).filter((t) => toggles[t.field]).map((t) => t.label),
                  );
                if (!parts.length) return null;
                return (
                  <div key={q.id} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {q.title}
                    </span>
                    <span className="font-medium">{parts.join(", ")}</span>
                  </div>
                );
              })}
              {companies.length > 0 && (
                <p className="text-muted-foreground">
                  {companies.length} company{companies.length === 1 ? "" : " records"} for invoices
                </p>
              )}
            </div>
          )}

          {mutation.isError && (
            <p className="text-sm text-primary">
              We could not save that. Please check your answers and try again.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="text-sm text-muted-foreground underline decoration-border underline-offset-4 disabled:opacity-40"
            >
              Back
            </button>

            <div className="flex items-center gap-4">
              {question?.skippable && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  className="text-sm text-muted-foreground underline decoration-border underline-offset-4"
                >
                  Skip
                </button>
              )}
              {isSummary ? (
                <button
                  type="button"
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  className={primaryBtn}
                >
                  <Check className="size-4" />
                  {mutation.isPending ? "Saving…" : "Start planning"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canContinue}
                  className={primaryBtn}
                >
                  Continue <ArrowRight className="size-4" />
                </button>
              )}
            </div>
          </div>

          {isSummary && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-muted-foreground underline decoration-border underline-offset-4"
            >
              Edit answers
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
