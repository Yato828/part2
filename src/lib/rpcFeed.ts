import { getJson } from "./http";
async function requestRpc<T>(
  method: string,
  params: unknown[] = [],
): Promise<T> {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  };
  const request = async (endpoint: string) => {
    const body = await getJson<{ result?: T; error?: { message: string } }>(
      endpoint,
      6000,
      init,
    );
    if (body.error || body.result === undefined)
      throw new Error(body.error?.message ?? "Solana RPC unavailable");
    return body.result;
  };
  try {
    // These are read-only RPC calls. Racing two public nodes avoids waiting through
    // a provider's full timeout when it is rate limited.
    return await Promise.any([request("/rpc"), request("/rpc-backup")]);
  } catch (error) {
    if (error instanceof AggregateError) {
      const last = error.errors.at(-1);
      if (last instanceof Error) throw last;
    }
    throw error;
  }
}

export async function rpcBatch<T>(
  calls: Array<{ method: string; params?: unknown[] }>,
): Promise<Array<T | null>> {
  if (!calls.length) return [];
  const body = calls.map((call, i) => ({
    jsonrpc: "2.0",
    id: i + 1,
    method: call.method,
    params: call.params ?? [],
  }));
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
  const request = async (endpoint: string) => {
    const rows = await getJson<
      Array<{ id: number; result?: T; error?: { message: string } }>
    >(endpoint, 10000, init);
    const byId = new Map(rows.map((row) => [row.id, row]));
    return body.map((call) => {
      const row = byId.get(call.id);
      return row?.result === undefined ? null : row.result;
    });
  };
  try {
    return await Promise.any([request("/rpc"), request("/rpc-backup")]);
  } catch (error) {
    if (error instanceof AggregateError) {
      const last = error.errors.at(-1);
      if (last instanceof Error) throw last;
    }
    throw error;
  }
}
export const fetchBlockNumberRpc = () =>
  rpc<number>("getSlot", [{ commitment: "confirmed" }]);

// Share bounded read snapshots between visible modules without caching writes.
const READ_TTL: Record<string, number> = {
  getSlot: 3000,
  getRecentPerformanceSamples: 15000,
  getBlocks: 10000,
  getBlock: 60000,
  getTokenSupply: 30000,
  getTokenLargestAccounts: 30000,
  getMultipleAccounts: 30000,
  getSignaturesForAddress: 15000,
  getTransaction: 60000,
  getBalance: 10000,
};
const snapshots = new Map<string, { value: unknown; until: number }>();
const pendingReads = new Map<string, Promise<unknown>>();
export async function rpc<T>(
  method: string,
  params: unknown[] = [],
  fresh = false,
): Promise<T> {
  const ttl = READ_TTL[method];
  if (!ttl) return requestRpc<T>(method, params);
  const key = JSON.stringify([method, params]);
  const cached = snapshots.get(key);
  if (!fresh && cached && cached.until > Date.now()) return cached.value as T;
  const pending = pendingReads.get(key);
  if (pending) return pending as Promise<T>;
  const job = requestRpc<T>(method, params)
    .then((value) => {
      snapshots.set(key, { value, until: Date.now() + ttl });
      if (snapshots.size > 128)
        snapshots.delete(snapshots.keys().next().value!);
      return value;
    })
    .finally(() => pendingReads.delete(key));
  pendingReads.set(key, job);
  return job;
}
