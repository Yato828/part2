import { getJson } from "./http";
import { isExtension } from "./env";
import { fetchBlockNumberRpc, fetchBlocksRpc, fetchStatsRpc, fetchTxsRpc } from "./rpcFeed";

export type RhDeployment = {
  contractAddress: string;
  chainId: number;
  networkName?: string;
};

export type RhAsset = {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  deployments: RhDeployment[];
  currentMultiplier: string;
  pendingMultiplier: string;
  pendingMultiplierEffectiveTime?: string;
  logoUrl?: string;
  status: string;
  isin?: string;
  tokenDecimals?: number;
};

export type RhQuote = {
  tokenSymbol: string;
  deployments: RhDeployment[];
  bid: string;
  ask: string;
  currency: string;
  dailyTradingVolume: string;
  isTradingHalt: boolean;
  generatedAt: string;
  dailyHigh?: string;
  dailyLow?: string;
  mintBurnTokenVolume?: string;
  mintBurnUsdVolume?: string;
  change24h?: number;
  change1h?: number;
  liquidityUsd?: number;
  dex?: string;
  fdv?: number;
};

export type ChainStats = {
  average_block_time: number;
  coin_price: string;
  gas_prices: { slow: number; average: number; fast: number };
  total_addresses: string;
  total_blocks: string;
  total_transactions: string;
  transactions_today: string;
  gas_used_today: string;
  market_cap: string;
  network_utilization_percentage: number;
};

export type ChainToken = {
  address_hash: string;
  name: string;
  symbol: string;
  decimals: string;
  holders_count: string | number;
  exchange_rate: string | null;
  circulating_market_cap: string | null;
  volume_24h: string | null;
  total_supply: string | null;
  icon_url: string | null;
  type: string;
};

export type ChainTx = {
  hash: string;
  timestamp: string;
  status: string;
  method: string | null;
  value: string;
  from: { hash: string };
  to: { hash: string | null; name?: string | null };
  block_number: number;
  transaction_types?: string[];
};

export type ChainBlock = {
  height: number;
  timestamp: string;
  transactions_count: number;
  gas_used: string;
  size: number;
  hash: string;
};

export type TokenTransfer = {
  timestamp: string;
  tx_hash?: string;
  transaction_hash?: string;
  from: { hash: string };
  to: { hash: string };
  total?: { value: string; decimals?: string };
};

export type DexPair = {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  volume?: { h24?: number; h1?: number; m5?: number };
  priceChange?: { h24?: number; h1?: number; m5?: number; h6?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  txns?: { h24?: { buys: number; sells: number } };
};

export function rhAddress(asset: RhAsset, chainId = 4663) {
  return asset.deployments?.find((d) => d.chainId === chainId)?.contractAddress ?? asset.deployments?.[0]?.contractAddress;
}

function bestPair(pairs: DexPair[], address?: string) {
  const robin = pairs.filter((p) => p.chainId === "robinhood");
  const pool = address
    ? robin.filter((p) => p.baseToken.address.toLowerCase() === address.toLowerCase())
    : robin;
  const list = (pool.length ? pool : robin).slice().sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  return list[0] ?? null;
}

function quoteFromPair(pair: DexPair, symbol?: string): RhQuote {
  const price = Number(pair.priceUsd);
  const spread = Number.isFinite(price) ? Math.max(price * 0.0004, 0.0001) : 0;
  return {
    tokenSymbol: symbol || pair.baseToken.symbol,
    deployments: [{ contractAddress: pair.baseToken.address, chainId: 4663, networkName: "Robinhood Chain" }],
    bid: Number.isFinite(price) ? (price - spread).toString() : "0",
    ask: Number.isFinite(price) ? (price + spread).toString() : "0",
    currency: "USD",
    dailyTradingVolume: String(pair.volume?.h24 ?? 0),
    isTradingHalt: false,
    generatedAt: new Date().toISOString(),
    change24h: pair.priceChange?.h24,
    change1h: pair.priceChange?.h1,
    liquidityUsd: pair.liquidity?.usd,
    dex: pair.dexId,
    fdv: pair.fdv ?? pair.marketCap,
  };
}

async function assetsFromRegistry() {
  const local = await getJson<{ assets: RhAsset[] }>("/registry.json", 8000);
  return (local.assets ?? []).filter((a) => a.deployments?.some((d) => d.chainId === 4663));
}

export async function fetchAssets() {
  if (isExtension()) {
    try {
      const local = await assetsFromRegistry();
      if (local.length) return local;
    } catch {
      /* packed registry missing */
    }
  }
  try {
    const data = await getJson<{ assets: RhAsset[] }>("/rhj/assets", 2500);
    const list = (data.assets ?? []).filter((a) => a.deployments?.some((d) => d.chainId === 4663));
    if (list.length) return list;
  } catch {
    /* geo-blocked in some regions */
  }
  return assetsFromRegistry();
}

export async function fetchDexByAddress(address: string) {
  const pairs = await getJson<DexPair[] | { pairs: DexPair[] }>(`/dex/token-pairs/v1/robinhood/${address}`);
  const list = Array.isArray(pairs) ? pairs : pairs.pairs ?? [];
  return bestPair(list, address);
}

export async function fetchDexQuotes(entries: Array<{ symbol: string; address: string }>) {
  const map = new Map<string, RhQuote>();
  for (let i = 0; i < entries.length; i += 30) {
    const chunk = entries.slice(i, i + 30);
    const path = `/dex/latest/dex/tokens/${chunk.map((e) => e.address).join(",")}`;
    try {
      const body = await getJson<DexPair[] | { pairs: DexPair[] }>(path);
      const list = Array.isArray(body) ? body : body.pairs ?? [];
      for (const e of chunk) {
        const pair = bestPair(list, e.address);
        if (pair) map.set(e.symbol.toUpperCase(), quoteFromPair(pair, e.symbol.toUpperCase()));
      }
    } catch {
      /* skip chunk */
    }
  }
  return map;
}

export async function fetchPrice(symbol: string, address?: string) {
  try {
    const data = await getJson<{ quotes: RhQuote[] }>(`/rhj/prices/${encodeURIComponent(symbol)}`);
    if (data.quotes?.[0]) return data.quotes[0];
  } catch {
    /* blocked */
  }
  if (address) {
    const pair = await fetchDexByAddress(address);
    if (pair) return quoteFromPair(pair, symbol.toUpperCase());
  }
  const search = await getJson<{ pairs: DexPair[] }>(`/dex/latest/dex/search?q=${encodeURIComponent(symbol)}`);
  const pair = bestPair(search.pairs ?? [], address);
  return pair ? quoteFromPair(pair, symbol.toUpperCase()) : null;
}

export async function fetchPrices(entries: Array<{ symbol: string; address: string }>) {
  const map = await fetchDexQuotes(entries);
  if (map.size) return map;
  const fallback = new Map<string, RhQuote>();
  await Promise.all(
    entries.slice(0, 8).map(async (e) => {
      try {
        const q = await fetchPrice(e.symbol, e.address);
        if (q) fallback.set(e.symbol.toUpperCase(), q);
      } catch {
        /* ignore */
      }
    })
  );
  return fallback;
}

export async function fetchCorpActions() {
  try {
    return await getJson<{ corpActions: Array<{ tokenSymbol: string; type: string; status: string; processDate?: { year: number; month: number; day: number } }> }>("/rhj/corporate-actions");
  } catch {
    return { corpActions: [] };
  }
}

export async function fetchStats() {
  try {
    return await getJson<ChainStats>("/chain/stats", 4000);
  } catch {
    return fetchStatsRpc();
  }
}

export async function fetchTxs() {
  try {
    return await getJson<ChainTx[]>("/chain/main-page/transactions", 4000);
  } catch {
    return fetchTxsRpc();
  }
}

export async function fetchBlocks() {
  try {
    return await getJson<ChainBlock[]>("/chain/main-page/blocks", 4000);
  } catch {
    return fetchBlocksRpc();
  }
}

export async function fetchChainTokens() {
  try {
    const data = await getJson<{ items: ChainToken[] }>("/chain/tokens?type=ERC-20");
    if (data.items?.length) return data.items;
  } catch {
    /* cf */
  }
  try {
    const data = await getJson<{ data: Array<{ attributes: { address: string; name: string; symbol: string; price_usd?: string; volume_usd?: { h24?: string }; fdv_usd?: string; image_url?: string } }> }>("/gecko/networks/robinhood/trending_pools?page=1");
    return (data.data ?? []).map((p) => ({
      address_hash: p.attributes.address,
      name: p.attributes.name,
      symbol: p.attributes.symbol,
      decimals: "18",
      holders_count: "—",
      exchange_rate: p.attributes.price_usd ?? null,
      circulating_market_cap: p.attributes.fdv_usd ?? null,
      volume_24h: p.attributes.volume_usd?.h24 ?? null,
      total_supply: null,
      icon_url: p.attributes.image_url ?? null,
      type: "ERC-20",
    }));
  } catch {
    return [];
  }
}

export async function fetchToken(address: string) {
  return getJson<ChainToken>(`/chain/tokens/${address}`);
}

export async function fetchTransfers(address: string) {
  const data = await getJson<{ items: TokenTransfer[] }>(`/chain/tokens/${address}/transfers`);
  return data.items ?? [];
}

export type TokenHolder = {
  address: { hash: string; name?: string | null; is_contract?: boolean };
  value: string;
};

export async function fetchHolders(address: string) {
  const data = await getJson<{ items: TokenHolder[] }>(`/chain/tokens/${address}/holders`);
  return data.items ?? [];
}

export type PoolSwap = {
  sender: string;
  recipient: string;
  volume_0: number;
  price_0_usd: number;
  created_at: string;
};

export async function fetchPoolSwaps(pool: string) {
  const data = await getJson<{ transactions: PoolSwap[] }>(
    `/paprika/networks/robinhood/pools/${pool.toLowerCase()}/transactions?limit=100&page=1`
  );
  return data.transactions ?? [];
}

export async function fetchSearch(q: string) {
  return getJson<{ pairs: DexPair[] }>(`/dex/latest/dex/search?q=${encodeURIComponent(q)}`);
}

export async function fetchBlockNumber() {
  try {
    return await fetchBlockNumberRpc();
  } catch {
    return 0;
  }
}

export async function fetchTrendingPools() {
  const data = await getJson<{
    data: Array<{
      attributes: {
        name: string;
        address: string;
        base_token_price_usd: string;
        volume_usd?: { h24?: string };
        reserve_in_usd?: string;
        price_change_percentage?: { h24?: string };
      };
      relationships?: { base_token?: { data?: { id: string } } };
    }>;
  }>("/gecko/networks/robinhood/trending_pools?page=1");
  return data.data ?? [];
}
