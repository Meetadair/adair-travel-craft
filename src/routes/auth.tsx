import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Adair account — sign in or sign up" },
      {
        name: "description",
        content:
          "Sign in to Adair Travel to store your trips, preferences, and download PDF invoices.",
      },
      { property: "og:title", content: "Adair account — sign in or sign up" },
      {
        property: "og:description",
        content: "Your trips, preferences, and invoices in one client dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
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
        setMessage("Check your inbox — we've sent you a confirmation link.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-md px-6 py-20">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {mode === "signin" ? "Sign in" : "Create an account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your trips, preferences, and invoices in one place.
        </p>

        <form onSubmit={submit} className="hairline-card mt-8 space-y-4 p-6">
          {mode === "signup" && (
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Full name</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
                autoComplete="name"
              />
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
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
            {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Sign up"}
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
          {mode === "signin" ? "I don't have an account yet" : "I already have an account"}
        </button>

        <p className="mt-8 text-xs text-muted-foreground">
          Prefer to see a demo first?{" "}
          <Link to="/assistant" className="text-primary">
            Open the assistant
          </Link>
        </p>
      </main>
    </div>
  );
}
