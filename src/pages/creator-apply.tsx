/** Apply to the creator programme. Approval happens in admin, never here. */
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { applyAsCreator, getCreatorDashboard } from "@/lib/creators.functions";
import { AppFooter } from "@/components/app-footer";

const NETWORKS = ["instagram", "tiktok", "youtube", "blog"] as const;

export function CreatorApplyPage() {
  const apply = useServerFn(applyAsCreator);
  const fetchDashboard = useServerFn(getCreatorDashboard);
  const existing = useQuery({ queryKey: ["creator-self"], queryFn: () => fetchDashboard({}) });

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [iban, setIban] = useState("");
  const [entity, setEntity] = useState("");
  const [vatStatus, setVatStatus] = useState("");
  const [licence, setLicence] = useState(false);

  const submit = useMutation({
    mutationFn: () =>
      apply({
        data: {
          displayName,
          handle,
          bio: bio || undefined,
          platforms: NETWORKS.filter((n) => links[n]?.trim()).map((n) => ({
            network: n,
            url: links[n]!.trim(),
          })),
          payoutIban: iban || undefined,
          payoutEntity: entity || undefined,
          payoutVatStatus: vatStatus || undefined,
          acceptLicence: true,
        },
      }),
    onSuccess: () => existing.refetch(),
  });

  const already = existing.data?.creator;
  const field =
    "mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Creator programme</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You earn a share of what we earn, only when someone books. Nobody can pay to be
          recommended, and you cannot pay to be listed — that is what makes your picks worth
          reading.
        </p>

        {already && (
          <section className="hairline-card mt-8 p-5">
            <p className="text-sm">
              Your application is <span className="font-medium">{already.status}</span>.
            </p>
            {already.reviewNote && (
              <p className="mt-2 text-sm text-muted-foreground">{already.reviewNote}</p>
            )}
            <Link to="/creator" className="mt-4 inline-block text-sm font-medium text-primary">
              Go to your creator page
            </Link>
          </section>
        )}

        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit.mutate();
          }}
        >
          <label className="block text-sm">
            Your name
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={field}
            />
          </label>
          <label className="block text-sm">
            Handle (your link will be /c/your-handle)
            <input
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className={field}
              placeholder="kitti-travels"
            />
          </label>
          <label className="block text-sm">
            About you
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={field}
            />
          </label>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Where you publish</legend>
            {NETWORKS.map((network) => (
              <label key={network} className="block text-sm capitalize">
                {network}
                <input
                  type="url"
                  value={links[network] ?? ""}
                  onChange={(e) => setLinks((prev) => ({ ...prev, [network]: e.target.value }))}
                  className={field}
                  placeholder="https://"
                />
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Payout details</legend>
            <p className="text-xs text-muted-foreground">
              Stored encrypted. Only the last four digits are ever shown again.
            </p>
            <label className="block text-sm">
              IBAN
              <input value={iban} onChange={(e) => setIban(e.target.value)} className={field} />
            </label>
            <label className="block text-sm">
              Who invoices us (your name or company)
              <input value={entity} onChange={(e) => setEntity(e.target.value)} className={field} />
            </label>
            <label className="block text-sm">
              VAT status
              <input
                value={vatStatus}
                onChange={(e) => setVatStatus(e.target.value)}
                className={field}
                placeholder="VAT registered / not registered"
              />
            </label>
          </fieldset>

          <section className="hairline-card p-5">
            <h2 className="text-sm font-medium">Content licence</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Placeholder for counsel. In short: you keep your work, and you allow us to show your
              photos and words in the app and the weekly email, with credit to you.
            </p>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={licence}
                onChange={(e) => setLicence(e.target.checked)}
                className="mt-1"
              />
              I accept the content licence.
            </label>
          </section>

          <button
            type="submit"
            disabled={!licence || submit.isPending}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submit.isPending ? "Sending…" : already ? "Update application" : "Apply"}
          </button>
          {submit.isError && (
            <p className="text-sm text-primary">
              That did not go through. Check your handle and links, then try again.
            </p>
          )}
          {submit.isSuccess && (
            <p className="text-sm text-muted-foreground">
              Received. We review applications by hand.
            </p>
          )}
        </form>
      </main>
      <AppFooter />
    </div>
  );
}
