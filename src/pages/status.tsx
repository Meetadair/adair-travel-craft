import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteNav } from "@/components/site-nav";
import { getSystemStatus } from "@/lib/status.functions";

const DOT: Record<string, string> = {
  ok: "bg-primary",
  off: "bg-border",
  error: "bg-foreground",
};

export function StatusPage() {
  const fetchStatus = useServerFn(getSystemStatus);
  const status = useQuery({ queryKey: ["system-status"], queryFn: () => fetchStatus({}) });

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight">What is live</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A quick check of everything the assistant depends on.
        </p>

        {status.isLoading && <p className="mt-10 text-sm text-muted-foreground">Checking…</p>}
        {status.isError && (
          <p className="mt-10 text-sm text-primary">The check could not run right now.</p>
        )}

        {status.data && (
          <>
            <ul className="hairline-card mt-8 divide-y divide-border">
              {status.data.capabilities.map((item) => (
                <li key={item.name} className="flex items-center gap-4 px-5 py-4">
                  <span className={`size-2 rounded-full ${DOT[item.state] ?? "bg-border"}`} />
                  <span className="flex-1 text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{item.note}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Checked {new Date(status.data.checkedAt).toLocaleString()}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
