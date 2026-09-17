/**
 * The public creator offer.
 *
 * Every affiliate programme on earth says "earn commission". What we can say
 * that they cannot: the traveller keeps earning for a year, the maths is shown
 * rather than described, and nobody can buy a recommendation. So the page leads
 * with the numbers and lets the visitor put their own in.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { AppFooter } from "@/components/app-footer";
import {
  ATTRIBUTION_DAYS,
  EARNING_WINDOW_MONTHS,
  OFFER_RATES,
  SAMPLE_TRIP,
  SUBSCRIPTION_BOUNTY_MINOR,
  earningOnTripMinor,
  formatMinor,
  type TripMix,
} from "@/lib/creators/offer";
import { CANCELLATION_WINDOW_DAYS, PAYOUT_MINIMUM_MINOR } from "@/lib/creators/commission";

const WAYS = [
  {
    title: "Your link and your code",
    body: `Anyone who arrives through them is yours for ${EARNING_WINDOW_MONTHS} months — every trip they book in that year, not just the first one.`,
  },
  {
    title: "Places you actually went",
    body: "Submit a hotel, a restaurant, a road. When a traveller books their trip on your recommendation you earn on that line, even if they came to Adair on their own.",
  },
  {
    title: "Travellers who take a plan",
    body: `${formatMinor(SUBSCRIPTION_BOUNTY_MINOR.select)} when someone you introduced starts on Select, ${formatMinor(SUBSCRIPTION_BOUNTY_MINOR.signature)} on Signature.`,
  },
];

const RULES = [
  `Nothing accrues until a booking is confirmed, and a line sits pending for ${CANCELLATION_WINDOW_DAYS} days while free cancellation runs. Cancelled trip, reversed line — we would rather say that now than surprise you later.`,
  `Payouts go out monthly once your balance passes ${formatMinor(PAYOUT_MINIMUM_MINOR)}. Below that it rolls over; it is never lost.`,
  "You are paid a share of what we earn, never a share of what the traveller paid. That is why we can show you the arithmetic.",
  "Nobody can pay to be recommended and you cannot pay to be listed. It is the only reason your picks are worth reading.",
  "You see counts and amounts. You never see a traveller's name, itinerary or contact details.",
];

const FAQ = [
  {
    q: "Do I need a big following?",
    a: "No. We read what you publish, not your follower count. A small blog whose readers actually travel is worth more to us than a large account that does not.",
  },
  {
    q: "What if I already use another affiliate network?",
    a: "Keep it. Nothing here is exclusive, and we do not ask for category exclusivity either.",
  },
  {
    q: "How long does the link last?",
    a: `A click is remembered for ${ATTRIBUTION_DAYS} days. Once someone signs up through you, they earn for you for ${EARNING_WINDOW_MONTHS} months from that day.`,
  },
  {
    q: "Can I recommend a place I have a deal with?",
    a: "You can recommend it, but say so in your note. An undisclosed arrangement is the one thing that ends a creator account.",
  },
  {
    q: "Who can join?",
    a: "Anyone who publishes about travel, food or places — blog, newsletter, Instagram, TikTok, YouTube. Apply online, we answer within a few days.",
  },
];

const FIELDS: Array<{ key: keyof TripMix; label: string }> = [
  { key: "flightMinor", label: "Flights" },
  { key: "stayMinor", label: "Hotel" },
  { key: "carMinor", label: "Car" },
  { key: "extrasMinor", label: "Extras" },
];

function Calculator() {
  const [mix, setMix] = useState<TripMix>(SAMPLE_TRIP);
  const [tripsPerMonth, setTripsPerMonth] = useState(4);

  const perTrip = earningOnTripMinor(mix);
  const perMonth = perTrip * tripsPerMonth;

  return (
    <div className="hairline-card mt-6 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {FIELDS.map((field) => (
          <label key={field.key} className="block text-sm">
            <span className="text-muted-foreground">{field.label}</span>
            <div className="mt-1 flex items-center rounded-xl border border-border bg-background px-3">
              <span className="text-sm text-muted-foreground">€</span>
              <input
                type="number"
                min={0}
                step={10}
                value={Math.round(mix[field.key] / 100)}
                onChange={(e) =>
                  setMix((m) => ({
                    ...m,
                    [field.key]: Math.max(0, Number(e.target.value) || 0) * 100,
                  }))
                }
                className="w-full bg-transparent px-2 py-2 text-sm outline-none"
              />
            </div>
          </label>
        ))}
      </div>

      <label className="mt-5 block text-sm">
        <span className="text-muted-foreground">
          Trips your readers book in a month:{" "}
          <span className="text-foreground">{tripsPerMonth}</span>
        </span>
        <input
          type="range"
          min={1}
          max={40}
          value={tripsPerMonth}
          onChange={(e) => setTripsPerMonth(Number(e.target.value))}
          className="mt-2 w-full accent-primary"
        />
      </label>

      <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3 border-t border-border pt-4">
        <div>
          <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            Per trip
          </div>
          <div className="font-display text-2xl font-semibold">{formatMinor(perTrip)}</div>
        </div>
        <div>
          <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            Per month
          </div>
          <div className="font-display text-2xl font-semibold">{formatMinor(perMonth)}</div>
        </div>
        <div>
          <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            Over a year
          </div>
          <div className="font-display text-2xl font-semibold">{formatMinor(perMonth * 12)}</div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Worked from our typical margin on each line, at the rates above. It is arithmetic, not a
        forecast — what you earn depends on what your readers actually book.
      </p>
    </div>
  );
}

export function CreatorsPublicPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Recommend places you love.
          <br />
          Earn for a year, not a click.
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted-foreground">
          Send a reader to Adair once and they earn for you on every trip they book for the next{" "}
          {EARNING_WINDOW_MONTHS} months. No minimum following, no exclusivity, no paid placement —
          ever.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to="/creators/apply"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Apply online <ArrowRight className="size-4" />
          </Link>
          <span className="text-sm text-muted-foreground">
            Takes about three minutes. We answer within a few days.
          </span>
        </div>

        {/* Rates */}
        <section className="mt-16">
          <h2 className="font-display text-xl font-semibold tracking-tight">What you earn</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A share of our margin on each line of the trip. We can only share what we make, so this
            is the whole of it.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {OFFER_RATES.map((rate) => (
              <div
                key={rate.lineType}
                className="flex items-baseline justify-between rounded-xl border border-border px-4 py-3"
              >
                <span className="text-sm">{rate.label}</span>
                <span className="font-display text-lg font-semibold">
                  {rate.shareBps / 100}
                  <span className="text-sm font-normal text-muted-foreground"> % of margin</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Calculator */}
        <section className="mt-16">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Put your own numbers in
          </h2>
          <Calculator />
        </section>

        {/* Ways to earn */}
        <section className="mt-16">
          <h2 className="font-display text-xl font-semibold tracking-tight">Three ways to earn</h2>
          <div className="mt-5 space-y-4">
            {WAYS.map((way, i) => (
              <div key={way.title} className="flex gap-4">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-xs">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-medium">{way.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{way.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rules */}
        <section className="mt-16">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            The part other programmes bury
          </h2>
          <ul className="mt-5 space-y-3">
            {RULES.map((rule) => (
              <li key={rule} className="text-sm text-muted-foreground">
                {rule}
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="mt-16">
          <h2 className="font-display text-xl font-semibold tracking-tight">Questions</h2>
          <div className="mt-5 divide-y divide-border border-y border-border">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
                  {item.q}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-border p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold tracking-tight">Ready when you are</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Apply with your handle and where you publish. Approved creators get a link, a code, a
            public profile page and a dashboard showing every click, signup and booking.
          </p>
          <Link
            to="/creators/apply"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Apply online <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
