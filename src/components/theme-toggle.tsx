/**
 * The two ways to change the theme: a labelled three-way control for Settings,
 * and a one-tap icon in the header for when the room gets bright.
 *
 * Both write the same stored choice, so they can never disagree.
 */
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { useTheme, type ThemeChoice } from "@/lib/theme";

const OPTIONS: Record<ThemeChoice, { label: string; Icon: LucideIcon }> = {
  light: { label: "Light", Icon: Sun },
  dark: { label: "Dark", Icon: Moon },
  system: { label: "System", Icon: Monitor },
};

/** Reading order of the control, and the order the header button cycles in. */
const ORDER: ThemeChoice[] = ["light", "dark", "system"];

/**
 * Segmented three-way control, sized like the option chips elsewhere in
 * Settings but on a single row: the three states are mutually exclusive and
 * short enough to read side by side.
 */
export function ThemeToggle() {
  const { choice, setChoice } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex w-full max-w-sm items-center gap-1 rounded-xl border border-border bg-background p-1"
    >
      {ORDER.map((value) => {
        const { label, Icon } = OPTIONS[value];
        const selected = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setChoice(value)}
            className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors motion-reduce:transition-none ${
              selected
                ? "bg-primary/10 font-medium text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon className={`size-4 shrink-0 ${selected ? "text-primary" : ""}`} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Header version: one icon, cycling Light → Dark → System. There is no room
 * for three labels next to the language switcher, and anyone who wants to see
 * all three states at once has them in Settings. The icon shows the choice
 * rather than what it currently resolves to, so "System" stays visible as a
 * state of its own instead of masquerading as whichever one it picked.
 */
export function ThemeNavToggle() {
  const { choice, setChoice } = useTheme();
  const { label, Icon } = OPTIONS[choice];
  const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length] ?? "system";

  return (
    <button
      type="button"
      onClick={() => setChoice(next)}
      aria-label={`Theme: ${label}. Switch to ${OPTIONS[next].label}.`}
      title={`Theme: ${label}`}
      className="inline-flex items-center rounded-lg px-2.5 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Icon className="size-4" />
    </button>
  );
}
