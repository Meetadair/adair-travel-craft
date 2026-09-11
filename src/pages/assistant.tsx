import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Plane, BedDouble, CarFront, Sparkles, ChevronRight, Send, X } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { HotelGallery } from "@/components/hotel-gallery";
import { composeTrip, saveTrip } from "@/lib/travel.functions";
import { supabase } from "@/integrations/supabase/client";
import { localeHref, useLocale, useT } from "@/lib/i18n";

const ICONS: Record<string, React.ReactNode> = {
  flight: <Plane className="size-4" />,
  hotel: <BedDouble className="size-4" />,
  car: <CarFront className="size-4" />,
};

/** Technical provider names are not shown to the customer. */
const HIDDEN_PROVIDERS = ["duffel", "amadeus"];
function displayProvider(provider: string) {
  return HIDDEN_PROVIDERS.some((p) => provider.toLowerCase().includes(p)) ? "Adair" : provider;
}

export function AssistantPage() {
  const navigate = useNavigate();
  const locale = useLocale();
  const t = useT();
  const compose = useServerFn(composeTrip);
  const persist = useServerFn(saveTrip);
  const [input, setInput] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [hotelRef, setHotelRef] = useState<string | null>(null);
  const [showAlts, setShowAlts] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);

  const money = (amount: number, currency: string) =>
    `${amount.toLocaleString(locale, { maximumFractionDigits: 0 })} ${currency}`;

  const search = useMutation({
    mutationFn: (message: string) => compose({ data: { message, locale } }),
  });

  const raw = search.data;
  const offers = (raw?.offers ?? [])
    .filter((o) => !removed.includes(o.kind))
    .map((o) => {
      if (o.kind !== "hotel" || !hotelRef) return o;
      const alt = o.alternatives?.find((a) => a.offerReference === hotelRef);
      return alt ? { ...alt, ...(o.alternatives ? { alternatives: o.alternatives } : {}) } : o;
    });
  const total = Math.round(offers.reduce((sum, o) => sum + o.amount, 0) * 100) / 100;

  const store = useMutation({
    mutationFn: async () => {
      const result = raw;
      if (!result) throw new Error("No trip to save");
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ href: localeHref(locale, "/auth") });
        throw new Error("Sign in to save this trip");
      }
      return persist({
        data: {
          title: `${result.request.destinationCity} · ${result.request.departDate}`,
          city: result.request.destinationCity,
          origin: result.request.originCity,
          startDate: result.request.departDate,
          endDate: result.request.returnDate,
          currency: result.currency,
          source: result.source,
          items: offers.map((o) => ({
            kind: o.kind,
            title: o.title,
            detail: o.detail,
            provider: displayProvider(o.provider),
            offerReference: o.offerReference,
            amount: o.amount,
            currency: o.currency,
          })),
        },
      });
    },
    onSuccess: (res) => setSaved(res.documentNumber),
  });

  const result = raw;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{t.assistant.title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t.assistant.lead}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            setAsked(input.trim());
            setSaved(null);
            setHotelRef(null);
            setShowAlts(false);
            search.mutate(input.trim());
          }}
          className="hairline-card mt-8 flex items-end gap-3 p-4"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder={t.assistant.placeholder}
            className="min-h-[56px] w-full resize-none bg-transparent px-2 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={search.isPending}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <Send className="size-4" />
            {search.isPending ? t.assistant.submitBusy : t.assistant.submitIdle}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {t.assistant.examples.map((ex) => (
            <button
              key={ex}
              onClick={() => setInput(ex)}
              className="tag-pill text-left hover:bg-secondary"
            >
              {ex.slice(0, 46)}…
            </button>
          ))}
        </div>

        {asked && (
          <div className="mt-12 flex justify-end">
            <div className="max-w-md rounded-xl rounded-br-sm border border-border bg-card px-5 py-4">
              <p className="text-sm leading-relaxed">{asked}</p>
            </div>
          </div>
        )}

        {search.isError && <p className="mt-6 text-sm text-primary">{t.assistant.error}</p>}

        {result && (
          <div className="mt-6 flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <div className="w-full">
              <p className="mb-2 text-sm text-muted-foreground">{result.reply}</p>
              <div className="hairline-card overflow-hidden">
                <div className="border-b border-border px-5 py-4">
                  <p className="text-sm font-semibold">
                    {result.request.originCity} → {result.request.destinationCity}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {result.request.departDate} – {result.request.returnDate} ·{" "}
                    {result.source === "live"
                      ? t.assistant.sourceLive
                      : result.source === "partial"
                        ? t.assistant.sourcePartial
                        : t.assistant.sourceDemo}
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {offers.map((o) => (
                    <div key={o.kind + o.offerReference} className="flex gap-4 px-5 py-4">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                        {ICONS[o.kind]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{o.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {o.detail}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="tag-pill">{displayProvider(o.provider)}</span>
                          <span className="tag-pill">{o.offerReference.slice(0, 22)}</span>
                        </div>
                        {o.kind === "hotel" && (
                          <>
                            <HotelGallery
                              {...(o.images ? { images: o.images } : {})}
                              alt={o.title}
                            />
                            {o.alternatives && o.alternatives.length > 0 && (
                              <div className="mt-3">
                                <button
                                  onClick={() => setShowAlts((v) => !v)}
                                  className="text-xs font-medium text-primary underline underline-offset-4"
                                >
                                  {showAlts
                                    ? t.assistant.hideAlternatives
                                    : t.assistant.showAlternatives}
                                </button>
                                {showAlts && (
                                  <div className="mt-3 space-y-2">
                                    {(hotelRef
                                      ? o.alternatives.filter(
                                          (a) => a.offerReference !== o.offerReference,
                                        )
                                      : o.alternatives.slice(0, 3)
                                    ).map((a) => (
                                      <button
                                        key={a.offerReference}
                                        onClick={() => setHotelRef(a.offerReference)}
                                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-secondary"
                                      >
                                        <span className="min-w-0">
                                          <span className="block truncate text-sm font-medium">
                                            {a.title}
                                          </span>
                                          <span className="block truncate text-xs text-muted-foreground">
                                            {a.detail}
                                          </span>
                                        </span>
                                        <span className="shrink-0 text-sm font-semibold text-primary">
                                          {money(a.amount, a.currency)}
                                        </span>
                                      </button>
                                    ))}
                                    {hotelRef && (
                                      <button
                                        onClick={() => setHotelRef(null)}
                                        className="text-xs text-muted-foreground underline underline-offset-4"
                                      >
                                        {t.assistant.backToRecommendation}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <p className="text-sm font-semibold text-primary">
                          {money(o.amount, o.currency)}
                        </p>
                        <button
                          type="button"
                          onClick={() => setRemoved((prev) => [...prev, o.kind])}
                          aria-label={t.assistant.remove}
                          title={t.assistant.remove}
                          className="flex size-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {removed.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs text-muted-foreground">
                      <span>{t.assistant.removedNote}</span>
                      <button
                        type="button"
                        onClick={() => setRemoved([])}
                        className="font-medium text-primary underline underline-offset-4"
                      >
                        {t.assistant.restoreAll}
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-border bg-cream-deep px-5 py-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t.assistant.total}</p>
                    <p className="font-display text-xl font-semibold text-primary">
                      {money(total, result.currency)}
                    </p>
                  </div>
                  <button
                    onClick={() => store.mutate()}
                    disabled={store.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    {store.isPending ? t.assistant.saveBusy : t.assistant.saveIdle}
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>

              {saved && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t.assistant.savedAs} {saved}.{" "}
                  <button
                    onClick={() => navigate({ to: "/dashboard" })}
                    className="text-primary underline underline-offset-4"
                  >
                    {t.assistant.openDashboard}
                  </button>
                </p>
              )}

              {result.warnings.length > 0 && (
                <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
                  {result.warnings.map((w) => (
                    <li key={w}>· {w}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
