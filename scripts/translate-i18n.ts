/**
 * Generates src/lib/i18n/locales/<code>.json from the English source dictionary.
 * Run with: bun scripts/translate-i18n.ts [locale...]
 */
import { writeFile } from "node:fs/promises";
import { en } from "../src/lib/i18n/locales/en";

const LOCALES: Record<string, string> = {
  de: "German",
  ja: "Japanese",
  uk: "Ukrainian",
  zh: "Simplified Chinese",
  es: "Spanish (Spain)",
  pt: "Portuguese (European)",
  fr: "French",
  it: "Italian",
  sr: "Serbian (Latin script)",
  fi: "Finnish",
  no: "Norwegian (Bokmal)",
  sv: "Swedish",
  pl: "Polish",
};

const apiKey = process.env["ANTHROPIC_API_KEY"];
if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

function shapeOf(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shapeOf);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, shapeOf(v)]),
    );
  }
  return typeof value;
}

function sameShape(a: unknown, b: unknown, path = ""): string[] {
  const sa = JSON.stringify(shapeOf(a));
  const sb = JSON.stringify(shapeOf(b));
  return sa === sb ? [] : [`shape mismatch at ${path || "root"}`];
}

async function translate(code: string, language: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 16000,
      system:
        `You localize marketing and product UI copy for a premium AI travel assistant called Adair. ` +
        `Translate every string value of the given JSON into ${language}. ` +
        `Rules: keep the JSON structure, keys, array order and array length EXACTLY the same. ` +
        `Do NOT translate: brand and product names (Adair, Skyscanner, Booking.com, Uber, OpenTable, LOT, ` +
        `Lufthansa, Air France, Hyatt, Small Luxury Hotels, Park Hyatt Milano, BMW, Sixt, Linate, Duomo, NDC, PDF, VAT, EUR), ` +
        `airport/IATA codes, booking references, dates, numbers and prices. ` +
        `Keep the tone calm, warm and premium — not corporate, not shouty. Keep copy roughly as short as the English. ` +
        `Preserve punctuation marks such as the middot separator and the arrow. Return ONLY the JSON object.`,
      messages: [{ role: "user", content: JSON.stringify(en) }],
    }),
  });
  if (!res.ok) throw new Error(`${code}: anthropic ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { content?: Array<{ text?: string }> };
  const raw = (json.content?.[0]?.text ?? "{}").trim();
  // Claude sometimes wraps the JSON in a ```json fence despite being asked
  // not to; stripping it here is cheaper than a retry loop.
  const unfenced = raw.startsWith("```")
    ? raw.replace(/^```[a-z]*\n/i, "").replace(/```\s*$/, "")
    : raw;
  const parsed = JSON.parse(unfenced);
  const problems = sameShape(en, parsed);
  if (problems.length) throw new Error(`${code}: ${problems.join(", ")}`);
  await writeFile(
    new URL(`../src/lib/i18n/locales/${code}.json`, import.meta.url),
    JSON.stringify(parsed, null, 2) + "\n",
  );
  console.log(`ok ${code}`);
}

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LOCALES);
const results = await Promise.allSettled(
  wanted.map((code) => {
    const language = LOCALES[code];
    if (!language) throw new Error(`unknown locale ${code}`);
    return translate(code, language);
  }),
);
const failed = results.filter((r) => r.status === "rejected");
for (const f of failed) console.error(String((f as PromiseRejectedResult).reason));
if (failed.length) process.exit(1);
