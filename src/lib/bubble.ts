import {
  fetchTrades,
  type PoolSwap,
  type TokenHolder,
  type TokenTransfer,
} from "./api";
import { fetchHolderSnapshot } from "./holders";
import { USDC, WSOL } from "./const";
import { isPoolAddr } from "./axiom";

export type BubbleNode = {
  id: string;
  size: number;
  txs: number;
  cluster: number;
  share: number;
  name?: string;
  contract?: boolean;
};

export type BubbleLink = {
  source: string;
  target: string;
  value: number;
};

export type BubbleGraph = {
  nodes: BubbleNode[];
  links: BubbleLink[];
  kind?: "holders" | "traders";
  source?: string;
  notice?: string;
};

const ZERO = "11111111111111111111111111111111";
const SKIP = new Set([ZERO, WSOL, USDC]);

function norm(addr?: string | null) {
  return addr ?? "";
}

function skipAddr(addr: string, extra?: string[]) {
  if (!isPoolAddr(addr)) return true;
  const id = addr;
  if (SKIP.has(id)) return true;
  return extra?.some((x) => x === id) ?? false;
}

function addVol(
  map: Map<string, BubbleNode>,
  id: string,
  vol: number,
  txs: number,
  extra?: Partial<BubbleNode>,
) {
  const k = id;
  const prev = map.get(k);
  if (prev) {
    prev.size += vol;
    prev.txs += txs;
    if (extra?.name && !prev.name) prev.name = extra.name;
    if (extra?.contract) prev.contract = true;
    return;
  }
  map.set(k, {
    id: k,
    size: vol,
    txs,
    cluster: 0,
    share: 0,
    ...extra,
  });
}

function addLink(
  links: Map<string, BubbleLink>,
  from: string,
  to: string,
  value: number,
) {
  const source = from;
  const target = to;
  if (source === target) return;
  const k = `${source}>${target}`;
  const prev = links.get(k);
  if (prev) {
    prev.value += value;
    return;
  }
  links.set(k, { source, target, value });
}

export function clusterNodes(nodes: BubbleNode[], links: BubbleLink[]) {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  const unite = (a: string, b: string) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent.set(pa, pb);
  };
  for (const n of nodes) parent.set(n.id, n.id);
  for (const l of links) {
    if (parent.has(l.source) && parent.has(l.target)) unite(l.source, l.target);
  }
  const roots = new Map<string, number>();
  let next = 0;
  for (const n of nodes) {
    const r = find(n.id);
    if (!roots.has(r)) roots.set(r, next++);
    n.cluster = roots.get(r)!;
  }
  return nodes;
}

export function buildBubbleGraph(
  holders: TokenHolder[],
  transfers: TokenTransfer[],
  swaps: PoolSwap[],
): BubbleGraph {
  const extraSkip: string[] = [];
  const nodes = new Map<string, BubbleNode>();
  const links = new Map<string, BubbleLink>();

  for (const h of holders) {
    const id = norm(h.address?.hash);
    if (skipAddr(id, extraSkip)) continue;
    const raw = Number(h.value);
    addVol(nodes, id, Number.isFinite(raw) ? raw : 0, 0, {
      name: h.address?.name || undefined,
      contract: h.address?.is_contract,
    });
  }

  for (const tr of transfers) {
    const from = norm(tr.from?.hash);
    const to = norm(tr.to?.hash);
    const val = tr.total
      ? Number(tr.total.value) / 10 ** Number(tr.total.decimals ?? 18)
      : 1;
    const amt = Number.isFinite(val) && val > 0 ? val : 1;
    if (!skipAddr(from, extraSkip)) {
      addVol(nodes, from, amt, 1);
    }
    if (!skipAddr(to, extraSkip)) {
      addVol(nodes, to, amt, 1);
    }
    if (!skipAddr(from, extraSkip) && !skipAddr(to, extraSkip)) {
      addLink(links, from, to, amt);
    }
  }

  for (const s of swaps) {
    const wallet = skipAddr(s.sender, extraSkip) ? s.recipient : s.sender;
    const id = norm(wallet);
    if (skipAddr(id, extraSkip)) continue;
    const usd =
      Math.abs(Number(s.volume_0) * Number(s.price_0_usd)) ||
      Math.abs(Number(s.volume_0)) ||
      1;
    addVol(nodes, id, usd, 1);
  }

  const ranked = [...nodes.values()]
    .sort((a, b) => b.size - a.size)
    .slice(0, 36);
  const keep = new Set(ranked.map((n) => n.id));
  const keptLinks = [...links.values()].filter(
    (l) => keep.has(l.source) && keep.has(l.target),
  );
  clusterNodes(ranked, keptLinks);
  const total = ranked.reduce((s, n) => s + n.size, 0) || 1;
  for (const n of ranked) n.share = n.size / total;
  return { nodes: ranked, links: keptLinks };
}

export { indexedHolders } from "./holders";
const graphCache = new Map<string, { graph: BubbleGraph; until: number }>();
const graphPending = new Map<string, Promise<BubbleGraph>>();
export async function fetchBubbleGraph(
  token?: string,
  pool?: string,
  mode: "auto" | "holders" | "traders" = "auto",
  force = false,
): Promise<BubbleGraph> {
  if (!isPoolAddr(token)) return { nodes: [], links: [] };
  const key = `${token}:${pool}:${mode}`;
  const cached = graphCache.get(key);
  if (!force && cached && cached.until > Date.now()) return cached.graph;
  const running = graphPending.get(key);
  if (running) return running;
  const job = (async (): Promise<BubbleGraph> => {
    if (mode !== "traders") {
      try {
        const snapshot = await fetchHolderSnapshot(token, force);
        return {
          ...buildBubbleGraph(snapshot.holders, [], []),
          kind: "holders",
          source: snapshot.source,
          notice: `${snapshot.source} · largest-account owners · % of displayed balances, not total supply. ${snapshot.source === "RugCheck" ? "Indexed snapshot; balance timestamp not supplied. " : ""}No inferred transfer links.`,
        };
      } catch {
        /* Explicit Traders fallback is labeled below. */
      }
      if (mode === "holders")
        throw new Error(
          "Holder data is unavailable for this mint. Try Traders or retry.",
        );
    }
    if (!isPoolAddr(pool))
      throw new Error("Select a pool to load wallet activity.");
    const trades = await fetchTrades(pool, token);
    const wallets = new Map<string, BubbleNode>();
    for (const trade of trades) {
      if (
        !isPoolAddr(trade.wallet) ||
        !Number.isFinite(trade.usd) ||
        trade.usd <= 0
      )
        continue;
      const node = wallets.get(trade.wallet) ?? {
        id: trade.wallet,
        size: 0,
        txs: 0,
        cluster: wallets.size,
        share: 0,
      };
      node.size += trade.usd;
      node.txs++;
      wallets.set(trade.wallet, node);
    }
    const nodes = [...wallets.values()]
      .sort((a, b) => b.size - a.size)
      .slice(0, 36);
    const total = nodes.reduce((sum, n) => sum + n.size, 0);
    nodes.forEach((n) => (n.share = total ? n.size / total : 0));
    return {
      nodes,
      links: [],
      kind: "traders",
      source: "GeckoTerminal trades",
      notice:
        mode === "auto"
          ? "Holder data unavailable — showing recent traders. Bubble size = sampled trade volume, not token holdings."
          : "Recent traders · bubble size = sampled USD volume. Shared pool activity does not establish wallet links.",
    };
  })()
    .then((graph) => {
      graphCache.set(key, { graph, until: Date.now() + 60000 });
      if (graphCache.size > 40)
        graphCache.delete(graphCache.keys().next().value!);
      return graph;
    })
    .finally(() => graphPending.delete(key));
  graphPending.set(key, job);
  return job;
}
