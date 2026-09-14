/**
 * Business trips — the overlay editor.
 *
 * One card, a handful of fields, and only the fields that actually change when
 * the company pays: cabin, hotel style and distance, the car. Everything left
 * empty falls through to the person's own preferences, and the card says so —
 * a second full questionnaire is exactly what this design avoids.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAccount, saveBusinessPrefs, type BusinessPrefsPayload } from "@/lib/account.functions";

const field =
  "mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary";
const label = "text-xs font-medium text-muted-foreground";

const CABINS = [
  ["", "Same as my usual"],
  ["economy", "Economy"],
  ["premium_economy", "Premium economy"],
  ["business", "Business"],
  ["first", "First"],
] as const;

const HOTEL_STYLES = [
  ["", "Same as my usual"],
  ["chain", "Reliable chain"],
  ["business", "Business hotel"],
  ["boutique", "Boutique"],
  ["apartment", "Apartment"],
] as const;

const CAR_CLASSES = [
  ["", "Same as my usual"],
  ["compact", "Compact"],
  ["intermediate", "Intermediate"],
  ["executive", "Executive"],
  ["no-car", "No car on business trips"],
] as const;

export function BusinessTrips() {
  const queryClient = useQueryClient();
  const fetchAccount = useServerFn(getAccount);
  const save = useServerFn(saveBusinessPrefs);

  const account = useQuery({ queryKey: ["account"], queryFn: () => fetchAccount() });

  const [cabin, setCabin] = useState("");
  const [hotelStyle, setHotelStyle] = useState("");
  const [maxKm, setMaxKm] = useState("");
  const [carClass, setCarClass] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (loaded || !account.data) return;
    const overlay = account.data.businessPrefs;
    setCabin(overlay.cabinClass ?? "");
    setHotelStyle(overlay.hotelTypes?.[0] ?? "");
    setMaxKm(overlay.hotelMaxKm ? String(overlay.hotelMaxKm) : "");
    setCarClass(overlay.carClass ?? "");
    setLoaded(true);
  }, [account.data, loaded]);

  const mutation = useMutation({
    mutationFn: () => {
      const overlay: BusinessPrefsPayload = {};
      if (
        cabin === "economy" ||
        cabin === "premium_economy" ||
        cabin === "business" ||
        cabin === "first"
      ) {
        overlay.cabinClass = cabin;
      }
      if (hotelStyle) overlay.hotelTypes = [hotelStyle];
      const km = Number(maxKm);
      if (maxKm && Number.isFinite(km) && km >= 1)
        overlay.hotelMaxKm = Math.min(50, Math.round(km));
      if (carClass) overlay.carClass = carClass;
      return save({ data: { overlay } });
    },
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ["account"] });
    },
  });

  return (
    <section className="hairline-card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Business trips</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          When a trip is for work — a meeting in the sentence, or the invoice going to a company —
          these take over. Anything left on &quot;same as my usual&quot; simply uses your normal
          preferences.
        </p>
      </div>

      <label className="block">
        <span className={label}>Cabin on work trips</span>
        <select value={cabin} onChange={(e) => setCabin(e.target.value)} className={field}>
          {CABINS.map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={label}>Hotel style</span>
        <select
          value={hotelStyle}
          onChange={(e) => setHotelStyle(e.target.value)}
          className={field}
        >
          {HOTEL_STYLES.map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={label}>Hotel at most (km from the centre or the meeting)</span>
        <input
          value={maxKm}
          onChange={(e) => setMaxKm(e.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          placeholder="Same as my usual"
          className={field}
        />
      </label>

      <label className="block">
        <span className={label}>Car</span>
        <select value={carClass} onChange={(e) => setCarClass(e.target.value)} className={field}>
          {CAR_CLASSES.map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          Save business preferences
        </button>
        {saved && !mutation.isPending && (
          <span className="text-xs text-muted-foreground">Saved.</span>
        )}
      </div>
    </section>
  );
}
