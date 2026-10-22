import { WSOL, USDC } from "./const";
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

export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

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
  info?: {
    imageUrl?: string;
    websites?: Array<{ url: string }>;
    socials?: Array<{ type: string; url: string }>;
  };
};

export const CANDLE_IVS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type Interval = (typeof CANDLE_IVS)[number];
export const IV_MS: Record<string, number> = {
  "1m": 60000,
  "5m": 300000,
  "15m": 900000,
  "1h": 3600000,
  "4h": 14400000,
  "1d": 86400000,
};
export function isPoolAddr(value?: string | null): value is string {
  return !!value && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}
export function onlySolana(pairs: DexPair[]) {
  return pairs.filter(
    (p) =>
      p.chainId === "solana" &&
      p.baseToken &&
      isPoolAddr(p.baseToken.address) &&
      isPoolAddr(p.pairAddress),
  );
}
export function pairToCoin(p: DexPair): AxiomCoin {
  return {
    symbol: p.baseToken.symbol,
    name: p.baseToken.name,
    address: p.baseToken.address,
    pairAddress: p.pairAddress,
    chainId: "solana",
    dex: p.dexId,
    priceUsd: Number(p.priceUsd) || 0,
    logo: p.info?.imageUrl,
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
    createdAt: p.pairCreatedAt,
    quoteAddress: p.quoteToken?.address,
    website: p.info?.websites?.[0]?.url,
    twitter: p.info?.socials?.find((s) => s.type === "twitter")?.url,
  };
}
export function mergePulseCoins(coins: AxiomCoin[]) {
  const map = new Map<string, AxiomCoin>();
  for (const c of coins) {
    if (c.chainId !== "solana" || !isPoolAddr(c.address)) continue;
    const old = map.get(c.address);
    if (!old || (c.liquidityUsd ?? 0) > (old.liquidityUsd ?? 0))
      map.set(c.address, { ...c, logo: c.logo || old?.logo });
    else if (!old.logo && c.logo) map.set(c.address, { ...old, logo: c.logo });
  }
  return [...map.values()].sort(
    (a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0),
  );
}
export async function searchAxioms(query: string): Promise<AxiomCoin[]> {
  const q = query.trim();
  if (!q) return [];
  const body = isPoolAddr(q)
    ? await getJson<DexPair[]>(`/dex/token-pairs/v1/solana/${q}`, 10000)
    : ((
        await getJson<{ pairs?: DexPair[] }>(
          `/dex/latest/dex/search?q=${encodeURIComponent(q)}`,
          10000,
        )
      ).pairs ?? []);
  return mergePulseCoins(
    onlySolana(body)
      .filter((p) => !isPoolAddr(q) || p.baseToken.address === q)
      .map(pairToCoin),
  );
}
export async function fetchSolCoinByAddress(address: string) {
  return (
    (await searchAxioms(address)).find((c) => c.address === address) ?? null
  );
}
export async function fetchBestPool(token: string) {
  return (await fetchSolCoinByAddress(token))?.pairAddress;
}
export async function fetchSolanaPool(mint: string, pool: string) {
  if (!isPoolAddr(mint) || !isPoolAddr(pool))
    throw new Error("Invalid Solana mint or pool");
  const body = await getJson<{ pairs?: DexPair[] }>(
    `/dex/latest/dex/pairs/solana/${pool}`,
    10000,
  );
  const pair = onlySolana(body.pairs ?? []).find(
    (p) => p.baseToken.address === mint && p.pairAddress === pool,
  );
  return pair ? pairToCoin(pair) : null;
}
export async function fetchAxiomLive(coin: AxiomCoin) {
  const pair = await fetchSolanaPool(coin.address, coin.pairAddress);
  if (!pair) throw new Error("Pool unavailable");
  return { ...pair, logo: pair.logo || coin.logo };
}
export async function fetchAxiomFeed(): Promise<AxiomCoin[]> {
  const marketMints = [
    WSOL,
    USDC,
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
  ];
  const canonical = new Set(marketMints);
  const [profiles, majors] = await Promise.allSettled([
    getJson<Array<{ chainId: string; tokenAddress: string }>>(
      "/dex/token-boosts/top/v1",
      10000,
    ),
    getJson<DexPair[]>(`/dex/tokens/v1/solana/${marketMints.join(",")}`, 10000),
  ]);
  const coins =
    majors.status === "fulfilled"
      ? onlySolana(majors.value)
          .filter((pair) => canonical.has(pair.baseToken.address))
          .map(pairToCoin)
      : [];
  if (profiles.status === "fulfilled") {
    const addresses = [
      ...new Set(
        profiles.value
          .filter((p) => p.chainId === "solana" && isPoolAddr(p.tokenAddress))
          .map((p) => p.tokenAddress),
      ),
    ].slice(0, 24);
    if (addresses.length) {
      try {
        const pairs = await getJson<DexPair[]>(
          `/dex/tokens/v1/solana/${addresses.join(",")}`,
          10000,
        );
        coins.push(...onlySolana(pairs).map(pairToCoin));
      } catch {
        /* keep majors */
      }
    }
  }
  if (!coins.length)
    throw new Error("Market feed unavailable. Retry or search a Solana mint.");
  return mergePulseCoins(coins).slice(0, 40);
}
export async function fetchPulseLaunches() {
  const profiles = await getJson<
    Array<{ chainId: string; tokenAddress: string }>
  >("/dex/token-profiles/latest/v1", 10000);
  const addresses = [
    ...new Set(
      profiles
        .filter((p) => p.chainId === "solana" && isPoolAddr(p.tokenAddress))
        .map((p) => p.tokenAddress),
    ),
  ].slice(0, 30);
  if (!addresses.length) return [];
  const pairs = await getJson<DexPair[]>(
    `/dex/tokens/v1/solana/${addresses.join(",")}`,
    10000,
  );
  return mergePulseCoins(onlySolana(pairs).map(pairToCoin)).sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  );
}
export function axiomUrl(c: AxiomCoin) {
  return `https://dexscreener.com/solana/${c.pairAddress}`;
}
export function isQuoteToken(addr?: string | null) {
  return addr === WSOL || addr === USDC;
}
export function ageLabel(createdAt?: number, now = Date.now()) {
  if (!createdAt || !Number.isFinite(createdAt)) return "—";
  const sec = Math.max(0, now - createdAt) / 1000;
  return sec < 60
    ? `${Math.floor(sec)}s`
    : sec < 3600
      ? `${Math.floor(sec / 60)}m`
      : sec < 86400
        ? `${Math.floor(sec / 3600)}h`
        : `${Math.floor(sec / 86400)}d`;
}
export function parseBarTime(value: unknown): number {
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  if (typeof value !== "string") return NaN;
  return /^\d+$/.test(value) ? parseBarTime(Number(value)) : Date.parse(value);
}
export function normalizeCandles(rows: Candle[]) {
  const map = new Map<number, Candle>();
  for (const b of rows)
    if (
      [b.t, b.o, b.h, b.l, b.c, b.v].every(Number.isFinite) &&
      b.t > 0 &&
      Math.min(b.o, b.h, b.l, b.c) > 0 &&
      b.h >= Math.max(b.o, b.c) &&
      b.l <= Math.min(b.o, b.c) &&
      b.v >= 0
    )
      map.set(b.t, b);
  return [...map.values()].sort((a, b) => a.t - b.t);
}
export function bucketCandles(rows: Candle[], bucketMs: number) {
  const map = new Map<number, Candle>();
  for (const c of normalizeCandles(rows)) {
    const t = Math.floor(c.t / bucketMs) * bucketMs;
    const p = map.get(t);
    map.set(
      t,
      p
        ? {
            t,
            o: p.o,
            h: Math.max(p.h, c.h),
            l: Math.min(p.l, c.l),
            c: c.c,
            v: p.v + c.v,
          }
        : { ...c, t },
    );
  }
  return [...map.values()];
}
export type PaprikaBar = {
  time_open: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export type PaprikaTransaction = {
  id: string;
  sender: string;
  recipient: string;
  token_0: string;
  token_1: string;
  amount_0: number;
  amount_1: number;
  volume_0: number;
  volume_1: number;
  price_0_usd: number;
  price_1_usd: number;
  created_at: string;
};
export function paprikaTransactionRows(body: unknown): PaprikaTransaction[] {
  const rows = (body as { transactions?: PaprikaTransaction[] })?.transactions;
  return Array.isArray(rows) ? rows : [];
}
export function transactionCandles(
  rows: PaprikaTransaction[],
  token: string,
  bucketMs: number,
) {
  return bucketCandles(
    rows.flatMap((r) => {
      const price =
        r.token_0 === token
          ? Number(r.price_0_usd)
          : r.token_1 === token
            ? Number(r.price_1_usd)
            : 0;
      const t = parseBarTime(r.created_at);
      if (!(price > 0) || !Number.isFinite(t)) return [];
      const volume =
        r.token_0 === token
          ? Math.abs(Number(r.volume_0)) * price
          : Math.abs(Number(r.volume_1)) * price;
      return [
        {
          t,
          o: price,
          h: price,
          l: price,
          c: price,
          v: Number.isFinite(volume) ? volume : 0,
        },
      ];
    }),
    bucketMs,
  );
}
export function paprikaRows(body: unknown): PaprikaBar[] {
  if (Array.isArray(body)) return body;
  const b = body as { data?: PaprikaBar[]; ohlcv?: PaprikaBar[] };
  return b?.data ?? b?.ohlcv ?? [];
}
export function parsePaprikaOhlcv(rows: PaprikaBar[]) {
  return normalizeCandles(
    rows.map((r) => ({
      t: parseBarTime(r.time_open),
      o: Number(r.open),
      h: Number(r.high),
      l: Number(r.low),
      c: Number(r.close),
      v: Number(r.volume),
    })),
  );
}
export type CandleResult = {
  bars: Candle[];
  source: "GeckoTerminal" | "DexPaprika" | "DexPaprika trades" | "Solana RPC";
  fetchedAt: number;
};
const cache = new Map<string, CandleResult>();
const pending = new Map<string, Promise<CandleResult>>();
const key = (pool: string, iv: string, token?: string) =>
  `${pool}:${iv}:${token ?? "base"}`;
export function peekCandles(pool: string, iv: string, token?: string) {
  return cache.get(key(pool, iv, token))?.bars;
}

export async function loadCandleResult(
  pool: string,
  iv: string,
  token?: string,
  before?: number,
  currentPrice = 0,
  maxAgeMs = 25000,
): Promise<CandleResult> {
  if (!isPoolAddr(pool) || !IV_MS[iv])
    throw new Error("Invalid Solana pool or interval");
  const k = key(pool, iv, token) + (before ? `:${before}` : "");
  const hit = cache.get(k);
  if (
    hit &&
    Date.now() - hit.fetchedAt < Math.max(0, Math.min(maxAgeMs, 25000))
  )
    return hit;
  const running = pending.get(k);
  if (running) return running;
  const job = (async () => {
    const unit = iv.endsWith("m")
      ? "minute"
      : iv.endsWith("h")
        ? "hour"
        : "day";
    const aggregate = parseInt(iv);
    try {
      const qs = new URLSearchParams({
        aggregate: String(aggregate),
        limit: "500",
        currency: "usd",
        token: token ?? "base",
      });
      if (before) qs.set("before_timestamp", String(Math.floor(before / 1000)));
      const data = await getJson<{
        data: { attributes: { ohlcv_list: number[][] } };
      }>(`/gecko/networks/solana/pools/${pool}/ohlcv/${unit}?${qs}`, 12000);
      const bars = normalizeCandles(
        (data.data?.attributes?.ohlcv_list ?? []).map((r) => ({
          t: r[0] * 1000,
          o: r[1],
          h: r[2],
          l: r[3],
          c: r[4],
          v: r[5],
        })),
      );
      if (!bars.length) throw new Error("No candles");
      return { bars, source: "GeckoTerminal" as const, fetchedAt: Date.now() };
    } catch {
      try {
        if (["1m", "5m", "15m"].includes(iv)) {
          if (!token || before)
            throw new Error("Short-interval history unavailable");
          const body = await getJson<unknown>(
            `/paprika/networks/solana/pools/${pool}/transactions?limit=100&page=1`,
            10000,
          );
          const bars = transactionCandles(
            paprikaTransactionRows(body),
            token,
            IV_MS[iv],
          );
          if (!bars.length) throw new Error("No priced indexed trades");
          return {
            bars,
            source: "DexPaprika trades" as const,
            fetchedAt: Date.now(),
          };
        }
        // Paprika OHLCV is token0 USD. Only use it when token0 matches the selected mint.
        const meta = await getJson<{ tokens?: Array<{ id: string }> }>(
          `/paprika/networks/solana/pools/${pool}`,
          8000,
        );
        if (token && meta.tokens?.[0]?.id !== token)
          throw new Error("Wrong pool orientation");
        const now = Date.now();
        const end = Math.min(before ?? now, now);
        const freeWindow = 23 * 60 * 60 * 1000;
        if (end < now - freeWindow)
          throw new Error("Outside free history window");
        const qs = new URLSearchParams({
          start: new Date(
            Math.max(now - freeWindow, end - freeWindow),
          ).toISOString(),
          end: new Date(end).toISOString(),
          interval: "1h",
          limit: "100",
        });
        const data = await getJson<unknown>(
          `/paprika/networks/solana/pools/${pool}/ohlcv?${qs}`,
          12000,
        );
        let bars = parsePaprikaOhlcv(paprikaRows(data));
        if (iv === "4h" || iv === "1d") bars = bucketCandles(bars, IV_MS[iv]);
        if (!bars.length) throw new Error("No historical candles");
        return { bars, source: "DexPaprika" as const, fetchedAt: Date.now() };
      } catch {
        throw new Error("No market information for this period yet.");
      }
    }
  })()
    .then((result) => {
      cache.set(k, result);
      if (cache.size > 100) cache.delete(cache.keys().next().value!);
      return result;
    })
    .finally(() => pending.delete(k));
  pending.set(k, job);
  return job;
}
export async function fetchCandles(pool: string, iv: string, token?: string) {
  return (await loadCandleResult(pool, iv, token)).bars;
}
export function prefetchCandles(
  pool?: string,
  intervals: string[] = ["15m"],
  token?: string,
) {
  if (isPoolAddr(pool))
    for (const iv of intervals)
      void fetchCandles(pool, iv, token).catch(() => {});
}
