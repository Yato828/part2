import { describe, expect, it } from "vitest";
import { parseSolIn } from "./swap";
describe("SOL amounts", () => {
  it("converts SOL to lamports without floating-point rounding", () => {
    expect(parseSolIn("0.000000001")).toBe(1n);
    expect(parseSolIn("1.123456789")).toBe(1123456789n);
  });
  it("rejects invalid, zero, negative and overprecise amounts", () => {
    for (const value of [
      "",
      "0",
      "-1",
      "NaN",
      "1e2",
      "0.0000000001",
      "Infinity",
    ])
      expect(() => parseSolIn(value)).toThrow();
  });
});

import { vi, beforeEach } from "vitest";
import { quoteSol, executeSwap } from "./swap";
import { getJson } from "./http";
import { rpc } from "./rpcFeed";
import { WSOL, USDC } from "./const";
vi.mock("./http", () => ({ getJson: vi.fn() }));
vi.mock("./rpcFeed", () => ({ rpc: vi.fn() }));
vi.mock("./wallet", () => ({
  getSolana: () => ({ signAndSendTransaction: vi.fn() }),
  walletSnap: () => ({ account: "A".repeat(32) }),
}));
beforeEach(() => {
  vi.mocked(getJson).mockReset();
  vi.mocked(rpc).mockReset();
});
describe("swap quote validation", () => {
  it("rejects wrong output mint before any transaction is built", async () => {
    vi.mocked(rpc).mockResolvedValue({ value: { decimals: 6 } });
    vi.mocked(getJson).mockResolvedValue({
      success: true,
      data: { inputMint: WSOL, outputMint: WSOL, inputAmount: "100000000" },
    });
    await expect(quoteSol(USDC, "0.1")).rejects.toThrow("does not match");
  });
  it("rejects manipulated amounts, slippage and empty routes", async () => {
    vi.mocked(rpc).mockResolvedValue({ value: { decimals: 6 } });
    vi.mocked(getJson).mockResolvedValue({
      success: true,
      data: {
        inputMint: WSOL, outputMint: USDC, inputAmount: "100000000",
        outputAmount: "1000", otherAmountThreshold: "1001", priceImpactPct: 0,
        slippageBps: 500, routePlan: [],
      },
    });
    await expect(quoteSol(USDC, "0.1", 100)).rejects.toThrow("invalid quote");
  });
  it("rejects zero or excessive slippage before calling APIs", async () => {
    await expect(quoteSol(USDC, "0.1", 0)).rejects.toThrow("Slippage");
    await expect(quoteSol(USDC, "0.1", 501)).rejects.toThrow("Slippage");
    expect(getJson).not.toHaveBeenCalled();
  });
  it("rejects expired quotes without building or submitting transactions", async () => {
    await expect(
      executeSwap(
        { response: {} as never, decimals: 6, createdAt: Date.now() - 60000 },
        () => {},
      ),
    ).rejects.toThrow("expired");
    expect(getJson).not.toHaveBeenCalled();
  });
});
