import { describe, expect, it } from "vitest";
import { buildBubbleGraph, clusterNodes, indexedHolders } from "./bubble";

describe("bubble graph", () => {
  it("clusters connected wallets and sizes by flow", () => {
    const g = buildBubbleGraph(
      [
        {
          address: { hash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
          value: "1000",
        },
        { address: { hash: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" }, value: "500" },
        { address: { hash: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC" }, value: "100" },
      ],
      [
        {
          timestamp: "",
          from: { hash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
          to: { hash: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" },
          total: { value: "10", decimals: "0" },
        },
      ],
      [
        {
          sender: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
          recipient: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
          volume_0: 2,
          price_0_usd: 10,
          created_at: "",
        },
      ],
    );
    expect(g.nodes.length).toBe(3);
    expect(g.links.length).toBe(1);
    expect(g.links[0].source.startsWith("AAAA")).toBe(true);
    expect(g.links[0].target.startsWith("BBBB")).toBe(true);
    const a = g.nodes.find((n) => n.id.startsWith("AAAA"));
    const b = g.nodes.find((n) => n.id.startsWith("BBBB"));
    const c = g.nodes.find((n) => n.id.startsWith("CCCC"));
    expect(a?.cluster).toBe(b?.cluster);
    expect(c?.cluster).not.toBe(a?.cluster);
    expect(a!.size).toBeGreaterThan(b!.size);
    const shares = g.nodes.reduce((s, n) => s + n.share, 0);
    expect(shares).toBeCloseTo(1);
  });

  it("drops router-like dust and keeps isolated nodes in their own cluster", () => {
    const nodes = [
      { id: "0xa", size: 1, txs: 0, cluster: 0, share: 0 },
      { id: "0xb", size: 1, txs: 0, cluster: 0, share: 0 },
    ];
    clusterNodes(nodes, []);
    expect(nodes[0].cluster).not.toBe(nodes[1].cluster);
  });

  it("uses indexed owner addresses and merges duplicate owner balances", () => {
    const holders = indexedHolders([
      {
        owner: "So11111111111111111111111111111111111111112",
        address: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        uiAmount: 10,
      },
      {
        owner: "So11111111111111111111111111111111111111112",
        address: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        amount: 2_500_000,
        decimals: 6,
      },
      { address: "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", uiAmount: 99 },
    ]);
    expect(holders).toEqual([
      {
        address: { hash: "So11111111111111111111111111111111111111112" },
        value: "12.5",
      },
    ]);
  });
});
