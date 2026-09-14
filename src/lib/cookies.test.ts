import { beforeEach, describe, expect, it } from "vitest";

import { analyticsAllowed, DEFAULT_CHOICE, readCookieChoice, writeCookieChoice } from "./cookies";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    },
  });
});

describe("cookie consent", () => {
  it("treats no answer as a refusal, never as consent", () => {
    expect(readCookieChoice()).toBeNull();
    expect(analyticsAllowed()).toBe(false);
    expect(DEFAULT_CHOICE.analytics).toBe(false);
  });

  it("remembers a yes", () => {
    writeCookieChoice(true);
    expect(analyticsAllowed()).toBe(true);
    expect(readCookieChoice()?.essential).toBe(true);
  });

  it("remembers a no, which is different from never having asked", () => {
    writeCookieChoice(false);
    expect(readCookieChoice()).not.toBeNull();
    expect(analyticsAllowed()).toBe(false);
  });

  it("records when the choice was made", () => {
    writeCookieChoice(true);
    expect(readCookieChoice()?.decidedAt).not.toBe("");
  });

  it("treats a corrupted value as undecided rather than as consent", () => {
    store.set("adair.cookie-choice", "{ not json");
    expect(readCookieChoice()).toBeNull();
    expect(analyticsAllowed()).toBe(false);
  });

  it("never lets essential be switched off — the site would not run", () => {
    writeCookieChoice(false);
    expect(readCookieChoice()?.essential).toBe(true);
  });
});
