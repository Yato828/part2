import { getJson } from "./http";
import { isPoolAddr } from "./axiom";

const cache = new Map<string, { url?: string; until: number }>();
const pending = new Map<string, Promise<string | undefined>>();
export function safeLogo(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !/missing|placeholder/i.test(url.pathname)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
export async function tokenLogo(mint: string): Promise<string | undefined> {
  if (!isPoolAddr(mint)) return;
  const hit = cache.get(mint);
  if (hit && hit.until > Date.now()) return hit.url;
  if (pending.has(mint)) return pending.get(mint);
  const job = getJson<{ data?: { attributes?: { image_url?: string } } }>(
    `/gecko/networks/solana/tokens/${mint}/info`,
    8000,
  )
    .then((body) => safeLogo(body.data?.attributes?.image_url))
    .catch(() => undefined)
    .then((url) => {
      cache.set(mint, { url, until: Date.now() + (url ? 3600000 : 60000) });
      return url;
    })
    .finally(() => pending.delete(mint));
  pending.set(mint, job);
  return job;
}
