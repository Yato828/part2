import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  onlySolana,
  isPoolAddr,
  mergePulseCoins,
  bucketCandles,
  normalizeCandles,
  searchAxioms,
  fetchSolanaPool,
  loadCandleResult,
  transactionCandles,
  type AxiomCoin,
} from "./axiom";
import { getJson } from "./http";
import { WSOL, USDC } from "./const";
vi.mock("./http", () => ({ getJson: vi.fn() }));
const pair = {
  chainId: "solana",
  dexId: "raydium",
  pairAddress: "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
  baseToken: { address: WSOL, name: "Solana", symbol: "SOL" },
  priceUsd: "120",
};
beforeEach(() => vi.mocked(getJson).mockReset());
describe("Solana market isolation", () => {
  it("drops other networks, malformed pools and missing tokens", () => {
    expect(
      onlySolana([
        pair,
        { ...pair, chainId: "ethereum" },
        { ...pair, pairAddress: "0x123" },
        { ...pair, baseToken: undefined },
      ] as never),
    ).toEqual([pair]);
  });
  it("validates base58 instead of EVM addresses", () => {
    expect(isPoolAddr(WSOL)).toBe(true);
    expect(isPoolAddr("0x" + "a".repeat(40))).toBe(false);
  });
  it("does not lowercase mint requests or return an unrelated base token", async () => {
    vi.mocked(getJson).mockResolvedValue([
      pair,
      { ...pair, baseToken: { ...pair.baseToken, address: USDC } },
    ]);
    const rows = await searchAxioms(WSOL);
    expect(getJson).toHaveBeenCalledWith(
      `/dex/token-pairs/v1/solana/${WSOL}`,
      10000,
    );
    expect(rows.map((c) => c.address)).toEqual([WSOL]);
  });
  it("keeps case-distinct mints and chooses the deepest pool per exact mint", () => {
    const c: AxiomCoin = {
      symbol: "X",
      name: "X",
      address: "A".repeat(32),
      pairAddress: pair.pairAddress,
      chainId: "solana",
      dex: "raydium",
      priceUsd: 1,
      liquidityUsd: 10,
    };
    expect(
      mergePulseCoins([
        c,
        { ...c, address: "a".repeat(32) },
        { ...c, liquidityUsd: 20 },
      ]),
    ).toHaveLength(2);
    expect(
      mergePulseCoins([c, { ...c, liquidityUsd: 20 }])[0].liquidityUsd,
    ).toBe(20);
  });
  it("verifies the selected Solana pool without switching to a different pool", async () => {
    vi.mocked(getJson).mockResolvedValue({
      pairs: [
        { ...pair, pairAddress: USDC, liquidity: { usd: 999999 } },
        { ...pair, chainId: "ethereum" },
        pair,
      ],
    });
    expect((await fetchSolanaPool(WSOL, pair.pairAddress))?.pairAddress).toBe(
      pair.pairAddress,
    );
    expect(getJson).toHaveBeenCalledWith(
      `/dex/latest/dex/pairs/solana/${pair.pairAddress}`,
      10000,
    );
    expect(await fetchSolanaPool(USDC, pair.pairAddress)).toBeNull();
  });
});
describe("honest candles", () => {
  const t = Date.parse("2026-09-01T00:00:00Z");
  const bar = { t, o: 1, h: 3, l: 1, c: 2, v: 4 };
  it("sorts, deduplicates and rejects invalid OHLC and negative volume", () => {
    expect(
      normalizeCandles([
        { ...bar, t: t + 60000 },
        bar,
        { ...bar, c: 2.5 },
        { ...bar, t: t + 120000, h: 0 },
        { ...bar, t: t + 180000, v: -1 },
      ]),
    ).toEqual([
      { ...bar, c: 2.5 },
      { ...bar, t: t + 60000 },
    ]);
  });
  it("buckets in chronological order with correct open, close and volume", () => {
    const rows = bucketCandles([{ ...bar, t: t + 60000, c: 3 }, bar], 300000);
    expect(rows).toEqual([{ ...bar, c: 3, v: 8 }]);
  });
  it("builds short candles from real DexPaprika trades", () => {
    const rows = transactionCandles(
      [
        {
          id: "2",
          sender: "x",
          recipient: "p",
          token_0: WSOL,
          token_1: USDC,
          amount_0: -1,
          amount_1: 120,
          volume_0: 1,
          volume_1: 120,
          price_0_usd: 120,
          price_1_usd: 1,
          created_at: new Date(t + 60_000).toISOString(),
        },
        {
          id: "1",
          sender: "x",
          recipient: "p",
          token_0: WSOL,
          token_1: USDC,
          amount_0: 1,
          amount_1: -119,
          volume_0: 1,
          volume_1: 119,
          price_0_usd: 119,
          price_1_usd: 1,
          created_at: new Date(t).toISOString(),
        },
      ],
      WSOL,
      300_000,
    );
    expect(rows).toEqual([{ t, o: 119, h: 120, l: 119, c: 120, v: 239 }]);
  });
  it("passes exact selected mint and pool to USD OHLCV", async () => {
    vi.mocked(getJson).mockResolvedValue({
      data: { attributes: { ohlcv_list: [[t / 1000, 1, 3, 1, 2, 4]] } },
    });
    const result = await loadCandleResult(pair.pairAddress, "5m", WSOL);
    expect(result.bars).toEqual([bar]);
    expect(
      vi
        .mocked(getJson)
        .mock.calls.some(([url]) =>
          String(url).includes(
            `/${pair.pairAddress}/ohlcv/minute?aggregate=5&limit=500&currency=usd&token=${WSOL}`,
          ),
        ),
    ).toBe(true);
  });
  it("returns a friendly message when no fallback supports the selected mint", async () => {
    vi.mocked(getJson)
      .mockRejectedValueOnce(new Error("blocked"))
      .mockResolvedValueOnce({ tokens: [{ id: USDC }] });
    await expect(
      loadCandleResult(pair.pairAddress, "1h", WSOL),
    ).rejects.toThrow("No market information for this period yet");
  });
  it("bypasses a cached candle snapshot for a manual live refresh", async () => {
    vi.mocked(getJson).mockResolvedValue({
      data: { attributes: { ohlcv_list: [[t / 1000, 1, 3, 1, 2, 4]] } },
    });
    await loadCandleResult(USDC, "15m", WSOL);
    const calls = vi.mocked(getJson).mock.calls.length;
    vi.mocked(getJson).mockResolvedValue({
      data: { attributes: { ohlcv_list: [[t / 1000, 1, 3, 1, 2.5, 5]] } },
    });
    expect((await loadCandleResult(USDC, "15m", WSOL)).bars[0].c).toBe(2);
    expect(vi.mocked(getJson).mock.calls).toHaveLength(calls);
    expect(
      (await loadCandleResult(USDC, "15m", WSOL, undefined, 0, 0)).bars[0].c,
    ).toBe(2.5);
    expect(vi.mocked(getJson).mock.calls).toHaveLength(calls + 1);
  });
});
