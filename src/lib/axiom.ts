import { getJson } from "./http";

export type AxiomCoin = {
  symbol: string;
  name: string;
  address: string;
  pairAddress: string;
  chainId: string;
  dex: string;
  logo?: string;
  priceUsd: number;
  mcap?: number;
  fdv?: number;
  liquidityUsd?: number;
  volume5m?: number;
  volume1h?: number;
  volume24h?: number;
  change5m?: number;
  change1h?: number;
  change6h?: number;
  change24h?: number;
  buys24h?: number;
  sells24h?: number;
  holders?: number;
  website?: string;
  twitter?: string;
  createdAt?: number;
  quoteAddress?: string;
};

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

type DexPair = {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken?: { address?: string; symbol: string };
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { m5?: number; h1?: number; h24?: number };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  txns?: { h24?: { buys: number; sells: number } };
  pairCreatedAt?: number;
  info?: { imageUrl?: string; websites?: Array<{ url: string }>; socials?: Array<{ type: string; url: string }> };
};

type GeckoPool = {
  id: string;
  attributes: {
    address: string;
    name: string;
    base_token_price_usd?: string;
    quote_token_price_usd?: string;
    fdv_usd?: string;
    market_cap_usd?: string | null;
    reserve_in_usd?: string;
    volume_usd?: { h24?: string; h1?: string; m5?: string };
    price_change_percentage?: { m5?: string; h1?: string; h6?: string; h24?: string };
    transactions?: { h24?: { buys?: number; sells?: number } };
  };
  relationships?: {
    base_token?: { data?: { id: string } };
    quote_token?: { data?: { id: string } };
    dex?: { data?: { id: string } };
  };
};

const RH = "robinhood";

export function onlyRh(pairs: DexPair[]) {
  return pairs.filter((p) => p.chainId === RH && p.baseToken);
}

function pairLogo(p: DexPair) {
  return p.info?.imageUrl;
}

function pairToCoin(p: DexPair, extra?: Partial<AxiomCoin>): AxiomCoin {
  const tw = p.info?.socials?.find((s) => s.type === "twitter")?.url;
  const web = p.info?.websites?.[0]?.url;
  return {
    symbol: p.baseToken.symbol.replace(/^\$/, ""),
    name: p.baseToken.name,
    address: p.baseToken.address,
    pairAddress: p.pairAddress,
    chainId: RH,
    dex: p.dexId,
    logo: pairLogo(p),
    priceUsd: Number(p.priceUsd) || 0,
    mcap: p.marketCap,
    fdv: p.fdv,
    liquidityUsd: p.liquidity?.usd,
    volume5m: p.volume?.m5,
    volume1h: p.volume?.h1,
    volume24h: p.volume?.h24,
    change5m: p.priceChange?.m5,
    change1h: p.priceChange?.h1,
    change6h: p.priceChange?.h6,
    change24h: p.priceChange?.h24,
    buys24h: p.txns?.h24?.buys,
    sells24h: p.txns?.h24?.sells,
    website: web,
    twitter: tw,
    createdAt: p.pairCreatedAt,
    quoteAddress: p.quoteToken?.address,
    ...extra,
  };
}

const QUOTE_LIKE = new Set([
  "0x5fc5360d0400a0fd4f2af552add042d716f1d168", // USDG
  "0x0bd7d308f8e1639fab988df18a8011f41eacad73", // WETH
]);

function geckoToCoin(p: GeckoPool): AxiomCoin | null {
  const baseId = p.relationships?.base_token?.data?.id ?? "";
  const quoteId = p.relationships?.quote_token?.data?.id ?? "";
  if (!baseId.startsWith("robinhood_")) return null;
  let address = baseId.replace(/^robinhood_/, "");
  let quoteAddress = quoteId.startsWith("robinhood_") ? quoteId.replace(/^robinhood_/, "") : undefined;
  const name = p.attributes.name ?? "";
  let symbol = name.split("/")[0]?.trim() || "???";
  let flipped = false;
  if (QUOTE_LIKE.has(address.toLowerCase()) && quoteAddress && !QUOTE_LIKE.has(quoteAddress.toLowerCase())) {
    const wasBase = address;
    address = quoteAddress;
    quoteAddress = wasBase;
    symbol = name.split("/")[1]?.trim() || symbol;
    flipped = true;
  }
  return {
    symbol,
    name,
    address,
    pairAddress: p.attributes.address,
    chainId: RH,
    dex: p.relationships?.dex?.data?.id ?? "dex",
    priceUsd: Number(flipped ? p.attributes.quote_token_price_usd : p.attributes.base_token_price_usd) || 0,
    mcap: p.attributes.market_cap_usd ? Number(p.attributes.market_cap_usd) : Number(p.attributes.fdv_usd) || undefined,
    fdv: p.attributes.fdv_usd ? Number(p.attributes.fdv_usd) : undefined,
    liquidityUsd: p.attributes.reserve_in_usd ? Number(p.attributes.reserve_in_usd) : undefined,
    volume5m: p.attributes.volume_usd?.m5 ? Number(p.attributes.volume_usd.m5) : undefined,
    volume1h: p.attributes.volume_usd?.h1 ? Number(p.attributes.volume_usd.h1) : undefined,
    volume24h: p.attributes.volume_usd?.h24 ? Number(p.attributes.volume_usd.h24) : undefined,
    change5m: p.attributes.price_change_percentage?.m5 ? Number(p.attributes.price_change_percentage.m5) : undefined,
    change1h: p.attributes.price_change_percentage?.h1 ? Number(p.attributes.price_change_percentage.h1) : undefined,
    change6h: p.attributes.price_change_percentage?.h6 ? Number(p.attributes.price_change_percentage.h6) : undefined,
    change24h: p.attributes.price_change_percentage?.h24 ? Number(p.attributes.price_change_percentage.h24) : undefined,
    buys24h: p.attributes.transactions?.h24?.buys,
    sells24h: p.attributes.transactions?.h24?.sells,
    quoteAddress,
  };
}

function rank(coins: AxiomCoin[]) {
  return coins
    .filter((c) => c.chainId === RH)
    .sort((a, b) => {
      const ap = isPoolAddr(a.pairAddress) ? 1 : 0;
      const bp = isPoolAddr(b.pairAddress) ? 1 : 0;
      if (bp !== ap) return bp - ap;
      return (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0);
    });
}

function dedupe(coins: AxiomCoin[]) {
  const seen = new Set<string>();
  const out: AxiomCoin[] = [];
  for (const c of coins) {
    if (c.chainId !== RH) continue;
    const k = c.address.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

const candleCache = new Map<string, { t: number; v: Candle[] }>();
const candleWait = new Map<string, Promise<Candle[]>>();
const CANDLE_TTL = 20_000;
export const CANDLE_IVS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

function candleKey(pool: string, interval: string) {
  return `${pool.toLowerCase()}:${interval}`;
}

export function isPoolAddr(s?: string | null): s is string {
  return !!s && /^0x[a-fA-F0-9]{40}$/.test(s);
}

export function peekCandles(pool: string, interval: string): Candle[] | undefined {
  return candleCache.get(candleKey(pool, interval))?.v;
}

export function patchLastCandle(bars: Candle[], last?: number): Candle[] {
  if (!bars.length || !Number.isFinite(last) || !last) return bars;
  const cur = bars[bars.length - 1];
  if (Math.abs(cur.c - last) < 1e-12) return bars;
  const next = bars.slice();
  next[next.length - 1] = { ...cur, c: last, h: Math.max(cur.h, last), l: Math.min(cur.l, last) };
  return next;
}

export function bucketCandles(rows: Candle[], bucketMs: number): Candle[] {
  const map = new Map<number, Candle>();
  for (const c of rows) {
    const t = Math.floor(c.t / bucketMs) * bucketMs;
    const prev = map.get(t);
    if (!prev) {
      map.set(t, { ...c, t });
      continue;
    }
    map.set(t, {
      t,
      o: prev.o,
      h: Math.max(prev.h, c.h),
      l: Math.min(prev.l, c.l),
      c: c.c,
      v: prev.v + c.v,
    });
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}

export type PaprikaBar = {
  time_open: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function parseBarTime(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      return n < 1e12 ? n * 1000 : n;
    }
    const t = Date.parse(trimmed);
    return Number.isFinite(t) ? t : NaN;
  }
  return NaN;
}

export function paprikaRows(body: unknown): PaprikaBar[] {
  if (Array.isArray(body)) return body as PaprikaBar[];
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as PaprikaBar[];
    if (Array.isArray(o.ohlcv)) return o.ohlcv as PaprikaBar[];
  }
  return [];
}

export function parsePaprikaOhlcv(rows: PaprikaBar[]): Candle[] {
  return rows
    .map((r) => ({
      t: parseBarTime((r as PaprikaBar & { time?: unknown }).time_open ?? (r as { time?: unknown }).time),
      o: Number(r.open),
      h: Number(r.high),
      l: Number(r.low),
      c: Number(r.close),
      v: Number(r.volume),
    }))
    .filter((c) => Number.isFinite(c.t) && Number.isFinite(c.c))
    .sort((a, b) => a.t - b.t);
}

export function swapsToCandles(
  swaps: Array<{ created_at?: string; price_0_usd?: number; price_0?: number; volume_0?: number }>,
  bucketMs: number
): Candle[] {
  const ticks = swaps
    .map((s) => ({
      t: parseBarTime(s.created_at),
      p: Number(s.price_0_usd ?? s.price_0),
      v: Math.abs(Number(s.volume_0) || 0),
    }))
    .filter((x) => Number.isFinite(x.t) && Number.isFinite(x.p) && x.p > 0)
    .sort((a, b) => a.t - b.t);
  const map = new Map<number, Candle>();
  for (const tick of ticks) {
    const t = Math.floor(tick.t / bucketMs) * bucketMs;
    const prev = map.get(t);
    if (!prev) {
      map.set(t, { t, o: tick.p, h: tick.p, l: tick.p, c: tick.p, v: tick.v });
      continue;
    }
    prev.h = Math.max(prev.h, tick.p);
    prev.l = Math.min(prev.l, tick.p);
    prev.c = tick.p;
    prev.v += tick.v;
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}

const IV_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

const PAPRIKA_IV: Record<string, { iv: string; bucket?: number }> = {
  "1m": { iv: "1m" },
  "5m": { iv: "5m" },
  "15m": { iv: "15m" },
  "1h": { iv: "1h" },
  "4h": { iv: "1h", bucket: 4 * 60 * 60_000 },
  "1d": { iv: "24h" },
};

const PAPRIKA_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "24h": 24 * 60 * 60_000,
};

async function loadPaprika(pool: string, interval: string): Promise<Candle[]> {
  const spec = PAPRIKA_IV[interval] ?? PAPRIKA_IV["15m"];
  const limit = 96;
  const end = Date.now();
  const start = end - (PAPRIKA_MS[spec.iv] ?? IV_MS[interval] ?? IV_MS["15m"]) * limit;
  const qs = new URLSearchParams({
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    interval: spec.iv,
    limit: String(limit),
  });
  const body = await getJson<unknown>(
    `/paprika/networks/${RH}/pools/${pool.toLowerCase()}/ohlcv?${qs}`,
    3500
  );
  const candles = parsePaprikaOhlcv(paprikaRows(body));
  if (!candles.length) return [];
  return spec.bucket ? bucketCandles(candles, spec.bucket) : candles;
}

async function loadSwapCandles(pool: string, interval: string): Promise<Candle[]> {
  const body = await getJson<{ transactions?: Array<{ created_at?: string; price_0_usd?: number; price_0?: number; volume_0?: number }> }>(
    `/paprika/networks/${RH}/pools/${pool.toLowerCase()}/transactions?limit=80&page=1`,
    3000
  );
  const bucket = IV_MS[interval] ?? IV_MS["15m"];
  return swapsToCandles(body.transactions ?? [], bucket);
}

async function loadCandles(pool: string, interval: string): Promise<Candle[]> {
  const paprika = await loadPaprika(pool, interval).catch(() => [] as Candle[]);
  if (paprika.length > 1) return paprika;
  const fromSwaps = await loadSwapCandles(pool, interval).catch(() => [] as Candle[]);
  if (fromSwaps.length) return fromSwaps;
  return paprika;
}

export async function fetchCandles(pool: string, interval: string, force = false): Promise<Candle[]> {
  if (!isPoolAddr(pool)) return [];
  const k = candleKey(pool, interval);
  const hit = candleCache.get(k);
  const fresh = hit && Date.now() - hit.t < CANDLE_TTL;

  const start = () => {
    const job = loadCandles(pool, interval)
      .then((rows) => {
        if (rows.length) candleCache.set(k, { t: Date.now(), v: rows });
        return rows.length ? rows : hit?.v ?? [];
      })
      .finally(() => candleWait.delete(k));
    candleWait.set(k, job);
    return job;
  };

  const pending = candleWait.get(k);
  if (hit && !force) {
    if (!fresh && !pending) void start();
    return hit.v;
  }
  if (hit && force && pending) return pending;
  return pending ?? start();
}

export function prefetchCandles(pool?: string, intervals: string[] = ["15m"]) {
  if (!isPoolAddr(pool)) return;
  for (const iv of intervals) void fetchCandles(pool, iv);
}

async function logosFor(coins: AxiomCoin[]) {
  const need = coins.filter((c) => !c.logo).slice(0, 20);
  if (!need.length) return coins;
  try {
    const body = await getJson<{ pairs?: DexPair[] } | DexPair[]>(`/dex/latest/dex/tokens/${need.map((c) => c.address).join(",")}`);
    const pairs = onlyRh(Array.isArray(body) ? body : body.pairs ?? []);
    const byAddr = new Map<string, string>();
    for (const p of pairs) {
      const img = pairLogo(p);
      if (img) byAddr.set(p.baseToken.address.toLowerCase(), img);
    }
    return coins.map((c) => ({ ...c, logo: c.logo || byAddr.get(c.address.toLowerCase()) }));
  } catch {
    return coins;
  }
}

export async function searchAxioms(q: string): Promise<AxiomCoin[]> {
  const query = q.trim();
  if (!query) return fetchAxiomFeed();
  const looksAddr = /^0x[a-fA-F0-9]{40}$/.test(query);
  const dexP = getJson<{ pairs: DexPair[] }>(`/dex/latest/dex/search?q=${encodeURIComponent(query)}`, 5000);
  const addrP = looksAddr
    ? getJson<{ pairs?: DexPair[] } | DexPair[]>(`/dex/latest/dex/tokens/${query}`, 5000)
    : Promise.resolve({ pairs: [] as DexPair[] });
  const [dex, byAddr] = await Promise.allSettled([dexP, addrP]);
  const coins: AxiomCoin[] = [];
  if (dex.status === "fulfilled") {
    coins.push(
      ...onlyRh(dex.value.pairs ?? [])
        .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
        .map((p) => pairToCoin(p))
    );
  }
  if (byAddr.status === "fulfilled") {
    const pairs = onlyRh(Array.isArray(byAddr.value) ? byAddr.value : byAddr.value.pairs ?? []);
    coins.push(...pairs.map((p) => pairToCoin(p)));
  }
  const out = dedupe(rank(coins)).slice(0, 40);
  if (out[0]?.pairAddress) prefetchCandles(out[0].pairAddress);
  return out;
}

export async function fetchRhCoinByAddress(address: string): Promise<AxiomCoin | null> {
  const want = address.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(want)) return null;
  const hits = await searchAxioms(want);
  return hits.find((c) => c.address.toLowerCase() === want) ?? hits[0] ?? null;
}

export async function fetchBestPool(token: string): Promise<string | undefined> {
  try {
    const body = await getJson<{ pairs?: DexPair[] } | DexPair[]>(`/dex/latest/dex/tokens/${token}`, 4000);
    const pairs = onlyRh(Array.isArray(body) ? body : body.pairs ?? [])
      .filter((p) => isPoolAddr(p.pairAddress))
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    return pairs[0]?.pairAddress;
  } catch {
    return undefined;
  }
}

export async function fetchAxiomFeed(): Promise<AxiomCoin[]> {
  try {
    const [boosts, nvda] = await Promise.all([
      getJson<Array<{ chainId: string; tokenAddress: string }>>("/dex/token-boosts/top/v1", 3500).catch(() => []),
      getJson<{ pairs: DexPair[] }>("/dex/latest/dex/search?q=NVDA", 3500).catch(() => ({ pairs: [] as DexPair[] })),
    ]);
    const coins: AxiomCoin[] = [];
    const rhBoosts = boosts.filter((b) => b.chainId === RH).map((b) => b.tokenAddress);
    if (rhBoosts.length) {
      const body = await getJson<{ pairs?: DexPair[] } | DexPair[]>(
        `/dex/latest/dex/tokens/${rhBoosts.slice(0, 12).join(",")}`,
        4000
      );
      const pairs = onlyRh(Array.isArray(body) ? body : body.pairs ?? []);
      coins.push(...pairs.map((p) => pairToCoin(p)));
    }
    coins.push(...onlyRh(nvda.pairs ?? []).map((p) => pairToCoin(p)));
    const merged = dedupe(rank(coins));
    if (merged[0]?.pairAddress) prefetchCandles(merged[0].pairAddress);
    if (merged.length) return merged.slice(0, 30);
  } catch {
    /* fall through */
  }
  return searchAxioms("HOOD");
}

export async function fetchAxiomLive(coin: AxiomCoin) {
  try {
    const body = await getJson<{ pair?: DexPair; pairs?: DexPair[] } | DexPair[]>(
      coin.pairAddress && coin.pairAddress !== coin.address
        ? `/dex/latest/dex/pairs/${RH}/${coin.pairAddress}`
        : `/dex/latest/dex/tokens/${coin.address}`
    );
    const pairs = onlyRh(
      Array.isArray(body) ? body : [body.pair, ...(body.pairs ?? [])].filter(Boolean) as DexPair[]
    );
    const hit = pairs.find((p) => p.pairAddress?.toLowerCase() === coin.pairAddress.toLowerCase()) ?? pairs[0];
    if (!hit) return { ...coin, chainId: RH };
    return pairToCoin(hit, { logo: coin.logo || pairLogo(hit), holders: coin.holders });
  } catch {
    return { ...coin, chainId: RH };
  }
}

export function axiomUrl(coin: AxiomCoin) {
  return `https://dexscreener.com/${RH}/${coin.pairAddress}`;
}
