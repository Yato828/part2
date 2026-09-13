import { DEFAULT_WATCH, USDG, WETH } from "./const";
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
    pool_created_at?: string;
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

const NATIVE = "0x0000000000000000000000000000000000000000";
const QUOTE_LIKE = new Set([WETH.toLowerCase(), USDG.toLowerCase(), NATIVE]);

function orientDex(p: DexPair): DexPair {
  const base = p.baseToken?.address?.toLowerCase();
  const quote = p.quoteToken?.address?.toLowerCase();
  if (base && QUOTE_LIKE.has(base) && quote && !QUOTE_LIKE.has(quote)) {
    return {
      ...p,
      baseToken: {
        address: p.quoteToken!.address!,
        name: p.quoteToken?.symbol || p.baseToken.name,
        symbol: p.quoteToken?.symbol || "???",
      },
      quoteToken: { address: p.baseToken.address, symbol: p.baseToken.symbol },
    };
  }
  return p;
}

function pairToCoin(p: DexPair, extra?: Partial<AxiomCoin>): AxiomCoin {
  const q = orientDex(p);
  const tw = q.info?.socials?.find((s) => s.type === "twitter")?.url;
  const web = q.info?.websites?.[0]?.url;
  return {
    symbol: q.baseToken.symbol.replace(/^\$/, ""),
    name: q.baseToken.name,
    address: q.baseToken.address,
    pairAddress: q.pairAddress,
    chainId: RH,
    dex: q.dexId,
    logo: pairLogo(q),
    priceUsd: Number(q.priceUsd) || 0,
    mcap: q.marketCap,
    fdv: q.fdv,
    liquidityUsd: q.liquidity?.usd,
    volume5m: q.volume?.m5,
    volume1h: q.volume?.h1,
    volume24h: q.volume?.h24,
    change5m: q.priceChange?.m5,
    change1h: q.priceChange?.h1,
    change6h: q.priceChange?.h6,
    change24h: q.priceChange?.h24,
    buys24h: q.txns?.h24?.buys,
    sells24h: q.txns?.h24?.sells,
    website: web,
    twitter: tw,
    createdAt: q.pairCreatedAt,
    quoteAddress: q.quoteToken?.address,
    ...extra,
  };
}

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
    createdAt: p.attributes.pool_created_at ? Date.parse(p.attributes.pool_created_at) : undefined,
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
  return !!s && (/^0x[a-fA-F0-9]{40}$/.test(s) || /^0x[a-fA-F0-9]{64}$/.test(s));
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

type PaprikaTok = { id?: string; symbol?: string; name?: string };
type PaprikaPool = {
  id?: string;
  dex_id?: string;
  dex_name?: string;
  created_at?: string;
  volume_usd_24h?: number;
  volume_usd?: number;
  liquidity_usd?: number;
  price_usd?: number;
  last_price_usd?: number;
  tokens?: PaprikaTok[];
};

export function paprikaPoolRows(body: unknown): PaprikaPool[] {
  if (Array.isArray(body)) return body as PaprikaPool[];
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (Array.isArray(o.pools)) return o.pools as PaprikaPool[];
    if (Array.isArray(o.results)) return o.results as PaprikaPool[];
    if (Array.isArray(o.data)) return o.data as PaprikaPool[];
  }
  return [];
}

function geckoPoolRows(body: unknown): GeckoPool[] {
  if (body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: GeckoPool[] }).data;
  }
  return [];
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
  swaps: Array<{
    created_at?: string;
    price_0_usd?: number;
    price_0?: number;
    price_1_usd?: number;
    price_1?: number;
    volume_0?: number;
    volume_1?: number;
    token_0?: string;
  }>,
  bucketMs: number
): Candle[] {
  const ticks = swaps
    .map((s) => {
      const flip = isQuoteToken(s.token_0);
      const p = Number(flip ? (s.price_1_usd ?? s.price_1) : (s.price_0_usd ?? s.price_0));
      const v = Math.abs(Number(flip ? s.volume_1 : s.volume_0) || 0);
      return { t: parseBarTime(s.created_at), p, v };
    })
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
  const limit = interval === "1m" ? 180 : 96;
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
    1400
  );
  const candles = parsePaprikaOhlcv(paprikaRows(body));
  if (!candles.length) return [];
  return spec.bucket ? bucketCandles(candles, spec.bucket) : candles;
}

async function loadSwapCandles(pool: string, interval: string): Promise<Candle[]> {
  const body = await getJson<{
    transactions?: Array<{
      created_at?: string;
      price_0_usd?: number;
      price_0?: number;
      price_1_usd?: number;
      price_1?: number;
      volume_0?: number;
      volume_1?: number;
      token_0?: string;
    }>;
  }>(`/paprika/networks/${RH}/pools/${pool.toLowerCase()}/transactions?limit=100&page=1`, 1400);
  const bucket = IV_MS[interval] ?? IV_MS["15m"];
  return swapsToCandles(body.transactions ?? [], bucket);
}

async function loadCandles(pool: string, interval: string): Promise<Candle[]> {
  const v4 = /^0x[a-fA-F0-9]{64}$/.test(pool);
  if (v4) return loadSwapCandles(pool, interval).catch(() => [] as Candle[]);
  const [paprika, swaps] = await Promise.all([
    loadPaprika(pool, interval).catch(() => [] as Candle[]),
    loadSwapCandles(pool, interval).catch(() => [] as Candle[]),
  ]);
  if (paprika.length > 1) return paprika;
  if (swaps.length) return swaps;
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
  const dexP = getJson<{ pairs: DexPair[] }>(`/dex/latest/dex/search?q=${encodeURIComponent(query)}`, 1400);
  const addrP = looksAddr
    ? getJson<{ pairs?: DexPair[] } | DexPair[]>(`/dex/latest/dex/tokens/${query}`, 1400)
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
  try {
    const body = await getJson<{ pairs?: DexPair[] } | DexPair[]>(`/dex/latest/dex/tokens/${want}`, 1400);
    const pairs = onlyRh(Array.isArray(body) ? body : body.pairs ?? [])
      .filter((p) => isPoolAddr(p.pairAddress))
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const hit = pairs.find((p) => p.baseToken.address.toLowerCase() === want) ?? pairs[0];
    if (hit) {
      const coin = pairToCoin(hit);
      if (coin.pairAddress) prefetchCandles(coin.pairAddress, ["1m", "15m"]);
      return coin;
    }
  } catch {
    /* search fallback */
  }
  const hits = await searchAxioms(want);
  return hits.find((c) => c.address.toLowerCase() === want) ?? hits[0] ?? null;
}

export async function fetchBestPool(token: string): Promise<string | undefined> {
  try {
    const body = await getJson<{ pairs?: DexPair[] } | DexPair[]>(`/dex/latest/dex/tokens/${token}`, 1400);
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
      getJson<Array<{ chainId: string; tokenAddress: string }>>("/dex/token-boosts/top/v1", 2200).catch(() => []),
      getJson<{ pairs: DexPair[] }>("/dex/latest/dex/search?q=NVDA", 2200).catch(() => ({ pairs: [] as DexPair[] })),
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
    const hit =
      pairs.find((p) => coin.pairAddress && p.pairAddress?.toLowerCase() === coin.pairAddress.toLowerCase()) ??
      pairs[0];
    if (!hit) return { ...coin, chainId: RH };
    return pairToCoin(hit, { logo: coin.logo || pairLogo(hit), holders: coin.holders });
  } catch {
    return { ...coin, chainId: RH };
  }
}

export function axiomUrl(coin: AxiomCoin) {
  return `https://dexscreener.com/${RH}/${coin.pairAddress}`;
}

export function isQuoteToken(addr?: string | null) {
  return !!addr && QUOTE_LIKE.has(addr.toLowerCase());
}

export function ageLabel(createdAt?: number, now = Date.now()) {
  if (!createdAt || !Number.isFinite(createdAt)) return "new";
  const s = Math.max(0, now - createdAt) / 1000;
  if (s < 45) return `${Math.max(1, Math.floor(s))}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function isStockToken(
  coin: Pick<AxiomCoin, "symbol" | "address">,
  stockSymbols: Set<string>,
  stockAddresses: Set<string>
) {
  if (coin.address && stockAddresses.has(coin.address.toLowerCase())) return true;
  const sym = coin.symbol.replace(/^\$/, "").toUpperCase();
  return stockSymbols.has(sym);
}

export function filterPulseCoins(
  coins: AxiomCoin[],
  stockSymbols: Iterable<string>,
  stockAddresses: Iterable<string>
) {
  const syms = new Set([...stockSymbols].map((s) => s.toUpperCase()));
  const addrs = new Set([...stockAddresses].map((a) => a.toLowerCase()));
  const quotes = new Set(["WETH", "USDG", "ETH"]);
  return coins.filter((c) => {
    if (!c.address || isQuoteToken(c.address)) return false;
    const tick = c.symbol.replace(/^\$/, "").toUpperCase();
    if (quotes.has(tick)) return false;
    if (isStockToken(c, syms, addrs)) return false;
    return true;
  });
}

function isStubSymbol(sym?: string) {
  if (!sym) return true;
  const s = sym.replace(/^\$/, "");
  return /^0x/i.test(s) || /^[0-9A-F]{6}$/i.test(s);
}

export function mergePulseCoins(coins: AxiomCoin[]): AxiomCoin[] {
  const seen = new Map<string, AxiomCoin>();
  for (const c of coins) {
    if (!c.address) continue;
    const k = c.address.toLowerCase();
    const prev = seen.get(k);
    if (!prev) {
      seen.set(k, c);
      continue;
    }
    const newer = (c.createdAt ?? 0) >= (prev.createdAt ?? 0) ? c : prev;
    const older = newer === c ? prev : c;
    const named = isStubSymbol(c.symbol) && !isStubSymbol(prev.symbol) ? prev : c.symbol && !isStubSymbol(c.symbol) ? c : prev;
    const other = named === c ? prev : c;
    const pool = isPoolAddr(newer.pairAddress)
      ? newer.pairAddress
      : isPoolAddr(older.pairAddress)
        ? older.pairAddress
        : named.pairAddress;
    const createdAt = Math.max(c.createdAt ?? 0, prev.createdAt ?? 0) || named.createdAt;
    seen.set(k, {
      ...other,
      ...named,
      pairAddress: pool,
      createdAt,
      priceUsd: named.priceUsd || other.priceUsd,
      liquidityUsd: named.liquidityUsd ?? other.liquidityUsd,
      volume24h: named.volume24h ?? other.volume24h,
      logo: named.logo || other.logo,
    });
  }
  return [...seen.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

function paprikaToCoin(r: PaprikaPool): AxiomCoin | null {
  const toks = (r.tokens ?? []).filter((t) => t.id);
  const base = toks.find((t) => !isQuoteToken(t.id)) ?? toks[1] ?? toks[0];
  const baseId = base?.id;
  if (!baseId || isQuoteToken(baseId)) return null;
  const createdAt = r.created_at ? Date.parse(r.created_at) : undefined;
  const quote = toks.find((t) => t.id && t.id.toLowerCase() !== baseId.toLowerCase());
  const stub = baseId.slice(2, 8).toUpperCase();
  return {
    symbol: (base.symbol || stub).replace(/^\$/, ""),
    name: base.name || base.symbol || "New pair",
    address: baseId,
    pairAddress: isPoolAddr(r.id) ? r.id : "",
    chainId: RH,
    dex: r.dex_id ?? r.dex_name ?? "uniswap",
    priceUsd: Number(r.price_usd ?? r.last_price_usd) || 0,
    liquidityUsd: r.liquidity_usd,
    volume24h: r.volume_usd_24h ?? r.volume_usd,
    createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
    quoteAddress: quote?.id,
  };
}

async function hydrateDexTokens(addrs: string[]): Promise<AxiomCoin[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < addrs.length; i += 30) chunks.push(addrs.slice(i, i + 30));
  const parts = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const body = await getJson<{ pairs?: DexPair[] } | DexPair[]>(
          `/dex/latest/dex/tokens/${chunk.join(",")}`,
          2500
        );
        const pairs = onlyRh(Array.isArray(body) ? body : body.pairs ?? []);
        const newest = new Map<string, DexPair>();
        for (const p of pairs) {
          const coin = pairToCoin(p);
          const k = coin.address.toLowerCase();
          const prev = newest.get(k);
          if (!prev || (p.pairCreatedAt ?? 0) > (prev.pairCreatedAt ?? 0)) newest.set(k, p);
        }
        return [...newest.values()].map((p) => pairToCoin(p));
      } catch {
        return [] as AxiomCoin[];
      }
    })
  );
  return parts.flat();
}

export async function fetchPulseLaunches(opts?: {
  stockSymbols?: string[];
  stockAddresses?: string[];
}): Promise<AxiomCoin[]> {
  const stockSymbols = opts?.stockSymbols?.length ? opts.stockSymbols : DEFAULT_WATCH;
  const stockAddresses = opts?.stockAddresses ?? [];

  const [pap, profiles, boosts, rhSearch, weth, chain] = await Promise.allSettled([
    getJson<unknown>(`/paprika/networks/${RH}/pools/search?sort=desc&order_by=created_at&limit=50`, 2800),
    getJson<Array<{ chainId?: string; tokenAddress?: string }>>("/dex/token-profiles/latest/v1", 2200),
    getJson<Array<{ chainId?: string; tokenAddress?: string }>>("/dex/token-boosts/latest/v1", 2200),
    getJson<{ pairs?: DexPair[] }>("/dex/latest/dex/search?q=robinhood", 2200),
    getJson<{ pairs?: DexPair[] }>("/dex/latest/dex/search?q=WETH", 2200),
    getJson<{ items?: Array<{ address_hash: string; name: string; symbol: string; exchange_rate: string | null; volume_24h: string | null; icon_url: string | null }> }>(
      "/chain/tokens?type=ERC-20",
      2200
    ),
  ]);

  const paprikaCoins: AxiomCoin[] = [];
  if (pap.status === "fulfilled") {
    for (const r of paprikaPoolRows(pap.value)) {
      const c = paprikaToCoin(r);
      if (c) paprikaCoins.push(c);
    }
  }

  const dexFresh: AxiomCoin[] = [];
  const takePairs = (body?: { pairs?: DexPair[] }) => {
    const pairs = onlyRh(body?.pairs ?? [])
      .filter((p) => isPoolAddr(p.pairAddress))
      .sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0))
      .slice(0, 40);
    dexFresh.push(...pairs.map((p) => pairToCoin(p)));
  };
  if (rhSearch.status === "fulfilled") takePairs(rhSearch.value);
  if (weth.status === "fulfilled") takePairs(weth.value);

  const addrs = new Set<string>(
    [...paprikaCoins, ...dexFresh]
      .map((c) => c.address.toLowerCase())
      .filter((a) => /^0x[a-f0-9]{40}$/.test(a))
  );
  const take = (rows: Array<{ chainId?: string; tokenAddress?: string }>) => {
    for (const row of rows) {
      if (row.chainId !== RH || !row.tokenAddress) continue;
      if (!/^0x[a-fA-F0-9]{40}$/.test(row.tokenAddress)) continue;
      if (isQuoteToken(row.tokenAddress)) continue;
      addrs.add(row.tokenAddress.toLowerCase());
    }
  };
  if (profiles.status === "fulfilled") take(profiles.value);
  if (boosts.status === "fulfilled") take(boosts.value);

  const have = new Set([...paprikaCoins, ...dexFresh].map((c) => c.address.toLowerCase()));
  const missing = [...addrs].filter((a) => !have.has(a)).slice(0, 40);
  const papNeed = paprikaCoins
    .map((c) => c.address.toLowerCase())
    .filter((a) => /^0x[a-f0-9]{40}$/.test(a));
  const dexCoins = await hydrateDexTokens([...new Set([...missing, ...papNeed])].slice(0, 60));
  const chainCoins: AxiomCoin[] = [];
  if (chain.status === "fulfilled") {
    for (const t of chain.value.items ?? []) {
      if (!t.address_hash || isQuoteToken(t.address_hash)) continue;
      chainCoins.push({
        symbol: (t.symbol || "???").replace(/^\$/, ""),
        name: t.name || t.symbol || "New token",
        address: t.address_hash,
        pairAddress: "",
        chainId: RH,
        dex: "robinhood",
        logo: t.icon_url || undefined,
        priceUsd: Number(t.exchange_rate) || 0,
        volume24h: t.volume_24h ? Number(t.volume_24h) : undefined,
      });
    }
  }
  const merged = mergePulseCoins([...dexCoins, ...dexFresh, ...paprikaCoins, ...chainCoins]);
  const out = filterPulseCoins(merged, stockSymbols, stockAddresses).slice(0, 36);
  const now = Date.now();
  for (const c of out.slice(0, 8)) {
    const fresh = Boolean(c.createdAt && now - c.createdAt < 8 * 3600_000);
    prefetchCandles(c.pairAddress, fresh ? ["1m", "5m"] : ["15m"]);
  }
  return out;
}
