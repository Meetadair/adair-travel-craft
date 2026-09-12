/**
 * "Add a reservation" on a confirmed trip. Books through the enabled
 * restaurant partner; if none is connected yet, it says so plainly instead of
 * inventing a venue.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UtensilsCrossed } from "lucide-react";
import { addTripReservation } from "@/lib/extras.functions";
import type { UnavailableReason } from "@/lib/suppliers/types";

const selectClass =
  "rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function nights(start: string | null, end: string | null): string[] {
  if (!start) return [];
  const from = Date.parse(`${start}T12:00:00Z`);
  const to = Date.parse(`${end ?? start}T12:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return [start];
  const out: string[] = [];
  for (let t = from; t <= to && out.length < 14; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

const explain = (reason?: UnavailableReason): string =>
  reason === "no-availability"
    ? "No table at that time. Try another evening."
    : "Restaurant booking opens at launch — our reservation partner is not live yet.";

export function AddReservation({
  tripId,
  startDate,
  endDate,
  travellers,
}: {
  tripId: string;
  startDate: string | null;
  endDate: string | null;
  travellers?: number;
}) {
  const add = useServerFn(addTripReservation);
  const dates = nights(startDate, endDate);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(dates[0] ?? "");
  const [time, setTime] = useState("19:30");
  const [partySize, setPartySize] = useState(Math.max(1, travellers ?? 2));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!dates.length) return null;

  const submit = async () => {
    setBusy(true);
    setNote(null);
    try {
      const result = await add({ data: { tripId, date, time, partySize } });
      setNote(
        result.status === "confirmed"
          ? "Reservation confirmed — it is on your trip and in your calendar."
          : explain(result.reason),
      );
    } catch {
      setNote("We could not reach the reservation partner. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-border px-5 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-secondary"
      >
        <UtensilsCrossed className="size-4 text-primary" />
        {open ? "Close" : "Add a reservation"}
      </button>

      {open && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-xs text-muted-foreground">Evening</span>
            <select
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={`mt-1 ${selectClass}`}
            >
              {dates.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-muted-foreground">Time</span>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className={`mt-1 ${selectClass}`}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-muted-foreground">People</span>
            <input
              type="number"
              min={1}
              max={20}
              value={partySize}
              onChange={(event) => setPartySize(Number(event.target.value) || 1)}
              className={`mt-1 w-20 ${selectClass}`}
            />
          </label>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !date}
            className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:border-primary disabled:opacity-60"
          >
            {busy ? "Checking…" : "Request table"}
          </button>
        </div>
      )}

      {note && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}
