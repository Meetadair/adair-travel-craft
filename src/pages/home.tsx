import { HotelGallery } from "@/components/hotel-gallery";
import {
  Plane,
  BedDouble,
  CarFront,
  Check,
  X,
  ArrowRight,
  UtensilsCrossed,
  Wallet,
  Armchair,
  Building2,
  Sparkles,
  MapPin,
  CalendarDays,
  Clock,
  ChevronRight,
  Coffee,
  FileDown,
  Share2,
  Receipt,
  Users,
  Copy,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { LineOptions, MatchNote } from "@/components/trip-line-options";
import { ArrivalPlanNote, TransferNote } from "@/components/arrival-plan-note";
import { track } from "@/lib/track";
import { TripExtras } from "@/components/trip-extras";
import { searchLiveTrip, swapCardAlternative } from "@/lib/trip-live.functions";
import type { BudgetStatus, MatchSummary } from "@/lib/trip/match";
import {
  INSURANCE_DETAIL,
  INSURANCE_TITLE,
  type InsuranceQuote,
} from "@/lib/trip/insurance";
import { parseTripSentence } from "@/lib/trip/parse";
import { TripRoute } from "@/components/trip-route";
import type { TripStop } from "@/lib/trip/types";

import { downloadTripInvoice } from "@/lib/trip-pdf";
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
    <section className="mx-auto max-w-4xl px-6 pt-28 pb-20 text-center sm:pt-36">
      <div className="animate-rise" style={{ animationDelay: "0ms" }}>
        <Tag>
          <Sparkles className="size-3" /> {t.home.hero.badge}
        </Tag>
      </div>
      <h1
        className="animate-rise mt-8 font-display text-5xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-7xl"
        style={{ animationDelay: "90ms" }}
      >
        {t.home.hero.titleLine1}
        <br />
        {t.home.hero.titleLine2}
      </h1>
      <p
        className="animate-rise mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        style={{ animationDelay: "180ms" }}
      >
        {t.home.hero.lead}
      </p>

      <form
        className="animate-rise mx-auto mt-10 w-full max-w-[560px]"
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

function Comparison({ t }: { t: Dict }) {
  const c = t.home.comparison;
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>{c.label}</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {c.title}
      </h2>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <div className="hairline-card p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">{c.withoutTitle}</h3>
            <Tag>
              <X className="size-3" /> {c.withoutTag}
            </Tag>
          </div>
          <ul className="mt-6 space-y-3">
            {c.apps.map((app) => (
              <li
                key={app.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3"
              >
                <span className="text-sm font-medium text-foreground">{app.name}</span>
                <span className="text-xs text-muted-foreground">{app.detail}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
            {c.withoutFooter}
          </p>
        </div>

        <div className="hairline-card relative overflow-hidden p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">{c.withTitle}</h3>
            <Tag accent>
              <Check className="size-3" /> {c.withTag}
            </Tag>
          </div>
          <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-5">
            <p className="text-sm leading-relaxed text-foreground">{c.quote}</p>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
            <Plane className="size-4 text-primary" />
            <BedDouble className="size-4 text-primary" />
            <CarFront className="size-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{c.bundle}</span>
          </div>
          <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
            {c.withFooter} <span className="font-semibold text-primary">€1,240</span>
          </p>
        </div>
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
  const [earlyBooking, setEarlyBooking] = useState<
    { daysAhead: number; discountBps: number; savedEur: number } | null
  >(null);
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
      const result = await runSwap({ data: { cardId, kind, index, ...(reason ? { reason } : {}) } });
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
      if (priced.flight && result.priced.flight != null) priced.flight.amountEur = result.priced.flight;
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

  const runKey = submission?.key ?? 0;
  useEffect(() => {
    if (!submission) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    const text = submission.sentence.trim() || d.userMessage;

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
        const result = await runLiveSearch({ data: { sentence: text } });
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
      return searchTrip(request);
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
  const nightsLabel =
    nights === 1 ? d.nightsOne : fill(d.nightsMany, { count: String(nights) });

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
    ? Math.round(live.savedEur * (travelTotal > 0 ? Math.min(1, travelTotal / Math.max(1, live.totalEur)) : 0) * 100) / 100
    : 0;
  const invoiceVisible = req ? req.invoiceToCompany : Boolean(parsed?.invoice);

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

            {thinking ? (
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
                        Requested: <span className="font-medium text-foreground">{requestedNames.hotel}</span>
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
                          We don&apos;t have &lsquo;{live.hotelRequested}&rsquo; in our inventory yet
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
                        Requested: <span className="font-medium text-foreground">{requestedNames.car}</span>
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
                          onClick={() =>
                            navigate({ to: "/book/$cardId", params: { cardId } })
                          }
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
                          {fill(d.savedLive, { amount: eur(savedShown) })} ·{" "}
                          {d.savedEstimate}
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
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MyTrips({ t }: { t: Dict }) {
  const m = t.home.trips;
  const cards = [
    {
      icon: <Plane className="size-4" />,
      label: m.flight,
      title: m.flightTitle,
      detail: m.flightDetail,
      code: m.flightCode,
    },
    {
      icon: <BedDouble className="size-4" />,
      label: m.hotel,
      title: m.hotelTitle,
      detail: m.hotelDetail,
      code: m.hotelCode,
    },
    {
      icon: <CarFront className="size-4" />,
      label: m.car,
      title: m.carTitle,
      detail: m.carDetail,
      code: m.carCode,
    },
  ];

  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>{m.label}</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {m.title}
      </h2>

      <div className="mt-12 grid gap-5 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="hairline-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background">
                {c.icon}
              </div>
              <Tag>{c.label}</Tag>
            </div>
            <h3 className="mt-5 text-sm font-semibold text-foreground">{c.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.detail}</p>
            <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] tracking-wide text-muted-foreground">
              {c.code}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 hairline-card px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" /> {m.dates}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" /> {m.place}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" /> {m.departs}
            </span>
          </div>
          <span className="text-sm font-semibold text-primary">€1,240 · {m.paid}</span>
        </div>
        <SavedLine t={t} className="mt-3" />
      </div>

      <div className="mt-5 flex justify-end">
        <PdfButton t={t} />
      </div>
    </section>
  );
}

function PdfButton({ t }: { t: Dict }) {
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        try {
          await downloadTripInvoice({
            documentNumber: "ADR/2026/DEMO/001",
            issueDate: new Date().toISOString().slice(0, 10),
            city: "Milan",
            origin: "Warsaw",
            startDate: "2026-09-18",
            endDate: "2026-09-19",
            currency: "EUR",
            live: false,
            locale,
            buyer: { name: "", company: "", taxId: "", email: "" },
            items: [
              {
                kind: "flight",
                title: "LOT 391 · Warsaw → Milan Linate",
                detail: "Thu Sep 18, 6:35 – 8:50 · returns Fri Sep 19, 20:15",
                provider: "LOT Polish Airlines",
                offerReference: "LO391-DEMO",
                amount: 312,
                currency: "EUR",
              },
              {
                kind: "hotel",
                title: "Park Hyatt Milano · 1 night",
                detail: "120 m from the Duomo, Park Deluxe room, breakfast included",
                provider: "Park Hyatt",
                offerReference: "PHM-DEMO",
                amount: 742,
                currency: "EUR",
              },
              {
                kind: "car",
                title: "BMW 3 Series · 2 days",
                detail: "Pickup at Linate airport, return to the same location",
                provider: "Sixt",
                offerReference: "CAR-DEMO",
                amount: 186,
                currency: "EUR",
              },
            ],
          });
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      <FileDown className="size-4" />
      {loading ? t.home.trips.pdfBusy : t.home.trips.pdfIdle}
    </button>
  );
}

function TravelProfile({ t }: { t: Dict }) {
  const p = t.home.profile;
  const icons = [
    <Plane key="a" className="size-4" />,
    <Building2 key="b" className="size-4" />,
    <UtensilsCrossed key="c" className="size-4" />,
    <Wallet key="d" className="size-4" />,
  ];

  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="hairline-card overflow-hidden">
        <div className="grid md:grid-cols-[1fr_1.4fr]">
          <div className="border-b border-border bg-cream-deep p-8 sm:p-10 md:border-b-0 md:border-r">
            <SectionLabel>{p.label}</SectionLabel>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight">
              {p.titleLine1}
              <br />
              {p.titleLine2}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{p.lead}</p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
              <Armchair className="size-4 text-primary" />
              <span className="text-xs font-medium text-foreground">{p.activeCount}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2">
            {p.groups.map((g, i) => (
              <div
                key={g.title}
                className={`p-6 sm:p-7 ${i % 2 === 0 ? "sm:border-r" : ""} ${i < 2 ? "border-b" : ""} border-border max-sm:border-b max-sm:last:border-b-0`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-primary">{icons[i]}</span>
                  <h3 className="text-sm font-semibold text-foreground">{g.title}</h3>
                </div>
                <ul className="mt-4 space-y-2">
                  {g.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
                    >
                      <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Principles({ t }: { t: Dict }) {
  const icons = [
    <Sparkles key="a" className="size-5" />,
    <Coffee key="b" className="size-5" />,
    <MapPin key="c" className="size-5" />,
  ];
  return (
    <section id="principles" className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>{t.home.principles.label}</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {t.home.principles.title}
      </h2>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {t.home.principles.items.map((p, i) => (
          <div key={p.title} className="hairline-card p-7">
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-background text-primary">
                {icons[i]}
              </div>
              <span className="font-display text-sm font-semibold text-muted-foreground">
                0{i + 1}
              </span>
            </div>
            <h3 className="mt-6 font-display text-lg font-semibold leading-snug text-foreground">
              {p.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Teams({ t }: { t: Dict }) {
  const c = t.home.campaign;
  const locale = useLocale();
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>{c.teamsLabel}</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {c.teamsTitle}
      </h2>
      <div className="hairline-card mt-8 flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary">
            <Users className="size-5" />
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{c.teamsLine}</p>
        </div>
        <div className="flex flex-col gap-3 sm:w-80 sm:shrink-0">
          <EarlyAccess t={t} type="teams" label={c.teamsCta} />
          <LocaleLink
            to="/business"
            locale={locale}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            {c.teamsMore}
            <ArrowRight className="size-4" />
          </LocaleLink>
        </div>
      </div>
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
        {divider}
        <Comparison t={t} />
        {divider}
        <ChatDemo t={t} submission={submission} />
        {divider}
        <MyTrips t={t} />
        {divider}
        <TravelProfile t={t} />
        {divider}
        <Principles t={t} />
        {divider}
        <Teams t={t} />
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
            <p className="text-xs text-muted-foreground">{t.home.footer}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
