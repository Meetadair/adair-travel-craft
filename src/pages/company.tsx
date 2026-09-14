/**
 * The pages a company is expected to have: who we are, how to work with us,
 * how to reach us, and what we do with cookies.
 *
 * Written plainly and without claims we cannot stand behind. Where a fact is
 * not settled yet — a licence number, a registered address — it is marked
 * rather than invented.
 */
import { Link } from "@tanstack/react-router";

import { SiteNav } from "@/components/site-nav";
import { AppFooter } from "@/components/app-footer";
import { openCookieSettings } from "@/lib/cookies";

function Page({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{title}</h1>
        {lead && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{lead}</p>}
        <div className="mt-8 space-y-6 text-sm leading-relaxed">{children}</div>
      </main>
      <AppFooter />
    </div>
  );
}

const h2 = "font-display text-lg font-semibold";

export function AboutPage() {
  return (
    <Page
      title="About us"
      lead="One sentence in, one trip out. That is the whole idea, and everything else follows from it."
    >
      <p>
        Booking a trip means five sites, five confirmations and five places to check when something
        changes. Adair replaces that with one conversation: you say where you need to be, we put the
        flight, the hotel and the car on one card at one price, and we stay with you for the
        journey.
      </p>

      <h2 className={h2}>What we will not do</h2>
      <p>
        We do not confirm anything a supplier has not confirmed. We do not show a saving without the
        costs that come after it. We do not recommend a place nobody has been to. If we do not know
        something, we say so — an assistant that guesses is worse than no assistant.
      </p>

      <h2 className={h2}>Where we are</h2>
      <p>
        Adair Kft., Budapest. We operate as a travel organiser; registration details and the licence
        number are published here once the registration completes.
      </p>
    </Page>
  );
}

export function CooperationPage() {
  return (
    <Page title="Cooperation" lead="Four ways to work with us. All of them start with an email.">
      <div>
        <h2 className={h2}>Hotels and properties</h2>
        <p className="mt-2 text-muted-foreground">
          Direct rates, negotiated with us rather than through a marketplace, and something small on
          arrival for our travellers. In return, guests who arrive with their preferences already
          known to you.
        </p>
      </div>

      <div>
        <h2 className={h2}>Suppliers and technology</h2>
        <p className="mt-2 text-muted-foreground">
          Flights, accommodation, cars, rail, transfers, insurance, experiences. If you have an API
          and cover a market we serve, we would like to hear about it.
        </p>
      </div>

      <div>
        <h2 className={h2}>Companies</h2>
        <p className="mt-2 text-muted-foreground">
          One travel policy, one invoice, one place for the whole team.{" "}
          <Link to="/business" className="underline decoration-border underline-offset-4">
            Adair for companies
          </Link>
          .
        </p>
      </div>

      <div>
        <h2 className={h2}>Writers and creators</h2>
        <p className="mt-2 text-muted-foreground">
          Recommend places you have actually stayed at or eaten in, and earn when people book them.{" "}
          <Link to="/creators" className="underline decoration-border underline-offset-4">
            The creator programme
          </Link>
          .
        </p>
      </div>
    </Page>
  );
}

export function ContactPage() {
  return (
    <Page title="Contact" lead="A person reads every one of these.">
      <div>
        <h2 className={h2}>Already travelling</h2>
        <p className="mt-2 text-muted-foreground">
          Ask in the assistant — it has your booking in front of it. If it cannot help, it passes
          you to us and tells you when to expect an answer.{" "}
          <Link to="/support" className="underline decoration-border underline-offset-4">
            Open a support request
          </Link>
          .
        </p>
      </div>

      <div>
        <h2 className={h2}>Everything else</h2>
        <p className="mt-2 text-muted-foreground">
          Partnerships, press, companies, or anything that does not fit a form — write to us and say
          which it is, so it reaches the right person first time.
        </p>
      </div>

      <div>
        <h2 className={h2}>Company</h2>
        <p className="mt-2 text-muted-foreground">
          Adair Kft., Budapest, Hungary. Registration details are published here once the travel
          organiser registration completes.
        </p>
      </div>
    </Page>
  );
}

export function CookiePolicyPage() {
  return (
    <Page
      title="Cookie policy"
      lead="Two kinds, and you decide about the second. No advertising networks, no third-party trackers."
    >
      <div>
        <h2 className={h2}>Needed to run the site</h2>
        <p className="mt-2 text-muted-foreground">
          Keeping you signed in, remembering the language you chose, protecting the checkout against
          someone replaying it. These are set because the site does not work without them, and they
          carry nothing about you beyond the session itself.
        </p>
      </div>

      <div>
        <h2 className={h2}>How the site is used</h2>
        <p className="mt-2 text-muted-foreground">
          Our own page counts, so we can see what is slow or broken. Set only if you agree, and
          nothing is sent to an advertising network. Refusing changes nothing about what you can do
          here.
        </p>
      </div>

      <div>
        <h2 className={h2}>Changing your mind</h2>
        <p className="mt-2 text-muted-foreground">
          Withdrawing is as easy as agreeing, and takes effect immediately.
        </p>
        <button
          type="button"
          onClick={openCookieSettings}
          className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 text-sm hover:border-primary"
        >
          Open cookie settings
        </button>
      </div>

      <p className="text-muted-foreground">
        What we do with personal data is a separate matter, covered in the{" "}
        <Link to="/privacy" className="underline decoration-border underline-offset-4">
          privacy policy
        </Link>
        .
      </p>
    </Page>
  );
}
