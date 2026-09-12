/**
 * The arithmetic behind a backwards-planned trip, shown on the card because
 * this is where the traveller has to trust us with a fixed meeting time.
 */
import { CarTaxiFront, Clock } from "lucide-react";
import type { ArrivalPlan } from "@/lib/trip/backwards";

const time = (iso: string, locale: string) =>
  new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

function hours(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function ArrivalPlanNote({
  plan,
  locale,
  onPickSafer,
  busy,
}: {
  plan: ArrivalPlan;
  locale: string;
  /** Swap in the calmer flight from the same search. */
  onPickSafer?: (index: number) => void;
  busy?: boolean;
}) {
  return (
    <div className="border-b border-border px-5 py-4">
      <p className="flex items-start gap-2 text-sm font-medium">
        <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          Planned backwards from {time(plan.mustArriveBy, locale)}
          {plan.meetingLocation ? ` at ${plan.meetingLocation}` : ""}
        </span>
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{plan.reasoning}</p>

      {plan.feasible && plan.tight && (
        <p className="mt-2 text-xs leading-relaxed text-foreground">
          This arrives {hours(plan.slackMin)} before your meeting — tight.
          {plan.saferOption
            ? ` ${plan.saferOption.title} ${
                plan.saferOption.extraEur > 0
                  ? `costs €${plan.saferOption.extraEur} more`
                  : plan.saferOption.extraEur < 0
                    ? `costs €${Math.abs(plan.saferOption.extraEur)} less`
                    : "costs no more"
              } and gives you ${hours(plan.saferOption.slackMin)}.`
            : " No calmer flight came back for this date."}
        </p>
      )}

      {plan.feasible && plan.tight && plan.saferOption && onPickSafer && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onPickSafer(plan.saferOption!.index)}
          className="mt-2 w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-primary hover:border-primary disabled:opacity-60 sm:w-auto"
        >
          Take the earlier flight
        </button>
      )}

      {!plan.feasible && (
        <p className="mt-2 text-xs leading-relaxed text-foreground">{plan.shortfall}</p>
      )}
    </div>
  );
}

/** The airport → meeting ride. No supplier is connected, so we show no price. */
export function TransferNote({
  transfer,
  locale,
}: {
  transfer: NonNullable<import("@/lib/trip/types").TripSearchResponse["transfer"]>;
  locale: string;
}) {
  return (
    <div className="px-5 py-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <CarTaxiFront className="size-4 text-primary" /> Airport transfer
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Pickup {time(transfer.pickupAt, locale)} · {transfer.fromLabel} → {transfer.toLabel} ·{" "}
        {transfer.minutes} min
      </p>
      {!transfer.supplierConnected && (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Held in the plan without a price — no ride supplier is connected to our account yet.
        </p>
      )}
    </div>
  );
}
