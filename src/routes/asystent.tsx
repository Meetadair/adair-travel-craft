import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Plane, BedDouble, CarFront, Sparkles, ChevronRight, Send } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { HotelGallery } from "@/components/hotel-gallery";
import { composeTrip, saveTrip } from "@/lib/travel.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/asystent")({
  head: () => ({
    meta: [
      { title: "Asystent Adair — złóż całą podróż w jednej rozmowie" },
      {
        name: "description",
        content:
          "Napisz, gdzie i kiedy musisz być. Adair wyszukuje rzeczywiste oferty lotu, hotelu i samochodu i składa je w jedną kartę.",
      },
      { property: "og:title", content: "Asystent Adair — cała podróż w jednej rozmowie" },
      {
        property: "og:description",
        content: "Rzeczywiste oferty lotów, hoteli i samochodów w jednej karcie do rezerwacji.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantPage,
});

const ICONS: Record<string, React.ReactNode> = {
  flight: <Plane className="size-4" />,
  hotel: <BedDouble className="size-4" />,
  car: <CarFront className="size-4" />,
};

const EXAMPLES = [
  "Muszę być w Mediolanie w czwartek rano, wracam w piątek wieczorem, hotel blisko Duomo i auto na miejscu.",
  "Konferencja w Barcelonie 12–14 października, klasa premium economy, hotel przy centrum kongresowym.",
  "Wyjazd do Londynu w poniedziałek, powrót w środę, bez samochodu.",
];

function money(amount: number, currency: string) {
  return `${amount.toLocaleString("pl-PL", { maximumFractionDigits: 0 })} ${currency}`;
}

function AssistantPage() {
  const navigate = useNavigate();
  const compose = useServerFn(composeTrip);
  const persist = useServerFn(saveTrip);
  const [input, setInput] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const search = useMutation({
    mutationFn: (message: string) => compose({ data: { message } }),
  });

  const store = useMutation({
    mutationFn: async () => {
      const result = search.data;
      if (!result) throw new Error("Brak podróży do zapisania");
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth" });
        throw new Error("Zaloguj się, aby zapisać podróż");
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
          items: result.offers.map((o) => ({
            kind: o.kind,
            title: o.title,
            detail: o.detail,
            provider: o.provider,
            offerReference: o.offerReference,
            amount: o.amount,
            currency: o.currency,
          })),
        },
      });
    },
    onSuccess: (res) => setSaved(res.documentNumber),
  });

  const result = search.data;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Napisz, gdzie musisz być.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Adair rozumie zdanie po polsku, pyta dostawców o dostępność i składa lot, hotel i
          samochód w jedną kartę do rezerwacji.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            setAsked(input.trim());
            setSaved(null);
            search.mutate(input.trim());
          }}
          className="hairline-card mt-8 flex items-end gap-3 p-4"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="np. Muszę być w Mediolanie w czwartek rano, wracam w piątek wieczorem…"
            className="min-h-[56px] w-full resize-none bg-transparent px-2 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={search.isPending}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <Send className="size-4" />
            {search.isPending ? "Szukam…" : "Złóż podróż"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
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

        {search.isError && (
          <p className="mt-6 text-sm text-primary">
            Nie udało się złożyć podróży. Spróbuj ponownie lub podaj daty wprost.
          </p>
        )}

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
                      ? "ceny z API dostawców"
                      : result.source === "partial"
                        ? "część pozycji z API dostawców"
                        : "dane przykładowe"}
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {result.offers.map((o) => (
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
                          <span className="tag-pill">{o.provider}</span>
                          <span className="tag-pill">{o.offerReference.slice(0, 22)}</span>
                        </div>
                        {o.kind === "hotel" && (
                          <HotelGallery
                            {...(o.images ? { images: o.images } : {})}
                            alt={o.title}
                          />
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-primary">
                        {money(o.amount, o.currency)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-border bg-cream-deep px-5 py-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Razem, jedna rezerwacja</p>
                    <p className="font-display text-xl font-semibold text-primary">
                      {money(result.total, result.currency)}
                    </p>
                  </div>
                  <button
                    onClick={() => store.mutate()}
                    disabled={store.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    {store.isPending ? "Zapisuję…" : "Zapisz w moich podróżach"}
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>

              {saved && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Zapisane jako {saved}.{" "}
                  <button
                    onClick={() => navigate({ to: "/panel" })}
                    className="text-primary underline underline-offset-4"
                  >
                    Otwórz panel
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
