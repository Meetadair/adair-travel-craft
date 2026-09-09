import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Adair Travel — Jedna prośba. Cała podróż." },
      {
        name: "description",
        content:
          "Adair to asystent podróży AI, który w jednym oknie czatu składa lot, hotel i samochód w jedną rezerwację.",
      },
      { property: "og:title", content: "Adair Travel — Jedna prośba. Cała podróż." },
      {
        property: "og:description",
        content:
          "Lot, hotel i samochód w jednej karcie do rezerwacji. Zamiast pięciu appek — jedna rozmowa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={
        accent
          ? "tag-pill border-primary/25 text-primary"
          : "tag-pill"
      }
    >
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

/* ---------- Hero ---------- */

function Hero() {
  return (
    <section className="mx-auto max-w-4xl px-6 pt-28 pb-20 text-center sm:pt-36">
      <div className="animate-rise" style={{ animationDelay: "0ms" }}>
        <Tag>
          <Sparkles className="size-3" /> Asystent podróży AI — koncept
        </Tag>
      </div>
      <h1
        className="animate-rise mt-8 font-display text-5xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-7xl"
        style={{ animationDelay: "90ms" }}
      >
        Jedna prośba.
        <br />
        Cała podróż.
      </h1>
      <p
        className="animate-rise mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        style={{ animationDelay: "180ms" }}
      >
        Adair składa lot, hotel i samochód w jedną kartę do rezerwacji — w jednym
        oknie czatu. Zamiast pięciu appek, jedna rozmowa.
      </p>
      <div
        className="animate-rise mt-10 flex items-center justify-center gap-3"
        style={{ animationDelay: "270ms" }}
      >
        <a
          href="#demo"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Zobacz jak działa <ArrowRight className="size-4" />
        </a>
        <a
          href="#zasady"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          Trzy zasady
        </a>
      </div>
    </section>
  );
}

/* ---------- Comparison ---------- */

const withoutApps = [
  { name: "Skyscanner", detail: "szukanie lotu, 14 zakładek" },
  { name: "Booking.com", detail: "hotel po publicznej stawce" },
  { name: "Wypożyczalnia", detail: "osobna rezerwacja auta" },
  { name: "Uber", detail: "dojazdy na miejscu" },
  { name: "OpenTable", detail: "restauracje osobno" },
];

function Comparison() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>Dlaczego Adair</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Pięć appek albo jedno okno.
      </h2>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {/* Without */}
        <div className="hairline-card p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Bez Adaira</h3>
            <Tag>
              <X className="size-3" /> 5 appek
            </Tag>
          </div>
          <ul className="mt-6 space-y-3">
            {withoutApps.map((app) => (
              <li
                key={app.name}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3"
              >
                <span className="text-sm font-medium text-foreground">{app.name}</span>
                <span className="text-xs text-muted-foreground">{app.detail}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
            5 rezerwacji · 5 potwierdzeń · 5 miejsc do sprawdzania
          </p>
        </div>

        {/* With */}
        <div className="hairline-card relative overflow-hidden p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Z Adairem</h3>
            <Tag accent>
              <Check className="size-3" /> 1 rozmowa
            </Tag>
          </div>
          <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-5">
            <p className="text-sm leading-relaxed text-foreground">
              „Muszę być w Mediolanie w czwartek rano, wracam w piątek wieczorem,
              coś blisko Duomo i auto na miejscu."
            </p>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
            <Plane className="size-4 text-primary" />
            <BedDouble className="size-4 text-primary" />
            <CarFront className="size-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Lot + hotel + auto — jedna karta
            </span>
          </div>
          <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
            1 rezerwacja · 1 potwierdzenie · <span className="font-semibold text-primary">1 240 €</span>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- Chat demo ---------- */

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

function ChatDemo() {
  return (
    <section id="demo" className="mx-auto max-w-3xl px-6 py-20">
      <SectionLabel>Demo rozmowy</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Jedna wiadomość wystarczy.
      </h2>

      <div className="mt-12 space-y-5">
        {/* User message */}
        <div className="animate-rise flex justify-end" style={{ animationDelay: "100ms" }}>
          <div className="max-w-md rounded-xl rounded-br-sm border border-border bg-card px-5 py-4">
            <p className="text-sm leading-relaxed text-foreground">
              Muszę być w Mediolanie w czwartek rano, wracam w piątek wieczorem,
              coś blisko Duomo i auto na miejscu.
            </p>
            <p className="mt-2 text-right text-[11px] text-muted-foreground">Ty · 09:41</p>
          </div>
        </div>

        {/* Adair response */}
        <div className="animate-rise flex gap-3" style={{ animationDelay: "400ms" }}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <div className="w-full max-w-lg">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Adair · 09:41</p>
            <div className="hairline-card overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <p className="text-sm font-semibold text-foreground">
                  Mediolan · czw – pt
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Skomponowane pod Twój profil podróży
                </p>
              </div>

              <div className="divide-y divide-border">
                <TripRow
                  icon={<Plane className="size-4" />}
                  title="LOT 391 · Warszawa → Mediolan"
                  subtitle="Czw 06:55 – 09:05 · powrót pt 19:40 · miejsce przy oknie, preferowana linia"
                  tags={[<Tag key="1">Duffel · NDC</Tag>, <Tag key="2">Premium Economy</Tag>]}
                  price="412 €"
                />
                <TripRow
                  icon={<BedDouble className="size-4" />}
                  title="Park Hyatt Milano"
                  subtitle="1 noc · pokój King, ciche piętro · 200 m od Duomo"
                  tags={[<Tag key="1" accent>Adair Direct</Tag>, <Tag key="2">stawka negocjowana</Tag>]}
                  price="610 €"
                />
                <TripRow
                  icon={<CarFront className="size-4" />}
                  title="BMW serii 3 · odbiór Linate"
                  subtitle="Czw 09:30 – pt 18:30 · pełne ubezpieczenie, bez kaucji"
                  tags={[<Tag key="1">Duffel</Tag>, <Tag key="2">automat</Tag>]}
                  price="218 €"
                />
              </div>

              <div className="flex items-center justify-between border-t border-border bg-cream-deep px-5 py-4">
                <div>
                  <p className="text-xs text-muted-foreground">Razem, jedna rezerwacja</p>
                  <p className="font-display text-xl font-semibold text-primary">1 240 €</p>
                </div>
                <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                  Zarezerwuj całość <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              3 elementy · 1 płatność · 1 numer rezerwacji
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- My trips ---------- */

const trips = [
  {
    icon: <Plane className="size-4" />,
    label: "Lot",
    title: "LOT 391 · WAW → MXP",
    detail: "Czw 18 wrz · 06:55 · miejsce 7A",
    code: "Rezerwacja ADR-8K2M4F",
  },
  {
    icon: <BedDouble className="size-4" />,
    label: "Hotel",
    title: "Park Hyatt Milano",
    detail: "Zameldowanie 18 wrz · 1 noc · King",
    code: "Potwierdzenie PH-55271",
  },
  {
    icon: <CarFront className="size-4" />,
    label: "Samochód",
    title: "BMW serii 3 · Linate",
    detail: "Odbiór 09:30 · zwrot pt 18:30",
    code: "Voucher ADR-CAR-0912",
  },
];

function MyTrips() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>Moje podróże</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Wszystko w jednym miejscu po rezerwacji.
      </h2>

      <div className="mt-12 grid gap-5 sm:grid-cols-3">
        {trips.map((t) => (
          <div key={t.label} className="hairline-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background">
                {t.icon}
              </div>
              <Tag>{t.label}</Tag>
            </div>
            <h3 className="mt-5 text-sm font-semibold text-foreground">{t.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.detail}</p>
            <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] tracking-wide text-muted-foreground">
              {t.code}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 hairline-card flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" /> czw 18 – pt 19 wrz
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" /> Mediolan, Włochy
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" /> odjazd za 6 dni
          </span>
        </div>
        <span className="text-sm font-semibold text-primary">1 240 € · opłacone</span>
      </div>

      <div className="mt-5 flex justify-end">
        <PdfButton />
      </div>
    </section>
  );
}

const DEMO_INVOICE = {
  documentNumber: "ADR/2025/DEMO/001",
  issueDate: new Date().toISOString().slice(0, 10),
  city: "Mediolan",
  origin: "Warszawa",
  startDate: "2025-09-18",
  endDate: "2025-09-19",
  currency: "EUR",
  live: false,
  buyer: { name: "", company: "", taxId: "", email: "" },
  items: [
    {
      kind: "flight",
      title: "LOT 391 · Warszawa → Mediolan Linate",
      detail: "czw 18 wrz, 06:35 – 08:50 · powrót pt 19 wrz, 20:15",
      provider: "Duffel · NDC",
      offerReference: "LO391-DEMO",
      amount: 312,
      currency: "EUR",
    },
    {
      kind: "hotel",
      title: "Park Hyatt Milano · 1 noc",
      detail: "120 m od Duomo, pokój Park Deluxe, śniadanie w cenie",
      provider: "Adair Direct",
      offerReference: "PHM-DEMO",
      amount: 742,
      currency: "EUR",
    },
    {
      kind: "car",
      title: "BMW seria 3 · 2 dni",
      detail: "Odbiór na lotnisku Linate, zwrot w tym samym miejscu",
      provider: "Duffel",
      offerReference: "CAR-DEMO",
      amount: 186,
      currency: "EUR",
    },
  ],
};

function PdfButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        try {
          await downloadTripInvoice(DEMO_INVOICE);
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      <FileDown className="size-4" />
      {loading ? "Generuję PDF…" : "Pobierz kartę podróży (PDF)"}
    </button>
  );
}

/* ---------- Travel profile ---------- */

const profilePrefs = [
  {
    icon: <Plane className="size-4" />,
    title: "Loty",
    items: ["LOT, Lufthansa, Air France", "Premium Economy od 2 h", "Miejsce przy oknie, przód"],
  },
  {
    icon: <Building2 className="size-4" />,
    title: "Hotele",
    items: ["Hyatt, Small Luxury Hotels", "Ciche piętro, King bed", "Max 10 min pieszo od celu"],
  },
  {
    icon: <UtensilsCrossed className="size-4" />,
    title: "Dieta i czas",
    items: ["Bez glutenu", "Śniadanie w cenie", "Wymeldowanie po 11:00"],
  },
  {
    icon: <Wallet className="size-4" />,
    title: "Budżet",
    items: ["Do 1 500 € / podróż 2-dniowa", "Faktura VAT firmowa", "EUR, jedna karta"],
  },
];

function TravelProfile() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="hairline-card overflow-hidden">
        <div className="grid md:grid-cols-[1fr_1.4fr]">
          <div className="border-b border-border bg-cream-deep p-8 sm:p-10 md:border-b-0 md:border-r">
            <SectionLabel>Profil podróży</SectionLabel>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight">
              Ustawiasz raz.
              <br />
              Działa zawsze.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Adair uczy się Twoich preferencji raz — i każda kolejna podróż
              automatycznie je respektuje. Bez klikania filtrów, bez porównywania.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
              <Armchair className="size-4 text-primary" />
              <span className="text-xs font-medium text-foreground">
                18 preferencji aktywnych
              </span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2">
            {profilePrefs.map((p, i) => (
              <div
                key={p.title}
                className={`p-6 sm:p-7 ${i % 2 === 0 ? "sm:border-r" : ""} ${i < 2 ? "border-b" : ""} border-border max-sm:border-b max-sm:last:border-b-0`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-primary">{p.icon}</span>
                  <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
                </div>
                <ul className="mt-4 space-y-2">
                  {p.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
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

/* ---------- Principles ---------- */

const principles = [
  {
    icon: <Sparkles className="size-5" />,
    title: "Jedna podróż, nie trzy rezerwacje",
    text: "Lot, hotel i samochód to jedna podróż — więc powinna być jedną rezerwacją. Jedno okno, jedna płatność, jedno potwierdzenie.",
  },
  {
    icon: <Coffee className="size-5" />,
    title: "Cena, jakiej inni nie mają",
    text: "Hotele po własnych, negocjowanych stawkach Adair Direct — nie po publicznych cenach z Booking.com. Różnicę widzisz w podsumowaniu.",
  },
  {
    icon: <MapPin className="size-5" />,
    title: "Jedno miejsce po rezerwacji",
    text: "Numery rezerwacji, vouchery, zmiany i odwołania — wszystko w jednym widoku Moje podróże, do ostatniego dnia wyjazdu.",
  },
];

function Principles() {
  return (
    <section id="zasady" className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>Trzy zasady</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Na tym stoi Adair.
      </h2>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {principles.map((p, i) => (
          <div key={p.title} className="hairline-card p-7">
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-background text-primary">
                {p.icon}
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

/* ---------- Page ---------- */

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-semibold tracking-tight text-foreground">
          Adair<span className="text-primary">.</span>
        </span>
        <a
          href="#demo"
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Zobacz demo <ArrowRight className="size-3.5" />
        </a>
      </header>

      <main>
        <Hero />
        <div className="mx-auto max-w-6xl px-6">
          <div className="border-t border-border" />
        </div>
        <Comparison />
        <div className="mx-auto max-w-6xl px-6">
          <div className="border-t border-border" />
        </div>
        <ChatDemo />
        <div className="mx-auto max-w-6xl px-6">
          <div className="border-t border-border" />
        </div>
        <MyTrips />
        <div className="mx-auto max-w-6xl px-6">
          <div className="border-t border-border" />
        </div>
        <TravelProfile />
        <div className="mx-auto max-w-6xl px-6">
          <div className="border-t border-border" />
        </div>
        <Principles />
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-10 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
          <span className="font-display text-lg font-semibold tracking-tight text-foreground">
            Adair<span className="text-primary">.</span>
          </span>
          <p className="text-xs text-muted-foreground">
            Koncept produktu — dane przykładowe. Adair Travel, 2026.
          </p>
        </div>
      </footer>
    </div>
  );
}
