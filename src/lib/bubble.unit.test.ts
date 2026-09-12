import { describe, expect, it } from "vitest";
import { buildBubbleGraph, clusterNodes } from "./bubble";

describe("bubble graph", () => {
  it("clusters connected wallets and sizes by flow", () => {
    const g = buildBubbleGraph(
      [
        { address: { hash: "0x1111111111111111111111111111111111111111" }, value: "1000" },
        { address: { hash: "0x2222222222222222222222222222222222222222" }, value: "500" },
        { address: { hash: "0x3333333333333333333333333333333333333333" }, value: "100" },
      ],
      [
        {
          timestamp: "",
          from: { hash: "0x1111111111111111111111111111111111111111" },
          to: { hash: "0x2222222222222222222222222222222222222222" },
          total: { value: "10", decimals: "0" },
        },
      ],
      [
        {
          sender: "0x3333333333333333333333333333333333333333",
          recipient: "0x3333333333333333333333333333333333333333",
          volume_0: 2,
          price_0_usd: 10,
          created_at: "",
        },
      ]
    );
    expect(g.nodes.length).toBe(3);
    expect(g.links.length).toBe(1);
    expect(g.links[0].source.startsWith("0x1111")).toBe(true);
    expect(g.links[0].target.startsWith("0x2222")).toBe(true);
    const a = g.nodes.find((n) => n.id.startsWith("0x1111"));
    const b = g.nodes.find((n) => n.id.startsWith("0x2222"));
    const c = g.nodes.find((n) => n.id.startsWith("0x3333"));
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
});
