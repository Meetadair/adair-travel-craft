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
      { title: "Adair Travel — One request. The whole trip." },
      {
        name: "description",
        content:
          "Adair is an AI travel assistant that bundles your flight, hotel, and car into a single booking — all from one chat window.",
      },
      { property: "og:title", content: "Adair Travel — One request. The whole trip." },
      {
        property: "og:description",
        content:
          "Flight, hotel, and car in a single booking card. Instead of five apps — one conversation.",
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
          <Sparkles className="size-3" /> AI travel assistant — concept
        </Tag>
      </div>
      <h1
        className="animate-rise mt-8 font-display text-5xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-7xl"
        style={{ animationDelay: "90ms" }}
      >
        One request.
        <br />
        The whole trip.
      </h1>
      <p
        className="animate-rise mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        style={{ animationDelay: "180ms" }}
      >
        Adair bundles your flight, hotel, and car into a single booking card — all in one
        chat window. Instead of five apps, one conversation.
      </p>
      <div
        className="animate-rise mt-10 flex items-center justify-center gap-3"
        style={{ animationDelay: "270ms" }}
      >
        <a
          href="#demo"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          See how it works <ArrowRight className="size-4" />
        </a>
        <a
          href="#principles"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          Three principles
        </a>
      </div>
    </section>
  );
}

/* ---------- Comparison ---------- */

const withoutApps = [
  { name: "Skyscanner", detail: "flight search, 14 tabs" },
  { name: "Booking.com", detail: "hotel at public rate" },
  { name: "Rental agency", detail: "separate car booking" },
  { name: "Uber", detail: "getting around locally" },
  { name: "OpenTable", detail: "restaurants, separately" },
];

function Comparison() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>Why Adair</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Five apps, or one window.
      </h2>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {/* Without */}
        <div className="hairline-card p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Without Adair</h3>
            <Tag>
              <X className="size-3" /> 5 apps
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
            5 bookings · 5 confirmations · 5 places to check
          </p>
        </div>

        {/* With */}
        <div className="hairline-card relative overflow-hidden p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">With Adair</h3>
            <Tag accent>
              <Check className="size-3" /> 1 conversation
            </Tag>
          </div>
          <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-5">
            <p className="text-sm leading-relaxed text-foreground">
              "I need to be in Milan Thursday morning, back Friday evening,
              somewhere near the Duomo, and a car on the ground."
            </p>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
            <Plane className="size-4 text-primary" />
            <BedDouble className="size-4 text-primary" />
            <CarFront className="size-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Flight + hotel + car — one card
            </span>
          </div>
          <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
            1 booking · 1 confirmation · <span className="font-semibold text-primary">€1,240</span>
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
      <SectionLabel>Conversation demo</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        One message is all it takes.
      </h2>

      <div className="mt-12 space-y-5">
        {/* User message */}
        <div className="animate-rise flex justify-end" style={{ animationDelay: "100ms" }}>
          <div className="max-w-md rounded-xl rounded-br-sm border border-border bg-card px-5 py-4">
            <p className="text-sm leading-relaxed text-foreground">
              I need to be in Milan Thursday morning, back Friday evening,
              somewhere near the Duomo, and a car on the ground.
            </p>
            <p className="mt-2 text-right text-[11px] text-muted-foreground">You · 9:41 AM</p>
          </div>
        </div>

        {/* Adair response */}
        <div className="animate-rise flex gap-3" style={{ animationDelay: "400ms" }}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <div className="w-full max-w-lg">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Adair · 9:41 AM</p>
            <div className="hairline-card overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <p className="text-sm font-semibold text-foreground">
                  Milan · Thu – Fri
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Composed to match your travel profile
                </p>
              </div>

              <div className="divide-y divide-border">
                <TripRow
                  icon={<Plane className="size-4" />}
                  title="LOT 391 · Warsaw → Milan"
                  subtitle="Thu 6:55 – 9:05 AM · returns Fri 7:40 PM · window seat, preferred airline"
                  tags={[<Tag key="1">LOT Polish Airlines</Tag>, <Tag key="2">Premium Economy</Tag>]}
                  price="€412"
                />
                <TripRow
                  icon={<BedDouble className="size-4" />}
                  title="Park Hyatt Milano"
                  subtitle="1 night · King room, quiet floor · 200 m from the Duomo"
                  tags={[<Tag key="1" accent>negotiated rate</Tag>]}
                  price="€610"
                />
                <TripRow
                  icon={<CarFront className="size-4" />}
                  title="BMW 3 Series · pickup at Linate"
                  subtitle="Thu 9:30 AM – Fri 6:30 PM · full insurance, no deposit"
                  tags={[<Tag key="1">Sixt</Tag>, <Tag key="2">automatic</Tag>]}
                  price="€218"
                />
              </div>

              <div className="flex items-center justify-between border-t border-border bg-cream-deep px-5 py-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total, one booking</p>
                  <p className="font-display text-xl font-semibold text-primary">€1,240</p>
                </div>
                <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                  Book it all <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              3 items · 1 payment · 1 booking number
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
    label: "Flight",
    title: "LOT 391 · WAW → MXP",
    detail: "Thu, Sep 18 · 6:55 AM · seat 7A",
    code: "Booking ADR-8K2M4F",
  },
  {
    icon: <BedDouble className="size-4" />,
    label: "Hotel",
    title: "Park Hyatt Milano",
    detail: "Check-in Sep 18 · 1 night · King",
    code: "Confirmation PH-55271",
  },
  {
    icon: <CarFront className="size-4" />,
    label: "Car",
    title: "BMW 3 Series · Linate",
    detail: "Pickup 9:30 AM · return Fri 6:30 PM",
    code: "Voucher ADR-CAR-0912",
  },
];

function MyTrips() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>My trips</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Everything in one place after you book.
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
            <CalendarDays className="size-3.5" /> Thu 18 – Fri 19 Sep
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" /> Milan, Italy
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" /> departs in 6 days
          </span>
        </div>
        <span className="text-sm font-semibold text-primary">€1,240 · paid</span>
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
  city: "Milan",
  origin: "Warsaw",
  startDate: "2025-09-18",
  endDate: "2025-09-19",
  currency: "EUR",
  live: false,
  buyer: { name: "", company: "", taxId: "", email: "" },
  items: [
    {
      kind: "flight",
      title: "LOT 391 · Warsaw → Milan Linate",
      detail: "Thu Sep 18, 6:35 – 8:50 AM · returns Fri Sep 19, 8:15 PM",
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
      {loading ? "Generating PDF…" : "Download trip card (PDF)"}
    </button>
  );
}

/* ---------- Travel profile ---------- */

const profilePrefs = [
  {
    icon: <Plane className="size-4" />,
    title: "Flights",
    items: ["LOT, Lufthansa, Air France", "Premium Economy for 2h+ flights", "Window seat, front of cabin"],
  },
  {
    icon: <Building2 className="size-4" />,
    title: "Hotels",
    items: ["Hyatt, Small Luxury Hotels", "Quiet floor, King bed", "Max 10 min walk from destination"],
  },
  {
    icon: <UtensilsCrossed className="size-4" />,
    title: "Diet & timing",
    items: ["Gluten-free", "Breakfast included", "Late checkout after 11:00 AM"],
  },
  {
    icon: <Wallet className="size-4" />,
    title: "Budget",
    items: ["Up to €1,500 / 2-day trip", "Company VAT invoice", "EUR, one card"],
  },
];

function TravelProfile() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="hairline-card overflow-hidden">
        <div className="grid md:grid-cols-[1fr_1.4fr]">
          <div className="border-b border-border bg-cream-deep p-8 sm:p-10 md:border-b-0 md:border-r">
            <SectionLabel>Travel profile</SectionLabel>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight">
              Set it once.
              <br />
              It works every time.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Adair learns your preferences once — and every trip after that
              honors them automatically. No filters to click, nothing to compare.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
              <Armchair className="size-4 text-primary" />
              <span className="text-xs font-medium text-foreground">
                18 active preferences
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
    title: "One trip, not three bookings",
    text: "A flight, a hotel, and a car are one trip — so they should be one booking. One window, one payment, one confirmation.",
  },
  {
    icon: <Coffee className="size-5" />,
    title: "A price no one else gets you",
    text: "Hotels at our own negotiated rates — not public Booking.com pricing. You see the difference right in the summary.",
  },
  {
    icon: <MapPin className="size-5" />,
    title: "One place after you book",
    text: "Confirmation numbers, vouchers, changes, and cancellations — all in one My Trips view, right up to the last day of your trip.",
  },
];

function Principles() {
  return (
    <section id="principles" className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>Three principles</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        This is what Adair stands on.
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
      <SiteNav />

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
            Product concept — sample data. Adair Travel, 2026.
          </p>
        </div>
      </footer>
    </div>
  );
}
