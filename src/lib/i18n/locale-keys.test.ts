import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { en } from "./locales/en";

/**
 * There is no fallback merging: a key missing from a locale renders as empty
 * space, not as English. Twelve locales were shipping a date picker with a
 * blank "nights" label and no instruction to pick a return day, and nothing
 * caught it — the types are satisfied by a partial object because each locale
 * is loaded as JSON.
 */

const DIR = join(import.meta.dirname, "locales");

function controlsBlocks(value: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) controlsBlocks(item, out);
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const controls = record["controls"];
    if (controls && typeof controls === "object") out.push(controls as Record<string, unknown>);
    for (const nested of Object.values(record)) controlsBlocks(nested, out);
  }
  return out;
}

const expected = controlsBlocks(en);
const wanted = Object.keys(expected[0] ?? {});

describe("locale completeness", () => {
  it("knows which keys the English controls block defines", () => {
    expect(wanted.length).toBeGreaterThan(10);
  });

  const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));

  it("has locale files to check", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    it(`${file} defines every assistant control string`, () => {
      const data = JSON.parse(readFileSync(join(DIR, file), "utf8"));
      const blocks = controlsBlocks(data);
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        const missing = wanted.filter((key) => !(key in block));
        expect(missing, `${file} is missing: ${missing.join(", ")}`).toEqual([]);
        const blank = wanted.filter((key) => String(block[key] ?? "").trim() === "");
        expect(blank, `${file} has blank values: ${blank.join(", ")}`).toEqual([]);
      }
    });
  }
});
