import { describe, expect, it } from "vitest";
import { briefIntel, liveScore, type IntelInput } from "./intel";
import type { AxiomCoin } from "./axiom";

const base = (extra: Partial<AxiomCoin> = {}): AxiomCoin => ({
  symbol: "TEST",
  name: "Test",
  address: "0x1111111111111111111111111111111111111111",
  pairAddress: "0x2222222222222222222222222222222222222222",
  chainId: "robinhood",
  dex: "uniswap",
  priceUsd: 1,
  ...extra,
});

const armed = (over: Partial<IntelInput> & { coin?: AxiomCoin | null } = {}): IntelInput => ({
  armed: true,
  symbol: over.coin?.symbol ?? "TEST",
  ...over,
});

describe("HERO intel scenarios", () => {
  it("stays idle until a token is armed", () => {
    const b = briefIntel({ armed: false });
    expect(b.id).toBe("idle");
    expect(b.score).toBe(0);
  });

  it("flags halt", () => {
    expect(briefIntel(armed({ halt: true, coin: base() })).id).toBe("halt");
  });

  it("calls rug on thin new silent liquidity", () => {
    const b = briefIntel(
      armed({
        coin: base({ liquidityUsd: 2000, createdAt: Date.now() - 3600_000, volume24h: 100, sells24h: 40, buys24h: 5 }),
      })
    );
    expect(b.id).toBe("rug");
    expect(b.action).toMatch(/DO NOT BUY/);
  });

  it("marks dead tape", () => {
    expect(briefIntel(armed({ coin: base({ liquidityUsd: 30000, volume24h: 10 }) })).id).toBe("dead");
  });

  it("warns on chase / extended pump", () => {
    expect(briefIntel(armed({ coin: base({ liquidityUsd: 200000, volume24h: 80000, change1h: 18, twitter: "x" }) })).id).toBe(
      "chase"
    );
  });

  it("allows long hold on official stock tokens", () => {
    const b = briefIntel(armed({ stock: true, coin: base({ symbol: "NVDA", liquidityUsd: 500000, volume24h: 20000 }) }));
    expect(b.id).toBe("long");
  });

  it("opens a live buy window on healthy flow", () => {
    const b = briefIntel(
      armed({
        coin: base({
          liquidityUsd: 250000,
          volume24h: 40000,
          change24h: 4,
          change1h: 1,
          buys24h: 80,
          sells24h: 40,
          twitter: "https://x.com/x",
          website: "https://example.com",
        }),
      })
    );
    expect(b.id).toBe("buy");
    expect(b.score).toBeGreaterThan(50);
  });

  it("caps score between 1 and 99", () => {
    expect(liveScore(armed({ halt: true, coin: base({ liquidityUsd: 1 }) }))).toBeGreaterThan(0);
    expect(liveScore(armed({ stock: true, coin: base({ liquidityUsd: 1e12, volume24h: 1e9, twitter: "x", website: "w" }) }))).toBeLessThan(
      100
    );
  });

  it("keeps verdicts, actions, and reviews in English", () => {
    const cyrillic = /[а-яё]/i;
    const briefs = [
      briefIntel({ armed: false }),
      briefIntel(armed({ halt: true, coin: base() })),
      briefIntel(armed({ coin: base({ liquidityUsd: 2000, createdAt: Date.now() - 3600_000, volume24h: 100, sells24h: 40, buys24h: 5 }) })),
      briefIntel(armed({ coin: base({ liquidityUsd: 30000, volume24h: 10 }) })),
      briefIntel(armed({ coin: base({ liquidityUsd: 200000, volume24h: 80000, change1h: 18, twitter: "x" }) })),
      briefIntel(armed({ stock: true, coin: base({ symbol: "NVDA", liquidityUsd: 500000, volume24h: 20000 }) })),
      briefIntel(
        armed({
          coin: base({
            liquidityUsd: 250000,
            volume24h: 40000,
            change24h: 4,
            change1h: 1,
            buys24h: 80,
            sells24h: 40,
            twitter: "https://x.com/x",
            website: "https://example.com",
          }),
        })
      ),
      briefIntel(armed({ coin: base({ liquidityUsd: 90000, volume24h: 25000, change24h: 12 }) })),
      briefIntel(armed({ coin: base({ liquidityUsd: 90000, volume24h: 800, change24h: 1, twitter: "x" }) })),
    ];
    for (const b of briefs) {
      expect(`${b.verdict} ${b.action} ${b.review} ${b.flags.join(" ")}`).not.toMatch(cyrillic);
    }
  });
});
