import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { CHAIN_ID, CHAIN_NAME, EXPLORER, QUOTER_V2, RPC, SWAP_ROUTER, USDG, WETH } from "./const";
import { isExtension } from "./env";
import { ensureRobinhood, getEth } from "./wallet";

export const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Blockscout", url: EXPLORER } },
});

export const FEES = [500, 3000, 10000, 100] as const;
export const SLIPPAGE_BPS = 200n;

export const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
  "function quoteExactInput(bytes path, uint256 amountIn) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

export const swapSingleAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
]);

export const swapPathAbi = parseAbi([
  "function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params) payable returns (uint256 amountOut)",
]);

const erc20Abi = parseAbi(["function decimals() view returns (uint8)"]);
const routerViewAbi = parseAbi(["function WETH9() view returns (address)"]);

export type QuoteHit = {
  amountOut: bigint;
  decimals: number;
  fee: number;
  fee2?: number;
  path?: Hex;
};

function rpcUrl() {
  if (isExtension()) return RPC;
  return typeof window !== "undefined" ? `${window.location.origin}/rpc` : RPC;
}

export function publicClient() {
  return createPublicClient({ chain: robinhoodChain, transport: http(rpcUrl()) });
}

export function encodePath(tokens: Address[], fees: number[]): Hex {
  if (tokens.length !== fees.length + 1) throw new Error("path length mismatch");
  let hex = "0x";
  for (let i = 0; i < fees.length; i++) {
    hex += tokens[i].slice(2).toLowerCase();
    hex += fees[i].toString(16).padStart(6, "0");
  }
  hex += tokens[tokens.length - 1].slice(2).toLowerCase();
  return hex as Hex;
}

export function minAmountOut(amountOut: bigint, bps = SLIPPAGE_BPS) {
  return (amountOut * (10000n - bps)) / 10000n;
}

export function parseEthIn(amountEth: string) {
  const trimmed = amountEth.trim();
  if (!trimmed || Number(trimmed) <= 0) throw new Error("amount must be greater than 0");
  return parseEther(trimmed);
}

export async function tokenDecimals(token: Address) {
  try {
    return await publicClient().readContract({ address: token, abi: erc20Abi, functionName: "decimals" });
  } catch {
    return 18;
  }
}

export async function routerWeth() {
  return publicClient().readContract({
    address: SWAP_ROUTER as Address,
    abi: routerViewAbi,
    functionName: "WETH9",
  });
}

export async function quoteEthToToken(tokenOut: Address, amountEth: string): Promise<QuoteHit | null> {
  const amountIn = parseEthIn(amountEth);
  const client = publicClient();
  const out = getAddress(tokenOut) as Address;
  if (out.toLowerCase() === WETH.toLowerCase()) throw new Error("cannot swap ETH into WETH via this panel");
  const decimals = await tokenDecimals(out);
  const weth = getAddress(WETH) as Address;
  const usdg = getAddress(USDG) as Address;

  const directs = await Promise.all(
    FEES.map(async (fee) => {
      try {
        const { result } = await client.simulateContract({
          address: QUOTER_V2 as Address,
          abi: quoterAbi,
          functionName: "quoteExactInputSingle",
          args: [{ tokenIn: weth, tokenOut: out, amountIn, fee, sqrtPriceLimitX96: 0n }],
        });
        return { amountOut: result[0], decimals, fee } as QuoteHit;
      } catch {
        return null;
      }
    })
  );

  const hops: QuoteHit[] = [];
  for (const f1 of [500, 3000] as const) {
    const hopQuotes = await Promise.all(
      FEES.map(async (f2) => {
        try {
          const path = encodePath([weth, usdg, out], [f1, f2]);
          const { result } = await client.simulateContract({
            address: QUOTER_V2 as Address,
            abi: quoterAbi,
            functionName: "quoteExactInput",
            args: [path, amountIn],
          });
          return { amountOut: result[0], decimals, fee: f1, fee2: f2, path } as QuoteHit;
        } catch {
          return null;
        }
      })
    );
    hops.push(...hopQuotes.filter((x): x is QuoteHit => Boolean(x)));
  }

  const all = [...directs, ...hops].filter((x): x is QuoteHit => x != null && x.amountOut > 0n);
  if (!all.length) return null;
  return all.sort((a, b) => (a.amountOut < b.amountOut ? 1 : -1))[0];
}

export function formatOut(hit: QuoteHit) {
  return formatUnits(hit.amountOut, hit.decimals);
}

export async function swapEthToToken(account: Address, tokenOut: Address, amountEth: string, hit: QuoteHit) {
  const eth = getEth();
  if (!eth) throw new Error("wallet not found — install MetaMask or Rabby");
  await ensureRobinhood(eth);
  const amountIn = parseEthIn(amountEth);
  const out = getAddress(tokenOut) as Address;
  if (out.toLowerCase() === WETH.toLowerCase()) throw new Error("cannot swap ETH into WETH via this panel");
  if (hit.amountOut <= 0n) throw new Error("quote is empty");
  const bal = await publicClient().getBalance({ address: account });
  if (amountIn > bal) throw new Error("insufficient ETH");
  const minOut = minAmountOut(hit.amountOut);
  const wallet = createWalletClient({
    chain: robinhoodChain,
    transport: custom(eth as Parameters<typeof custom>[0]),
    account,
  });
  if (hit.path) {
    return wallet.writeContract({
      address: SWAP_ROUTER as Address,
      abi: swapPathAbi,
      functionName: "exactInput",
      args: [{ path: hit.path, recipient: account, amountIn, amountOutMinimum: minOut }],
      value: amountIn,
      account,
      chain: robinhoodChain,
    });
  }
  return wallet.writeContract({
    address: SWAP_ROUTER as Address,
    abi: swapSingleAbi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: getAddress(WETH) as Address,
        tokenOut: out,
        fee: hit.fee,
        recipient: account,
        amountIn,
        amountOutMinimum: minOut,
        sqrtPriceLimitX96: 0n,
      },
    ],
    value: amountIn,
    account,
    chain: robinhoodChain,
  });
}
