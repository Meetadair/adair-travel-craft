import {
  MAX_SEATS,
  adjust,
  partyProblems,
  seatCount,
  type PartyCounts,
} from "@/lib/trip/party-counts";

/**
 * Cabin and who is travelling.
 *
 * Deliberately the shape every airline site uses — a cabin row, then five age
 * bands with a plus and a minus. A traveller who has booked a flight before
 * already knows how to use it, and that familiarity is worth more here than
 * any cleverer idea. The one thing we do better: the counters cannot build a
 * party the airline would reject, so nobody discovers at payment that their
 * two lap infants were never bookable.
 */

export type Cabin = "economy" | "premium_economy" | "business" | "first";

export type CabinPartyCopy = {
  cabinLabel: string;
  economy: string;
  premiumEconomy: string;
  business: string;
  first: string;
  whoLabel: string;
  ageNote: string;
  adults: string;
  adultsAge: string;
  teenagers: string;
  teenagersAge: string;
  children: string;
  childrenAge: string;
  infantsSeat: string;
  infantsSeatAge: string;
  infantsLap: string;
  infantsLapAge: string;
  seatsLeft: string;
  needAdult: string;
  needLap: string;
  done: string;
};

const CABINS: Array<{ id: Cabin; key: keyof CabinPartyCopy }> = [
  { id: "economy", key: "economy" },
  { id: "premium_economy", key: "premiumEconomy" },
  { id: "business", key: "business" },
  { id: "first", key: "first" },
];

const BANDS: Array<{
  band: keyof PartyCounts;
  label: keyof CabinPartyCopy;
  age: keyof CabinPartyCopy;
}> = [
  { band: "adults", label: "adults", age: "adultsAge" },
  { band: "teenagers", label: "teenagers", age: "teenagersAge" },
  { band: "children", label: "children", age: "childrenAge" },
  { band: "infantsWithSeat", label: "infantsSeat", age: "infantsSeatAge" },
  { band: "infantsOnLap", label: "infantsLap", age: "infantsLapAge" },
];

function Stepper({
  value,
  label,
  onStep,
  canAdd,
  canRemove,
}: {
  value: number;
  label: string;
  onStep: (delta: number) => void;
  canAdd: boolean;
  canRemove: boolean;
}) {
  const button =
    "flex size-8 items-center justify-center rounded-lg border border-border text-base leading-none transition-colors hover:border-primary/50 disabled:cursor-default disabled:opacity-30 disabled:hover:border-border";
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={!canRemove}
        aria-label={`One fewer ${label}`}
        onClick={() => onStep(-1)}
        className={button}
      >
        −
      </button>
      <span
        aria-live="polite"
        className="w-7 text-center text-sm font-medium tabular-nums"
      >
        {value}
      </span>
      <button
        type="button"
        disabled={!canAdd}
        aria-label={`One more ${label}`}
        onClick={() => onStep(1)}
        className={button}
      >
        +
      </button>
    </div>
  );
}

export function CabinParty({
  cabin,
  party,
  copy,
  onCabin,
  onParty,
  onDone,
}: {
  cabin: Cabin;
  party: PartyCounts;
  copy: CabinPartyCopy;
  onCabin: (cabin: Cabin) => void;
  onParty: (party: PartyCounts) => void;
  onDone?: (() => void) | undefined;
}) {
  const seats = seatCount(party);
  const problems = partyProblems(party);

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
        {copy.cabinLabel}
      </div>
      <div role="group" aria-label={copy.cabinLabel} className="mt-2 flex flex-wrap gap-1">
        {CABINS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={cabin === option.id}
            onClick={() => onCabin(option.id)}
            className={
              cabin === option.id
                ? "rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                : "rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            }
          >
            {copy[option.key]}
          </button>
        ))}
      </div>

      <div className="mt-4 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
        {copy.whoLabel}
      </div>
      {/* Ages are as of the day of departure, which is how airlines read them
          and is not obvious — a child who turns twelve on the flight out is a
          teenager for the whole trip. */}
      <p className="mt-1 text-xs text-muted-foreground">{copy.ageNote}</p>

      <div className="mt-2 divide-y divide-border">
        {BANDS.map((row) => {
          const value = party[row.band];
          const floor = row.band === "adults" ? 1 : 0;
          const wouldAdd = adjust(party, row.band, 1);
          return (
            <div key={row.band} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm">{copy[row.label]}</div>
                <div className="text-xs text-muted-foreground">{copy[row.age]}</div>
              </div>
              <Stepper
                value={value}
                label={copy[row.label]}
                canAdd={wouldAdd[row.band] > value}
                canRemove={value > floor}
                onStep={(delta) => onParty(adjust(party, row.band, delta))}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          {problems.includes("unaccompanied_minor") || problems.includes("no_adult")
            ? copy.needAdult
            : problems.includes("too_many_lap_infants")
              ? copy.needLap
              : `${MAX_SEATS - seats} ${copy.seatsLeft}`}
        </p>
        {onDone && (
          <button
            type="button"
            disabled={problems.length > 0}
            onClick={onDone}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            {copy.done}
          </button>
        )}
      </div>
    </div>
  );
}
