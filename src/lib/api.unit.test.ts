import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTrades, fetchHolders } from "./api";
import { getJson } from "./http";
import { rpc } from "./rpcFeed";
import { WSOL, USDC } from "./const";
vi.mock("./http", () => ({ getJson: vi.fn() }));
vi.mock("./rpcFeed", () => ({ rpc: vi.fn() }));
beforeEach(() => {
  vi.mocked(getJson).mockReset();
  vi.mocked(rpc).mockReset();
});
describe("Solana trade and holder semantics", () => {
  it("uses DexPaprika transactions for Flow and derives side from pool delta", async () => {
    vi.mocked(getJson).mockResolvedValue({
      transactions: [
        {
          id: "buySig",
          sender: "Buyer",
          recipient: "Pool",
          token_0: USDC,
          token_1: WSOL,
          amount_0: 120_000_000,
          amount_1: -1_000_000_000,
          volume_0: 120,
          volume_1: 1,
          price_0_usd: 1,
          price_1_usd: 120,
          created_at: "2026-09-29T00:00:00Z",
        },
        {
          id: "sellSig",
          sender: "Seller",
          recipient: "Pool",
          token_0: USDC,
          token_1: WSOL,
          amount_0: -60_000_000,
          amount_1: 500_000_000,
          volume_0: 60,
          volume_1: 0.5,
          price_0_usd: 1,
          price_1_usd: 120,
          created_at: "2026-09-29T00:01:00Z",
        },
      ],
    });
    const rows = await fetchTrades("Pool", WSOL);
    expect(rows.map((r) => [r.hash, r.side, r.usd])).toEqual([
      ["buySig", "buy", 120],
      ["sellSig", "sell", 60],
    ]);
    expect(getJson).toHaveBeenCalledTimes(1);
  });
  it("uses selected mint direction, not pool orientation, for buys and sells", async () => {
    const base = {
      tx_hash: "sig",
      tx_from_address: "Wallet",
      volume_in_usd: "120",
      from_token_amount: "1",
      to_token_amount: "120",
      price_from_in_usd: "120",
      price_to_in_usd: "1",
      block_timestamp: "2026-09-29T00:00:00Z",
      kind: "buy",
    };
    vi.mocked(getJson).mockResolvedValue({
      data: [
        {
          attributes: {
            ...base,
            from_token_address: WSOL,
            to_token_address: USDC,
          },
        },
        {
          attributes: {
            ...base,
            from_token_address: USDC,
            to_token_address: WSOL,
          },
        },
        {
          attributes: {
            ...base,
            from_token_address: "other",
            to_token_address: "other2",
          },
        },
      ],
    });
    const rows = await fetchTrades("Pool", WSOL);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.side)).toEqual(["sell", "buy"]);
    expect(rows[0].amount).toBe(1);
    expect(rows[1].amount).toBe(120);
  });
  it("resolves token account owners and merges balances in token units", async () => {
    vi.mocked(rpc)
      .mockResolvedValueOnce({
        value: [
          { address: "AccountA", amount: "1000000", decimals: 6 },
          { address: "AccountB", amount: "2500000", decimals: 6 },
        ],
      })
      .mockResolvedValueOnce({
        value: [
          {
            data: {
              parsed: {
                info: { owner: "So11111111111111111111111111111111111111112" },
              },
            },
          },
          {
            data: {
              parsed: {
                info: { owner: "So11111111111111111111111111111111111111112" },
              },
            },
          },
        ],
      });
    expect(await fetchHolders(USDC)).toEqual([
      {
        address: { hash: "So11111111111111111111111111111111111111112" },
        value: "3.5",
      },
    ]);
  });
});
