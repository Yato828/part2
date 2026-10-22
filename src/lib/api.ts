import { getJson } from "./http";
import { rpc } from "./rpcFeed";
import { isPoolAddr, paprikaTransactionRows } from "./axiom";
import { fetchRpcPoolTrades } from "./solanaTrades";
import { fetchHolderSnapshot } from "./holders";
export type TokenHolder = {
  address: { hash: string; name?: string | null; is_contract?: boolean };
  value: string;
};
export type TokenTransfer = {
  timestamp: string;
  tx_hash?: string;
  transaction_hash?: string;
  from: { hash: string };
  to: { hash: string };
  total?: { value: string; decimals?: string };
};
export type PoolSwap = {
  sender: string;
  recipient: string;
  volume_0: number;
  price_0_usd: number;
  created_at: string;
};
export type Trade = {
  hash: string;
  wallet: string;
  side: "buy" | "sell";
  usd: number;
  amount: number;
  price: number;
  timestamp: string;
};
export type ChainBlock = {
  height: number;
  timestamp: string;
  transactions_count: number;
  hash: string;
};
export type ChainStats = { slot: number; tps: number };
export async function fetchStats(): Promise<ChainStats> {
  const [slotResult, samplesResult] = await Promise.allSettled([
    rpc<number>("getSlot", [{ commitment: "confirmed" }]),
    rpc<Array<{ numTransactions: number; samplePeriodSecs: number }>>(
      "getRecentPerformanceSamples",
      [1],
    ),
  ]);
  if (slotResult.status === "rejected" && samplesResult.status === "rejected") {
    throw slotResult.reason;
  }
  const slot = slotResult.status === "fulfilled" ? slotResult.value : NaN;
  const samples =
    samplesResult.status === "fulfilled" ? samplesResult.value : [];
  return {
    slot,
    tps: samples[0]
      ? samples[0].numTransactions / samples[0].samplePeriodSecs
      : NaN,
  };
}
export async function fetchBlocks(): Promise<ChainBlock[]> {
  const head = await rpc<number>("getSlot", [{ commitment: "finalized" }]);
  const slots = await rpc<number[]>("getBlocks", [
    head - 8,
    head,
    { commitment: "finalized" },
  ]);
  const results = await Promise.allSettled(
    slots
      .slice(-4)
      .reverse()
      .map(async (height) => {
        const block = await rpc<{
          blockhash: string;
          blockTime: number;
          signatures: string[];
        }>("getBlock", [
          height,
          {
            commitment: "finalized",
            transactionDetails: "signatures",
            rewards: false,
            maxSupportedTransactionVersion: 0,
          },
        ]);
        return {
          height,
          hash: block.blockhash,
          timestamp: new Date(block.blockTime * 1000).toISOString(),
          transactions_count: block.signatures.length,
        };
      }),
  );
  const detailed = results.flatMap((r) =>
    r.status === "fulfilled" ? [r.value] : [],
  );
  if (detailed.length) return detailed;
  throw new Error("Block details unavailable from connected RPC sources");
}
export async function fetchTrades(
  pool: string,
  token: string,
  tokenPrice = 0,
): Promise<Trade[]> {
  const onchain = async () => {
    const rows = await fetchRpcPoolTrades(pool, token);
    if (!rows.length) throw new Error("No RPC trades");
    return rows.map((row) => ({
      ...row,
      price: tokenPrice,
      usd: row.amount * tokenPrice,
    }));
  };
  const indexed = async () => {
    const body = await getJson<unknown>(
      `/paprika/networks/solana/pools/${pool}/transactions?limit=100&page=1`,
      10000,
    );
    const rows = paprikaTransactionRows(body).flatMap((row) => {
      const token0 = row.token_0 === token;
      const token1 = row.token_1 === token;
      if (!token0 && !token1) return [];
      const amount = Math.abs(Number(token0 ? row.volume_0 : row.volume_1));
      const price = Number(token0 ? row.price_0_usd : row.price_1_usd);
      const poolDelta = Number(token0 ? row.amount_0 : row.amount_1);
      return [
        {
          hash: row.id,
          wallet: row.sender,
          side: poolDelta < 0 ? ("buy" as const) : ("sell" as const),
          usd: amount * price,
          amount,
          price,
          timestamp: row.created_at,
        },
      ];
    });
    if (!rows.length) throw new Error("No indexed trades");
    return rows;
  };
  try {
    return await Promise.any([indexed(), onchain()]);
  } catch {
    // Some pools are indexed by GeckoTerminal but not DexPaprika.
  }
  const body = await getJson<{
    data: Array<{
      attributes: {
        tx_hash: string;
        tx_from_address: string;
        kind: "buy" | "sell";
        volume_in_usd: string;
        from_token_amount: string;
        to_token_amount: string;
        price_from_in_usd: string;
        price_to_in_usd: string;
        block_timestamp: string;
        from_token_address: string;
        to_token_address: string;
      };
    }>;
  }>(`/gecko/networks/solana/pools/${pool}/trades`, 10000);
  return (body.data ?? []).flatMap(({ attributes: a }) => {
    const buy = a.to_token_address === token;
    if (!buy && a.from_token_address !== token) return [];
    return [
      {
        hash: a.tx_hash,
        wallet: a.tx_from_address,
        side: buy ? ("buy" as const) : ("sell" as const),
        usd: Number(a.volume_in_usd),
        amount: Number(buy ? a.to_token_amount : a.from_token_amount),
        price: Number(buy ? a.price_to_in_usd : a.price_from_in_usd),
        timestamp: a.block_timestamp,
      },
    ];
  });
}
export async function fetchHolders(mint: string): Promise<TokenHolder[]> {
  if (!isPoolAddr(mint)) return [];
  return (await fetchHolderSnapshot(mint)).holders;
}
// Owner-to-owner transfers require an indexer. Never infer edges from swaps or shared pools.
export async function fetchTransfers(_mint: string): Promise<TokenTransfer[]> {
  return [];
}
export async function fetchPoolSwaps(_pool: string): Promise<PoolSwap[]> {
  return [];
}
