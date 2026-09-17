import { describe, expect, it } from "vitest";

import { asConsent, originClause, resolveLocation } from "./location";
import { TOOLS, currentLocationInput } from "./tools";
import { runTool } from "./tools.server";

const hotel = { name: "Le Bristol", lat: 48.872, lon: 2.315 };
const city = { name: "Paris", lat: 48.8566, lon: 2.3522 };
const ctx = { supabase: {} as never, userId: "user-1" };

describe("resolveLocation", () => {
  it("uses the device only when consent was given", () => {
    const granted = resolveLocation({
      device: { lat: 48.86, lon: 2.34 },
      consent: "granted",
      hotel,
      city,
    });
    expect(granted.source).toBe("device");

    const notAsked = resolveLocation({
      device: { lat: 48.86, lon: 2.34 },
      consent: "not_asked",
      hotel,
      city,
    });
    expect(notAsked.source).toBe("hotel");
  });

  it("falls back to the hotel when the device was refused", () => {
    const resolved = resolveLocation({ device: null, consent: "denied", hotel, city }, true);
    expect(resolved.source).toBe("hotel");
    expect(originClause(resolved)).toContain("your hotel");
  });

  it("never asks again after a refusal", () => {
    expect(resolveLocation({ device: null, consent: "denied", hotel, city }, true).askConsent).toBe(
      false,
    );
  });

  it("asks only when the question needs exact position", () => {
    expect(
      resolveLocation({ device: null, consent: "not_asked", hotel, city }, false).askConsent,
    ).toBe(false);
    expect(
      resolveLocation({ device: null, consent: "not_asked", hotel, city }, true).askConsent,
    ).toBe(true);
  });

  it("falls back to the city centre with no hotel booked", () => {
    const resolved = resolveLocation({ device: null, consent: "denied", hotel: null, city });
    expect(resolved.source).toBe("city");
    expect(originClause(resolved)).toContain("Paris");
  });

  it("admits it has no starting point at all", () => {
    const resolved = resolveLocation({
      device: null,
      consent: "not_asked",
      hotel: null,
      city: null,
    });
    expect(resolved.source).toBe("none");
  });
});

describe("asConsent", () => {
  it("treats anything unknown as never asked", () => {
    expect(asConsent("granted")).toBe("granted");
    expect(asConsent(null)).toBe("not_asked");
    expect(asConsent("maybe")).toBe("not_asked");
  });
});

describe("get_current_location tool", () => {
  it("is offered to the model with its source contract", () => {
    const tool = TOOLS.find((t) => t.name === "get_current_location");
    expect(tool?.description).toMatch(/always says which one/i);
  });

  it("defaults precise to false so permission is not asked by accident", () => {
    expect(currentLocationInput.parse({}).precise).toBe(false);
  });

  it("always reports the source it used", async () => {
    const device = JSON.parse(
      await runTool(
        "get_current_location",
        { precise: true },
        {
          ...ctx,
          location: { device: { lat: 48.86, lon: 2.34 }, consent: "granted", hotel, city },
        },
      ),
    );
    expect(device.source).toBe("device");

    const denied = JSON.parse(
      await runTool(
        "get_current_location",
        { precise: true },
        {
          ...ctx,
          location: { device: null, consent: "denied", hotel, city },
        },
      ),
    );
    expect(denied.source).toBe("hotel");
    expect(denied.say).toContain("your hotel");
    expect(denied.askConsent).toBe(false);

    const none = JSON.parse(
      await runTool(
        "get_current_location",
        {},
        {
          ...ctx,
          location: { device: null, consent: "not_asked", hotel: null, city: null },
        },
      ),
    );
    expect(none.ok).toBe(false);
    expect(none.source).toBe("none");
  });
});
