/** Placeholder legal pages. The wording itself is for counsel to write. */
import { SiteNav } from "@/components/site-nav";

const SECTIONS: Record<"privacy" | "terms", { title: string; intro: string; headings: string[] }> = {
  privacy: {
    title: "Privacy",
    intro:
      "This page sets out how Adair handles your data. The wording below is an outline; the final text is to be completed by counsel.",
    headings: [
      "Who we are and how to reach us",
      "What data we collect and why",
      "Travel suppliers we share a booking with",
      "How long we keep records, and what tax law requires us to keep",
      "Your rights: access, export, correction, deletion",
      "Calendar access and how to withdraw it",
      "Payments — card details are handled by our payment provider and never stored by us",
      "Cookies and analytics",
      "Complaints and supervisory authority",
    ],
  },
  terms: {
    title: "Terms",
    intro:
      "These are the terms that apply when you book through Adair. The wording below is an outline; the final text is to be completed by counsel.",
    headings: [
      "The service Adair provides",
      "Your account and the accuracy of traveller details",
      "Prices, service fee and currency",
      "Payment and when the booking becomes binding",
      "Changes and cancellations, including supplier conditions and fees",
      "Travel documents, visas and passport requirements",
      "Insurance",
      "Liability and the role of the travel supplier",
      "Complaints, applicable law and jurisdiction",
    ],
  },
};

export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const section = SECTIONS[kind];
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{section.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{section.intro}</p>
        <p className="mt-6 rounded-xl border border-border px-4 py-3 text-sm">
          To be completed by counsel.
        </p>
        <ol className="mt-8 space-y-6">
          {section.headings.map((heading, i) => (
            <li key={heading}>
              <h2 className="font-display text-lg font-semibold">
                {i + 1}. {heading}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">To be completed by counsel.</p>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
