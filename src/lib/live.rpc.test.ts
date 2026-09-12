import { describe, expect, it } from "vitest";
import { createPublicClient, getAddress, http, parseEther, type Address } from "viem";
import { CHAIN_ID, QUOTER_V2, RPC, SWAP_ROUTER, WETH } from "./const";
import {
  minAmountOut,
  publicClient,
  quoteEthToToken,
  quoterAbi,
  robinhoodChain,
  routerWeth,
  swapPathAbi,
  swapSingleAbi,
} from "./swap";

const NVDA = getAddress("0x2fAEBBf2F808b7C06addA6f5f3f546F59F519d7c") as Address;
const FAKE = "0x1111111111111111111111111111111111111111" as Address;

describe("live Robinhood 4663 swap stack", () => {
  const client = createPublicClient({ chain: robinhoodChain, transport: http(RPC) });

  it("chain id is 4663", async () => {
    expect(await client.getChainId()).toBe(CHAIN_ID);
  });

  it("SwapRouter02 / QuoterV2 / WETH have bytecode", async () => {
    const [router, quoter, weth] = await Promise.all([
      client.getCode({ address: SWAP_ROUTER as Address }),
      client.getCode({ address: QUOTER_V2 as Address }),
      client.getCode({ address: WETH as Address }),
    ]);
    expect((router ?? "0x").length).toBeGreaterThan(10);
    expect((quoter ?? "0x").length).toBeGreaterThan(10);
    expect((weth ?? "0x").length).toBeGreaterThan(10);
  });

  it("router WETH9() matches const WETH", async () => {
    const onchain = await routerWeth();
    expect(getAddress(onchain)).toBe(getAddress(WETH));
  });

  it("quotes ETH → NVDA (pool exists, amountOut > 0)", async () => {
    const hit = await quoteEthToToken(NVDA, "0.01");
    expect(hit).not.toBeNull();
    expect(hit!.amountOut).toBeGreaterThan(0n);
    expect(hit!.fee).toBeGreaterThan(0);
    expect(minAmountOut(hit!.amountOut)).toBeLessThan(hit!.amountOut);
  });

  it("simulates SwapRouter02 swap calldata with ETH value (state override)", async () => {
    const hit = await quoteEthToToken(NVDA, "0.01");
    expect(hit).not.toBeNull();
    const amountIn = parseEther("0.01");
    const minOut = minAmountOut(hit!.amountOut);
    const sim = hit!.path
      ? await client.simulateContract({
          address: SWAP_ROUTER as Address,
          abi: swapPathAbi,
          functionName: "exactInput",
          args: [{ path: hit!.path, recipient: FAKE, amountIn, amountOutMinimum: minOut }],
          value: amountIn,
          account: FAKE,
          stateOverride: [{ address: FAKE, balance: parseEther("10") }],
        })
      : await client.simulateContract({
          address: SWAP_ROUTER as Address,
          abi: swapSingleAbi,
          functionName: "exactInputSingle",
          args: [
            {
              tokenIn: getAddress(WETH) as Address,
              tokenOut: NVDA,
              fee: hit!.fee,
              recipient: FAKE,
              amountIn,
              amountOutMinimum: minOut,
              sqrtPriceLimitX96: 0n,
            },
          ],
          value: amountIn,
          account: FAKE,
          stateOverride: [{ address: FAKE, balance: parseEther("10") }],
        });
    expect(sim.result).toBeGreaterThan(0n);
  });

  it("quoter and publicClient share the same RPC helper", () => {
    expect(publicClient().chain.id).toBe(CHAIN_ID);
    expect(quoterAbi.length).toBeGreaterThan(0);
  });
});
