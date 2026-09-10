import { SiteNav } from "@/components/site-nav";
import { LocaleLink, useLocale, useT } from "@/lib/i18n";

export function InvestorsPage() {
  const t = useT();
  const locale = useLocale();
  const i = t.investors;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-6 py-20">
        <p className="tag-pill">{i.badge}</p>
        <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          {i.titleLine1}
          <br />
          {i.titleLine2}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">{i.lead}</p>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {i.metrics.map((m) => (
            <div key={m.label} className="hairline-card p-5">
              <p className="font-display text-2xl font-semibold text-primary">{m.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>

        <section className="mt-20">
          <h2 className="font-display text-2xl font-semibold tracking-tight">{i.revenueTitle}</h2>
          <div className="mt-8 space-y-4">
            {i.revenue.map((r) => (
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
          <h2 className="font-display text-2xl font-semibold tracking-tight">{i.unitTitle}</h2>
          <div className="hairline-card mt-8 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border px-6 py-3 text-xs text-muted-foreground">
              <span>{i.colItem}</span>
              <span className="w-24 text-right">{i.colPrice}</span>
              <span className="w-24 text-right">{i.colMargin}</span>
            </div>
            {i.unit.map((row) => (
              <div
                key={row.item}
                className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border px-6 py-4 text-sm"
              >
                <span>{row.item}</span>
                <span className="w-24 text-right">{row.price}</span>
                <span className="w-24 text-right font-semibold text-primary">{row.margin}</span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 bg-cream-deep px-6 py-4 text-sm font-semibold">
              <span>{i.unitTotal}</span>
              <span className="w-24 text-right">€1,240</span>
              <span className="w-24 text-right text-primary">€124</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{i.unitNote}</p>
        </section>

        <section className="mt-20">
          <h2 className="font-display text-2xl font-semibold tracking-tight">{i.askTitle}</h2>
          <div className="hairline-card mt-8 p-8">
            <p className="text-sm leading-relaxed text-muted-foreground">{i.askBody}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="mailto:investors@adair.travel"
                className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {i.contact}
              </a>
              <LocaleLink
                to="/assistant"
                locale={locale}
                className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-secondary"
              >
                {i.seeProduct}
              </LocaleLink>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
