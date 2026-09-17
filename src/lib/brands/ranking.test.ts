import { describe, expect, it } from "vitest";
import { BRAND_SEED, regionForAirport } from "./catalogue";
import { brandsInSameGroup, earnsOnBrandGroup, rankBrands, searchBrands } from "./ranking";

const ids = (list: { id: string }[]) => list.map((b) => b.id);

describe("regionForAirport", () => {
  it("puts Warsaw in Europe and New York in the US", () => {
    expect(regionForAirport("WAW")).toBe("eu");
    expect(regionForAirport("JFK")).toBe("us");
  });
  it("falls back to Europe for an unknown or missing airport", () => {
    expect(regionForAirport("ZZZ")).toBe("eu");
    expect(regionForAirport(null)).toBe("eu");
  });
});

describe("rankBrands — region relevance", () => {
  it("shows European carriers first for a Warsaw customer", () => {
    const list = ids(rankBrands(BRAND_SEED, { kind: "airline", region: "eu", limit: 14 }));
    expect(list).toContain("lot");
    expect(list).toContain("lufthansa");
    expect(list).not.toContain("southwest");
  });
  it("shows US carriers first for a New York customer", () => {
    const list = ids(rankBrands(BRAND_SEED, { kind: "airline", region: "us", limit: 14 }));
    expect(list).toContain("delta");
    expect(list).toContain("southwest");
    expect(list.indexOf("delta")).toBeLessThan(14);
    expect(list).not.toContain("ryanair");
  });
  it("keeps the short list short but always keeps an already-chosen brand", () => {
    const list = rankBrands(BRAND_SEED, {
      kind: "airline",
      region: "us",
      limit: 12,
      selected: ["ryanair"],
    });
    expect(list.length).toBe(13);
    expect(ids(list)).toContain("ryanair");
  });
  it("ranks hotel groups and rental companies by region too", () => {
    expect(ids(rankBrands(BRAND_SEED, { kind: "car_rental", region: "eu", limit: 8 }))).toContain(
      "europcar",
    );
    expect(ids(rankBrands(BRAND_SEED, { kind: "car_rental", region: "us", limit: 8 }))).toContain(
      "enterprise",
    );
    expect(
      ids(rankBrands(BRAND_SEED, { kind: "hotel_chain", region: "eu", limit: 15 })).length,
    ).toBe(15);
  });
  it("never mixes kinds", () => {
    const list = rankBrands(BRAND_SEED, { kind: "hotel_chain", region: "eu" });
    expect(list.every((b) => b.kind === "hotel_chain")).toBe(true);
  });
});

describe("searchBrands", () => {
  it("finds anything in the full table, not just the short list", () => {
    expect(ids(searchBrands(BRAND_SEED, { kind: "airline", query: "hawaii" }))).toEqual([
      "hawaiian",
    ]);
    expect(ids(searchBrands(BRAND_SEED, { kind: "hotel_chain", query: "raffles" }))).toContain(
      "raffles",
    );
    expect(ids(searchBrands(BRAND_SEED, { kind: "car_rental", query: "panek" }))).toEqual([
      "panek",
    ]);
  });
  it("matches by alliance or owning group", () => {
    const star = ids(
      searchBrands(BRAND_SEED, { kind: "airline", query: "star alliance", limit: 50 }),
    );
    expect(star).toContain("lot");
    expect(star).toContain("united");
    expect(star).not.toContain("delta");
  });
  it("ignores accents and punctuation", () => {
    expect(ids(searchBrands(BRAND_SEED, { kind: "hotel_chain", query: "melia" }))).toContain(
      "melia",
    );
    expect(ids(searchBrands(BRAND_SEED, { kind: "hotel_chain", query: "ritz carlton" }))).toContain(
      "ritzcarlton",
    );
  });
});

describe("group spread for loyalty", () => {
  it("counts Marriott's brands when Marriott is chosen", () => {
    const group = ids(brandsInSameGroup(BRAND_SEED, "marriott"));
    expect(group).toContain("westin");
    expect(group).toContain("ritzcarlton");
    expect(group).not.toContain("hilton");
  });
  it("counts the rest of Star Alliance when LOT is chosen", () => {
    const group = ids(brandsInSameGroup(BRAND_SEED, "lot"));
    expect(group).toContain("lufthansa");
    expect(group).toContain("united");
    expect(group).not.toContain("delta");
  });
  it("matches a supplier name against the whole group", () => {
    expect(earnsOnBrandGroup(BRAND_SEED, "marriott", "Le Méridien Warsaw")).toBe(true);
    expect(earnsOnBrandGroup(BRAND_SEED, "marriott", "Hotel Bristol")).toBe(false);
    expect(earnsOnBrandGroup(BRAND_SEED, "hertz", "Thrifty · Compact")).toBe(true);
    expect(earnsOnBrandGroup(BRAND_SEED, "hertz", null)).toBe(false);
  });
  it("returns just the brand itself when it belongs to no group", () => {
    expect(ids(brandsInSameGroup(BRAND_SEED, "wizz"))).toEqual(["wizz"]);
  });
});
