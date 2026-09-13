/** Large tappable option buttons used by the onboarding wizard and Preferences. */
import { Check } from "lucide-react";
import { BrandPicker } from "@/components/prefs/brand-picker";
import type { FieldDef, Option, TextDef } from "@/lib/prefs/questions";

const base =
  "flex min-h-12 items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors motion-reduce:transition-none";
const on = "border-primary bg-primary/5 font-medium text-foreground";
const off = "border-border bg-background hover:border-foreground/30";

function Chip({
  option,
  selected,
  onClick,
}: {
  option: Option;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={`${base} ${selected ? on : off}`}>
      <span>{option.label}</span>
      {selected && <Check className="size-4 shrink-0 text-primary" />}
    </button>
  );
}

export function SingleField({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div>
      {def.label && (
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {def.label}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {def.options.map((option) => (
          <Chip
            key={option.value}
            option={option}
            selected={value[0] === option.value}
            onClick={() => onChange(value[0] === option.value ? [] : [option.value])}
          />
        ))}
      </div>
    </div>
  );
}

export function MultiField({
  def,
  value,
  onChange,
  homeAirport,
  fullList,
}: {
  def: FieldDef;
  value: string[];
  onChange: (next: string[]) => void;
  /** Used to rank the brand short list to the customer's region. */
  homeAirport?: string;
  /** Settings shows the whole brand table; onboarding shows the short list. */
  fullList?: boolean;
}) {
  const toggle = (v: string) => {
    if (def.noneValue && v === def.noneValue) {
      onChange(value.includes(v) ? [] : [v]);
      return;
    }
    const without = value.filter((x) => x !== def.noneValue);
    onChange(without.includes(v) ? without.filter((x) => x !== v) : [...without, v]);
  };

  return (
    <div>
      {def.label && (
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {def.label}
        </p>
      )}
      {def.brandKind ? (
        <BrandPicker
          kind={def.brandKind}
          value={value}
          onChange={onChange}
          {...(homeAirport ? { homeAirport } : {})}
          {...(def.noneValue ? { noneValue: def.noneValue } : {})}
          fullList={Boolean(fullList)}
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {def.options.map((option) => (
            <Chip
              key={option.value}
              option={option}
              selected={value.includes(option.value)}
              onClick={() => toggle(option.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Free-text answer, e.g. accessibility needs or things to always avoid. */
export function TextField({
  def,
  value,
  onChange,
}: {
  def: TextDef;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {def.label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={def.placeholder}
        rows={3}
        maxLength={500}
        className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

export function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`${base} ${checked ? on : off}`}
    >
      <span>{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${
          checked ? "bg-primary" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-background transition-all motion-reduce:transition-none ${
            checked ? "left-4.5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
