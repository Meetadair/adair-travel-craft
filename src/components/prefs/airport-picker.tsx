/** Searchable "City (IATA)" home-airport picker. */
import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { airportByIata, airportLabel, findAirports } from "@/lib/prefs/airports";

export function AirportPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (iata: string) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => findAirports(query, 10), [query]);
  const selected = airportByIata(value);

  return (
    <div>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a city or airport code"
          aria-label="Search airports"
          className="w-full rounded-xl border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none focus:border-primary"
        />
      </label>

      {selected && (
        <p className="mt-3 text-sm text-muted-foreground">
          Flying from <span className="font-medium text-foreground">{airportLabel(selected)}</span>
        </p>
      )}

      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {results.map((airport) => {
          const active = airport.iata === value;
          return (
            <button
              key={airport.iata}
              type="button"
              onClick={() => onChange(airport.iata)}
              className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors motion-reduce:transition-none ${
                active
                  ? "border-primary bg-primary/5 font-medium"
                  : "border-border bg-background hover:border-foreground/30"
              }`}
            >
              <span>
                {airportLabel(airport)}
                <span className="block text-xs text-muted-foreground">
                  {airport.name} · {airport.country}
                </span>
              </span>
              {active && <Check className="size-4 shrink-0 text-primary" />}
            </button>
          );
        })}
        {!results.length && (
          <p className="text-sm text-muted-foreground">
            No airport matches that. Try the city name or the three-letter code.
          </p>
        )}
      </div>
    </div>
  );
}
