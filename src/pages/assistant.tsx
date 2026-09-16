import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import { ageQuestion, familyFromSentence } from "@/lib/trip/family";
import { applyAnswer, assumptionNote, clarify, hasNoDates, isVagueWeek, type Clarification } from "@/lib/trip/clarify";
import { AirportAnswer, DateAnswer, TravellersAnswer } from "@/components/trip/answer-controls";
import { isCompleteRange, rangeSentence, type DateRange } from "@/lib/trip/answers";
import { CabinParty, type Cabin } from "@/components/trip/cabin-party";
import { SpeechToggle, useSpeech } from "@/components/voice-output";
import {
  EMPTY_PARTY,
  describeParty,
  headCount,
  isBookableParty,
  stayGuestAges,
  type PartyCounts,
} from "@/lib/trip/party-counts";

/** A search with the dates settled on the card rather than read from the text. */
type SearchArgs = {
  message: string;
  departDate?: string;
  returnDate?: string;
  oneWay?: boolean;
  flexDays?: number;
  cabinClass?: string;
  party?: PartyCounts;
};
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
import {
  Plane,
  BedDouble,
  CarFront,
  Sparkles,
  ChevronRight,
  Send,
  X,
  CalendarDays,
} from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { HotelGallery } from "@/components/hotel-gallery";
import { VoiceInput } from "@/components/voice-input";
import { CalendarTripHints } from "@/components/calendar-trip-hints";
import { LoyaltyReminder } from "@/components/prefs/loyalty-reminder";
import { getPromptSuggestions } from "@/lib/suggestions.functions";
import { getAccount } from "@/lib/account.functions";
import { listCompanions } from "@/lib/companions.functions";
import { composeTrip, saveTrip } from "@/lib/travel.functions";
import { searchLiveTrip } from "@/lib/trip-live.functions";
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
  const live = useServerFn(searchLiveTrip);
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
  /**
   * The calendar, openable at any point in the conversation.
   *
   * Adair does not always ask for dates with the structured question that
   * carries a calendar with it — sometimes it just says "when are you
   * travelling?" in a sentence. Without a way to open the picker on demand the
   * only answer available is to type a date and hope it is understood, which
   * is exactly the guessing this product is supposed to remove.
   */
  const [calendarOpen, setCalendarOpen] = useState(false);
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
  /**
   * The dates being re-picked on the result card. The picker used to exist only
   * while Adair was asking "which dates?", so a traveller who had already named
   * their dates could never reach it — and never saw the flexible-dates option
   * at all, which is the one moment it is worth the most.
   */
  const [cardDates, setCardDates] = useState<DateRange | null>(null);
  /** Adair reading its replies aloud. Off until somebody asks for it. */
  const speech = useSpeech(locale, t.assistant.speechHello);
  /**
   * Whether the traveller's last message was spoken rather than typed.
   *
   * This is the rule that makes it feel like a conversation: speak to Adair
   * and it speaks back, whatever the toggle says. Type to it and it answers
   * in text, unless you asked to be read to. Speaking every reply to someone
   * who was typing is "it just starts talking".
   */
  const askedByVoice = useRef(false);
  useEffect(() => {
    const latest = [...turns].reverse().find((t) => t.role === "adair");
    if (!latest) return;
    if (askedByVoice.current || speech.enabled) speech.say(latest.text, askedByVoice.current);
  }, [turns, speech]);
  /**
   * Cabin and who is flying, re-openable on the card. Airlines put this behind
   * one control for a reason: the cabin a family can afford depends on how
   * many of them there are, so the two are decided together or not at all.
   */
  const [partyOpen, setPartyOpen] = useState(false);
  const [cabin, setCabin] = useState<Cabin>("economy");
  const [party, setParty] = useState<PartyCounts>(EMPTY_PARTY);

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
    // Passed through rather than read back from state: setAnswered above has
    // not landed yet when handleSentence runs, so without this the question
    // that was just answered is asked again — and answering it again starts
    // the same loop from the top.
    handleSentence(applyAnswer(asked ?? input.trim(), question.kind, given), {
      skipIntent: true,
      justAnswered: question.kind as ChatQuestionKind,
    });
  };

  /**
   * One entry point for everything typed or tapped. The destination comes
   * first: with no city we ask for it and never search.
   */
  const handleSentence = (
    raw: string,
    options: { skipIntent?: boolean; justAnswered?: ChatQuestionKind } = {},
  ) => {
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
          answered: options.justAnswered ? [...answered, options.justAnswered] : answered,
          known: knownProfile,
          copy: {
            destination: t.assistant.questions.destination,
            travellers: t.assistant.questions.travellers,
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
          excludeIata: next.excludeIata ?? [],
          placeholder: "",
        }
      : clarify(sentence, {
          destinationCity: parsed?.destinationCity ?? "",
          knownAirports: knownAirports(),
        });
    if (ask) {
      setQuestion(ask);
      setAnswer("");
      if (ask.kind === "travellers") {
        setTravellersCount(1);
        setSelectedCompanions([]);
      }
      setAsked(sentence);
      search.reset();
      say("adair", ask.question);
      void track("clarify_asked", { kind: ask.kind });
      return;
    }
    runSearch(sentence);
  };

  const runSearch = (sentence: string, override?: Omit<SearchArgs, "message">) => {
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
    search.mutate(override ? { message: sentence, ...override } : sentence);
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

  // Who to offer as chips on the "flying solo, or with others?" question —
  // signed out or nobody saved yet, and the count-only control still works.
  const loadCompanions = useServerFn(listCompanions);
  const companions = useQuery({
    queryKey: ["companions-for-questions"],
    queryFn: () => loadCompanions(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const savedCompanions = useMemo(
    () => (companions.data ?? []).filter((t) => !t.isSelf),
    [companions.data],
  );
  const [travellersCount, setTravellersCount] = useState(1);
  const [selectedCompanions, setSelectedCompanions] = useState<string[]>([]);
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

      // Adair sometimes asks for the dates in a sentence of its own rather than
      // through the structured question that carries a calendar. When that
      // happens and we still do not know when the trip is, open the calendar
      // ourselves: the alternative is a traveller typing a date into a chat box
      // and hoping it was read the way they meant it.
      const trip = parseTripSentence(message);
      if (trip && (hasNoDates(message) || isVagueWeek(message))) setCalendarOpen(true);
    },
    onError: () => say("adair", t.assistant.intent.unclear),
  });

  const search = useMutation({
    mutationFn: (args: string | SearchArgs) =>
      typeof args === "string"
        ? compose({ data: { message: args, locale } })
        : compose({ data: { ...args, locale } }),
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

  /**
   * Booking.
   *
   * composeTrip is a preview: it prices a trip but stores nothing, so there is
   * nothing for the booking page to open. The live search is the path that
   * writes a trip card and holds the supplier's offer, so booking runs that —
   * with the dates, cabin and party the traveller settled on here, so the card
   * they book is the card they were looking at.
   *
   * Signing in is required to book, as it is everywhere: an offer has to be
   * held against somebody. The sentence is stashed so they come back to it
   * rather than to an empty box.
   */
  const startBooking = useMutation({
    mutationFn: async () => {
      const sentence = asked?.trim();
      if (!sentence || !raw) throw new Error("No trip to book");
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        try {
          window.localStorage.setItem(ASSISTANT_PREFILL_KEY, sentence);
        } catch {
          /* private browsing — they will retype it */
        }
        navigate({ href: localeHref(locale, "/auth") });
        throw new Error("Sign in to book");
      }
      return live({
        data: {
          sentence,
          overrides: {
            departDate: raw.request.departDate,
            ...(raw.request.oneWay
              ? { oneWay: true }
              : { returnDate: raw.request.returnDate, oneWay: false }),
            cabinClass: cabin,
            passengers: headCount(party),
            ...(stayGuestAges(party).length ? { childAges: stayGuestAges(party) } : {}),
          },
        },
      });
    },
    onSuccess: (res) => navigate({ to: "/book/$cardId", params: { cardId: res.cardId } }),
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

        {/* The answer belongs under the question that asked it. Rendered after
            the composer it landed below a box that sticks to the bottom of the
            window, so Adair asked at the top of the screen and the way to reply
            sat underneath the thing you type in — which reads as two separate
            conversations. */}
        {question && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!answer.trim()) return;
              answerQuestion(answer);
            }}
            className="hairline-card mt-6 p-5"
          >
            {/* Adair already asked this in the conversation just above; a card
                that repeats the same sentence reads as a rendering bug. */}
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
                  onChange={setDateDraft}
                  // The calendar stays up until the traveller says they are
                  // done. Submitting the moment a range happened to be complete
                  // took the calendar away mid-thought, with no way back to it.
                  onConfirm={() => {
                    if (!dateDraft || !isCompleteRange(dateDraft)) return;
                    const sentence = rangeSentence(dateDraft);
                    setDateDraft(null);
                    answerQuestion(sentence);
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

            {question.kind === "origin" && (
              <div className="mt-3">
                <AirportAnswer
                  value={null}
                  exclude={question.excludeIata ?? []}
                  copy={t.assistant.strip.controls}
                  onChange={(iata) => answerQuestion(iata)}
                />
              </div>
            )}

            {question.kind === "travellers" && (
              <div className="mt-3 space-y-3">
                <TravellersAnswer
                  value={travellersCount}
                  companions={savedCompanions.map((c) => ({ id: c.id, label: c.givenName }))}
                  selected={selectedCompanions}
                  copy={t.assistant.strip.controls}
                  onChange={setTravellersCount}
                  onToggleCompanion={(id) => {
                    setSelectedCompanions((current) => {
                      const next = current.includes(id)
                        ? current.filter((c) => c !== id)
                        : [...current, id];
                      // Picking a person is picking a seat: the count follows
                      // the chips rather than needing to be set twice.
                      setTravellersCount((count) => Math.max(count, next.length + 1));
                      return next;
                    });
                  }}
                />
                <button
                  type="button"
                  onClick={() => answerQuestion(`for ${travellersCount} people`)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {t.assistant.questions.done}
                </button>
              </div>
            )}

            {/* The typed answer is for questions that have no better control.
                Under the calendar it was a second, meaningless way to answer
                the same question — an empty box and a Continue button sitting
                right below "Search these dates". */}
            {question.options.length === 0 &&
              question.kind !== "dates" &&
              question.kind !== "no_dates" &&
              question.kind !== "vague_week" &&
              question.kind !== "travellers" &&
              question.kind !== "origin" &&
              question.kind !== "needs_destination" &&
              question.kind !== "which_airport" && (
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
              )}
          </form>
        )}

        {calendarOpen && (
          <div className="hairline-card mt-4 p-5">
            <p className="text-sm text-foreground">{t.assistant.questions.dates}</p>
            <div className="mt-3">
              <DateAnswer
                value={dateDraft}
                copy={t.assistant.strip.controls}
                onChange={setDateDraft}
                onConfirm={() => {
                  if (!dateDraft || !isCompleteRange(dateDraft)) return;
                  const chosen = rangeSentence(dateDraft);
                  setDateDraft(null);
                  setCalendarOpen(false);
                  // Answering the open question when there is one, and otherwise
                  // saying the dates as a sentence of their own.
                  if (question) answerQuestion(chosen);
                  else handleSentence(applyAnswer(asked ?? input.trim(), "dates", chosen));
                }}
              />
            </div>
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
            onChange={(e) => {
              askedByVoice.current = false;
              setInput(e.target.value);
            }}
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
          {/* Listening and speaking are one idea, so they share one pill:
              two identical round buttons, one hairline, no competing shapes. */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-background p-0.5">
            <VoiceInput
              locale={locale}
              onTranscript={setInput}
              onSubmit={(sentence) => {
                // Spoken in, spoken out.
                askedByVoice.current = true;
                setInput("");
                handleSentence(sentence);
              }}
            />
            <SpeechToggle
              enabled={speech.enabled}
              supported={speech.supported}
              onToggle={speech.toggle}
              labelOn={t.assistant.speechOn}
              labelOff={t.assistant.speechOff}
            />
            <button
              type="button"
              onClick={() => setCalendarOpen((open) => !open)}
              aria-pressed={calendarOpen}
              aria-label={t.assistant.questions.dates}
              title={t.assistant.questions.dates}
              className={
                calendarOpen
                  ? "flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  : "flex size-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              }
            >
              <CalendarDays className="size-4" />
            </button>
          </div>
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


        <LoyaltyReminder />

        <CalendarTripHints onPlan={(sentence) => setInput(sentence)} />

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
                    {result.request.oneWay
                      ? `${result.request.departDate} · ${t.assistant.strip.controls.oneWay}`
                      : `${result.request.departDate} – ${result.request.returnDate}`}{" "}
                    ·{" "}
                    {result.source === "live"
                      ? t.assistant.sourceLive
                      : result.source === "partial"
                        ? t.assistant.sourcePartial
                        : t.assistant.sourceDemo}
                    {" · "}
                    <button
                      type="button"
                      onClick={() =>
                        setCardDates((open) =>
                          open
                            ? null
                            : {
                                departDate: result.request.departDate,
                                ...(result.request.oneWay
                                  ? { oneWay: true }
                                  : { returnDate: result.request.returnDate }),
                                ...(result.request.flexDays
                                  ? { flexDays: result.request.flexDays }
                                  : {}),
                              },
                        )
                      }
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      {t.assistant.strip.controls.changeDates}
                    </button>
                    {" · "}
                    {/* Trip type, at the top level where every airline site
                        puts it. It used to live inside the calendar, two
                        clicks deep, so a traveller looking for "one way"
                        simply could not find it. */}
                    <button
                      type="button"
                      onClick={() => {
                        if (result.request.oneWay) {
                          // Back to a return trip needs a return day, and we do
                          // not invent one: open the calendar and let them pick.
                          setCardDates({ departDate: result.request.departDate });
                          return;
                        }
                        runSearch(asked ?? "", {
                          departDate: result.request.departDate,
                          oneWay: true,
                          cabinClass: cabin,
                          party,
                        });
                      }}
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      {result.request.oneWay
                        ? t.assistant.strip.controls.roundTrip
                        : t.assistant.strip.controls.oneWay}
                    </button>
                    {" · "}
                    <button
                      type="button"
                      onClick={() => setPartyOpen((open) => !open)}
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      {describeParty(party)} ·{" "}
                      {
                        t.assistant.strip.controls[
                          cabin === "premium_economy" ? "premiumEconomy" : cabin
                        ]
                      }
                    </button>
                  </p>

                  {partyOpen && (
                    <div className="mt-3">
                      <CabinParty
                        cabin={cabin}
                        party={party}
                        copy={t.assistant.strip.controls}
                        onCabin={setCabin}
                        onParty={setParty}
                        onDone={() => {
                          if (!isBookableParty(party)) return;
                          setPartyOpen(false);
                          runSearch(asked ?? "", { cabinClass: cabin, party });
                        }}
                      />
                    </div>
                  )}

                  {/* Cheaper a day or two either side. Only ever shown when the
                      traveller said they could move, and only with a real
                      saving behind it. */}
                  {result.flexSaving && !cardDates && (
                    <button
                      type="button"
                      onClick={() =>
                        runSearch(asked ?? "", {
                          departDate: result.flexSaving!.departDate,
                          ...(result.flexSaving!.returnDate
                            ? { returnDate: result.flexSaving!.returnDate }
                            : { oneWay: true }),
                        })
                      }
                      className="mt-2 flex w-full items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-left text-xs"
                    >
                      <span>
                        {t.assistant.strip.controls.flexSaveLead}{" "}
                        <span className="font-semibold">
                          {result.flexSaving.saveAmount} {result.flexSaving.currency}
                        </span>{" "}
                        {t.assistant.strip.controls.flexSaveTail}{" "}
                        <span className="font-semibold">{result.flexSaving.departDate}</span>
                      </span>
                      <span className="shrink-0 font-medium text-primary">
                        {t.assistant.strip.controls.flexSaveApply}
                      </span>
                    </button>
                  )}

                  {cardDates && (
                    <div className="mt-3">
                      <DateAnswer
                        value={cardDates}
                        copy={t.assistant.strip.controls}
                        onChange={setCardDates}
                        onConfirm={() => {
                          if (!isCompleteRange(cardDates)) return;
                          const next = cardDates;
                          setCardDates(null);
                          runSearch(asked ?? "", {
                            departDate: next.departDate,
                            ...(next.oneWay
                              ? { oneWay: true }
                              : { returnDate: next.returnDate ?? next.departDate, oneWay: false }),
                            ...(next.flexDays ? { flexDays: next.flexDays } : {}),
                            cabinClass: cabin,
                            party,
                          });
                        }}
                      />
                    </div>
                  )}
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
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => store.mutate()}
                      disabled={store.isPending}
                      className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:opacity-60"
                    >
                      {store.isPending ? t.assistant.saveBusy : t.assistant.saveIdle}
                    </button>
                    <button
                      onClick={() => startBooking.mutate()}
                      disabled={startBooking.isPending}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                    >
                      {startBooking.isPending ? t.assistant.bookBusy : t.assistant.bookIdle}
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
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
