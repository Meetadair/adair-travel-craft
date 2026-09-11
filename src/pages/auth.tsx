import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { LocaleLink, useLocale, useT } from "@/lib/i18n";

export function AuthPage() {
  const navigate = useNavigate();
  const t = useT();
  const locale = useLocale();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          navigate({ to: "/dashboard" });
          return;
        }
        setMessage(t.auth.confirmSent);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.genericError);
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-md px-6 py-20">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {mode === "signin" ? t.auth.signInTitle : t.auth.signUpTitle}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.auth.lead}</p>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={async () => {
              setError(null);
              setMessage(null);
              try {
                const { lovable } = await import("@/integrations/lovable");
                await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin,
                });
              } catch (err) {
                setError(err instanceof Error ? err.message : t.auth.genericError);
              }
            }}
            className="w-full rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-secondary"
          >
            Continue with Google
          </button>
          <button
            type="button"
            disabled={busy || !email}
            onClick={async () => {
              setBusy(true);
              setError(null);
              setMessage(null);
              try {
                const { error: linkError } = await supabase.auth.signInWithOtp({
                  email,
                  options: { emailRedirectTo: window.location.origin },
                });
                if (linkError) throw linkError;
                setMessage("Check your inbox — we've sent you a sign-in link.");
              } catch (err) {
                setError(err instanceof Error ? err.message : t.auth.genericError);
              } finally {
                setBusy(false);
              }
            }}
            className="w-full rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
          >
            Email me a sign-in link
          </button>
          <p className="text-xs text-muted-foreground">
            Type your email below first, then use the link button.
          </p>
        </div>

        <form onSubmit={submit} className="hairline-card mt-6 space-y-4 p-6">
          {mode === "signup" && (
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">{t.auth.fullName}</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                autoComplete="name"
              />
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">{t.auth.email}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">{t.auth.password}</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>

          {error && <p className="text-sm text-primary">{error}</p>}
          {message && <p className="text-sm text-muted-foreground">{message}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? t.auth.submitBusy : mode === "signin" ? t.auth.signIn : t.auth.signUp}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setMessage(null);
          }}
          className="mt-5 text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
        >
          {mode === "signin" ? t.auth.toSignUp : t.auth.toSignIn}
        </button>

        <p className="mt-8 text-xs text-muted-foreground">
          {t.auth.demoHint}{" "}
          <LocaleLink to="/assistant" locale={locale} className="text-primary">
            {t.auth.demoLink}
          </LocaleLink>
        </p>
      </main>
    </div>
  );
}
