import { describe, expect, it } from "vitest";
import {
  ageLabel,
  bucketCandles,
  filterPulseCoins,
  isPoolAddr,
  isQuoteToken,
  mergePulseCoins,
  onlyRh,
  paprikaRows,
  paprikaPoolRows,
  parseBarTime,
  parsePaprikaOhlcv,
  swapsToCandles,
  type AxiomCoin,
} from "./axiom";

describe("Robinhood-only filter", () => {
  const nvda = {
    chainId: "robinhood",
    dexId: "uniswap",
    pairAddress: "0xd4eb21209c4d6093f80b5b84f5c45cc093ea14a3",
    baseToken: { address: "0x2faebbf2f808b7c06adda6f5f3f546f59f519d7c", name: "NVIDIA", symbol: "NVDA" },
  };
  const bonk = {
    chainId: "solana",
    dexId: "raydium",
    pairAddress: "SoL111",
    baseToken: { address: "bonk", name: "Bonk", symbol: "BONK" },
  };

  it("keeps robinhood pairs and drops solana", () => {
    const out = onlyRh([nvda, bonk] as never);
    expect(out).toHaveLength(1);
    expect(out[0].baseToken.symbol).toBe("NVDA");
  });

  it("drops pairs without a base token", () => {
    expect(onlyRh([{ chainId: "robinhood", dexId: "x", pairAddress: "0x", baseToken: undefined }] as never)).toEqual([]);
  });
});

describe("pool addresses and paprika candles", () => {
  it("accepts Uniswap v3 20-byte pools and v4 bytes32 ids", () => {
    expect(isPoolAddr("0xd4eb21209c4d6093f80b5b84f5c45cc093ea14a3")).toBe(true);
    expect(isPoolAddr("0xd434e890610315a1922bc3f36dba2a3906cfff336c1af2ab821681a9db8fe7a0")).toBe(true);
    expect(isPoolAddr("")).toBe(false);
    expect(isPoolAddr("0x1234")).toBe(false);
  });

  it("parses paprika ohlcv rows", () => {
    const rows = parsePaprikaOhlcv([
      { time_open: "2026-09-07T00:00:00Z", open: 10, high: 12, low: 9, close: 11, volume: 100 },
      { time_open: "2026-09-07T00:15:00Z", open: 11, high: 13, low: 10, close: 12, volume: 80 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].o).toBe(10);
    expect(rows[1].c).toBe(12);
    expect(rows[1].t).toBeGreaterThan(rows[0].t);
  });

  it("buckets 1h bars into 4h candles", () => {
    const t0 = Date.parse("2026-09-07T00:00:00Z");
    const hour = 60 * 60 * 1000;
    const src = [0, 1, 2, 3, 4].map((i) => ({
      t: t0 + i * hour,
      o: 10 + i,
      h: 12 + i,
      l: 9,
      c: 11 + i,
      v: 10,
    }));
    const out = bucketCandles(src, 4 * hour);
    expect(out).toHaveLength(2);
    expect(out[0].o).toBe(10);
    expect(out[0].c).toBe(14);
    expect(out[0].h).toBe(15);
    expect(out[0].v).toBe(40);
    expect(out[1].o).toBe(14);
    expect(out[1].v).toBe(10);
  });

  it("unwraps paprika envelopes and unix times", () => {
    expect(paprikaRows({ ohlcv: [{ time_open: "2026-09-07T00:00:00Z", open: 1, high: 1, low: 1, close: 1, volume: 1 }] })).toHaveLength(1);
    expect(parseBarTime("1710000000")).toBe(1710000000000);
    expect(parseBarTime(1710000000000)).toBe(1710000000000);
  });

  it("builds candles from pool swaps", () => {
    const t0 = "2026-09-07T00:00:10Z";
    const t1 = "2026-09-07T00:00:40Z";
    const out = swapsToCandles(
      [
        { created_at: t0, price_0: 10, volume_0: 1 },
        { created_at: t1, price_0: 12, volume_0: 2 },
      ],
      60_000
    );
    expect(out).toHaveLength(1);
    expect(out[0].o).toBe(10);
    expect(out[0].c).toBe(12);
    expect(out[0].h).toBe(12);
    expect(out[0].v).toBe(3);
  });

  it("uses token1 price when token0 is WETH", () => {
    const out = swapsToCandles(
      [
        {
          created_at: "2026-09-07T00:00:10Z",
          token_0: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
          price_0: 3000,
          price_1: 0.004,
          volume_1: 5,
        },
      ],
      60_000
    );
    expect(out).toHaveLength(1);
    expect(out[0].c).toBe(0.004);
    expect(out[0].v).toBe(5);
  });
});

const coin = (partial: Partial<AxiomCoin> & Pick<AxiomCoin, "symbol" | "address">): AxiomCoin => ({
  name: partial.symbol,
  pairAddress: "",
  chainId: "robinhood",
  dex: "uniswap",
  priceUsd: 0,
  ...partial,
});

describe("pulse launches", () => {
  it("ages launches in seconds, minutes, hours", () => {
    const now = Date.parse("2026-09-13T12:00:00Z");
    expect(ageLabel(now - 12_000, now)).toBe("12s");
    expect(ageLabel(now - 120_000, now)).toBe("2m");
    expect(ageLabel(now - 3 * 3600_000, now)).toBe("3h");
  });

  it("drops WETH, USDG, and registry stock tokens", () => {
    const out = filterPulseCoins(
      [
        coin({ symbol: "NVDA", address: "0x1111111111111111111111111111111111111111" }),
        coin({ symbol: "PEPE", address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" }),
        coin({ symbol: "WETH", address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
        coin({ symbol: "FROG", address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", createdAt: 2 }),
        coin({ symbol: "HOOD", address: "0xcccccccccccccccccccccccccccccccccccccccc" }),
      ],
      ["NVDA", "HOOD"],
      ["0xdddddddddddddddddddddddddddddddddddddddd"]
    );
    expect(out.map((c) => c.symbol)).toEqual(["FROG"]);
  });

  it("prefers a real ticker over a paprika hex stub", () => {
    const stub = coin({
      symbol: "CCE765",
      address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      pairAddress: "0xd434e890610315a1922bc3f36dba2a3906cfff336c1af2ab821681a9db8fe7a0",
      createdAt: 90,
    });
    const named = coin({
      symbol: "FROG",
      address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      pairAddress: "0xd4eb21209c4d6093f80b5b84f5c45cc093ea14a3",
      createdAt: 40,
      priceUsd: 1.2,
    });
    const out = mergePulseCoins([stub, named]);
    expect(out[0].symbol).toBe("FROG");
    expect(out[0].createdAt).toBe(90);
    expect(out[0].pairAddress).toBe("0xd434e890610315a1922bc3f36dba2a3906cfff336c1af2ab821681a9db8fe7a0");
  });

  it("keeps the newest 20-byte pool when merging the same token", () => {
    const a = coin({
      symbol: "0xABCD",
      address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      pairAddress: "",
      createdAt: 10,
    });
    const b = coin({
      symbol: "FROG",
      address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      pairAddress: "0xd4eb21209c4d6093f80b5b84f5c45cc093ea14a3",
      createdAt: 40,
      priceUsd: 1.2,
    });
    const out = mergePulseCoins([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].symbol).toBe("FROG");
    expect(out[0].pairAddress).toBe("0xd4eb21209c4d6093f80b5b84f5c45cc093ea14a3");
    expect(out[0].createdAt).toBe(40);
  });

  it("reads paprika pool lists from pools or results", () => {
    expect(
      paprikaPoolRows({
        pools: [{ id: "0x1", tokens: [{ id: "0xabc", symbol: "FROG" }] }],
      })
    ).toHaveLength(1);
    expect(paprikaPoolRows({ results: [{ id: "0x2" }] })).toHaveLength(1);
    expect(paprikaPoolRows([])).toEqual([]);
  });

  it("treats native ETH as a quote asset", () => {
    expect(isQuoteToken("0x0000000000000000000000000000000000000000")).toBe(true);
    expect(isQuoteToken("0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73")).toBe(true);
  });
});
