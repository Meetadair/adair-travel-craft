/**
 * Change a booked trip: pick the new dates or the new hotel, see the price
 * difference and the conditions in plain words, then continue to payment.
 */
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, BedDouble, AlertTriangle } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { eur } from "@/lib/trip/client";
import { startTripChange } from "@/lib/trip-change.functions";
import { searchLiveTrip } from "@/lib/trip-live.functions";
import {
  changeQuote,
  conditionsSentences,
  differenceSentence,
  type ChangeKind,
} from "@/lib/trip/change";

export const CHANGE_STORAGE_KEY = "adair.trip-change";

const inputClass =
  "mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

type Quoted = {
  cardId: string;
  newTotalEur: number;
  oldTotalEur: number;
  feeEur: number;
  kind: ChangeKind;
};

export function TripChangePage({ tripId }: { tripId: string }) {
  const navigate = useNavigate();
  const begin = useServerFn(startTripChange);
  const search = useServerFn(searchLiveTrip);

  const [kind, setKind] = useState<ChangeKind>("dates");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [stayName, setStayName] = useState("");
  const [quoted, setQuoted] = useState<Quoted | null>(null);

  const quote = useMutation({
    mutationFn: async () => {
      const started = await begin({
        data: {
          tripId,
          kind,
          departDate: kind === "dates" ? departDate : null,
          returnDate: kind === "dates" ? returnDate : null,
          stayName: kind === "stay" ? stayName : null,
        },
      });
      const result = await search({ data: { sentence: started.sentence } });
      return {
        cardId: result.cardId,
        newTotalEur: result.priced.total,
        oldTotalEur: started.oldTotalEur,
        feeEur: started.feeEur,
        kind,
      } satisfies Quoted;
    },
    onSuccess: (data) => setQuoted(data),
  });

  const ready =
    kind === "dates"
      ? /^\d{4}-\d{2}-\d{2}$/.test(departDate) && /^\d{4}-\d{2}-\d{2}$/.test(returnDate)
      : stayName.trim().length > 1;

  const money = quoted ? changeQuote(quoted.oldTotalEur, quoted.newTotalEur, quoted.feeEur) : null;

  const confirm = () => {
    if (!quoted || !money) return;
    window.localStorage.setItem(
      CHANGE_STORAGE_KEY,
      JSON.stringify({
        cardId: quoted.cardId,
        oldTripId: tripId,
        kind: quoted.kind,
        feeEur: quoted.feeEur,
      }),
    );
    navigate({ to: "/book/$cardId", params: { cardId: quoted.cardId } });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">Change this trip</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Change one thing — everything else stays as you booked it. You will see the price
          difference and the conditions before anything is confirmed.
        </p>

        <div className="hairline-card mt-8 space-y-5 p-6">
          <div className="flex gap-2">
            {(
              [
                { value: "dates" as ChangeKind, label: "Dates", icon: CalendarDays },
                { value: "stay" as ChangeKind, label: "Hotel", icon: BedDouble },
              ]
            ).map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setKind(option.value);
                  setQuoted(null);
                }}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm ${
                  kind === option.value
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                <option.icon className="h-4 w-4" /> {option.label}
              </button>
            ))}
          </div>

          {kind === "dates" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-muted-foreground">New outbound date</span>
                <input
                  type="date"
                  value={departDate}
                  onChange={(e) => setDepartDate(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">New return date</span>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
          ) : (
            <label className="block text-sm">
              <span className="text-muted-foreground">Hotel you would prefer</span>
              <input
                value={stayName}
                onChange={(e) => setStayName(e.target.value)}
                placeholder="Name of the hotel"
                className={inputClass}
              />
            </label>
          )}

          <button
            disabled={!ready || quote.isPending}
            onClick={() => quote.mutate()}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {quote.isPending ? "Checking prices…" : "Check this change"}
          </button>

          {quote.isError && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              We could not price this change right now. Nothing has changed on your booking — please
              try again.
            </p>
          )}
        </div>

        {money && quoted && (
          <div className="hairline-card mt-6 space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">{differenceSentence(money)}</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Booked now</span>
                <span>{eur(money.oldTotalEur)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">After the change</span>
                <span className="font-semibold">{eur(money.newTotalEur)}</span>
              </div>
            </div>
            <ul className="space-y-1 border-t border-border pt-4 text-sm text-muted-foreground">
              {conditionsSentences(quoted.kind, "cancel-and-rebook", money).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <button
              onClick={confirm}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              {`Continue to payment · ${eur(money.payableNowEur)}`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
