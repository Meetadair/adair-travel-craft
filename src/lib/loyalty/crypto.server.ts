/**
 * Encrypt loyalty member numbers at rest with AES-GCM. The key comes from the
 * TRAVELLER_DATA_KEY secret and never leaves the server.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

async function key(): Promise<CryptoKey> {
  const secret = process.env["TRAVELLER_DATA_KEY"];
  if (!secret) throw new Error("traveller-key-missing");
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

const toBase64 = (bytes: Uint8Array): string => {
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return btoa(out);
};

const fromBase64 = (value: string): Uint8Array<ArrayBuffer> => {
  const raw = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(),
    enc.encode(plain),
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
}

export async function decryptSecret(stored: string): Promise<string> {
  const [ivPart, cipherPart] = stored.split(".");
  if (!ivPart || !cipherPart) throw new Error("loyalty-number-corrupt");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivPart) },
    await key(),
    fromBase64(cipherPart),
  );
  return dec.decode(plain);
}
