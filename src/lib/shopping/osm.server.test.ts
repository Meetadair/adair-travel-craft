import { describe, expect, it } from "vitest";
import { categoryFromTags, toShop } from "./osm.server";

const from = { lat: 52.2297, lon: 21.0122 };

describe("categoryFromTags", () => {
  it("maps mall and department_store to mall", () => {
    expect(categoryFromTags({ shop: "mall" })).toBe("mall");
    expect(categoryFromTags({ shop: "department_store" })).toBe("mall");
  });

  it("maps marketplace amenity and variety_store to market", () => {
    expect(categoryFromTags({ amenity: "marketplace" })).toBe("market");
    expect(categoryFromTags({ shop: "variety_store" })).toBe("market");
  });

  it("maps clothes/shoes/jewelry to boutique", () => {
    expect(categoryFromTags({ shop: "clothes" })).toBe("boutique");
    expect(categoryFromTags({ shop: "shoes" })).toBe("boutique");
    expect(categoryFromTags({ shop: "jewelry" })).toBe("boutique");
  });

  it("maps gift/toys to gifts", () => {
    expect(categoryFromTags({ shop: "gift" })).toBe("gifts");
    expect(categoryFromTags({ shop: "toys" })).toBe("gifts");
  });

  it("maps books/art/antiques/craft/second_hand to books_art", () => {
    expect(categoryFromTags({ shop: "books" })).toBe("books_art");
    expect(categoryFromTags({ shop: "art" })).toBe("books_art");
  });

  it("returns null for an untagged or irrelevant shop", () => {
    expect(categoryFromTags({ shop: "supermarket" })).toBeNull();
    expect(categoryFromTags({})).toBeNull();
  });
});

describe("toShop", () => {
  const element = {
    type: "node",
    id: 1,
    lat: 52.23,
    lon: 21.02,
    tags: {
      name: "Złote Tarasy",
      shop: "mall",
      "addr:street": "Złota",
      "addr:housenumber": "59",
      website: "https://zlotetarasy.pl",
      opening_hours: "Mo-Su 09:00-22:00",
    },
  };

  it("maps a full element", () => {
    const shop = toShop(element, from);
    expect(shop).toMatchObject({
      id: "osm:node/1",
      name: "Złote Tarasy",
      category: "mall",
      address: "Złota 59",
      website: "https://zlotetarasy.pl",
      openingHours: "Mo-Su 09:00-22:00",
    });
    expect(shop?.distanceKm).toBeGreaterThan(0);
  });

  it("drops an element with no name", () => {
    const { name: _name, ...noName } = element.tags;
    expect(toShop({ ...element, tags: noName }, from)).toBeNull();
  });

  it("drops an element whose shop tag maps to no category", () => {
    expect(toShop({ ...element, tags: { ...element.tags, shop: "supermarket" } }, from)).toBeNull();
  });

  it("uses the way center when lat/lon are absent", () => {
    const way = { type: "way", id: 2, center: { lat: 52.24, lon: 21.03 }, tags: element.tags };
    const shop = toShop(way, from);
    expect(shop?.id).toBe("osm:way/2");
    expect(shop?.distanceKm).not.toBeNull();
  });

  it("leaves distance null when coordinates are missing", () => {
    const noCoords = { type: "node", id: 3, tags: element.tags };
    expect(toShop(noCoords, from)?.distanceKm).toBeNull();
  });
});
