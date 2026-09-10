import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/investors")({
  head: () => ({
    meta: [
      { title: "Adair Travel for investors — model, margin, round" },
      {
        name: "description",
        content:
          "Adair Travel bundles a flight, hotel, and car into a single booking. Revenue model, margin from negotiated hotel rates, and seed round terms.",
      },
      { property: "og:title", content: "Adair Travel for investors" },
      {
        property: "og:description",
        content:
          "One assistant instead of five apps. Margin from our own negotiated hotel rates, not OTA commissions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestorsPage,
});

const metrics = [
  { label: "Average trip value", value: "€1,240" },
  { label: "Gross margin per trip", value: "11–17%" },
  { label: "Time to book a trip", value: "< 40 s" },
  { label: "Apps replaced", value: "5" },
];

const revenue = [
  {
    title: "Negotiated rate",
    body: "We buy rooms at our own corporate rate and sell them below the public OTA price. The margin stays with us, not with a middleman.",
    margin: "8–14%",
  },
  {
    title: "Airline commission (NDC)",
    body: "Flights through the NDC channel: a distribution commission plus a service fee for handling changes and refunds in a single window.",
    margin: "1–3%",
  },
  {
    title: "Corporate subscription",
    body: "Teams pay for a travel profile, expense policy, and a single VAT invoice for the whole trip instead of three documents.",
    margin: "€29 / user / mo.",
  },
];

const unit = [
  ["Flight (LOT, NDC)", "€312", "€6"],
  ["Hotel, 1 night (negotiated rate)", "€742", "€96"],
  ["Car, 2 days", "€186", "€22"],
];

function InvestorsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-6 py-20">
        <p className="tag-pill">Seed round · investor material</p>
        <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Business travel today means five apps.
          <br />
          With us, it's one sentence.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Adair Travel is an assistant that turns a single request into a flight, hotel, and car
          bundled into one card and one invoice. We earn on our own negotiated hotel rates, not
          on a comparison-site commission — that's why our price is lower and our margin is
          higher.
        </p>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="hairline-card p-5">
              <p className="font-display text-2xl font-semibold text-primary">{m.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>

        <section className="mt-20">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Where the revenue comes from
          </h2>
          <div className="mt-8 space-y-4">
            {revenue.map((r) => (
              <div key={r.title} className="hairline-card flex flex-wrap gap-6 p-6">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{r.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-primary">{r.margin}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Sample trip — unit economics
          </h2>
          <div className="hairline-card mt-8 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border px-6 py-3 text-xs text-muted-foreground">
              <span>Item</span>
              <span className="w-24 text-right">Customer price</span>
              <span className="w-24 text-right">Our margin</span>
            </div>
            {unit.map((row) => (
              <div
                key={row[0]}
                className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border px-6 py-4 text-sm"
              >
                <span>{row[0]}</span>
                <span className="w-24 text-right">{row[1]}</span>
                <span className="w-24 text-right font-semibold text-primary">{row[2]}</span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 bg-cream-deep px-6 py-4 text-sm font-semibold">
              <span>Total, one booking</span>
              <span className="w-24 text-right">€1,240</span>
              <span className="w-24 text-right text-primary">€124</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Warsaw–Milan route, illustrative figures based on test supplier rates.
          </p>
        </section>

        <section className="mt-20">
          <h2 className="font-display text-2xl font-semibold tracking-tight">What we're looking for</h2>
          <div className="hairline-card mt-8 p-8">
            <p className="text-sm leading-relaxed text-muted-foreground">
              We're raising a seed round to expand our negotiated hotel rate base across ten
              business cities, deliver full booking-change support in a single window, and sell
              into teams of 20–200 people.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="mailto:investors@adair.travel"
                className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Get in touch
              </a>
              <Link
                to="/assistant"
                className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-secondary"
              >
                See the product live
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
