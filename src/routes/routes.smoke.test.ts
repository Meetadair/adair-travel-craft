/**
 * Smoke test: every route module must load without throwing and must export a
 * usable Route. A page route needs a component; a server route needs handlers.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src/routes");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return routeFiles(full);
    if (!/\.tsx?$/.test(entry)) return [];
    if (/\.test\.tsx?$/.test(entry)) return [];
    return [full];
  });
}

const files = routeFiles(ROOT);

describe("route modules", () => {
  it("finds the route tree", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    const name = relative(process.cwd(), file);
    // Transforming a heavy route for the first time can take several seconds on a
    // cold machine, and the assistant route is the heaviest of them. A timeout
    // here says the laptop was busy, not that the route is broken — and a suite
    // that fails for that reason stops being believed.
    it(`loads ${name}`, { timeout: 30_000 }, async () => {
      const mod = (await import(/* @vite-ignore */ file)) as Record<string, unknown>;
      const route = mod["Route"] as
        | { options?: { component?: unknown; server?: unknown; loader?: unknown } }
        | undefined;
      expect(route, `${name} must export Route`).toBeTruthy();
      const options = route!.options ?? {};
      const isServerRoute = name.includes("/api/");
      if (isServerRoute) {
        expect(options.server, `${name} must define server handlers`).toBeTruthy();
      } else {
        expect(
          options.component ?? options.loader,
          `${name} must render something`,
        ).toBeTruthy();
      }
    });
  }
});
