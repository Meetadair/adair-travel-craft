/** Internal analytics, aggregated in SQL from data we already store. */
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { getAnalytics } from "@/lib/admin.functions";

type Row = Record<string, unknown>;

const num = (value: unknown) => (value == null ? 0 : Number(value));
const rows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);
const obj = (value: unknown): Row => (value && typeof value === "object" ? (value as Row) : {});

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Table({ head, body }: { head: string[]; body: Array<Array<string | number>> }) {
  if (body.length === 0)
    return <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>;
  return (
    <div className="hairline-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            {head.map((cell) => (
              <th key={cell} className="px-4 py-3 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {body.map((line, index) => (
            <tr key={index}>
              {line.map((cell, cellIndex) => (
                <td key={cellIndex} className="whitespace-nowrap px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminAnalyticsPage() {
  const fetchReport = useServerFn(getAnalytics);
  const report = useQuery({ queryKey: ["admin-analytics"], queryFn: () => fetchReport() });

  const data = report.data as Row | undefined;
  const funnel = rows(data?.["funnel"]);
  const onboarding = obj(data?.["onboarding"]);
  const searches = obj(data?.["searches"]);
  const feedback = obj(data?.["feedback"]);
  const match = obj(data?.["match"]);
  const bookings = obj(data?.["bookings"]);
  const errors = obj(data?.["errors"]);

  const label: Record<string, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days" };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Built from our own tables. No third-party service, no extra key.
        </p>

        {report.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
        {report.isError && (
          <p className="mt-8 flex items-center gap-2 text-sm text-primary">
            <ShieldAlert className="size-4" /> Admins only.
          </p>
        )}

        {data && (
          <>
            <Section title="Funnel" hint="Where people stop, step by step.">
              <Table
                head={["Window", "Typed", "Searched", "Cards", "Booking started", "Booked", "Drop-off"]}
                body={funnel.map((row) => {
                  const typed = num(row["typed"]);
                  const booked = num(row["booked"]);
                  const drop = typed > 0 ? `${Math.round(100 - (booked / typed) * 100)}%` : "—";
                  return [
                    label[String(row["label"])] ?? String(row["label"]),
                    typed,
                    num(row["searched"]),
                    num(row["cards"]),
                    num(row["booking_started"]),
                    booked,
                    drop,
                  ];
                })}
              />
            </Section>

            <Section title="Onboarding">
              <Table
                head={["Finished part 1", "Finished part 2", "Accounts", "Average completion", "Question losing most people"]}
                body={[
                  [
                    num(onboarding["part1"]),
                    num(onboarding["part2"]),
                    num(onboarding["total"]),
                    `${num(onboarding["avgPct"])}%`,
                    (() => {
                      const worst = obj(onboarding["worstQuestion"]);
                      return worst["question"]
                        ? `${String(worst["question"])} (${num(worst["drop_offs"])})`
                        : "—";
                    })(),
                  ],
                ]}
              />
            </Section>

            <Section title="Searches" hint="Last 30 days.">
              <Table
                head={["Destination", "Searches"]}
                body={rows(searches["destinations"]).map((row) => [
                  String(row["city"]),
                  num(row["searches"]),
                ])}
              />
              <div className="mt-4">
                <Table
                  head={["Average trip value", "Share flagged peak", "Cheaper dates accepted", "Dismissed"]}
                  body={[
                    [
                      `€${num(obj(searches["stats"])["avg_value"])}`,
                      `${num(obj(searches["stats"])["peak_share"])}%`,
                      num(obj(searches["cheaperDates"])["accepted"]),
                      num(obj(searches["cheaperDates"])["dismissed"]),
                    ],
                  ]}
                />
              </div>
            </Section>

            <Section
              title="Why people swap"
              hint="The most valuable data we have: what we proposed and why it was rejected."
            >
              <Table
                head={["Line", "Swaps"]}
                body={rows(feedback["byKind"]).map((row) => [
                  String(row["item_kind"]),
                  num(row["swaps"]),
                ])}
              />
              <div className="mt-4">
                <Table
                  head={["Reason given", "Times"]}
                  body={rows(feedback["reasons"]).map((row) => [
                    String(row["reason"]),
                    num(row["swaps"]),
                  ])}
                />
              </div>
            </Section>

            <Section title="Match quality">
              <Table
                head={["Line", "Average score", "Samples"]}
                body={rows(match["byKind"]).map((row) => [
                  String(row["kind"]),
                  num(row["avg_score"]),
                  num(row["samples"]),
                ])}
              />
              <div className="mt-4">
                <Table
                  head={["Preference we could not meet", "Times"]}
                  body={rows(match["unmet"]).map((row) => [String(row["reason"]), num(row["misses"])])}
                />
              </div>
            </Section>

            <Section title="Bookings" hint="Value and our margin, by day.">
              <Table
                head={["Day", "Bookings", "Value", "Our margin"]}
                body={rows(bookings["byDay"]).map((row) => [
                  String(row["day"]),
                  num(row["bookings"]),
                  `€${num(row["value"])}`,
                  `€${num(row["margin"])}`,
                ])}
              />
              <div className="mt-4">
                <Table
                  head={["Cancellation reason", "Times"]}
                  body={rows(bookings["cancellations"]).map((row) => [
                    String(row["reason"]),
                    num(row["cancels"]),
                  ])}
                />
              </div>
            </Section>

            <Section title="Failures">
              <Table
                head={["Failed search cause", "Times"]}
                body={rows(errors["searches"]).map((row) => [String(row["cause"]), num(row["hits"])])}
              />
              <div className="mt-4">
                <Table
                  head={["Failed booking cause", "Times"]}
                  body={rows(errors["bookings"]).map((row) => [
                    String(row["cause"]),
                    num(row["hits"]),
                  ])}
                />
              </div>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
