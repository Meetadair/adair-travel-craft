/**
 * The permission question, in the conversation, at the moment it matters.
 *
 * One line saying why, one line saying we do not keep it, one tap. A refusal is
 * remembered, so this never appears twice.
 */
import { useState } from "react";

import { useDeviceLocation } from "@/hooks/use-device-location";
import type { LocationConsent } from "@/lib/agent/location";

export type LocationPromptCopy = {
  ask: string;
  privacy: string;
  allow: string;
  deny: string;
  blocked: string;
  unavailable: string;
};

type Props = {
  copy: LocationPromptCopy;
  /** Called with the outcome: coordinates when allowed, nothing when not. */
  onResolved: (
    consent: LocationConsent,
    coords: { lat: number; lon: number } | null,
  ) => void | Promise<void>;
};

export function LocationPrompt({ copy, onResolved }: Props) {
  const { request, pending } = useDeviceLocation();
  const [note, setNote] = useState<string | null>(null);

  async function allow() {
    const outcome = await request();
    if (outcome.status === "granted") {
      await onResolved("granted", { lat: outcome.lat, lon: outcome.lon });
      return;
    }
    if (outcome.status === "blocked") {
      setNote(copy.blocked);
      await onResolved("denied", null);
      return;
    }
    if (outcome.status === "denied") {
      await onResolved("denied", null);
      return;
    }
    setNote(copy.unavailable);
    await onResolved("denied", null);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 text-sm">
      <p>{copy.ask}</p>
      <p className="mt-1 text-xs text-muted-foreground">{copy.privacy}</p>
      {note && <p className="mt-2 text-xs text-primary">{note}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={allow}
          disabled={pending}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
        >
          {copy.allow}
        </button>
        <button
          type="button"
          onClick={() => onResolved("denied", null)}
          className="rounded-full border border-border px-4 py-1.5 text-xs"
        >
          {copy.deny}
        </button>
      </div>
    </div>
  );
}
