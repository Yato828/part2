import { getJson } from "./http";
import { rpc } from "./rpcFeed";
import { isSolanaAddress } from "./validation";
import type { TokenHolder } from "./api";
export type HolderSnapshot = {
  holders: TokenHolder[];
  source: "Solana RPC" | "RugCheck";
  fetchedAt: number;
  accountCount: number;
  partial: boolean;
  supply?: number;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
};
export type IndexedHolder = {
  owner?: string;
  address?: string;
  uiAmount?: number;
  uiAmountString?: string;
  amount?: number | string;
  decimals?: number;
};
export function indexedHolders(rows: IndexedHolder[]): TokenHolder[] {
  const owners = new Map<string, number>();
  for (const row of rows) {
    if (!isSolanaAddress(row.owner)) continue;
    const amount =
      row.uiAmountString != null
        ? Number(row.uiAmountString)
        : (row.uiAmount ?? Number(row.amount) / 10 ** Number(row.decimals));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    owners.set(row.owner, (owners.get(row.owner) ?? 0) + amount);
  }
  return [...owners]
    .map(([hash, value]) => ({ address: { hash }, value: String(value) }))
    .sort((a, b) => Number(b.value) - Number(a.value));
}
const cache = new Map<string, HolderSnapshot>();
const pending = new Map<string, Promise<HolderSnapshot>>();
export async function fetchHolderSnapshot(
  mint: string,
  force = false,
): Promise<HolderSnapshot> {
  if (!isSolanaAddress(mint)) throw new Error("Select a valid Solana mint.");
  const hit = cache.get(mint);
  if (!force && hit && Date.now() - hit.fetchedAt < 30000) return hit;
  if (pending.has(mint)) return pending.get(mint)!;
  const fromRpc = async (): Promise<HolderSnapshot> => {
    const largest = await rpc<{
      value: Array<{ address: string; amount: string; decimals: number }>;
    }>("getTokenLargestAccounts", [mint, { commitment: "confirmed" }], force);
    const accounts = largest.value?.slice(0, 20) ?? [];
    if (!accounts.length) throw new Error("RPC returned no largest accounts");
    const owners = await rpc<{
      value: Array<{
        data?: { parsed?: { info?: { owner?: string } } };
      } | null>;
    }>(
      "getMultipleAccounts",
      [
        accounts.map((a) => a.address),
        { encoding: "jsonParsed", commitment: "confirmed" },
      ],
      force,
    );
    const rows = accounts.map((a, i) => ({
      ...a,
      owner: owners.value[i]?.data?.parsed?.info?.owner,
    }));
    const holders = indexedHolders(rows);
    if (!holders.length)
      throw new Error("RPC could not resolve account owners");
    return {
      holders,
      source: "Solana RPC",
      fetchedAt: Date.now(),
      accountCount: accounts.length,
      partial: rows.some((r) => !isSolanaAddress(r.owner)),
    };
  };
  const indexed = async (): Promise<HolderSnapshot> => {
    const report = await getJson<{
      mint?: string;
      topHolders?: IndexedHolder[] | null;
      token?: {
        supply?: number;
        decimals?: number;
        mintAuthority?: string | null;
        freezeAuthority?: string | null;
      };
    }>(`/rugcheck/tokens/${mint}/report`, 10000);
    if (report.mint !== mint)
      throw new Error("Holder report does not match selected mint");
    const rows = (report.topHolders ?? []).slice(0, 20);
    const holders = indexedHolders(rows);
    if (!holders.length)
      throw new Error("No indexed holder snapshot for this mint");
    const token = report.token;
    const supply =
      token &&
      Number.isInteger(token.decimals) &&
      token.decimals! >= 0 &&
      token.decimals! <= 18
        ? Number(token.supply) / 10 ** token.decimals!
        : NaN;
    return {
      holders,
      source: "RugCheck",
      fetchedAt: Date.now(),
      accountCount: rows.length,
      partial: rows.some((r) => !isSolanaAddress(r.owner)),
      ...(Number.isFinite(supply) && supply > 0 ? { supply } : {}),
      ...(token && Object.hasOwn(token, "mintAuthority")
        ? { mintAuthority: token.mintAuthority }
        : {}),
      ...(token && Object.hasOwn(token, "freezeAuthority")
        ? { freezeAuthority: token.freezeAuthority }
        : {}),
    };
  };
  const job = Promise.any([fromRpc(), indexed()])
    .then((result) => {
      cache.set(mint, result);
      if (cache.size > 40) cache.delete(cache.keys().next().value!);
      return result;
    })
    .catch(() => {
      throw new Error(
        "Holder sources are unavailable for this mint. Public RPC may restrict holder scans and the indexer may have no snapshot. Retry or inspect the mint on Solscan.",
      );
    })
    .finally(() => pending.delete(mint));
  pending.set(mint, job);
  return job;
}
