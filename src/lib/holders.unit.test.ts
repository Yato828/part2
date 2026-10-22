import { beforeEach, describe, expect, it, vi } from "vitest";
import { getJson } from "./http";
import { rpc } from "./rpcFeed";
import { fetchHolderSnapshot, indexedHolders } from "./holders";
import { WSOL, USDC } from "./const";
vi.mock("./http", () => ({ getJson: vi.fn() }));
vi.mock("./rpcFeed", () => ({ rpc: vi.fn() }));
const mint = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
beforeEach(() => {
  vi.mocked(getJson).mockReset();
  vi.mocked(rpc).mockReset();
});
describe("verified holder fallback and source attribution", () => {
  it("recovers RPC restrictions with an exact-mint indexed snapshot and decimal-safe UI balances", async () => {
    vi.mocked(rpc).mockRejectedValue(new Error("403 RPC"));
    vi.mocked(getJson).mockResolvedValue({
      mint,
      topHolders: [
        {
          owner: WSOL,
          uiAmountString: "2.500001",
          amount: 2500001,
          decimals: 6,
        },
        { owner: WSOL, uiAmountString: "1.25" },
      ],
      token: {
        supply: 1000000000,
        decimals: 6,
        mintAuthority: null,
        freezeAuthority: null,
      },
    });
    const result = await fetchHolderSnapshot(mint, true);
    expect(result).toMatchObject({
      source: "RugCheck",
      supply: 1000,
      mintAuthority: null,
      accountCount: 2,
    });
    expect(result.holders).toEqual([
      { address: { hash: WSOL }, value: "3.750001" },
    ]);
  });
  it("rejects another mint and missing owner identities rather than returning token-account addresses", async () => {
    vi.mocked(rpc).mockRejectedValue(new Error("429"));
    vi.mocked(getJson).mockResolvedValue({
      mint,
      topHolders: [{ owner: WSOL, uiAmount: 100 }],
    });
    await expect(fetchHolderSnapshot(USDC, true)).rejects.toThrow(
      "Holder sources are unavailable",
    );
    expect(
      indexedHolders([
        { address: WSOL, uiAmount: 100 },
        { owner: "0x123", uiAmount: 100 },
      ]),
    ).toEqual([]);
  });
  it("does not erase a cached success on failure, and force refresh bypasses cached RPC reads", async () => {
    vi.mocked(rpc).mockRejectedValue(new Error("blocked"));
    vi.mocked(getJson).mockRejectedValue(new Error("unavailable"));
    await expect(fetchHolderSnapshot(mint, true)).rejects.toThrow();
    const old = await fetchHolderSnapshot(mint);
    expect(old.source).toBe("RugCheck");
    expect(old.holders).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith(
      "getTokenLargestAccounts",
      [mint, { commitment: "confirmed" }],
      true,
    );
  });
});
