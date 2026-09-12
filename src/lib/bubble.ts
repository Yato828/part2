import { fetchHolders, fetchPoolSwaps, fetchTransfers, type PoolSwap, type TokenHolder, type TokenTransfer } from "./api";
import { SWAP_ROUTER, USDG, WETH } from "./const";
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
};

const ZERO = "0x0000000000000000000000000000000000000000";
const SKIP = new Set([ZERO, WETH.toLowerCase(), USDG.toLowerCase()]);

function norm(addr?: string | null) {
  return (addr ?? "").toLowerCase();
}

function skipAddr(addr: string, extra?: string[]) {
  if (!isPoolAddr(addr)) return true;
  const id = addr.toLowerCase();
  if (SKIP.has(id)) return true;
  return extra?.some((x) => x.toLowerCase() === id) ?? false;
}

function addVol(map: Map<string, BubbleNode>, id: string, vol: number, txs: number, extra?: Partial<BubbleNode>) {
  const k = id.toLowerCase();
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

function addLink(links: Map<string, BubbleLink>, from: string, to: string, value: number) {
  const source = from.toLowerCase();
  const target = to.toLowerCase();
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
  swaps: PoolSwap[]
): BubbleGraph {
  const extraSkip = [SWAP_ROUTER];
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
    const val = tr.total ? Number(tr.total.value) / 10 ** Number(tr.total.decimals ?? 18) : 1;
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
    const usd = Math.abs(Number(s.volume_0) * Number(s.price_0_usd)) || Math.abs(Number(s.volume_0)) || 1;
    addVol(nodes, id, usd, 1);
  }

  const ranked = [...nodes.values()].sort((a, b) => b.size - a.size).slice(0, 36);
  const keep = new Set(ranked.map((n) => n.id));
  const keptLinks = [...links.values()].filter((l) => keep.has(l.source) && keep.has(l.target));
  clusterNodes(ranked, keptLinks);
  const total = ranked.reduce((s, n) => s + n.size, 0) || 1;
  for (const n of ranked) n.share = n.size / total;
  return { nodes: ranked, links: keptLinks };
}

export async function fetchBubbleGraph(token?: string, pool?: string): Promise<BubbleGraph> {
  if (!isPoolAddr(token) && !isPoolAddr(pool)) return { nodes: [], links: [] };
  const [holders, transfers, swaps] = await Promise.all([
    isPoolAddr(token) ? fetchHolders(token).catch(() => [] as TokenHolder[]) : Promise.resolve([] as TokenHolder[]),
    isPoolAddr(token) ? fetchTransfers(token).catch(() => [] as TokenTransfer[]) : Promise.resolve([] as TokenTransfer[]),
    isPoolAddr(pool) ? fetchPoolSwaps(pool).catch(() => [] as PoolSwap[]) : Promise.resolve([] as PoolSwap[]),
  ]);
  return buildBubbleGraph(holders, transfers, swaps);
}
