import { HotelGallery } from "@/components/hotel-gallery";
import {
  Plane,
  BedDouble,
  CarFront,
  X,
  ArrowRight,
  Armchair,
  Sparkles,
  ChevronRight,
  Share2,
  Receipt,
  Copy,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { LineOptions, MatchNote } from "@/components/trip-line-options";
import { ArrivalPlanNote, TransferNote } from "@/components/arrival-plan-note";
import { track } from "@/lib/track";
import { TripExtras } from "@/components/trip-extras";
import { searchLiveTrip, swapCardAlternative } from "@/lib/trip-live.functions";
import { getConversationContext } from "@/lib/conversation.functions";
import type { BudgetStatus, MatchSummary } from "@/lib/trip/match";
import { INSURANCE_DETAIL, INSURANCE_TITLE, type InsuranceQuote } from "@/lib/trip/insurance";
import { parseTripSentence } from "@/lib/trip/parse";
import { TripRoute } from "@/components/trip-route";
import type { TripStop } from "@/lib/trip/types";
import { UnderstandingStrip } from "@/components/trip/understanding-strip";
import { ChatQuestions } from "@/components/trip/chat-questions";
import { AdviceLines } from "@/components/trip/advice-lines";
import { NudgeLine } from "@/components/trip/nudge-line";
import { applyOverrides, understand, type TripOverrides } from "@/lib/trip/understanding";
import { chatQuestions, essentialsMet, isBusinessSentence, type ChatQuestionKind } from "@/lib/trip/questions";
import { buildAdvice, type AdviceLine } from "@/lib/trip/advice";
import { pickNudge, readDismissed, rememberDismissed, type Nudge, type NudgeKind } from "@/lib/trip/nudges";
import { airportDistanceKm, driveMinutes } from "@/lib/trip/airport-geo";
import { ClosingChat } from "@/components/trip/closing-chat";
import { wishesFromSentence } from "@/lib/trip/understanding";
import { isSchengen } from "@/lib/trip/backwards";

import { SiteNav } from "@/components/site-nav";
import { LocaleLink, useLocale, useT, type Dict } from "@/lib/i18n";
import { parseDemoSentence, fill, referralCode } from "@/lib/demo-sentence";
import { joinWaitlist } from "@/lib/waitlist.functions";
import {
  parseTrip,
  searchTrip,
  fetchPriceContext,
  eur,
  timeLabel,
  dayLabel,
} from "@/lib/trip/client";
import type { PriceContext, TripSearchResponse } from "@/lib/trip/types";

type Submission = { sentence: string; key: number };

const ghostButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary";

/** True when the visitor asked the system to reduce motion. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** "You saved …" line with the comparison footnote as a tooltip. */
function SavedLine({ t, className }: { t: Dict; className?: string }) {
  return (
    <p className={`text-xs font-medium text-primary ${className ?? ""}`}>
      <span
        title={t.home.demo.savedNote}
        className="cursor-help underline decoration-primary/30 decoration-dotted underline-offset-4"
      >
        {t.home.demo.saved}
      </span>
    </p>
  );
}

/** Inline early-access / Teams waitlist form with a placeholder referral link. */
function EarlyAccess({
  t,
  type,
  label,
  sentence,
}: {
  t: Dict;
  type: "early_access" | "teams";
  label: string;
  sentence?: string;
}) {
  const c = t.home.campaign;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = code ? `adair.travel/r/${code}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`https://${link}`);
    } catch {
      /* clipboard unavailable — the link stays visible for manual copying */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (code) {
    return (
      <div className="animate-rise hairline-card w-full max-w-md p-5">
        <p className="text-sm leading-relaxed text-foreground">{c.success}</p>
        <p className="mt-4 text-xs text-muted-foreground">{c.referralLabel}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
            {link}
          </code>
          <button type="button" onClick={copyLink} className={ghostButton}>
            <Copy className="size-4" />
            {copied ? c.copied : c.copy}
          </button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={ghostButton}>
        {label}
      </button>
    );
  }

  return (
    <form
      className="animate-rise w-full max-w-md"
      onSubmit={async (e) => {
        e.preventDefault();
        const generated = referralCode();
        setBusy(true);
        setFailed(false);
        try {
          await joinWaitlist({
            data: {
              email,
              referralCode: generated,
              type,
              ...(sentence ? { sentence: sentence.slice(0, 1000) } : {}),
            },
          });
          setCode(generated);
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor={`early-${type}`} className="sr-only">
        {c.emailLabel}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`early-${type}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={c.emailPlaceholder}
          className="min-w-0 flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? c.joining : c.join}
        </button>
      </div>
      {failed && <p className="mt-2 text-xs text-destructive">{c.error}</p>}
    </form>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={accent ? "tag-pill border-primary/25 text-primary" : "tag-pill"}>
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  );
}

function Hero({ t, onSubmit }: { t: Dict; onSubmit: (sentence: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <section className="mx-auto max-w-4xl px-6 pb-16 pt-16 text-center sm:pb-20 sm:pt-28">
      <h1
        className="animate-rise font-display text-5xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-7xl"
        style={{ animationDelay: "90ms" }}
      >
        {t.home.hero.titleLine1}
        <br />
        {t.home.hero.titleLine2}
      </h1>
      <p
        className="animate-rise mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground"
        style={{ animationDelay: "180ms" }}
      >
        {t.home.hero.lead}
      </p>

      <form
        className="animate-rise mx-auto mt-8 w-full max-w-[560px]"
        style={{ animationDelay: "270ms" }}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(value);
        }}
      >
        <label htmlFor="hero-trip" className="sr-only">
          {t.home.hero.inputLabel}
        </label>
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 text-left sm:flex-row sm:items-center sm:rounded-full">
          <input
            id="hero-trip"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t.home.hero.inputPlaceholder}
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:rounded-full"
          >
            {t.home.hero.inputSubmit} <ArrowRight className="size-4" />
          </button>
        </div>
      </form>

      <div className="animate-rise mt-4" style={{ animationDelay: "340ms" }}>
        <a
          href="#demo"
          className="text-sm font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          {t.home.hero.ctaPrimary}
        </a>
      </div>
    </section>
  );
}

function TripRow({
  icon,
  title,
  subtitle,
  tags,
  price,
  extra,
  onRemove,
  removeLabel,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tags: React.ReactNode[];
  price: string;
  extra?: React.ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="group flex items-start justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3.5">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{tags}</div>
          {extra}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <p className="text-sm font-semibold text-foreground">{price}</p>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel}
            title={removeLabel}
            className="flex size-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ChatDemo({ t, submission }: { t: Dict; submission: Submission | null }) {
  const d = t.home.demo;
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  const typedSentence = submission?.sentence.trim() ?? "";
  const fullText = typedSentence || d.userMessage;

  const [typed, setTyped] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [revealed, setRevealed] = useState(3);
  const [showTotal, setShowTotal] = useState(true);
  const [showSaved, setShowSaved] = useState(true);
  const [showActions, setShowActions] = useState(true);
  const [copied, setCopied] = useState(false);
  // The conversational layer: Adair first shows what it understood and asks for
  // what's missing; the search runs only when the traveller taps "Find it".
  const [pending, setPending] = useState<Submission | null>(null);
  const [confirmed, setConfirmed] = useState<Submission | null>(null);
  const [overrides, setOverrides] = useState<TripOverrides>({});
  const [answered, setAnswered] = useState<ChatQuestionKind[]>([]);
  const [dismissedNudges, setDismissedNudges] = useState<NudgeKind[]>([]);
  const [nudgeContext, setNudgeContext] = useState<{
    calendarConnected: boolean;
    loyaltyCount: number;
    hasDefaultCompany: boolean;
  } | null>(null);
  const [actedAdvice, setActedAdvice] = useState<string[]>([]);
  const [live, setLive] = useState<TripSearchResponse | null>(null);
  const [liveFailed, setLiveFailed] = useState(false);
  // Optional in-app travel insurance offer (signed-in cards only).
  const [insurance, setInsurance] = useState<InsuranceQuote | null>(null);
  const [addInsurance, setAddInsurance] = useState(false);
  const [dropped, setDropped] = useState({ flight: false, hotel: false, car: false });
  const drop = (kind: "flight" | "hotel" | "car") =>
    setDropped((prev) => ({ ...prev, [kind]: true }));
  const anyDropped = dropped.flight || dropped.hotel || dropped.car;

  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const runLiveSearch = useServerFn(searchLiveTrip);
  const runSwap = useServerFn(swapCardAlternative);
  // The exact hotel / car the traveller named, shown while search is running.
  const [requestedNames, setRequestedNames] = useState<{
    hotel: string | null;
    car: string | null;
  }>({ hotel: null, car: null });
  const [swapping, setSwapping] = useState(false);
  // How well each line fits saved preferences, and where the total sits
  // against the traveller's usual budget (signed-in cards only).
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  // Set when booking far ahead lowered our own fee (leisure trips only).
  const [earlyBooking, setEarlyBooking] = useState<{
    daysAhead: number;
    discountBps: number;
    savedEur: number;
  } | null>(null);
  const [amendText, setAmendText] = useState("");
  const [amending, setAmending] = useState(false);

  const applyPriced = (result: {
    search: TripSearchResponse;
    priced: { flight: number | null; stay: number | null; car: number | null; total: number };
  }): TripSearchResponse => {
    const next = result.search;
    if (next.flight && result.priced.flight != null) next.flight.amountEur = result.priced.flight;
    if (next.stay && result.priced.stay != null) next.stay.amountEur = result.priced.stay;
    if (next.car && result.priced.car != null) next.car.amountEur = result.priced.car;
    next.totalEur = result.priced.total;
    return next;
  };

  const swapAlternative = async (
    kind: "flight" | "stay" | "car",
    index: number,
    reason?: string,
  ) => {
    if (!cardId || swapping) return;
    track("line_swapped", { kind, ...(reason ? { reason } : {}) });
    setSwapping(true);
    try {
      const result = await runSwap({
        data: { cardId, kind, index, ...(reason ? { reason } : {}) },
      });
      setMatch(result.match ?? null);
      setBudget(result.budget ?? null);
      setEarlyBooking(result.earlyBooking ?? null);
      setLive(applyPriced(result));
    } catch {
      /* leave the current card in place; the traveller can search again */
    } finally {
      setSwapping(false);
    }
  };

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session?.user));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setSignedIn(Boolean(session?.user));
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const [routeStops, setRouteStops] = useState<TripStop[] | null>(null);
  const [rerouting, setRerouting] = useState(false);

  // Why is this trip pricey? Real comparison searches on nearby dates.
  const [priceContext, setPriceContext] = useState<PriceContext | null>(null);
  const [datesKept, setDatesKept] = useState(false);
  const [movingDates, setMovingDates] = useState(false);

  const contextKey = live?.request
    ? `${live.request.destinationIata}|${live.request.departDate}|${live.request.returnDate}`
    : null;

  useEffect(() => {
    const request = live?.request;
    if (!request) return;
    let active = true;
    void fetchPriceContext(request).then((ctx) => {
      if (active && ctx?.peak) setPriceContext(ctx);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

  /** Re-run the same trip on the genuinely cheapest date we found. */
  const moveDates = async () => {
    const ctx = priceContext;
    if (!ctx?.offsetDays || !ctx.cheapestDepartDate || !ctx.cheapestReturnDate) return;
    track("cheaper_dates_accepted", { city: ctx.city, saving_eur: ctx.savingEur });
    setMovingDates(true);
    try {
      const sentence = submission?.sentence.trim() || d.userMessage;
      if (signedIn) {
        const result = await runLiveSearch({
          data: { sentence, dateShiftDays: ctx.offsetDays },
        });
        setCardId(result.cardId);
        setInsurance(result.insurance);
        setMatch(result.match ?? null);
        setBudget(result.budget ?? null);
        setEarlyBooking(result.earlyBooking ?? null);
        setLive(applyPriced(result));
      } else {
        const request = await parseTrip(sentence);
        setLive(
          await searchTrip({
            ...request,
            departDate: ctx.cheapestDepartDate,
            returnDate: ctx.cheapestReturnDate,
          }),
        );
      }
      setPriceContext(null);
      setDatesKept(true);
    } catch {
      /* keep the current card on screen */
    } finally {
      setMovingDates(false);
    }
  };

  const [amendBase, setAmendBase] = useState("");

  /** "Make it business class" — same trip, changed by one extra sentence. */
  const amendTrip = async () => {
    const change = amendText.trim();
    if (!change || amending) return;
    setAmending(true);
    try {
      // Everything they said before, plus the change — later wording wins.
      const base = amendBase || submission?.sentence.trim() || d.userMessage;
      const sentence = `${base}. Change: ${change}`;
      if (signedIn) {
        const result = await runLiveSearch({ data: { sentence } });
        setCardId(result.cardId);
        setInsurance(result.insurance);
        setMatch(result.match ?? null);
        setBudget(result.budget ?? null);
        setEarlyBooking(result.earlyBooking ?? null);
        setLive(applyPriced(result));
      } else {
        setLive(await searchTrip(await parseTrip(sentence)));
      }
      setAmendBase(sentence);
      setAmendText("");
    } catch {
      /* keep the current card on screen */
    } finally {
      setAmending(false);
    }
  };

  /** Same sentence, new stop order: re-search and re-price the first leg. */
  const reorderStops = async (next: TripStop[]) => {
    setRouteStops(next);
    if (!signedIn) return;
    const sentence = submission?.sentence.trim() || d.userMessage;
    setRerouting(true);
    try {
      const result = await runLiveSearch({ data: { sentence, stops: next } });
      const priced = result.search;
      if (priced.flight && result.priced.flight != null)
        priced.flight.amountEur = result.priced.flight;
      if (priced.stay && result.priced.stay != null) priced.stay.amountEur = result.priced.stay;
      if (priced.car && result.priced.car != null) priced.car.amountEur = result.priced.car;
      priced.totalEur = result.priced.total;
      setCardId(result.cardId);
      setInsurance(result.insurance);
      setMatch(result.match ?? null);
      setBudget(result.budget ?? null);
      setEarlyBooking(result.earlyBooking ?? null);
      setLive(priced);
      setRouteStops(priced.request.stops ?? next);
    } catch {
      // Keep the new order on screen; prices stay as they were.
    } finally {
      setRerouting(false);
    }
  };

  // A new sentence is understood first, not searched: the strip and any
  // questions appear, and the search waits for "Find it".
  useEffect(() => {
    if (!submission) return;
    setPending(submission);
    setConfirmed(null);
    setOverrides({});
    setAnswered([]);
    setLive(null);
    setLiveFailed(false);
    setCardId(null);
    setPriceContext(null);
    setDismissedNudges(readDismissed());
  }, [submission?.key]);

  const runKey = confirmed?.key ?? 0;
  useEffect(() => {
    if (!confirmed) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    const text = confirmed.sentence.trim() || d.userMessage;

    setLive(null);
    setRouteStops(null);
    setLiveFailed(false);
    setCardId(null);
    setInsurance(null);
    setMatch(null);
    setBudget(null);
    setAmendText("");
    setAddInsurance(false);
    setDropped({ flight: false, hotel: false, car: false });
    setPriceContext(null);
    setDatesKept(false);
    setActedAdvice([]);
    if (signedIn) {
      const named = parseTripSentence(text);
      setRequestedNames({ hotel: named.hotelNameExact, car: named.carNameExact });
    } else {
      setRequestedNames({ hotel: null, car: null });
    }

    // Kick the real search off immediately; the animation runs alongside it.
    const startedAt = Date.now();
    const search = (async () => {
      if (signedIn) {
        // Signed in: real supplier results, priced with this traveller's plan,
        // saved as a trip card that can then be booked.
        const result = await runLiveSearch({ data: { sentence: text, overrides } });
        const priced = result.search;
        if (priced.flight && result.priced.flight != null) {
          priced.flight.amountEur = result.priced.flight;
        }
        if (priced.stay && result.priced.stay != null) {
          priced.stay.amountEur = result.priced.stay;
        }
        if (priced.car && result.priced.car != null) {
          priced.car.amountEur = result.priced.car;
        }
        priced.totalEur = result.priced.total;
        if (!cancelled) {
          setCardId(result.cardId);
          setInsurance(result.insurance);
          setMatch(result.match ?? null);
          setBudget(result.budget ?? null);
          setEarlyBooking(result.earlyBooking ?? null);
        }
        return priced;
      }
      const request = await parseTrip(text);
      return searchTrip(applyOverrides(request, overrides));
    })();
    const settled = search
      .then((result) => {
        if (!cancelled) {
          if (result.flight || result.stay || result.car) {
            setLive(result);
            setRouteStops(result.request.stops ?? null);
          } else setLiveFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLiveFailed(true);
      });

    if (reduced) {
      setTyped(text);
      setThinking(false);
      setRevealed(3);
      setShowTotal(true);
      setShowSaved(true);
      setShowActions(true);
      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      };
    }

    setTyped("");
    setThinking(false);
    setRevealed(0);
    setShowTotal(false);
    setShowSaved(false);
    setShowActions(false);

    void (async () => {
      for (let i = 1; i <= text.length; i += 1) {
        await wait(40);
        if (cancelled) return;
        setTyped(text.slice(0, i));
      }
      setThinking(true);
      // Wait for the real request, but keep the indicator up for at least 1.5 s.
      await settled;
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1500) await wait(1500 - elapsed);
      if (cancelled) return;
      setThinking(false);
      for (let i = 1; i <= 3; i += 1) {
        setRevealed(i);
        await wait(350);
        if (cancelled) return;
      }
      setShowTotal(true);
      await wait(400);
      if (cancelled) return;
      setShowSaved(true);
      await wait(300);
      if (cancelled) return;
      setShowActions(true);
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, reduced]);

  // ---- What Adair understood, and what it still needs to ask -------------
  const a = t.assistant;
  const pendingSentence = pending ? pending.sentence.trim() || d.userMessage : "";
  const pendingRequest = useMemo(
    () => (pendingSentence ? parseTripSentence(pendingSentence) : null),
    [pendingSentence],
  );
  const effectiveRequest = pendingRequest ? applyOverrides(pendingRequest, overrides) : null;
  const understanding =
    pendingRequest && effectiveRequest
      ? understand(pendingSentence, effectiveRequest, a.strip)
      : null;
  const openQuestions = effectiveRequest
    ? chatQuestions(pendingSentence, effectiveRequest, { answered, copy: a.questions })
    : [];

  const answerQuestion = (kind: ChatQuestionKind, value: string | number[]) => {
    setOverrides((prev) => {
      if (kind === "dates" && typeof value === "string") return { ...prev, departDate: value };
      if (kind === "arrival_time" && typeof value === "string")
        return { ...prev, mustArriveBy: value };
      if (kind === "which_airport" && typeof value === "string")
        return { ...prev, destinationIata: value };
      if (kind === "child_ages" && Array.isArray(value)) return { ...prev, childAges: value };
      return prev;
    });
    setAnswered((prev) => (prev.includes(kind) ? prev : [...prev, kind]));
  };

  /** "Find it": the point at which we go to the suppliers. */
  const findIt = () => {
    if (!pending || !essentialsMet(openQuestions)) return;
    track("understanding_confirmed", { edited: Object.keys(overrides).length });
    setConfirmed({ sentence: pending.sentence, key: Date.now() });
  };

  // ---- What Adair noticed about the proposal -----------------------------
  const advice = useMemo<AdviceLine[]>(() => {
    if (!live?.request) return [];
    const stay = live.stay;
    const car = live.car;
    const km =
      stay && stay.lat != null && stay.lon != null
        ? airportDistanceKm(live.request.destinationIata, stay.lat, stay.lon)
        : null;
    const amenities = stay?.amenities ?? [];
    const plan = live.arrivalPlan;
    return buildAdvice(
      {
        hotel: stay
          ? {
              airportMinutes: km != null ? driveMinutes(km) : null,
              hasParking: amenities.length
                ? amenities.some((item) => /park|garage/.test(item))
                : null,
              breakfastIncluded: stay.breakfastIncluded ?? null,
              breakfastExtraEur: stay.breakfastExtra ?? null,
            }
          : null,
        car: car ? { priceEur: car.amountEur } : null,
        arrival: plan
          ? {
              tight: plan.tight,
              landAtLabel: timeLabel(plan.landAt, locale),
              meetingAtLabel: plan.mustArriveBy,
              safer: plan.saferOption
                ? {
                    title: plan.saferOption.title,
                    spareLabel: `${Math.max(1, Math.round(plan.saferOption.slackMin / 60))}h`,
                    extraEur: plan.saferOption.extraEur,
                    index: plan.saferOption.index,
                  }
                : null,
            }
          : null,
        price: priceContext?.peak
          ? {
              peak: true,
              ratio: Number(priceContext.ratio),
              savingEur: priceContext.savingEur,
              offsetDays: priceContext.offsetDays ?? null,
              eventName: priceContext.eventName ?? null,
            }
          : null,
        money: (amount: number) => eur(amount),
      },
      a.advice,
    ).filter((line) => !actedAdvice.includes(line.kind));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, priceContext, locale, actedAdvice]);

  const actOnAdvice = (line: AdviceLine) => {
    track("advice_acted", { kind: line.kind });
    setActedAdvice((prev) => [...prev, line.kind]);
    const action = line.action;
    if (!action) return;
    if (action.kind === "take_earlier_flight" && action.index != null)
      void swapAlternative("flight", action.index);
    else if (action.kind === "add_breakfast" && action.index != null)
      void swapAlternative("stay", action.index);
    else if (action.kind === "show_cheaper_dates") void moveDates();
    else if (action.kind === "swap_car_for_transfer") drop("car");
  };

  // ---- One suggestion for next time -------------------------------------
  const loadContext = useServerFn(getConversationContext);
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    void loadContext()
      .then((ctx) => {
        if (active) setNudgeContext(ctx);
      })
      .catch(() => {
        /* a missing nudge is never worth an error */
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const nudge = useMemo<Nudge | null>(() => {
    if (!live || !nudgeContext) return null;
    return pickNudge({
      business: isBusinessSentence(confirmed?.sentence ?? "", live.request),
      calendarConnected: nudgeContext.calendarConnected,
      loyaltyCount: nudgeContext.loyaltyCount,
      earnsMiles: Boolean(live.flight),
      askedForInvoice: Boolean(live.request?.invoiceToCompany),
      hasDefaultCompany: nudgeContext.hasDefaultCompany,
      dismissed: dismissedNudges,
      copy: a.nudge,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, nudgeContext, dismissedNudges, confirmed]);


  const parsed = typedSentence ? parseDemoSentence(typedSentence, d.weekdays) : null;
  const days = parsed
    ? { day1: d.weekdaysShort[parsed.day1] ?? "", day2: d.weekdaysShort[parsed.day2] ?? "" }
    : null;
  const sampleCard =
    parsed && days
      ? {
          title: fill(d.cardTitleTpl, { city: parsed.city, ...days }),
          flightTitle: fill(d.flightTitleTpl, { city: parsed.city }),
          flightDetail: fill(d.flightDetailTpl, days),
          hotelTitle: parsed.hotel,
          hotelDetail: d.hotelDetailTpl,
          carTitle: fill(d.carTitleTpl, { code: parsed.code }),
          carDetail: fill(d.carDetailTpl, days),
        }
      : {
          title: d.cardTitle,
          flightTitle: d.flightTitle,
          flightDetail: d.flightDetail,
          hotelTitle: d.hotelTitle,
          hotelDetail: d.hotelDetail,
          carTitle: d.carTitle,
          carDetail: d.carDetail,
        };

  const req = live?.request;
  const nights = req
    ? Math.max(
        1,
        Math.round(
          (new Date(req.returnDate).getTime() - new Date(req.departDate).getTime()) / 86_400_000,
        ),
      )
    : 1;
  const nightsLabel = nights === 1 ? d.nightsOne : fill(d.nightsMany, { count: String(nights) });

  const cardTitle = req
    ? `${req.destinationCity} · ${dayLabel(req.departDate, locale)} – ${dayLabel(req.returnDate, locale)}`
    : sampleCard.title;

  const parts = live
    ? {
        flight: live.flight?.amountEur ?? 0,
        hotel: live.stay?.amountEur ?? 0,
        car: live.car?.amountEur ?? 0,
      }
    : { flight: 412, hotel: 610, car: 218 };
  const keptTotal =
    (dropped.flight ? 0 : parts.flight) +
    (dropped.hotel ? 0 : parts.hotel) +
    (dropped.car ? 0 : parts.car);
  const insuranceAdd = addInsurance && insurance ? insurance.grossEur : 0;
  const travelTotal = anyDropped ? keptTotal : live ? live.totalEur : 1240;
  const totalLabel = eur(Math.round((travelTotal + insuranceAdd) * 100) / 100);
  // The saved estimate follows what is actually kept in the card.
  const savedShown = live
    ? Math.round(
        live.savedEur *
          (travelTotal > 0 ? Math.min(1, travelTotal / Math.max(1, live.totalEur)) : 0) *
          100,
      ) / 100
    : 0;
  const invoiceVisible = req ? req.invoiceToCompany : Boolean(parsed?.invoice);

  // Closing the booking in the chat: opened by "Book it all".
  const closingParts = [
    req?.destinationCity ?? "",
    req ? `${dayLabel(req.departDate, locale)}–${dayLabel(req.returnDate, locale)}` : "",
    !dropped.flight && live?.flight
      ? `${live.flight.carrier} ${live.flight.departTime ?? ""}`.trim()
      : "",
    !dropped.hotel && live?.stay ? live.stay.name : "",
    !dropped.car && live?.car ? live.car.vehicle : "",
  ].filter((part) => part.trim().length > 0);
  const closingExtras = wishesFromSentence(submission?.sentence ?? "").map((wish, index) => ({
    id: `wish-${index}`,
    label: wish,
  }));

  const reveal = (index: number) => (revealed >= index ? "animate-rise" : "hidden");

  async function shareCard() {
    const url = `${window.location.origin}${window.location.pathname}#demo`;
    const payload = { title: "Adair", text: `${cardTitle} · ${totalLabel}`, url };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        return;
      } catch {
        /* visitor dismissed the share sheet */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section id="demo" className="mx-auto max-w-3xl px-6 py-20">
      <SectionLabel>{d.label}</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {d.title}
      </h2>

      <div className="mt-12 space-y-5">
        <div className="animate-rise flex justify-end" style={{ animationDelay: "100ms" }}>
          <div className="max-w-md rounded-xl rounded-br-sm border border-border bg-card px-5 py-4">
            <p className="min-h-5 text-sm leading-relaxed text-foreground">
              {typed ?? d.userMessage}
              {typed !== null && typed.length < fullText.length && (
                <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-primary" />
              )}
            </p>
            <p className="mt-2 text-right text-[11px] text-muted-foreground">{d.you} · 9:41</p>
          </div>
        </div>

        <div className="animate-rise flex gap-3" style={{ animationDelay: "400ms" }}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <div className="w-full max-w-lg">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Adair · 9:41</p>

            {understanding && !confirmed && (
              <>
                <UnderstandingStrip
                  understanding={understanding}
                  overrides={overrides}
                  copy={a.strip}
                  canSearch={essentialsMet(openQuestions)}
                  onChange={(next) => setOverrides(next)}
                  onFind={findIt}
                />
                <ChatQuestions
                  questions={openQuestions}
                  copy={a.questions}
                  childAges={effectiveRequest?.childAges ?? undefined}
                  onAnswer={answerQuestion}
                  onSkip={(kind) =>
                    setAnswered((prev) => (prev.includes(kind) ? prev : [...prev, kind]))
                  }
                />
              </>
            )}

            {confirmed && thinking ? (
              <div className="animate-rise inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
                <span className="flex gap-1">
                  <span className="pulse size-1.5 rounded-full bg-primary" />
                  <span className="pulse size-1.5 rounded-full bg-primary/70" />
                  <span className="pulse size-1.5 rounded-full bg-primary/40" />
                </span>
                <span className="text-xs text-muted-foreground">{d.typing}</span>
              </div>
            ) : (
              <>
                {revealed > 0 && <AdviceLines lines={advice} onAct={actOnAdvice} />}
                <div className={`hairline-card overflow-hidden ${revealed > 0 ? "" : "hidden"}`}>

                  <div className="border-b border-border px-5 py-4">
                    <p className="text-sm font-semibold text-foreground">{cardTitle}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{d.cardSubtitle}</p>
                  </div>

                  {live?.arrivalPlan && (
                    <ArrivalPlanNote
                      plan={live.arrivalPlan}
                      locale={locale}
                      busy={swapping}
                      onPickSafer={(index) => void swapAlternative("flight", index)}
                    />
                  )}

                  <div className="divide-y divide-border">
                    {dropped.flight ? null : live?.flight && req ? (
                      <div className={reveal(1)}>
                        <TripRow
                          icon={<Plane className="size-4" />}
                          title={`${live.flight.carrier} ${live.flight.flightNumbers.join(" / ")} · ${req.originIata} → ${req.destinationIata}`}
                          subtitle={`${timeLabel(live.flight.departAt, locale)} – ${timeLabel(live.flight.arriveAt, locale)}${
                            live.flight.returnDepartAt
                              ? ` · ${timeLabel(live.flight.returnDepartAt, locale)}`
                              : ""
                          }`}
                          tags={[<Tag key="1">{live.flight.cabin.replace("_", " ")}</Tag>]}
                          price={eur(live.flight.amountEur)}
                          onRemove={() => drop("flight")}
                          removeLabel={d.remove}
                        />
                      </div>
                    ) : live ? null : (
                      <div className={reveal(1)}>
                        <TripRow
                          icon={<Plane className="size-4" />}
                          title={sampleCard.flightTitle}
                          subtitle={sampleCard.flightDetail}
                          tags={[
                            <Tag key="1">LOT Polish Airlines</Tag>,
                            <Tag key="2">{d.flightTagClass}</Tag>,
                          ]}
                          price="€412"
                          onRemove={() => drop("flight")}
                          removeLabel={d.remove}
                        />
                      </div>
                    )}

                    <MatchNote match={match?.flight} label="flight" />

                    {live?.flight && !dropped.flight && (
                      <LineOptions
                        busy={swapping}
                        options={(live.flightAlternatives ?? []).map((alt) => ({
                          title: `${alt.carrier} ${alt.flightNumbers.join(" / ")}`,
                          priceLabel: eur(alt.amountEur),
                        }))}
                        onPick={(index, reason) => void swapAlternative("flight", index, reason)}
                        emptyNote="No other flight came back for these dates — try shifting the dates by a day."
                      />
                    )}

                    {live?.departureNote && (
                      <p className="px-5 py-3 text-xs leading-relaxed text-muted-foreground">
                        {live.departureNote}
                      </p>
                    )}

                    {live?.transfer && !dropped.flight && (
                      <TransferNote transfer={live.transfer} locale={locale} />
                    )}

                    {requestedNames.hotel && !dropped.hotel && (
                      <p className="px-5 pt-3 text-xs text-muted-foreground">
                        Requested:{" "}
                        <span className="font-medium text-foreground">{requestedNames.hotel}</span>
                      </p>
                    )}

                    {dropped.hotel ? null : live?.stay ? (
                      <div className={reveal(2)}>
                        <TripRow
                          icon={<BedDouble className="size-4" />}
                          title={live.stay.name}
                          subtitle={`${nightsLabel}${live.stay.address ? ` · ${live.stay.address}` : ""}`}
                          tags={
                            live.stay.exact
                              ? [
                                  <Tag key="1" accent>
                                    Exact match
                                  </Tag>,
                                ]
                              : live.stay.rating
                                ? [<Tag key="1">{`★ ${live.stay.rating}`}</Tag>]
                                : []
                          }
                          price={eur(live.stay.amountEur)}
                          onRemove={() => drop("hotel")}
                          removeLabel={d.remove}
                          extra={
                            <HotelGallery
                              alt={live.stay.name}
                              {...(live.stay.photoUrl ? { images: [live.stay.photoUrl] } : {})}
                            />
                          }
                        />
                      </div>
                    ) : live?.hotelNotFound ? (
                      <div className={`${reveal(2)} px-5 py-4`}>
                        <p className="text-sm font-medium">
                          We don&apos;t have &lsquo;{live.hotelRequested}&rsquo; in our inventory
                          yet
                        </p>
                        {live.hotelAlternatives.length > 0 && (
                          <>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Closest options for the same dates:
                            </p>
                            <ul className="mt-3 space-y-2">
                              {live.hotelAlternatives.map((alt, index) => (
                                <li key={`${alt.name}-${index}`}>
                                  <button
                                    type="button"
                                    disabled={swapping}
                                    onClick={() => void swapAlternative("stay", index)}
                                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-4 py-2.5 text-left text-sm hover:border-primary disabled:opacity-60"
                                  >
                                    <span className="min-w-0 truncate">{alt.name}</span>
                                    <span className="shrink-0">{eur(alt.amountEur)}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    ) : live ? (
                      <div className={`${reveal(2)} px-5 py-4`}>
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <BedDouble className="size-4 text-primary" /> Hotel
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {live.testMode
                            ? "No hotel available in test mode for this destination — real properties appear once hotels are live on our account."
                            : "No room available for these dates. Try shifting the dates by a day."}
                        </p>
                      </div>
                    ) : (
                      <div className={reveal(2)}>
                        <TripRow
                          icon={<BedDouble className="size-4" />}
                          title={sampleCard.hotelTitle}
                          subtitle={sampleCard.hotelDetail}
                          tags={[
                            <Tag key="1" accent>
                              {d.hotelTag}
                            </Tag>,
                          ]}
                          price="€610"
                          onRemove={() => drop("hotel")}
                          removeLabel={d.remove}
                          extra={<HotelGallery alt={sampleCard.hotelTitle} />}
                        />
                      </div>
                    )}

                    <MatchNote match={match?.stay} label="hotel" />

                    {live?.stay && !dropped.hotel && (
                      <LineOptions
                        busy={swapping}
                        options={live.hotelAlternatives.map((alt) => ({
                          title: alt.name,
                          priceLabel: eur(alt.amountEur),
                        }))}
                        onPick={(index, reason) => void swapAlternative("stay", index, reason)}
                      />
                    )}

                    {requestedNames.car && !dropped.car && (
                      <p className="px-5 pt-3 text-xs text-muted-foreground">
                        Requested:{" "}
                        <span className="font-medium text-foreground">{requestedNames.car}</span>
                      </p>
                    )}

                    {dropped.car ? null : live?.car && req ? (
                      <div className={reveal(3)}>
                        <TripRow
                          icon={<CarFront className="size-4" />}
                          title={`${live.car.vehicle} · ${req.destinationIata}`}
                          subtitle={`${dayLabel(req.departDate, locale)} – ${dayLabel(req.returnDate, locale)} · ${live.car.supplier}`}
                          tags={
                            live.car.exact
                              ? [
                                  <Tag key="1" accent>
                                    Exact match
                                  </Tag>,
                                ]
                              : [<Tag key="1">{live.car.transmission}</Tag>]
                          }
                          price={eur(live.car.amountEur)}
                          onRemove={() => drop("car")}
                          removeLabel={d.remove}
                        />
                      </div>
                    ) : live?.carNotFound ? (
                      <div className={`${reveal(3)} px-5 py-4`}>
                        <p className="text-sm font-medium">
                          We don&apos;t have &lsquo;{live.carRequested}&rsquo; in our inventory yet
                        </p>
                        {live.carAlternatives.length > 0 && (
                          <>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Closest options for the same dates:
                            </p>
                            <ul className="mt-3 space-y-2">
                              {live.carAlternatives.map((alt, index) => (
                                <li key={`${alt.vehicle}-${index}`}>
                                  <button
                                    type="button"
                                    disabled={swapping}
                                    onClick={() => void swapAlternative("car", index)}
                                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-4 py-2.5 text-left text-sm hover:border-primary disabled:opacity-60"
                                  >
                                    <span className="min-w-0 truncate">
                                      {alt.vehicle} · {alt.supplier}
                                    </span>
                                    <span className="shrink-0">{eur(alt.amountEur)}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    ) : live && req?.needsCar ? (
                      <div className={`${reveal(3)} px-5 py-4`}>
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <CarFront className="size-4 text-primary" /> Car hire
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {live.testMode
                            ? "No car available in test mode for this destination — the real inventory appears once car hire is live on our account."
                            : "No car available for these dates. Ask again with different dates and we will look once more."}
                        </p>
                      </div>
                    ) : live ? null : (
                      <div className={reveal(3)}>
                        <TripRow
                          icon={<CarFront className="size-4" />}
                          title={sampleCard.carTitle}
                          subtitle={sampleCard.carDetail}
                          tags={[<Tag key="1">Sixt</Tag>, <Tag key="2">{d.carTag}</Tag>]}
                          price="€218"
                          onRemove={() => drop("car")}
                          removeLabel={d.remove}
                        />
                      </div>
                    )}

                    <MatchNote match={match?.car} label="car" />

                    {live?.car && !dropped.car && (
                      <LineOptions
                        busy={swapping}
                        options={live.carAlternatives.map((alt) => ({
                          title: `${alt.vehicle} · ${alt.supplier}`,
                          priceLabel: eur(alt.amountEur),
                        }))}
                        onPick={(index, reason) => void swapAlternative("car", index, reason)}
                      />
                    )}

                    {insurance && (
                      <div className={`${reveal(3)} px-5 py-4`}>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            aria-pressed={addInsurance}
                            onClick={() => setAddInsurance((v) => !v)}
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                              addInsurance
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-foreground hover:border-primary"
                            }`}
                          >
                            <ShieldCheck className="size-3.5" />
                            {addInsurance ? INSURANCE_TITLE : `+ Add travel insurance`} ·{" "}
                            {eur(insurance.grossEur)}
                          </button>
                          <Tag>Insurance</Tag>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {INSURANCE_DETAIL}
                        </p>
                      </div>
                    )}

                    {signedIn && cardId && <TripExtras cardId={cardId} />}

                    {anyDropped && (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs text-muted-foreground">
                        <span>{d.removedNote}</span>
                        <button
                          type="button"
                          onClick={() => setDropped({ flight: false, hotel: false, car: false })}
                          className="font-medium text-primary underline underline-offset-4"
                        >
                          {d.restoreAll}
                        </button>
                      </div>
                    )}

                    {earlyBooking && showTotal && (
                      <p className="px-5 py-3 text-xs text-muted-foreground">
                        Early-booking price: you&rsquo;re booking {earlyBooking.daysAhead} days
                        ahead, so our fee is lower — {eur(earlyBooking.savedEur)} off this trip.
                      </p>
                    )}

                    {budget && budget.state !== "unknown" && showTotal && (
                      <p className="px-5 py-3 text-xs text-muted-foreground">
                        {budget.state === "within"
                          ? `✓ Within your budget (your range: ${budget.range}).`
                          : `⚠ ${eur(budget.overEur)} over your budget (${budget.range})${
                              budget.culpritLabel ? `, mostly ${budget.culpritLabel}` : ""
                            }.${
                              budget.fixTotalEur != null
                                ? ` Another option on that line brings the trip to ${eur(budget.fixTotalEur)} — see "Show other options" above.`
                                : ""
                            }`}
                      </p>
                    )}

                    {live && showActions && (
                      <div className="px-5 py-3">
                        <label htmlFor="amend" className="text-xs text-muted-foreground">
                          Change something? Just say it.
                        </label>
                        <div className="mt-2 flex gap-2">
                          <input
                            id="amend"
                            value={amendText}
                            onChange={(event) => setAmendText(event.target.value)}
                            placeholder="business class, one night later"
                            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={() => void amendTrip()}
                            disabled={amending || !amendText.trim()}
                            className="shrink-0 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:border-primary disabled:opacity-60"
                          >
                            {amending ? "Updating…" : "Update"}
                          </button>
                        </div>
                      </div>
                    )}

                    {invoiceVisible && showTotal && (
                      <div className="animate-rise flex items-center gap-2 px-5 py-3 text-xs text-muted-foreground">
                        <Receipt className="size-3.5 text-primary" />
                        {d.invoiceLine}
                      </div>
                    )}
                  </div>

                  <div
                    className={`border-t border-border bg-cream-deep px-5 py-4 ${showTotal ? "animate-rise" : "hidden"}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {d.total}
                          {live?.approx ? ` · ${d.approx}` : ""}
                        </p>
                        <p className="font-display text-xl font-semibold text-primary">
                          {totalLabel}
                        </p>
                      </div>
                      {cardId ? (
                        <button
                          type="button"
                          onClick={() => setClosing(true)}
                          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          {d.bookAll} <ChevronRight className="size-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title={d.bookTooltip}
                          className="inline-flex shrink-0 cursor-not-allowed items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground opacity-70"
                        >
                          {d.bookAll} <ChevronRight className="size-4" />
                        </button>
                      )}
                    </div>
                    {live ? (
                      <p
                        className={`text-xs font-medium text-primary ${showSaved ? "animate-rise mt-3" : "hidden"}`}
                      >
                        <span
                          title={d.savedNote}
                          className="cursor-help underline decoration-primary/30 decoration-dotted underline-offset-4"
                        >
                          {fill(d.savedLive, { amount: eur(savedShown) })} · {d.savedEstimate}
                        </span>
                      </p>
                    ) : (
                      <SavedLine t={t} className={showSaved ? "animate-rise mt-3" : "hidden"} />
                    )}
                  </div>
                </div>

                {priceContext?.peak && !datesKept && showActions && (
                  <div className="animate-rise mt-4 rounded-2xl border border-border bg-background p-4">
                    <p className="text-sm leading-relaxed text-foreground">
                      {priceContext.eventName
                        ? `There's a big event in ${priceContext.city} (probably ${priceContext.eventName}) — that's why this trip is about ${priceContext.ratio}\u00d7 more expensive than usual.`
                        : `Prices are unusually high on these dates in ${priceContext.city} — about ${priceContext.ratio}\u00d7 more than usual.`}
                      {priceContext.offsetDays != null && (
                        <>
                          {" "}
                          {priceContext.offsetDays > 0
                            ? `Leaving ${priceContext.offsetDays} days later`
                            : `Leaving ${Math.abs(priceContext.offsetDays)} days earlier`}{" "}
                          would be {eur(priceContext.savingEur)} less.
                        </>
                      )}
                      {!live?.request?.invoiceToCompany && " Shall I check those dates?"}
                    </p>
                    {!live?.request?.invoiceToCompany && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={moveDates}
                          disabled={movingDates}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                        >
                          {movingDates ? "Checking…" : "Yes, show me"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            track("cheaper_dates_dismissed", { city: priceContext.city });
                            setDatesKept(true);
                          }}
                          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 text-sm font-medium"
                        >
                          Keep my dates
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {routeStops && routeStops.length > 2 && showActions && (
                  <div className="animate-rise mt-4 rounded-2xl border border-border bg-background p-4">
                    <p className="font-display text-sm font-semibold">Show on map</p>
                    <p className="mt-1 mb-3 text-xs text-muted-foreground">
                      Drag a stop, or use the arrows, to change the order — we re-check the route
                      and the price.
                    </p>
                    <TripRoute stops={routeStops} onReorder={reorderStops} reordering={rerouting} />
                  </div>
                )}

                <p
                  className={`mt-4 text-sm leading-relaxed text-foreground ${showActions ? "animate-rise" : "hidden"}`}
                >
                  {t.home.demoLine}
                </p>

                <div
                  className={`mt-3 flex flex-wrap items-start gap-2 ${showActions ? "animate-rise" : "hidden"}`}
                >
                  <button type="button" onClick={shareCard} className={ghostButton}>
                    <Share2 className="size-4" />
                    {copied ? d.shareCopied : d.share}
                  </button>
                  <EarlyAccess
                    t={t}
                    type="early_access"
                    label={t.home.campaign.earlyAccess}
                    sentence={typedSentence}
                  />
                </div>

                <p className={`mt-2 text-xs text-muted-foreground ${showActions ? "" : "hidden"}`}>
                  {d.footnote}
                </p>
                {liveFailed && showActions && (
                  <p className="mt-1 text-xs text-muted-foreground">{d.searchFailed}</p>
                )}
                {live?.testMode && showActions && (
                  <p className="mt-1 text-xs text-muted-foreground">{d.testMode}</p>
                )}
                {nudge && showActions && (
                  <NudgeLine
                    nudge={nudge}
                    dismissLabel={a.nudge.dismiss}
                    onDismiss={() => {
                      rememberDismissed(nudge.kind);
                      setDismissedNudges(readDismissed());
                      track("nudge_dismissed", { kind: nudge.kind });
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AfterYouBook({ t }: { t: Dict }) {
  const icons = [
    <Receipt key="a" className="size-4" />,
    <Armchair key="b" className="size-4" />,
    <ShieldCheck key="c" className="size-4" />,
  ];
  return (
    <section className="mx-auto max-w-5xl px-6 py-14">
      <div className="grid gap-5 sm:grid-cols-3">
        {t.home.after.items.map((item, i) => (
          <div key={item.title} className="flex items-start gap-3">
            <span className="mt-0.5 text-primary">{icons[i]}</span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Closing({ t }: { t: Dict }) {
  const c = t.home.close;
  const locale = useLocale();
  return (
    <section className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{c.title}</h2>
      <p className="mt-3 text-base text-muted-foreground">{c.line}</p>
      <div className="mt-7 flex justify-center">
        <EarlyAccess t={t} type="early_access" label={t.home.campaign.earlyAccess} />
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        {c.teams}{" "}
        <LocaleLink
          to="/business"
          locale={locale}
          className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:text-primary/80"
        >
          {c.teamsLink}
        </LocaleLink>
      </p>
    </section>
  );
}

export function HomePage() {
  const t = useT();
  const locale = useLocale();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const reduced = usePrefersReducedMotion();
  const divider = (
    <div className="mx-auto max-w-6xl px-6">
      <div className="border-t border-border" />
    </div>
  );

  function runDemo(sentence: string) {
    track("sentence_typed", { length: sentence.trim().length });
    setSubmission({ sentence, key: Date.now() });
    document
      .getElementById("demo")
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }

  /** Handed over from Getaway's "Plan this trip": run it straight away. */
  useEffect(() => {
    const handoff = window.sessionStorage.getItem("adair.getaway.sentence");
    if (!handoff) return;
    window.sessionStorage.removeItem("adair.getaway.sentence");
    runDemo(handoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      <main>
        <Hero t={t} onSubmit={runDemo} />
        <ChatDemo t={t} submission={submission} />
        {divider}
        <AfterYouBook t={t} />
        {divider}
        <Closing t={t} />
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-10 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
          <span className="font-display text-lg font-semibold tracking-tight text-foreground">
            Adair<span className="text-primary">.</span>
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <LocaleLink
              to="/business"
              locale={locale}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t.nav.business}
            </LocaleLink>
            <Link
              to="/creators"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              For creators
            </Link>
            <Link
              to="/privacy"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms
            </Link>
            <p className="text-xs text-muted-foreground">{t.home.footer}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
