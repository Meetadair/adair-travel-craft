import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/investors")({
  head: () => ({
    meta: [
      { title: "Adair Travel dla inwestorów — model, marża, runda" },
      {
        name: "description",
        content:
          "Adair Travel składa lot, hotel i samochód w jedną rezerwację. Model przychodowy, marża z negocjowanych stawek hotelowych i warunki rundy seed.",
      },
      { property: "og:title", content: "Adair Travel dla inwestorów" },
      {
        property: "og:description",
        content:
          "Jeden asystent zamiast pięciu aplikacji. Marża z własnych stawek hotelowych, nie z prowizji OTA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestorsPage,
});

const metrics = [
  { label: "Średnia wartość podróży", value: "1 240 €" },
  { label: "Marża brutto na podróż", value: "11–17 %" },
  { label: "Czas złożenia podróży", value: "< 40 s" },
  { label: "Aplikacje zastąpione", value: "5" },
];

const revenue = [
  {
    title: "Stawka negocjowana",
    body: "Kupujemy pokoje po własnej stawce korporacyjnej i sprzedajemy je poniżej ceny publicznej OTA. Marża zostaje u nas, nie u pośrednika.",
    margin: "8–14 %",
  },
  {
    title: "Prowizja lotnicza (NDC)",
    body: "Loty w kanale NDC: prowizja dystrybucyjna plus opłata serwisowa za obsługę zmian i zwrotów w jednym oknie.",
    margin: "1–3 %",
  },
  {
    title: "Abonament firmowy",
    body: "Zespoły płacą za profil podróży, politykę wydatków i jedną fakturę VAT za całą podróż zamiast trzech dokumentów.",
    margin: "29 € / os. / mies.",
  },
];

const unit = [
  ["Lot (LOT, NDC)", "312 €", "6 €"],
  ["Hotel 1 noc (stawka negocjowana)", "742 €", "96 €"],
  ["Samochód 2 dni", "186 €", "22 €"],
];

function InvestorsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-6 py-20">
        <p className="tag-pill">Runda seed · materiał dla inwestorów</p>
        <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Podróż służbowa to dziś pięć aplikacji.
          <br />
          U nas jedno zdanie.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Adair Travel to asystent, który z jednej prośby składa lot, hotel i samochód w jedną
          kartę i jedną fakturę. Zarabiamy na własnych negocjowanych stawkach hotelowych, a nie
          na prowizji od porównywarki — dlatego nasza cena jest niższa, a marża wyższa.
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
            Skąd bierze się przychód
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
            Przykładowa podróż — jednostkowa ekonomia
          </h2>
          <div className="hairline-card mt-8 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border px-6 py-3 text-xs text-muted-foreground">
              <span>Pozycja</span>
              <span className="w-24 text-right">Cena klienta</span>
              <span className="w-24 text-right">Nasza marża</span>
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
              <span>Razem, jedna rezerwacja</span>
              <span className="w-24 text-right">1 240 €</span>
              <span className="w-24 text-right text-primary">124 €</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Trasa Warszawa–Mediolan, dane poglądowe na podstawie stawek testowych dostawców.
          </p>
        </section>

        <section className="mt-20">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Czego szukamy</h2>
          <div className="hairline-card mt-8 p-8">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Zbieramy rundę seed na rozbudowę bazy negocjowanych stawek hotelowych w dziesięciu
              miastach biznesowych, pełną obsługę zmian rezerwacji w jednym oknie oraz sprzedaż
              do zespołów 20–200 osób.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="mailto:inwestorzy@adair.travel"
                className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Napisz do nas
              </a>
              <Link
                to="/asystent"
                className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-secondary"
              >
                Zobacz produkt na żywo
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
