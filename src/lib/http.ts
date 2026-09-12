import { partShell, type PartShell } from "./env";

const EXT_ROOT: Array<{ prefix: string; origin: string; strip: string; insert: string }> = [
  { prefix: "/paprika", origin: "https://api.dexpaprika.com", strip: "/paprika", insert: "" },
  { prefix: "/gecko", origin: "https://api.geckoterminal.com", strip: "/gecko", insert: "/api/v2" },
  { prefix: "/chain", origin: "https://robinhoodchain.blockscout.com", strip: "/chain", insert: "/api/v2" },
  { prefix: "/dex", origin: "https://api.dexscreener.com", strip: "/dex", insert: "" },
  { prefix: "/rhj", origin: "https://api.robinhood.com", strip: "/rhj", insert: "" },
  { prefix: "/rpc", origin: "https://rpc.mainnet.chain.robinhood.com", strip: "/rpc", insert: "" },
];

export function resolvePartUrl(url: string, shell: PartShell = partShell()) {
  if (!url.startsWith("/")) return url;
  if (shell !== "ext") return url;
  const hit = EXT_ROOT.find(
    (r) => url === r.prefix || url.startsWith(r.prefix + "/") || url.startsWith(r.prefix + "?")
  );
  if (!hit) return url;
  const rest = url.slice(hit.strip.length) || "/";
  return hit.origin + hit.insert + rest;
}

function safeHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return headers;
}

const PRIVACY: Pick<RequestInit, "credentials" | "referrerPolicy"> = {
  credentials: "omit",
  referrerPolicy: "no-referrer",
};

export async function getJson<T>(url: string, ms = 15000, init?: RequestInit): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(resolvePartUrl(url), {
      ...init,
      ...PRIVACY,
      headers: safeHeaders(init),
      signal: init?.signal ?? ac.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    if (/^\s*</.test(text)) throw new Error(`html ${url}`);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`bad json ${url}`);
    }
  } finally {
    clearTimeout(t);
  }
}

export function partFetch(url: string, init?: RequestInit) {
  return fetch(resolvePartUrl(url), {
    ...init,
    ...PRIVACY,
    headers: safeHeaders(init),
  });
}
