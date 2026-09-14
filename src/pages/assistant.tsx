import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { ageQuestion, familyFromSentence } from "@/lib/trip/family";
import { applyAnswer, assumptionNote, clarify, type Clarification } from "@/lib/trip/clarify";
import { AirportAnswer, DateAnswer } from "@/components/trip/answer-controls";
import { isCompleteRange, rangeSentence, type DateRange } from "@/lib/trip/answers";
import { ASSISTANT_PREFILL_KEY } from "@/lib/trips/prefill";
import { parseTripSentence } from "@/lib/trip/parse";
import { offerMatch } from "@/lib/trip/offer-match";
import { detectTripContext, prefsForContext } from "@/lib/prefs/context";
import type { SearchPrefs } from "@/lib/trip/rank";
import { MatchNote } from "@/components/trip-line-options";
import { FlightChoice } from "@/components/trip/flight-choice";
import { replyFor, ruleIntent } from "@/lib/trip/intent";
import { chatQuestions, type ChatQuestionKind } from "@/lib/trip/questions";
import { track } from "@/lib/track";
import { Plane, BedDouble, CarFront, Sparkles, ChevronRight, Send, X } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { HotelGallery } from "@/components/hotel-gallery";
import { VoiceInput } from "@/components/voice-input";
import { CalendarTripHints } from "@/components/calendar-trip-hints";
import { LoyaltyReminder } from "@/components/prefs/loyalty-reminder";
import { getPromptSuggestions } from "@/lib/suggestions.functions";
import { getAccount } from "@/lib/account.functions";
import { composeTrip, saveTrip } from "@/lib/travel.functions";
import { askAdair } from "@/lib/assistant.functions";
import { supabase } from "@/integrations/supabase/client";
import { localeHref, useLocale, useT } from "@/lib/i18n";
import { AppFooter } from "@/components/app-footer";

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
  const converse = useServerFn(askAdair);
  const [input, setInput] = useState("");

  /**
   * The conversation so far. Everything the traveller types and everything
   * Adair says back lives here, in order, so the screen reads as one thread
   * rather than a form that forgets the last answer.
   */
  const [turns, setTurns] = useState<Array<{ id: number; role: "user" | "adair"; text: string }>>(
    [],
  );
  const say = (role: "user" | "adair", text: string) =>
    setTurns((prev) => [...prev, { id: prev.length + Date.now(), role, text }]);
  /** True from the first message on: the page stops being a landing screen. */
  const started = turns.length > 0;

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
  /** The question on screen now. Only ever one at a time. */
  const [question, setQuestion] = useState<Clarification | null>(null);
  /** What has already been answered, so nothing is asked twice. */
  const [answered, setAnswered] = useState<ChatQuestionKind[]>([]);
  /** A range being picked. Held here until both ends are chosen. */
  const [dateDraft, setDateDraft] = useState<DateRange | null>(null);
  /** Flight the traveller picked from the choice; null means our pick. */
  const [flightRef, setFlightRef] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  /** What we assumed when we searched without asking, shown on the card. */
  const [assumption, setAssumption] = useState<string | null>(null);
  /** A plain answer — a greeting, a question about Adair — instead of a search. */
  const [reply, setReply] = useState<string | null>(null);

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
    setAnswered((prev) =>
      prev.includes(question.kind as ChatQuestionKind)
        ? prev
        : [...prev, question.kind as ChatQuestionKind],
    );
    say("user", given);
    handleSentence(applyAnswer(asked ?? input.trim(), question.kind, given), {
      skipIntent: true,
    });
  };

  /**
   * One entry point for everything typed or tapped. The destination comes
   * first: with no city we ask for it and never search.
   */
  const handleSentence = (raw: string, options: { skipIntent?: boolean } = {}) => {
    const sentence = raw.trim();
    if (!sentence) return;

    if (!options.skipIntent) {
      say("user", sentence);
    }
    // Whatever happens next, the box is empty again — as in any chat.
    setInput("");
    if (!options.skipIntent) {
      const kind = ruleIntent(sentence, Boolean(search.data));
      if (kind !== "trip" && kind !== "amendment") {
        setQuestion(null);
        setAsked(sentence);
        search.reset();
        setReply(null);
        // Not a trip to search — a greeting, a question about a place, a
        // distance. Adair answers it properly, with its tools.
        chat.mutate(sentence);
        return;
      }
    }
    setReply(null);

    const parsed = parseTripSentence(sentence);

    // The full question set, not just the one ambiguity: dates, an arrival time
    // for a business trip, children's ages, which airport, a car, the transfer,
    // the time they want to come home.
    const pending = parsed
      ? chatQuestions(sentence, parsed, {
          knownAirports: knownAirports(),
          answered,
          known: knownProfile,
          copy: {
            destination: t.assistant.questions.destination,
            dates: t.assistant.questions.dates,
            arrivalTime: t.assistant.questions.arrivalTime,
            whichAirport: t.assistant.questions.whichAirport,
            needsCar: t.assistant.questions.needsCar,
            returnTime: t.assistant.questions.returnTime,
            airportTransfer: t.assistant.questions.airportTransfer,
          },
        })
      : [];

    const next = pending[0] ?? null;
    const ask: Clarification | null = next
      ? {
          kind: next.kind as Clarification["kind"],
          question: next.question,
          options: next.options.map((option) => option.label),
          placeholder: "",
        }
      : clarify(sentence, {
          destinationCity: parsed?.destinationCity ?? "",
          knownAirports: knownAirports(),
        });
    if (ask) {
      setQuestion(ask);
      setAnswer("");
      setAsked(sentence);
      search.reset();
      say("adair", ask.question);
      void track("clarify_asked", { kind: ask.kind });
      return;
    }
    runSearch(sentence);
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
      parsed
        ? assumptionNote(sentence, parsed.destinationCity, parsed.destinationIata ?? "")
        : null,
    );
    search.mutate(sentence);
  };

  const money = (amount: number, currency: string) =>
    `${amount.toLocaleString(locale, { maximumFractionDigits: 0 })} ${currency}`;

  // Saved preferences, for the match dots. Absent when signed out, and then no
  // dots are shown — there would be nothing to score against.
  const loadAccount = useServerFn(getAccount);
  const account = useQuery({
    queryKey: ["account-for-match"],
    queryFn: () => loadAccount(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const basePrefs = (account.data?.preferences ?? null) as SearchPrefs | null;
  const searchPrefs = useMemo(() => {
    if (!basePrefs) return null;
    const context = detectTripContext(asked ?? "");
    return prefsForContext(
      basePrefs as unknown as Record<string, unknown>,
      account.data?.businessPrefs ?? null,
      context,
    ) as unknown as SearchPrefs;
  }, [basePrefs, account.data?.businessPrefs, asked]);

  // Trips already booked: a returning traveller has taught us things a new one
  // has not, and the question budget follows from that.
  const tripCount = useQuery({
    queryKey: ["trip-count-for-questions"],
    queryFn: async () => {
      const { count } = await supabase
        .from("trips")
        .select("id", { count: "exact", head: true })
        .eq("status", "booked");
      return count ?? 0;
    },
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

  /**
   * What Adair already knows, which decides how much it needs to ask. A first
   * trip earns a proper conversation; by the fifth, most of it is on file.
   */
  const knownProfile = useMemo(() => {
    const prefs = (account.data?.preferences ?? null) as Record<string, unknown> | null;
    const stated = prefs
      ? Object.values(prefs).filter((value) =>
          Array.isArray(value) ? value.length > 0 : Boolean(value),
        ).length
      : 0;
    return {
      statedPreferences: stated,
      tripsBooked: tripCount.data ?? 0,
      knowsCarHabit: Boolean(
        (prefs?.["carTransmission"] ?? "any") !== "any" || prefs?.["carClass"],
      ),
      knowsBusinessHabit: Boolean(prefs?.["cabinRule"] ?? account.data?.companies?.length),
    };
  }, [account.data, tripCount.data]);

  // Examples built from the customer's own profile, falling back to generic ones.
  const fetchSuggestions = useServerFn(getPromptSuggestions);
  const suggestions = useQuery({
    queryKey: ["prompt-suggestions"],
    queryFn: () => fetchSuggestions(),
    retry: false,
  });
  const personal = suggestions.data?.suggestions ?? [];
  const examples = personal.length ? personal.map((s) => s.text) : t.assistant.examples;

  /** A plain question, answered by Adair with its tools. */
  const chat = useMutation({
    mutationFn: async (message: string) => {
      const history = [
        ...turns.map((turn) => ({
          role: turn.role === "user" ? ("user" as const) : ("assistant" as const),
          content: turn.text,
        })),
        { role: "user" as const, content: message },
      ].slice(-20);
      return converse({ data: { messages: history, locale, city: null, hotel: null } });
    },
    onSuccess: (result, message) => {
      // Without a key the agent stays silent rather than guessing, so we fall
      // back to the written reply instead of showing the traveller nothing.
      const written =
        result.configured && result.reply
          ? result.reply
          : (replyFor(ruleIntent(message, false), t.assistant.intent) ??
            t.assistant.intent.unclear);
      say("adair", written);
    },
    onError: () => say("adair", t.assistant.intent.unclear),
  });

  const search = useMutation({
    mutationFn: (message: string) => compose({ data: { message, locale } }),
    onSuccess: (result) => {
      if ("needsDestination" in result) {
        say("adair", t.assistant.intent.needsDestination);
        setQuestion({
          kind: "needs_destination",
          question: t.assistant.intent.needsDestination,
          options: [],
          placeholder: "e.g. Milan",
        });
      }
    },
  });

  const data = search.data;
  const raw = data && "offers" in data ? data : undefined;
  const offers = (raw?.offers ?? [])
    .filter((o) => !removed.includes(o.kind))
    .map((o) => {
      if (o.kind === "hotel" && hotelRef) {
        const alt = o.alternatives?.find((a) => a.offerReference === hotelRef);
        return alt ? { ...alt, ...(o.alternatives ? { alternatives: o.alternatives } : {}) } : o;
      }
      // A picked flight replaces the line's price and reference, and the
      // choice stays attached so the traveller can change their mind.
      if (o.kind === "flight" && flightRef && o.flightChoice) {
        const picked = o.flightChoice.options.find((option) => option.flight.offerId === flightRef);
        if (!picked || picked.flight.offerId === o.offerReference) return o;
        const f = picked.flight;
        return {
          ...o,
          title: `${f.carrier} ${f.flightNumbers[0] ?? ""} · ${o.title.split("·").slice(1).join("·").trim()}`,
          offerReference: f.offerId,
          amount: Math.round(f.amount * 100) / 100,
          currency: f.currency,
        };
      }
      return o;
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
      <main
        className={
          started
            ? "mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col px-6 pb-6 pt-8"
            : "mx-auto max-w-3xl px-6 py-16"
        }
      >
        {!started && (
          <>
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              {t.assistant.title}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {t.assistant.lead}
            </p>
          </>
        )}

        {turns.length > 0 && (
          <div className="flex-1 space-y-4 pb-4">
            {turns.map((turn) =>
              turn.role === "user" ? (
                <div key={turn.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-sm leading-relaxed">
                    {turn.text}
                  </p>
                </div>
              ) : (
                <div key={turn.id} className="flex justify-start">
                  <p className="max-w-[85%] whitespace-pre-line text-sm leading-relaxed">
                    {turn.text}
                  </p>
                </div>
              ),
            )}
            {chat.isPending && (
              <p className="text-sm text-muted-foreground">{t.assistant.submitBusy}</p>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSentence(input);
          }}
          className={
            started
              ? "hairline-card sticky bottom-4 flex items-end gap-3 bg-background p-4"
              : "hairline-card mt-8 flex items-end gap-3 p-4"
          }
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, as in any chat. Shift+Enter still breaks the line,
              // and we never send mid-composition (IME for CJK input).
              if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
              e.preventDefault();
              if (!input.trim() || search.isPending) return;
              handleSentence(input);
            }}
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

        <div className={started ? "hidden" : "mt-4 flex flex-wrap gap-2"}>
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
            {(question.kind === "dates" ||
              question.kind === "no_dates" ||
              question.kind === "vague_week") && (
              <div className="mt-3">
                <DateAnswer
                  value={dateDraft}
                  copy={t.assistant.strip.controls}
                  onChange={(range) => {
                    setDateDraft(range);
                    // Both ends or nothing: a one-way answer would send the
                    // search off with a return date we made up.
                    if (isCompleteRange(range)) {
                      setDateDraft(null);
                      answerQuestion(rangeSentence(range));
                    }
                  }}
                />
              </div>
            )}

            {question.kind === "needs_destination" && (
              <div className="mt-3">
                <AirportAnswer
                  value={null}
                  copy={t.assistant.strip.controls}
                  onChange={(iata) => answerQuestion(iata)}
                />
              </div>
            )}

            {question.kind === "which_airport" && (
              <div className="mt-3">
                <AirportAnswer
                  value={null}
                  copy={t.assistant.strip.controls}
                  onChange={(iata) => answerQuestion(iata)}
                />
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
                    <div key={o.kind + o.offerReference}>
                      <div className="flex gap-4 px-5 py-4">
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
                      <MatchNote match={offerMatch(o, searchPrefs)} label={o.kind} />
                      {o.kind === "flight" && o.flightChoice && (
                        <div className="px-5 pb-4">
                          <FlightChoice
                            choice={o.flightChoice}
                            selectedOfferId={flightRef}
                            onSelect={setFlightRef}
                          />
                        </div>
                      )}
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
      <AppFooter />
    </div>
  );
}
