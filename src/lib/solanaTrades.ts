import { rpc, rpcBatch } from "./rpcFeed";
import { USDC, WSOL } from "./const";

type Balance = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
};
type Transaction = {
  blockTime: number | null;
  meta?: { err: unknown; preTokenBalances?: Balance[]; postTokenBalances?: Balance[] };
  transaction: { message: { accountKeys: Array<{ pubkey: string; signer: boolean }> } };
};
export type RpcPoolTrade = {
  hash: string;
  wallet: string;
  side: "buy" | "sell";
  amount: number;
  quotePerToken?: number;
  timestamp: string;
};

function raw(balance?: Balance) {
  return balance ? BigInt(balance.uiTokenAmount.amount) : 0n;
}

export function parseRpcPoolTrade(hash: string, token: string, tx: Transaction): RpcPoolTrade | null {
  if (!tx?.blockTime || tx.meta?.err) return null;
  const signers = new Set(tx.transaction.message.accountKeys.filter((k) => k.signer).map((k) => k.pubkey));
  const pre = (tx.meta?.preTokenBalances ?? []).filter((b) => b.mint === token && b.owner && signers.has(b.owner));
  const post = (tx.meta?.postTokenBalances ?? []).filter((b) => b.mint === token && b.owner && signers.has(b.owner));
  const owners = new Set([...pre, ...post].map((b) => b.owner!));
  let best: { owner: string; delta: bigint; decimals: number } | null = null;
  for (const owner of owners) {
    const before = pre.filter((b) => b.owner === owner).reduce((n, b) => n + raw(b), 0n);
    const after = post.filter((b) => b.owner === owner).reduce((n, b) => n + raw(b), 0n);
    const balance = post.find((b) => b.owner === owner) ?? pre.find((b) => b.owner === owner);
    const delta = after - before;
    if (balance && delta !== 0n && (!best || (delta < 0n ? -delta : delta) > (best.delta < 0n ? -best.delta : best.delta)))
      best = { owner, delta, decimals: balance.uiTokenAmount.decimals };
  }
  if (!best) return null;
  const all = [...(tx.meta?.preTokenBalances ?? []), ...(tx.meta?.postTokenBalances ?? [])];
  let quotePerToken: number | undefined;
  for (const mint of [USDC, WSOL]) {
    if (mint === token) continue;
    const balances = all.filter((b) => b.mint === mint && b.owner === best!.owner);
    if (!balances.length) continue;
    const before = (tx.meta?.preTokenBalances ?? []).filter((b) => b.mint === mint && b.owner === best!.owner)
      .reduce((n, b) => n + raw(b), 0n);
    const after = (tx.meta?.postTokenBalances ?? []).filter((b) => b.mint === mint && b.owner === best!.owner)
      .reduce((n, b) => n + raw(b), 0n);
    const decimals = balances[0].uiTokenAmount.decimals;
    const quote = Number(after > before ? after - before : before - after) / 10 ** decimals;
    const amount = Number(best.delta < 0n ? -best.delta : best.delta) / 10 ** best.decimals;
    if (quote > 0 && amount > 0) { quotePerToken = quote / amount; break; }
  }
  return {
    hash, wallet: best.owner, side: best.delta > 0n ? "buy" : "sell",
    amount: Number(best.delta < 0n ? -best.delta : best.delta) / 10 ** best.decimals,
    quotePerToken,
    timestamp: new Date(tx.blockTime * 1000).toISOString(),
  };
}

export async function fetchRpcPoolTrades(pool: string, token: string, limit = 24) {
  const signatures = await rpc<Array<{ signature: string; err: unknown }>>("getSignaturesForAddress", [
    pool, { limit, commitment: "confirmed" },
  ]);
  const usable = signatures.filter((s) => !s.err).slice(0, limit);
  const transactions = await rpcBatch<Transaction>(usable.map((s) => ({
    method: "getTransaction",
    params: [s.signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
  })));
  return transactions.flatMap((tx, i) => {
    if (!tx) return [];
    const row = parseRpcPoolTrade(usable[i]?.signature ?? "", token, tx);
    return row ? [row] : [];
  });
}
