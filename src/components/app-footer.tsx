/** Small footer for the signed-in app: help and the legal pages. */
import { Link } from "@tanstack/react-router";

export function AppFooter() {
  const cls =
    "text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground";
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-4 px-6 py-8">
        <Link to="/support" className={cls}>
          Help
        </Link>
        <Link to="/privacy" className={cls}>
          Privacy
        </Link>
        <Link to="/terms" className={cls}>
          Terms
        </Link>
        <span className="text-xs text-muted-foreground">© Adair</span>
      </div>
    </footer>
  );
}
