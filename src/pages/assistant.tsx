import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ageQuestion, familyFromSentence } from "@/lib/trip/family";
import { applyAnswer, assumptionNote, clarify, type Clarification } from "@/lib/trip/clarify";
import { ASSISTANT_PREFILL_KEY } from "@/lib/trips/prefill";
import { parseTripSentence } from "@/lib/trip/parse";
import { track } from "@/lib/track";
import { Plane, BedDouble, CarFront, Sparkles, ChevronRight, Send, X } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { HotelGallery } from "@/components/hotel-gallery";
import { VoiceInput } from "@/components/voice-input";
import { CalendarTripHints } from "@/components/calendar-trip-hints";
import { LoyaltyReminder } from "@/components/prefs/loyalty-reminder";
import { getPromptSuggestions } from "@/lib/suggestions.functions";
import { composeTrip, saveTrip } from "@/lib/travel.functions";
import { supabase } from "@/integrations/supabase/client";
import { localeHref, useLocale, useT } from "@/lib/i18n";

/** Airport choices the traveller has already made, remembered in the browser. */
const AIRPORT_CHOICE_KEY = "adair.airport-choices";

const ICONS: Record<string, React.ReactNode> = {
  flight: <Plane className="size-4" />,
  hotel: <BedDouble className="size-4" />,
  car: <CarFront className="size-4" />,
};

/** Technical provider names are not shown to the customer. */
const HIDDEN_PROVIDERS = ["duffel", "amadeus"];
function displayProvider(provider: string) {
  return HIDDEN_PROVIDERS.some((p) => provider.toLowerCase().includes(p)) ? "Adair" : provider;
}

export function AssistantPage() {
  const navigate = useNavigate();
  const locale = useLocale();
  const t = useT();
  const compose = useServerFn(composeTrip);
  const persist = useServerFn(saveTrip);
  const [input, setInput] = useState("");

  // A sentence handed over from My trips ("Book again" / "Same trip, but…").
  useEffect(() => {
    try {
      const handed = window.localStorage.getItem(ASSISTANT_PREFILL_KEY);
      if (handed) {
        window.localStorage.removeItem(ASSISTANT_PREFILL_KEY);
        setInput(handed);
      }
    } catch {
      /* private browsing — nothing to hand over */
    }
  }, []);
  const [asked, setAsked] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [hotelRef, setHotelRef] = useState<string | null>(null);
  const [showAlts, setShowAlts] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);
  /** The one question we may ask before searching. Never more than one. */
  const [question, setQuestion] = useState<Clarification | null>(null);
  const [answer, setAnswer] = useState("");
  /** What we assumed when we searched without asking, shown on the card. */
  const [assumption, setAssumption] = useState<string | null>(null);

  // Airport choices are remembered locally, so the same question is not asked
  // twice for a city they have already answered for.
  const knownAirports = (): string[] => {
    try {
      const raw = window.localStorage.getItem(AIRPORT_CHOICE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  };
  const rememberAirport = (code: string) => {
    try {
      const next = Array.from(new Set([...knownAirports(), code]));
      window.localStorage.setItem(AIRPORT_CHOICE_KEY, JSON.stringify(next));
    } catch {
      /* private browsing — we simply ask again next time */
    }
  };

  /** The answer folds back into the sentence; we then search, asking nothing more. */
  const answerQuestion = (given: string) => {
    if (!question) return;
    void track("clarify_answered", { kind: question.kind });
    if (question.kind === "which_airport") {
      const code = /\(([A-Z]{3})\)/.exec(given)?.[1];
      if (code) rememberAirport(code);
    }
    runSearch(applyAnswer(input.trim(), question.kind, given));
  };

  const runSearch = (sentence: string) => {
    setAsked(sentence);
    setSaved(null);
    setHotelRef(null);
    setShowAlts(false);
    setRemoved([]);
    setQuestion(null);
    const parsed = parseTripSentence(sentence);
    setAssumption(
      assumptionNote(sentence, parsed.destinationCity, parsed.destinationIata ?? ""),
    );
    search.mutate(sentence);
  };

  const money = (amount: number, currency: string) =>
    `${amount.toLocaleString(locale, { maximumFractionDigits: 0 })} ${currency}`;

  // Examples built from the customer's own profile, falling back to generic ones.
  const fetchSuggestions = useServerFn(getPromptSuggestions);
  const suggestions = useQuery({
    queryKey: ["prompt-suggestions"],
    queryFn: () => fetchSuggestions(),
    retry: false,
  });
  const personal = suggestions.data?.suggestions ?? [];
  const examples = personal.length ? personal.map((s) => s.text) : t.assistant.examples;

  const search = useMutation({
    mutationFn: (message: string) => compose({ data: { message, locale } }),
  });

  const raw = search.data;
  const offers = (raw?.offers ?? [])
    .filter((o) => !removed.includes(o.kind))
    .map((o) => {
      if (o.kind !== "hotel" || !hotelRef) return o;
      const alt = o.alternatives?.find((a) => a.offerReference === hotelRef);
      return alt ? { ...alt, ...(o.alternatives ? { alternatives: o.alternatives } : {}) } : o;
    });
  const total = Math.round(offers.reduce((sum, o) => sum + o.amount, 0) * 100) / 100;

  const store = useMutation({
    mutationFn: async () => {
      const result = raw;
      if (!result) throw new Error("No trip to save");
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ href: localeHref(locale, "/auth") });
        throw new Error("Sign in to save this trip");
      }
      return persist({
        data: {
          title: `${result.request.destinationCity} · ${result.request.departDate}`,
          city: result.request.destinationCity,
          origin: result.request.originCity,
          startDate: result.request.departDate,
          endDate: result.request.returnDate,
          currency: result.currency,
          source: result.source,
          items: offers.map((o) => ({
            kind: o.kind,
            title: o.title,
            detail: o.detail,
            provider: displayProvider(o.provider),
            offerReference: o.offerReference,
            amount: o.amount,
            currency: o.currency,
          })),
        },
      });
    },
    onSuccess: (res) => setSaved(res.documentNumber),
  });

  const result = raw;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{t.assistant.title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t.assistant.lead}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const sentence = input.trim();
            if (!sentence) return;
            // Ages change both the fare and the room, so they come first; then
            // the general ambiguities. Only ever one question per sentence.
            const ages = ageQuestion(familyFromSentence(sentence));
            const ask: Clarification | null = ages
              ? { kind: "child_ages", question: ages, options: [], placeholder: "4 and 7" }
              : clarify(sentence, {
                  destinationCity: parseTripSentence(sentence).destinationCity,
                  knownAirports: knownAirports(),
                });
            if (ask) {
              setQuestion(ask);
              setAnswer("");
              setAsked(sentence);
              void track("clarify_asked", { kind: ask.kind });
              return;
            }
            runSearch(sentence);
          }}
          className="hairline-card mt-8 flex items-end gap-3 p-4"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder={t.assistant.placeholder}
            className="min-h-[56px] w-full resize-none bg-transparent px-2 py-2 text-sm outline-none"
          />
          <VoiceInput locale={locale} onTranscript={setInput} />
          <button
            type="submit"
            disabled={search.isPending}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <Send className="size-4" />
            {search.isPending ? t.assistant.submitBusy : t.assistant.submitIdle}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setInput(ex)}
              className="tag-pill text-left hover:bg-secondary"
            >
              {ex.length > 46 ? `${ex.slice(0, 46)}…` : ex}
            </button>
          ))}
        </div>

        {question && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!answer.trim()) return;
              answerQuestion(answer);
            }}
            className="hairline-card mt-6 p-5"
          >
            <p className="text-sm leading-relaxed">{question.question}</p>
            {question.options.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {question.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => answerQuestion(option)}
                    className="tag-pill hover:bg-secondary"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={question.placeholder}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        <LoyaltyReminder />

        <CalendarTripHints onPlan={(sentence) => setInput(sentence)} />

        {asked && (
          <div className="mt-12 flex justify-end">
            <div className="max-w-md rounded-xl rounded-br-sm border border-border bg-card px-5 py-4">
              <p className="text-sm leading-relaxed">{asked}</p>
            </div>
          </div>
        )}

        {search.isError && <p className="mt-6 text-sm text-primary">{t.assistant.error}</p>}

        {result && (
          <div className="mt-6 flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <div className="w-full">
              <p className="mb-2 text-sm text-muted-foreground">{result.reply}</p>
              <div className="hairline-card overflow-hidden">
                <div className="border-b border-border px-5 py-4">
                  <p className="text-sm font-semibold">
                    {result.request.originCity} → {result.request.destinationCity}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {assumption ? `${assumption} · ` : ""}
                    {result.request.departDate} – {result.request.returnDate} ·{" "}
                    {result.source === "live"
                      ? t.assistant.sourceLive
                      : result.source === "partial"
                        ? t.assistant.sourcePartial
                        : t.assistant.sourceDemo}
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {offers.map((o) => (
                    <div key={o.kind + o.offerReference} className="flex gap-4 px-5 py-4">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                        {ICONS[o.kind]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{o.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {o.detail}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="tag-pill">{displayProvider(o.provider)}</span>
                          <span className="tag-pill">{o.offerReference.slice(0, 22)}</span>
                        </div>
                        {o.kind === "hotel" && (
                          <>
                            <HotelGallery
                              {...(o.images ? { images: o.images } : {})}
                              alt={o.title}
                            />
                            {o.alternatives && o.alternatives.length > 0 && (
                              <div className="mt-3">
                                <button
                                  onClick={() => setShowAlts((v) => !v)}
                                  className="text-xs font-medium text-primary underline underline-offset-4"
                                >
                                  {showAlts
                                    ? t.assistant.hideAlternatives
                                    : t.assistant.showAlternatives}
                                </button>
                                {showAlts && (
                                  <div className="mt-3 space-y-2">
                                    {(hotelRef
                                      ? o.alternatives.filter(
                                          (a) => a.offerReference !== o.offerReference,
                                        )
                                      : o.alternatives.slice(0, 3)
                                    ).map((a) => (
                                      <button
                                        key={a.offerReference}
                                        onClick={() => setHotelRef(a.offerReference)}
                                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-secondary"
                                      >
                                        <span className="min-w-0">
                                          <span className="block truncate text-sm font-medium">
                                            {a.title}
                                          </span>
                                          <span className="block truncate text-xs text-muted-foreground">
                                            {a.detail}
                                          </span>
                                        </span>
                                        <span className="shrink-0 text-sm font-semibold text-primary">
                                          {money(a.amount, a.currency)}
                                        </span>
                                      </button>
                                    ))}
                                    {hotelRef && (
                                      <button
                                        onClick={() => setHotelRef(null)}
                                        className="text-xs text-muted-foreground underline underline-offset-4"
                                      >
                                        {t.assistant.backToRecommendation}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <p className="text-sm font-semibold text-primary">
                          {money(o.amount, o.currency)}
                        </p>
                        <button
                          type="button"
                          onClick={() => setRemoved((prev) => [...prev, o.kind])}
                          aria-label={t.assistant.remove}
                          title={t.assistant.remove}
                          className="flex size-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {removed.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs text-muted-foreground">
                      <span>{t.assistant.removedNote}</span>
                      <button
                        type="button"
                        onClick={() => setRemoved([])}
                        className="font-medium text-primary underline underline-offset-4"
                      >
                        {t.assistant.restoreAll}
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-border bg-cream-deep px-5 py-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t.assistant.total}</p>
                    <p className="font-display text-xl font-semibold text-primary">
                      {money(total, result.currency)}
                    </p>
                  </div>
                  <button
                    onClick={() => store.mutate()}
                    disabled={store.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    {store.isPending ? t.assistant.saveBusy : t.assistant.saveIdle}
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>

              {saved && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t.assistant.savedAs} {saved}.{" "}
                  <button
                    onClick={() => navigate({ to: "/dashboard" })}
                    className="text-primary underline underline-offset-4"
                  >
                    {t.assistant.openDashboard}
                  </button>
                </p>
              )}

              {result.warnings.length > 0 && (
                <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
                  {result.warnings.map((w) => (
                    <li key={w}>· {w}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
