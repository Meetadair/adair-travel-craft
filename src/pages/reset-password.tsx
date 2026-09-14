/**
 * Resetting a password.
 *
 * Two states on one screen. Arriving normally, the traveller asks for a link.
 * Arriving from that link, Supabase has already put them in a recovery session
 * and they set the new password here.
 *
 * The reply to "send me a link" never says whether the address has an account —
 * that would let anyone probe who is registered. But when email is not
 * configured at all, we say so plainly rather than pretending it went.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { AppFooter } from "@/components/app-footer";
import { LocaleLink, localeHref, useLocale, useT } from "@/lib/i18n";

const inputClass =
  "mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

const buttonClass =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60";

export function ResetPasswordPage() {
  const t = useT();
  const locale = useLocale();
  const navigate = useNavigate();

  /** Set once Supabase reports a recovery session from the emailed link. */
  const [recovering, setRecovering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    // A reload after the link was followed still has the session.
    void supabase.auth.getSession().then(({ data: session }) => {
      if (session.session && window.location.hash.includes("type=recovery")) {
        setRecovering(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${localeHref(locale, "/reset-password")}`,
      });
      // No mail transport configured is a real failure, and saying "check your
      // inbox" would be a lie the traveller discovers twenty minutes later.
      if (sendError) {
        const detail = sendError.message.toLowerCase();
        setError(
          detail.includes("smtp") || detail.includes("email")
            ? t.auth.resetNoEmail
            : sendError.message,
        );
        return;
      }
      setMessage(t.auth.resetSent);
    } catch {
      setError(t.auth.genericError);
    } finally {
      setBusy(false);
    }
  }

  async function saveNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(
          updateError.message.toLowerCase().includes("session")
            ? t.auth.newPasswordExpired
            : updateError.message,
        );
        return;
      }
      setMessage(t.auth.newPasswordSaved);
      navigate({ href: localeHref(locale, "/assistant") });
    } catch {
      setError(t.auth.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-md px-6 py-20">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {recovering ? t.auth.newPasswordTitle : t.auth.resetTitle}
        </h1>

        {recovering ? (
          <form onSubmit={saveNewPassword} className="mt-8 space-y-5">
            <label className="block text-sm">
              {t.auth.newPassword}
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
              />
            </label>
            {error && <p className="text-sm text-primary">{error}</p>}
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <button type="submit" disabled={busy} className={buttonClass}>
              {busy ? t.auth.submitBusy : t.auth.newPasswordSave}
            </button>
          </form>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.auth.resetLead}</p>
            <form onSubmit={sendLink} className="mt-8 space-y-5">
              <label className="block text-sm">
                {t.auth.email}
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputClass}
                />
              </label>
              {error && <p className="text-sm text-primary">{error}</p>}
              {message && <p className="text-sm text-muted-foreground">{message}</p>}
              <button type="submit" disabled={busy} className={buttonClass}>
                {busy ? t.auth.submitBusy : t.auth.resetSend}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-sm">
          <LocaleLink
            to="/auth"
            locale={locale}
            className="text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
          >
            {t.auth.backToSignIn}
          </LocaleLink>
        </p>
      </main>
      <AppFooter />
    </div>
  );
}
