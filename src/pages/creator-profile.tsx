/** Public creator page: their approved picks, each labelled as creator content. */
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { SiteNav } from "@/components/site-nav";
import { getCreatorProfile, recordCreatorClick } from "@/lib/creators.functions";
import { AppFooter } from "@/components/app-footer";

export const CREATOR_STORAGE_KEY = "adair.creator";

export function CreatorProfilePage({ handle }: { handle: string }) {
  const fetchProfile = useServerFn(getCreatorProfile);
  const click = useServerFn(recordCreatorClick);
  const profile = useQuery({
    queryKey: ["creator-profile", handle],
    queryFn: () => fetchProfile({ data: { handle } }),
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(CREATOR_STORAGE_KEY, handle);
    } catch {
      // Private browsing can refuse storage; the visit simply is not remembered.
    }
    void click({ data: { handle, source: "profile" } }).catch(() => undefined);
  }, [handle, click]);

  const data = profile.data;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-12">
        {profile.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {profile.isSuccess && !data && (
          <>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Not found</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              This creator page is not available.
            </p>
          </>
        )}

        {data && (
          <>
            <header className="flex items-center gap-4">
              {data.avatarUrl && (
                <img
                  src={data.avatarUrl}
                  alt={data.displayName}
                  width={64}
                  height={64}
                  loading="lazy"
                  className="size-16 rounded-full border border-border object-cover"
                />
              )}
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                  {data.displayName}
                </h1>
                <p className="text-xs text-muted-foreground">Creator partner</p>
              </div>
            </header>

            {data.bio && <p className="mt-4 text-sm text-muted-foreground">{data.bio}</p>}

            {data.platforms.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {data.platforms.map((platform) => (
                  <li key={platform.url}>
                    <a
                      href={platform.url}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="rounded-xl border border-border px-3 py-1.5 text-xs capitalize"
                    >
                      {platform.network}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <h2 className="mt-10 text-sm font-medium">Their picks</h2>
            {data.picks.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">No approved picks yet.</p>
            )}
            <ul className="mt-3 space-y-4">
              {data.picks.map((pick) => (
                <li key={pick.id} className="hairline-card p-5">
                  <p className="font-medium">
                    {pick.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {pick.kind}
                      {pick.destination ? ` · ${pick.destination}` : ""}
                    </span>
                  </p>
                  {pick.whyThisOne && <p className="mt-2 text-sm">{pick.whyThisOne}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Recommended by {data.displayName} · Creator partner
                    {pick.visitedOn ? ` · visited ${pick.visitedOn}` : ""}
                  </p>
                  {pick.photos.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {pick.photos.map((photo) => (
                        <img
                          key={photo}
                          src={photo}
                          alt={pick.name}
                          width={240}
                          height={160}
                          loading="lazy"
                          className="h-28 w-40 shrink-0 rounded-xl border border-border object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {pick.postUrl && (
                    <a
                      href={pick.postUrl}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="mt-3 inline-block text-sm font-medium text-primary"
                    >
                      Read their post
                    </a>
                  )}
                </li>
              ))}
            </ul>

            <p className="mt-10 text-xs text-muted-foreground">
              Creators earn only when someone books. No place can pay to appear here.
            </p>
          </>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
