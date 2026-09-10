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
} from "lucide-react";
import { useEffect, useState } from "react";
import { downloadTripInvoice } from "@/lib/trip-pdf";
import { SiteNav } from "@/components/site-nav";
import { useLocale, useT, type Dict } from "@/lib/i18n";
import { parseDemoSentence, fill, referralCode } from "@/lib/demo-sentence";
import { joinWaitlist } from "@/lib/waitlist.functions";

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
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tags: React.ReactNode[];
  price: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
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
      <p className="shrink-0 text-sm font-semibold text-foreground">{price}</p>
    </div>
  );
}

function ChatDemo({ t, submission }: { t: Dict; submission: Submission | null }) {
  const d = t.home.demo;
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

    if (reduced) {
      setTyped(text);
      setThinking(false);
      setRevealed(3);
      setShowTotal(true);
      setShowSaved(true);
      setShowActions(true);
      return;
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
      await wait(2000);
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
  const card =
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

  const reveal = (index: number) => (revealed >= index ? "animate-rise" : "hidden");

  async function shareCard() {
    const url = `${window.location.origin}${window.location.pathname}#demo`;
    const payload = { title: "Adair", text: `${card.title} · €1,240`, url };
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
                    <p className="text-sm font-semibold text-foreground">{card.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{d.cardSubtitle}</p>
                  </div>

                  <div className="divide-y divide-border">
                    <div className={reveal(1)}>
                      <TripRow
                        icon={<Plane className="size-4" />}
                        title={card.flightTitle}
                        subtitle={card.flightDetail}
                        tags={[
                          <Tag key="1">LOT Polish Airlines</Tag>,
                          <Tag key="2">{d.flightTagClass}</Tag>,
                        ]}
                        price="€412"
                      />
                    </div>
                    <div className={reveal(2)}>
                      <TripRow
                        icon={<BedDouble className="size-4" />}
                        title={card.hotelTitle}
                        subtitle={card.hotelDetail}
                        tags={[
                          <Tag key="1" accent>
                            {d.hotelTag}
                          </Tag>,
                        ]}
                        price="€610"
                        extra={<HotelGallery alt={card.hotelTitle} />}
                      />
                    </div>
                    <div className={reveal(3)}>
                      <TripRow
                        icon={<CarFront className="size-4" />}
                        title={card.carTitle}
                        subtitle={card.carDetail}
                        tags={[<Tag key="1">Sixt</Tag>, <Tag key="2">{d.carTag}</Tag>]}
                        price="€218"
                      />
                    </div>
                    {parsed?.invoice && showTotal && (
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
                        <p className="text-xs text-muted-foreground">{d.total}</p>
                        <p className="font-display text-xl font-semibold text-primary">€1,240</p>
                      </div>
                      <button className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                        {d.bookAll} <ChevronRight className="size-4" />
                      </button>
                    </div>
                    <SavedLine t={t} className={showSaved ? "animate-rise mt-3" : "hidden"} />
                  </div>
                </div>

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
        <div className="sm:w-80 sm:shrink-0">
          <EarlyAccess t={t} type="teams" label={c.teamsCta} />
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  const t = useT();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const reduced = usePrefersReducedMotion();
  const divider = (
    <div className="mx-auto max-w-6xl px-6">
      <div className="border-t border-border" />
    </div>
  );

  function runDemo(sentence: string) {
    setSubmission({ sentence, key: Date.now() });
    document
      .getElementById("demo")
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }

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
          <p className="text-xs text-muted-foreground">{t.home.footer}</p>
        </div>
      </footer>
    </div>
  );
}
