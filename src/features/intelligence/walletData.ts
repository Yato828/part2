import { rpc } from "../../lib/rpcFeed";
import { isSolanaAddress } from "../../lib/validation";
export type WatchedWallet = { address: string; label: string; pinned: boolean };
export function parseWatchlist(raw: unknown): WatchedWallet[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw
    .filter(
      (w) =>
        w &&
        isSolanaAddress(w.address) &&
        !seen.has(w.address) &&
        seen.add(w.address),
    )
    .slice(0, 20)
    .map((w) => ({
      address: w.address,
      label: typeof w.label === "string" ? w.label.slice(0, 48) : "Wallet",
      pinned: w.pinned === true,
    }));
}
type ParsedTx = {
  blockTime: number | null;
  transaction: { message: { accountKeys: Array<{ pubkey: string } | string> } };
  meta: {
    err: unknown;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: Balance[];
    postTokenBalances?: Balance[];
  } | null;
};
type Balance = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { uiAmountString: string };
};
export type WalletEvent = {
  hash: string;
  wallet: string;
  label: string;
  timestamp: string | null;
  mint: string;
  action: string;
  amount: number;
  source: string;
  failed: boolean;
};
export function walletChanges(
  tx: ParsedTx,
  wallet: WatchedWallet,
  hash: string,
): WalletEvent[] {
  const base = {
    hash,
    wallet: wallet.address,
    label: wallet.label,
    timestamp: tx.blockTime
      ? new Date(tx.blockTime * 1000).toISOString()
      : null,
    source: "Solana mainnet RPC",
    failed: !!tx.meta?.err,
  };
  if (!tx.meta || tx.meta.err)
    return [{ ...base, mint: "", action: "Failed transaction", amount: 0 }];
  const changes = new Map<string, number>();
  for (const [rows, sign] of [
    [tx.meta.preTokenBalances ?? [], -1],
    [tx.meta.postTokenBalances ?? [], 1],
  ] as const) {
    for (const b of rows)
      if (b.owner === wallet.address)
        changes.set(
          b.mint,
          (changes.get(b.mint) ?? 0) +
            sign * Number(b.uiTokenAmount.uiAmountString),
        );
  }
  const rows: WalletEvent[] = [...changes]
    .filter(([, v]) => Number.isFinite(v) && Math.abs(v) > 1e-12)
    .map(([mint, delta]) => ({
      ...base,
      mint,
      action: delta > 0 ? "Token net received" : "Token net sent",
      amount: Math.abs(delta),
    }));
  const idx = tx.transaction.message.accountKeys.findIndex(
    (k) => (typeof k === "string" ? k : k.pubkey) === wallet.address,
  );
  if (idx >= 0) {
    const delta = (tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / 1e9;
    if (Number.isFinite(delta) && delta !== 0)
      rows.push({
        ...base,
        mint: "SOL",
        action: "SOL net delta (incl. fees)",
        amount: delta,
      });
  }
  return rows.length
    ? rows
    : [
        {
          ...base,
          mint: "",
          action: "Transaction · no wallet balance change",
          amount: 0,
        },
      ];
}
export async function walletActivity(wallet: WatchedWallet, before?: string) {
  if (!isSolanaAddress(wallet.address))
    throw new Error("Invalid Solana wallet");
  const signatures = await rpc<
    Array<{ signature: string; blockTime: number | null; err: unknown }>
  >("getSignaturesForAddress", [
    wallet.address,
    { limit: 8, commitment: "confirmed", ...(before ? { before } : {}) },
  ]);
  const fetchDetail = async (s: (typeof signatures)[number]) => {
    const tx = await rpc<ParsedTx | null>("getTransaction", [
      s.signature,
      {
        encoding: "jsonParsed",
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      },
    ]);
    if (!tx)
      return [
        {
          hash: s.signature,
          wallet: wallet.address,
          label: wallet.label,
          timestamp: s.blockTime
            ? new Date(s.blockTime * 1000).toISOString()
            : null,
          mint: "",
          action: "Transaction details unavailable",
          amount: 0,
          source: "Solana mainnet RPC",
          failed: !!s.err,
        },
      ];
    return walletChanges(tx, wallet, s.signature);
  };
  const results: PromiseSettledResult<WalletEvent[]>[] = [];
  for (let i = 0; i < signatures.length; i += 2)
    results.push(
      ...(await Promise.allSettled(
        signatures.slice(i, i + 2).map(fetchDetail),
      )),
    );
  const rows = results.flatMap((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : [
          {
            hash: signatures[i].signature,
            wallet: wallet.address,
            label: wallet.label,
            timestamp: signatures[i].blockTime
              ? new Date(signatures[i].blockTime! * 1000).toISOString()
              : null,
            mint: "",
            action: "Transaction details unavailable",
            amount: 0,
            source: "Solana mainnet RPC",
            failed: !!signatures[i].err,
          },
        ],
  );
  return {
    rows,
    before: signatures.length === 8 ? signatures.at(-1)?.signature : undefined,
    partial: results.some((r) => r.status === "rejected"),
  };
}
