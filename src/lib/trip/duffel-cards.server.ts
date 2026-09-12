/**
 * Server-only Duffel Cards helpers.
 *
 * Card details are collected by Duffel's hosted card component in the browser,
 * so no card number, expiry or CVC ever reaches our backend. All we do here is
 * mint the short-lived component client key the browser component needs.
 */
const BASE = "https://api.duffel.com";

function key(): string {
  const value = process.env["DUFFEL_API_KEY"];
  if (!value) throw new Error("missing-key");
  return value;
}

/** Creates a component client key for the Duffel card form / 3-D Secure session. */
export async function createComponentClientKey(): Promise<string> {
  const res = await fetch(`${BASE}/identity/component_client_keys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Duffel-Version": "v2",
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip",
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Duffel component_client_keys failed [${res.status}]: ${text.slice(0, 300)}`);
    throw new Error(`duffel-${res.status}`);
  }
  const json = (await res.json()) as { data?: { component_client_key?: string } };
  const clientKey = json.data?.component_client_key;
  if (!clientKey) throw new Error("client-key-missing");
  return clientKey;
}
