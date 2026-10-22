import { WSOL } from "./const";
import { isPoolAddr } from "./axiom";
import { getJson } from "./http";
import { rpc } from "./rpcFeed";
import { getSolana, walletSnap } from "./wallet";
export const SLIPPAGE_BPS = 100;
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export function parseSolIn(value: string) {
  if (!/^\d+(\.\d{1,9})?$/.test(value))
    throw new Error("Enter SOL with up to 9 decimals");
  const [whole, frac = ""] = value.split(".");
  const amount = BigInt(whole) * 1000000000n + BigInt(frac.padEnd(9, "0"));
  if (amount <= 0n) throw new Error("Amount must be greater than 0");
  return amount;
}
export type SwapResponse = {
  success: boolean;
  msg?: string;
  data: {
    inputMint: string;
    outputMint: string;
    inputAmount: string;
    outputAmount: string;
    otherAmountThreshold: string;
    priceImpactPct: number;
    slippageBps: number;
    routePlan: unknown[];
  };
};
export type QuoteHit = {
  response: SwapResponse;
  decimals: number;
  createdAt: number;
};
export async function quoteSol(
  token: string,
  input: string,
  slippage = SLIPPAGE_BPS,
): Promise<QuoteHit> {
  if (!isPoolAddr(token) || token === WSOL)
    throw new Error("Select an SPL token to swap SOL");
  if (!Number.isInteger(slippage) || slippage < 10 || slippage > 500)
    throw new Error("Slippage must be 0.1–5%");
  const amount = parseSolIn(input).toString();
  const [response, supply] = await Promise.all([
    getJson<SwapResponse>(
      `/ray/compute/swap-base-in?inputMint=${WSOL}&outputMint=${token}&amount=${amount}&slippageBps=${slippage}&txVersion=V0`,
      15000,
    ),
    rpc<{ value: { decimals: number } }>("getTokenSupply", [token]),
  ]);
  if (!response.success || !response.data)
    throw new Error(response.msg ?? "No Raydium route. Try Jupiter.");
  if (
    response.data.inputMint !== WSOL ||
    response.data.outputMint !== token ||
    response.data.inputAmount !== amount
  )
    throw new Error("Quote does not match selected token");
  const data = response.data;
  if (data.slippageBps !== slippage || !/^\d+$/.test(data.outputAmount) ||
      BigInt(data.outputAmount) <= 0n || !/^\d+$/.test(data.otherAmountThreshold) ||
      BigInt(data.otherAmountThreshold) <= 0n ||
      BigInt(data.otherAmountThreshold) > BigInt(data.outputAmount) ||
      !Array.isArray(data.routePlan) || data.routePlan.length === 0 ||
      !Number.isFinite(Number(data.priceImpactPct)) || Number(data.priceImpactPct) < 0 ||
      Number(data.priceImpactPct) > 100)
    throw new Error("Raydium returned an invalid quote");
  return { response, decimals: supply.value.decimals, createdAt: Date.now() };
}

function readU64(data: Uint8Array, offset: number) {
  if (data.length < offset + 8) throw new Error("Malformed system instruction");
  let value = 0n;
  for (let i = 7; i >= 0; i--) value = (value << 8n) + BigInt(data[offset + i]);
  return value;
}

export function validateSwapTransaction(
  tx: import("@solana/web3.js").VersionedTransaction,
  account: string,
  quotedInput: string,
) {
  if (tx.serialize().length > 1232) throw new Error("Swap transaction is oversized");
  const message = tx.message;
  if (message.header.numRequiredSignatures !== 1 ||
      message.staticAccountKeys[0]?.toBase58() !== account)
    throw new Error("Unexpected transaction signer");
  let directSpend = 0n;
  for (const ix of message.compiledInstructions) {
    const program = message.staticAccountKeys[ix.programIdIndex]?.toBase58();
    if (!program) throw new Error("Unresolved transaction program");
    if (program !== SYSTEM_PROGRAM || !ix.accountKeyIndexes.includes(0)) continue;
    const kind = ix.data.length >= 4
      ? ix.data[0] | (ix.data[1] << 8) | (ix.data[2] << 16) | (ix.data[3] << 24)
      : -1;
    if (kind === 0 || kind === 2) directSpend += readU64(ix.data, 4);
    else throw new Error("Unexpected SOL debit instruction");
  }
  const limit = BigInt(quotedInput) + 10_000_000n;
  if (directSpend > limit) throw new Error("Transaction spends more SOL than quoted");
}

async function simulate(tx: import("@solana/web3.js").VersionedTransaction) {
  const bytes = tx.serialize();
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const result = await rpc<{ value: { err: unknown; logs?: string[] } }>("simulateTransaction", [
    btoa(binary),
    { encoding: "base64", sigVerify: false, commitment: "confirmed" },
  ]);
  if (result.value.err) {
    const detail = result.value.logs?.at(-1)?.slice(0, 160);
    throw new Error(`Swap simulation failed${detail ? `: ${detail}` : ""}`);
  }
}
export async function executeSwap(
  quote: QuoteHit,
  onSent: (signature: string) => void,
) {
  const provider = getSolana();
  const account = walletSnap().account;
  if (!provider || !account) throw new Error("Connect a Solana wallet");
  if (Date.now() - quote.createdAt > 45000)
    throw new Error("Quote expired. Request a new quote.");
  const response = await getJson<{
    success: boolean;
    msg?: string;
    data: Array<{ transaction: string }>;
  }>("/ray/transaction/swap-base-in", 15000, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      computeUnitPriceMicroLamports: "10000",
      swapResponse: quote.response,
      txVersion: "V0",
      wallet: account,
      wrapSol: true,
      unwrapSol: false,
    }),
  });
  if (!response.success || !response.data?.length)
    throw new Error(response.msg ?? "Could not build swap");
  if (response.data.length > 3) throw new Error("Unexpected transaction bundle");
  const { VersionedTransaction } = await import("@solana/web3.js");
  for (const item of response.data) {
    if (walletSnap().account !== account)
      throw new Error("Wallet changed. Request a new quote.");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(item.transaction) || item.transaction.length > 4096)
      throw new Error("Invalid swap transaction payload");
    const tx = VersionedTransaction.deserialize(Uint8Array.from(atob(item.transaction), (c) => c.charCodeAt(0)));
    validateSwapTransaction(tx, account, quote.response.data.inputAmount);
    await simulate(tx);
    if (walletSnap().account !== account) throw new Error("Wallet changed. Request a new quote.");
    const result = await provider.signAndSendTransaction(tx);
    const signature = typeof result === "string" ? result : result.signature;
    if (!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(signature))
      throw new Error("Wallet returned an invalid transaction signature");
    onSent(signature);
    let confirmed = false;
    for (let n = 0; n < 30; n++) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await rpc<{
        value: Array<{ err: unknown; confirmationStatus: string } | null>;
      }>("getSignatureStatuses", [[signature]]);
      const hit = status.value[0];
      if (hit?.err) throw new Error("Transaction failed. Check Solscan.");
      if (
        hit?.confirmationStatus === "confirmed" ||
        hit?.confirmationStatus === "finalized"
      ) {
        confirmed = true;
        break;
      }
    }
    if (!confirmed)
      throw new Error("Confirmation pending. Check Solscan before retrying.");
  }
}
