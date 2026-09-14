import { useState } from "react";
import {
  Users,
  Wallet,
  BarChart3,
  ShieldCheck,
  Building2,
  UserRound,
  ArrowRight,
  Check,
} from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { useT, type Dict } from "@/lib/i18n";
import { joinWaitlist } from "@/lib/waitlist.functions";
import { referralCode } from "@/lib/demo-sentence";
import { AppFooter } from "@/components/app-footer";

const ghostButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  );
}

function Hero({ t }: { t: Dict }) {
  const b = t.business;
  return (
    <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center sm:pt-32">
      <span className="tag-pill">
        <Users className="size-3" /> {b.badge}
      </span>
      <h1 className="mt-8 font-display text-4xl font-semibold leading-[1.06] tracking-tight text-foreground sm:text-6xl">
        {b.titleLine1}
        <br />
        {b.titleLine2}
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        {b.lead}
      </p>
      <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a href="#contact" className={primaryButton}>
          {b.ctaPrimary}
          <ArrowRight className="size-4" />
        </a>
        <a href="#packages" className={ghostButton}>
          {b.ctaSecondary}
        </a>
      </div>
    </section>
  );
}

function Roles({ t }: { t: Dict }) {
  const b = t.business;
  const icons = [
    <UserRound key="a" className="size-5" />,
    <Wallet key="b" className="size-5" />,
    <Building2 key="c" className="size-5" />,
  ];
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>{b.rolesLabel}</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {b.rolesTitle}
      </h2>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {b.roles.map((r, i) => (
          <div key={r.role} className="hairline-card p-7">
            <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-background text-primary">
              {icons[i]}
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {r.role}
            </p>
            <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-foreground">
              {r.title}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {r.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Budgets({ t }: { t: Dict }) {
  const b = t.business;
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>{b.budgetLabel}</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {b.budgetTitle}
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{b.budgetLead}</p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {b.budgets.map((item) => (
          <div key={item.title} className="hairline-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {item.title}
            </p>
            <p className="mt-3 font-display text-2xl font-semibold text-primary">{item.value}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CompanyDashboard({ t }: { t: Dict }) {
  const b = t.business;
  const d = b.dash;
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>{b.dashLabel}</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {b.dashTitle}
      </h2>

      <div className="hairline-card mt-10 p-6 sm:p-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {d.budgetTitle}
            </p>
            <p className="mt-3 font-display text-3xl font-semibold text-foreground">€19,420</p>
            <p className="mt-1 text-xs text-muted-foreground">{d.budgetOf}</p>
            <div className="mt-4 h-1.5 w-full rounded-full bg-secondary">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: "69%" }} />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {d.savedTitle}
            </p>
            <p className="mt-3 font-display text-3xl font-semibold text-primary">{d.savedValue}</p>
            <p className="mt-1 text-xs text-muted-foreground">{d.savedNote}</p>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {d.tripsTitle}
          </p>
          <ul className="mt-4 divide-y divide-border">
            {d.trips.map((trip) => (
              <li
                key={`${trip.who}-${trip.route}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{trip.route}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {trip.who} · {trip.dates}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tag-pill">{trip.paid ? d.statusPaid : d.statusPending}</span>
                  <span className="font-display text-sm font-semibold text-foreground">
                    {trip.amount}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {d.peopleTitle}
            </p>
            <ul className="mt-4 space-y-3.5">
              {d.people.map((p) => (
                <li key={p.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{p.name}</span>
                    <span className="text-muted-foreground">{p.amount}</span>
                  </div>
                  <div className="mt-1.5 h-1 w-full rounded-full bg-secondary">
                    <div
                      className="h-1 rounded-full bg-primary/70"
                      style={{ width: `${p.share}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {d.routesTitle}
            </p>
            <ul className="mt-4 divide-y divide-border">
              {d.routes.map((r) => (
                <li key={r.route} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{r.route}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.count} {d.tripsCount}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">{r.amount}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{b.dashNote}</p>
    </section>
  );
}

function Analytics({ t }: { t: Dict }) {
  const b = t.business;
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>{b.analyticsLabel}</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {b.analyticsTitle}
      </h2>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {b.analytics.map((a) => (
          <div key={a.title} className="hairline-card p-6">
            <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background text-primary">
              <BarChart3 className="size-4" />
            </div>
            <h3 className="mt-5 font-display text-base font-semibold text-foreground">{a.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Packages({ t }: { t: Dict }) {
  const b = t.business;
  return (
    <section id="packages" className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>{b.plansLabel}</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {b.plansTitle}
      </h2>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {b.plans.map((plan) => (
          <div key={plan.name} className="hairline-card flex flex-col p-7">
            <h3 className="font-display text-xl font-semibold text-foreground">{plan.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{plan.forWho}</p>
            <p className="mt-5 font-display text-3xl font-semibold text-primary">{plan.price}</p>
            <p className="mt-1 text-xs text-muted-foreground">{plan.priceNote}</p>
            {plan.name === b.plans[1]?.name ? (
              <span className="mt-3 inline-flex w-fit rounded-full border border-primary/30 px-2.5 py-1 text-[11px] font-medium text-primary">
                {b.plansTrial}
              </span>
            ) : null}
            <ul className="mt-6 flex-1 space-y-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <a href="#contact" className={`${ghostButton} mt-7 w-full`}>
              {b.quote}
            </a>
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs text-muted-foreground">{b.plansNote}</p>
    </section>
  );
}

function ContactForm({ t }: { t: Dict }) {
  const b = t.business;
  const f = b.form;
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [size, setSize] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);

  const inputClass =
    "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40";

  if (done) {
    return (
      <div className="hairline-card mt-8 max-w-xl p-6">
        <p className="text-sm leading-relaxed text-foreground">{f.success}</p>
      </div>
    );
  }

  return (
    <form
      className="mt-8 max-w-xl space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setFailed(false);
        try {
          await joinWaitlist({
            data: {
              email,
              referralCode: referralCode(),
              type: "business",
              sentence: [company && `Company: ${company}`, size && `Team size: ${size}`, message]
                .filter(Boolean)
                .join(" · ")
                .slice(0, 1000),
            },
          });
          setDone(true);
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label htmlFor="biz-email" className="text-xs font-medium text-muted-foreground">
          {f.email}
        </label>
        <input
          id="biz-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={f.emailPlaceholder}
          className={`mt-1.5 ${inputClass}`}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="biz-company" className="text-xs font-medium text-muted-foreground">
            {f.company}
          </label>
          <input
            id="biz-company"
            type="text"
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={f.companyPlaceholder}
            className={`mt-1.5 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="biz-size" className="text-xs font-medium text-muted-foreground">
            {f.size}
          </label>
          <input
            id="biz-size"
            type="text"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder={f.sizePlaceholder}
            className={`mt-1.5 ${inputClass}`}
          />
        </div>
      </div>
      <div>
        <label htmlFor="biz-message" className="text-xs font-medium text-muted-foreground">
          {f.message}
        </label>
        <textarea
          id="biz-message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={f.messagePlaceholder}
          className={`mt-1.5 ${inputClass} resize-none`}
        />
      </div>
      <button type="submit" disabled={busy} className={primaryButton}>
        {busy ? f.submitBusy : f.submit}
      </button>
      {failed && <p className="text-xs text-destructive">{f.error}</p>}
    </form>
  );
}

function Contact({ t }: { t: Dict }) {
  const b = t.business;
  return (
    <section id="contact" className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>{b.contactLabel}</SectionLabel>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {b.contactTitle}
      </h2>
      <p className="mt-4 flex max-w-2xl items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        {b.contactLead}
      </p>
      <ContactForm t={t} />
    </section>
  );
}

export function BusinessPage() {
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
        <Roles t={t} />
        {divider}
        <Budgets t={t} />
        {divider}
        <CompanyDashboard t={t} />
        {divider}
        <Analytics t={t} />
        {divider}
        <Packages t={t} />
        {divider}
        <Contact t={t} />
      </main>
      <footer className="mx-auto max-w-6xl px-6 pb-10 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
          <span className="font-display text-lg font-semibold tracking-tight text-foreground">
            Adair<span className="text-primary">.</span>
          </span>
          <p className="text-xs text-muted-foreground">{t.business.footer}</p>
        </div>
      </footer>
      <AppFooter />
    </div>
  );
}
