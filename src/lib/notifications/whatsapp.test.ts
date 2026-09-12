import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WHATSAPP_TEMPLATES,
  hasWhatsAppKeys,
  normalisePhone,
  sendWhatsAppTemplate,
} from "./whatsapp";

afterEach(() => {
  delete process.env['WHATSAPP_API_TOKEN'];
  delete process.env['WHATSAPP_PHONE_NUMBER_ID'];
  vi.unstubAllGlobals();
});

describe("normalisePhone", () => {
  it("keeps digits only", () => {
    expect(normalisePhone("+48 601 234 567")).toBe("48601234567");
  });
  it("rejects too short and too long", () => {
    expect(normalisePhone("1234")).toBeNull();
    expect(normalisePhone("1234567890123456")).toBeNull();
  });
});

describe("hasWhatsAppKeys", () => {
  it("is false without both credentials", () => {
    process.env['WHATSAPP_API_TOKEN'] = "t";
    expect(hasWhatsAppKeys()).toBe(false);
    process.env['WHATSAPP_PHONE_NUMBER_ID'] = "1";
    expect(hasWhatsAppKeys()).toBe(true);
  });
});

describe("sendWhatsAppTemplate", () => {
  it("reports unavailable when the channel is not configured", async () => {
    const result = await sendWhatsAppTemplate({
      to: "+48601234567",
      template: "trip_reminder",
      params: [],
    });
    expect(result).toEqual({ status: "unavailable", reason: "missing-key" });
  });

  it("posts an approved template with ordered parameters", async () => {
    process.env['WHATSAPP_API_TOKEN'] = "token";
    process.env['WHATSAPP_PHONE_NUMBER_ID'] = "555";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWhatsAppTemplate({
      to: "+48 601 234 567",
      template: "booking_confirmation",
      params: ["Milan", "2026-04-02 – 2026-04-05", "ADR-1"],
    });

    expect(result).toEqual({ status: "sent", id: "wamid.1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/555/messages");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body['to']).toBe("48601234567");
    const template = body['template'] as {
      name: string;
      components: Array<{ parameters: Array<{ text: string }> }>;
    };
    expect(template.name).toBe(WHATSAPP_TEMPLATES.booking_confirmation);
    expect(template.components[0]!.parameters.map((p) => p.text)).toEqual([
      "Milan",
      "2026-04-02 – 2026-04-05",
      "ADR-1",
    ]);
  });

  it("reports failure on an http error", async () => {
    process.env['WHATSAPP_API_TOKEN'] = "token";
    process.env['WHATSAPP_PHONE_NUMBER_ID'] = "555";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 400 })));
    const result = await sendWhatsAppTemplate({
      to: "+48601234567",
      template: "trip_reminder",
      params: [],
    });
    expect(result).toEqual({ status: "failed", detail: "http-400" });
  });
});
