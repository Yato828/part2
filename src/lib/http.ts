import { partShell, type PartShell } from "./env";

const EXT_ROOT: Array<{
  prefix: string;
  origin: string;
  strip: string;
  insert: string;
}> = [
  {
    prefix: "/rugcheck",
    origin: "https://api.rugcheck.xyz",
    strip: "/rugcheck",
    insert: "/v1",
  },
  {
    prefix: "/paprika",
    origin: "https://api.dexpaprika.com",
    strip: "/paprika",
    insert: "",
  },
  {
    prefix: "/gecko",
    origin: "https://api.geckoterminal.com",
    strip: "/gecko",
    insert: "/api/v2",
  },
  {
    prefix: "/dex",
    origin: "https://api.dexscreener.com",
    strip: "/dex",
    insert: "",
  },
  {
    prefix: "/ray",
    origin: "https://transaction-v1.raydium.io",
    strip: "/ray",
    insert: "",
  },
  {
    prefix: "/rpc",
    origin: "https://api.mainnet-beta.solana.com",
    strip: "/rpc",
    insert: "",
  },
  {
    prefix: "/rpc-backup",
    origin: "https://solana-rpc.publicnode.com",
    strip: "/rpc-backup",
    insert: "",
  },
];

const FABLE_ORIGIN = "https://part-woad.vercel.app";

function savedBackend(): "hosted" | "local" {
  if (typeof window === "undefined") return "hosted";
  try {
    return JSON.parse(localStorage.getItem("part.preferences.v1") ?? "{}")
      .astraBackend === "local"
      ? "local"
      : "hosted";
  } catch {
    return "hosted";
  }
}
export function resolvePartUrl(
  url: string,
  shell: PartShell = partShell(),
  backend: "hosted" | "local" = savedBackend(),
) {
  if (!url.startsWith("/")) return url;
  if (shell === "ext" && url.startsWith("/api/")) {
    if (backend === "local") return "http://localhost:4664" + url;
    return import.meta.env.DEV ? url : FABLE_ORIGIN + url;
  }
  if (shell !== "ext") return url;
  const hit = EXT_ROOT.find(
    (r) =>
      url === r.prefix ||
      url.startsWith(r.prefix + "/") ||
      url.startsWith(r.prefix + "?"),
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

export async function getJson<T>(
  url: string,
  ms = 4000,
  init?: RequestInit,
): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(
      resolvePartUrl(url, typeof window === "undefined" ? "ext" : partShell()),
      {
        ...init,
        ...PRIVACY,
        headers: safeHeaders(init),
        signal: init?.signal
          ? AbortSignal.any([init.signal, ac.signal])
          : ac.signal,
      },
    );
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
