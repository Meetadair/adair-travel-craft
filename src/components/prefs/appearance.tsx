/**
 * Appearance — the only setting on this page that is not about travel, and the
 * only one stored in the browser rather than on the account. It is here anyway
 * because this is where people look for it.
 */
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/lib/theme";

export function Appearance() {
  const { choice, resolved } = useTheme();

  return (
    <section className="hairline-card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {choice === "system"
            ? `Following your device, which is currently ${resolved}.`
            : "Saved in this browser only — your other devices keep their own setting."}
        </p>
      </div>
      <ThemeToggle />
    </section>
  );
}
