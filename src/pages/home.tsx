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
} from "lucide-react";
import { useState } from "react";
import { downloadTripInvoice } from "@/lib/trip-pdf";
import { SiteNav } from "@/components/site-nav";
import { useLocale, useT, type Dict } from "@/lib/i18n";

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

function Hero({ t }: { t: Dict }) {
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
      <div
        className="animate-rise mt-10 flex flex-wrap items-center justify-center gap-3"
        style={{ animationDelay: "270ms" }}
      >
        <a
          href="#demo"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t.home.hero.ctaPrimary} <ArrowRight className="size-4" />
        </a>
        <a
          href="#principles"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          {t.home.hero.ctaSecondary}
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
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tags: React.ReactNode[];
  price: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="flex items-start gap-3.5">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{tags}</div>
        </div>
      </div>
      <p className="shrink-0 text-sm font-semibold text-foreground">{price}</p>
    </div>
  );
}

function ChatDemo({ t }: { t: Dict }) {
  const d = t.home.demo;
  return (
    <section id="demo" className="mx-auto max-w-3xl px-6 py-20">
      <SectionLabel>{d.label}</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {d.title}
      </h2>

      <div className="mt-12 space-y-5">
        <div className="animate-rise flex justify-end" style={{ animationDelay: "100ms" }}>
          <div className="max-w-md rounded-xl rounded-br-sm border border-border bg-card px-5 py-4">
            <p className="text-sm leading-relaxed text-foreground">{d.userMessage}</p>
            <p className="mt-2 text-right text-[11px] text-muted-foreground">{d.you} · 9:41</p>
          </div>
        </div>

        <div className="animate-rise flex gap-3" style={{ animationDelay: "400ms" }}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <div className="w-full max-w-lg">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Adair · 9:41</p>
            <div className="hairline-card overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <p className="text-sm font-semibold text-foreground">{d.cardTitle}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{d.cardSubtitle}</p>
              </div>

              <div className="divide-y divide-border">
                <TripRow
                  icon={<Plane className="size-4" />}
                  title={d.flightTitle}
                  subtitle={d.flightDetail}
                  tags={[
                    <Tag key="1">LOT Polish Airlines</Tag>,
                    <Tag key="2">{d.flightTagClass}</Tag>,
                  ]}
                  price="€412"
                />
                <TripRow
                  icon={<BedDouble className="size-4" />}
                  title={d.hotelTitle}
                  subtitle={d.hotelDetail}
                  tags={[
                    <Tag key="1" accent>
                      {d.hotelTag}
                    </Tag>,
                  ]}
                  price="€610"
                />
                <TripRow
                  icon={<CarFront className="size-4" />}
                  title={d.carTitle}
                  subtitle={d.carDetail}
                  tags={[<Tag key="1">Sixt</Tag>, <Tag key="2">{d.carTag}</Tag>]}
                  price="€218"
                />
              </div>

              <div className="flex items-center justify-between border-t border-border bg-cream-deep px-5 py-4">
                <div>
                  <p className="text-xs text-muted-foreground">{d.total}</p>
                  <p className="font-display text-xl font-semibold text-primary">€1,240</p>
                </div>
                <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                  {d.bookAll} <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{d.footnote}</p>
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

      <div className="mt-5 hairline-card flex flex-wrap items-center justify-between gap-4 px-6 py-4">
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

export function HomePage() {
  const t = useT();
  const divider = (
    <div className="mx-auto max-w-6xl px-6">
      <div className="border-t border-border" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      <main>
        <Hero t={t} />
        {divider}
        <Comparison t={t} />
        {divider}
        <ChatDemo t={t} />
        {divider}
        <MyTrips t={t} />
        {divider}
        <TravelProfile t={t} />
        {divider}
        <Principles t={t} />
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
