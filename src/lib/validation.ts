const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** A Solana public key encodes exactly 32 bytes. Case is significant. */
export function isSolanaAddress(value: unknown): value is string {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value))
    return false;
  let n = 0n;
  for (const c of value) n = n * 58n + BigInt(BASE58.indexOf(c));
  let bytes = 0;
  while (n) {
    bytes++;
    n >>= 8n;
  }
  return bytes + (value.match(/^1*/)?.[0].length ?? 0) === 32;
}

export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password)
      return url.href;
  } catch {
    /* invalid external URL */
  }
}

export function readLocal<T>(
  key: string,
  parse: (raw: unknown) => T,
  fallback: T,
): T {
  try {
    return parse(JSON.parse(localStorage.getItem(key) ?? "null"));
  } catch {
    return fallback;
  }
}
export function saveLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Data unavailable from connected sources";
