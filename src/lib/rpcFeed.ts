import { partFetch } from "./http";
import type { ChainBlock, ChainStats, ChainTx } from "./api";

type RpcBlock = {
  number?: string;
  hash?: string;
  timestamp?: string;
  gasUsed?: string;
  gasLimit?: string;
  size?: string;
  transactions?: Array<string | RpcTx>;
};

type RpcTx = {
  hash?: string;
  from?: string;
  to?: string | null;
  value?: string;
  input?: string;
};

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await partFetch("/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (!res.ok || body.error) throw new Error(body.error?.message || `rpc ${method}`);
  return body.result as T;
}

function hexNum(v?: string) {
  if (!v) return 0;
  const n = Number.parseInt(v, 16);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchBlockNumberRpc() {
  const hex = await rpc<string>("eth_blockNumber");
  return hexNum(hex);
}

export async function fetchStatsRpc(): Promise<ChainStats> {
  const gas = await rpc<string>("eth_gasPrice").catch(() => "0x0");
  const gwei = hexNum(gas) / 1e9;
  return {
    average_block_time: 0,
    coin_price: "0",
    gas_prices: { slow: gwei, average: gwei, fast: gwei },
    total_addresses: "—",
    total_blocks: "—",
    total_transactions: "—",
    transactions_today: "—",
    gas_used_today: "—",
    market_cap: "0",
    network_utilization_percentage: 0,
  };
}

export async function fetchBlocksRpc(count = 18): Promise<ChainBlock[]> {
  const head = await fetchBlockNumberRpc();
  const want = Array.from({ length: count }, (_, i) => head - i).filter((n) => n >= 0);
  const rows = await Promise.all(
    want.map(async (n) => {
      const b = await rpc<RpcBlock | null>("eth_getBlockByNumber", [`0x${n.toString(16)}`, false]);
      if (!b) return null;
      const txs = Array.isArray(b.transactions) ? b.transactions.length : 0;
      return {
        height: hexNum(b.number) || n,
        timestamp: new Date(hexNum(b.timestamp) * 1000).toISOString(),
        transactions_count: txs,
        gas_used: String(hexNum(b.gasUsed)),
        size: hexNum(b.size),
        hash: b.hash ?? "",
      } satisfies ChainBlock;
    })
  );
  return rows.filter((x): x is ChainBlock => Boolean(x));
}

export async function fetchTxsRpc(limit = 24): Promise<ChainTx[]> {
  const head = await fetchBlockNumberRpc();
  const out: ChainTx[] = [];
  for (let i = 0; i < 6 && out.length < limit; i++) {
    const n = head - i;
    if (n < 0) break;
    const b = await rpc<RpcBlock | null>("eth_getBlockByNumber", [`0x${n.toString(16)}`, true]);
    if (!b?.transactions) continue;
    const ts = new Date(hexNum(b.timestamp) * 1000).toISOString();
    for (const tx of b.transactions) {
      if (typeof tx === "string" || !tx.hash || !tx.from) continue;
      out.push({
        hash: tx.hash,
        timestamp: ts,
        status: "ok",
        method: null,
        value: tx.value ? String(BigInt(tx.value)) : "0",
        from: { hash: tx.from },
        to: { hash: tx.to ?? "" },
        block_number: hexNum(b.number) || n,
      });
      if (out.length >= limit) break;
    }
  }
  return out;
}
