/**
 * Getaway: this week's proposal, chosen for the traveller. Everything shown here
 * is either editorial content written by the team or a real checked price —
 * nothing is invented, and gaps are stated plainly.
 */
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BedDouble, Compass, MapPin, UtensilsCrossed, Landmark } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { getWeeklyGetaway, muteGetawayTheme } from "@/lib/getaway.functions";

const KIND_ICON = {
  hotel: <BedDouble className="size-4" />,
  restaurant: <UtensilsCrossed className="size-4" />,
  sight: <Landmark className="size-4" />,
} as const;

const money = (minor: number | null, currency: string) =>
  minor === null ? null : `${(minor / 100).toLocaleString("en", { maximumFractionDigits: 0 })} ${currency}`;

export function GetawayPage() {
  const fetchGetaway = useServerFn(getWeeklyGetaway);
  const mute = useServerFn(muteGetawayTheme);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const query = useQuery({ queryKey: ["getaway"], queryFn: () => fetchGetaway({}) });
  const muteMutation = useMutation({
    mutationFn: (themeId: string) => mute({ data: { themeId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["getaway"] }),
  });

  function planThis(sentence: string) {
    window.sessionStorage.setItem("adair.getaway.sentence", sentence);
    navigate({ to: "/" });
  }

  const result = query.data;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <p className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          <Compass className="size-3.5" /> Getaway · this week
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          One trip, chosen for you
        </h1>

        {query.isLoading && <p className="mt-8 text-sm text-muted-foreground">Looking…</p>}

        {result?.status === "no-home-airport" && (
          <div className="hairline-card mt-8 p-6">
            <p className="text-sm text-muted-foreground">
              Add your home airport in Settings and we can only suggest places you can actually get
              to.
            </p>
          </div>
        )}

        {result?.status === "no-match" && (
          <div className="hairline-card mt-8 p-6">
            <p className="text-sm text-muted-foreground">{result.note}</p>
          </div>
        )}

        {result?.status === "ok" &&
          (() => {
            const p = result.proposal;
            return (
              <>
                <section className="hairline-card mt-8 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-2xl font-semibold">{p.destination.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {p.destination.country} · {p.destination.airport}
                        {p.theme ? ` · ${p.theme.name}` : ""}
                      </p>
                    </div>
                    {p.reach && (
                      <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                        {p.reach.label}
                      </span>
                    )}
                  </div>

                  {p.needsMoreThanWeekend && (
                    <p className="mt-4 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-xs text-muted-foreground">
                      Needs more than a weekend — {p.destination.typicalNights} nights suits it
                      better.
                    </p>
                  )}

                  <ul className="mt-5 space-y-1.5">
                    {p.reasons.map((reason, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        · {reason}
                      </li>
                    ))}
                  </ul>

                  {p.destination.editorialNote ? (
                    <p className="mt-5 text-sm leading-relaxed">{p.destination.editorialNote}</p>
                  ) : (
                    <p className="mt-5 text-xs text-muted-foreground">
                      Our note on this place is still being written.
                    </p>
                  )}
                  {p.destination.bestFor && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Best for: {p.destination.bestFor}
                    </p>
                  )}
                  {p.destination.avoidWhen && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Avoid when: {p.destination.avoidWhen}
                    </p>
                  )}

                  <div className="mt-6 rounded-xl border border-border p-4">
                    {p.price ? (
                      <>
                        <p className="text-sm">
                          {p.price.departDate} → {p.price.returnDate}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {money(p.price.flightMinor, p.price.currency)
                            ? `Flight from ${money(p.price.flightMinor, p.price.currency)}`
                            : "No flight price from the last check"}
                          {money(p.price.stayMinor, p.price.currency)
                            ? ` · hotel from ${money(p.price.stayMinor, p.price.currency)}`
                            : ""}
                        </p>
                        {p.price.deal && (
                          <p className="mt-1 text-xs text-muted-foreground">{p.price.deal.label}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Checked {p.price.checkedAt.slice(0, 10)} — confirmed when you search.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No price check for this route yet. Searching now gives you the live price.
                      </p>
                    )}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => planThis(p.planSentence)}
                      className="min-h-11 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
                    >
                      Plan this trip
                    </button>
                    {p.theme && (
                      <button
                        type="button"
                        onClick={() => muteMutation.mutate(p.theme!.id)}
                        disabled={muteMutation.isPending}
                        className="min-h-11 w-full rounded-xl border border-border px-5 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary sm:w-auto"
                      >
                        Not interested in {p.theme.name.toLowerCase()}
                      </button>
                    )}
                  </div>
                </section>

                {p.places.length > 0 && (
                  <section className="mt-8">
                    <h3 className="font-display text-lg font-semibold">Where we would go</h3>
                    <ul className="mt-4 space-y-3">
                      {p.places.map((place) => (
                        <li key={place.id} className="hairline-card p-5">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            {KIND_ICON[place.kind]} {place.name}
                            {place.priceBand && (
                              <span className="text-xs text-muted-foreground">
                                {place.priceBand}
                              </span>
                            )}
                          </p>
                          {place.address && (
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="size-3" /> {place.address}
                            </p>
                          )}
                          {place.whyThisOne && (
                            <p className="mt-2 text-sm text-muted-foreground">{place.whyThisOne}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {p.itinerary && (
                  <section className="mt-8">
                    <h3 className="font-display text-lg font-semibold">{p.itinerary.title}</h3>
                    {p.itinerary.summary && (
                      <p className="mt-2 text-sm text-muted-foreground">{p.itinerary.summary}</p>
                    )}
                    <ol className="mt-4 space-y-3">
                      {p.itinerary.days.map((day) => (
                        <li key={day.dayNumber} className="hairline-card p-5">
                          <p className="text-sm font-medium">Day {day.dayNumber}</p>
                          {day.morning && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              Morning · {day.morning}
                            </p>
                          )}
                          {day.afternoon && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              Afternoon · {day.afternoon}
                            </p>
                          )}
                          {day.evening && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              Evening · {day.evening}
                            </p>
                          )}
                          {day.sleepPlace && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Sleep · {day.sleepPlace}
                            </p>
                          )}
                          {day.mealPlaces.length > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Table · {day.mealPlaces.join(", ")}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </>
            );
          })()}
      </main>
    </div>
  );
}
