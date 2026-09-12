import { describe, expect, it } from "vitest";
import { getAddress, parseEther } from "viem";
import { encodePath, minAmountOut, parseEthIn, SLIPPAGE_BPS } from "./swap";
import { WETH, USDG } from "./const";
import type { Address } from "viem";

describe("swap math + path", () => {
  it("rejects zero / negative ETH", () => {
    expect(() => parseEthIn("0")).toThrow(/greater than 0/);
    expect(() => parseEthIn("-1")).toThrow();
    expect(() => parseEthIn("")).toThrow();
  });

  it("parses 0.01 ETH", () => {
    expect(parseEthIn("0.01")).toBe(parseEther("0.01"));
  });

  it("applies 2% slippage floor", () => {
    expect(minAmountOut(10_000n)).toBe(9_800n);
    expect(minAmountOut(100n, SLIPPAGE_BPS)).toBe(98n);
  });

  it("encodes Uniswap v3 packed path WETH→USDG fee 500", () => {
    const weth = getAddress(WETH) as Address;
    const usdg = getAddress(USDG) as Address;
    const path = encodePath([weth, usdg], [500]);
    expect(path.startsWith("0x")).toBe(true);
    expect(path.length).toBe(2 + 40 + 6 + 40);
    expect(path.slice(2, 42)).toBe(weth.slice(2).toLowerCase());
    expect(path.slice(42, 48)).toBe("0001f4");
    expect(path.slice(48)).toBe(usdg.slice(2).toLowerCase());
  });

  it("rejects malformed path lengths", () => {
    const weth = getAddress(WETH) as Address;
    expect(() => encodePath([weth], [500])).toThrow(/path length/);
  });
});
