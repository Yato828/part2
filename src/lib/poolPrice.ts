import { USDC, WSOL } from "./const";
export const SOL_USDC_POOL = "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE";
export const ORCA_WHIRLPOOL = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
export const RAYDIUM_CLMM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
export const METEORA_DLMM = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";
export type PoolPriceState = {
  mintA: string;
  mintB: string;
  sqrtPriceX64?: bigint;
  rawRatio?: number;
  decimalsA?: number;
  decimalsB?: number;
  kind: string;
};
export type RpcAccount = {
  owner: string;
  data: [string, string];
  executable?: boolean;
};
const u128 = (data: Uint8Array, offset: number) => {
  let value = 0n;
  for (let i = 15; i >= 0; i--)
    value = (value << 8n) | BigInt(data[offset + i]);
  return value;
};
const key = (data: Uint8Array, offset: number) => {
  const bytes = data.slice(offset, offset + 32),
    alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n,
    encoded = "",
    zeros = 0;
  for (const byte of bytes) n = (n << 8n) | BigInt(byte);
  while (n > 0n) {
    encoded = alphabet[Number(n % 58n)] + encoded;
    n /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    zeros++;
  }
  return "1".repeat(zeros) + encoded;
};
export function decodePoolPrice(account: RpcAccount): PoolPriceState | null {
  if (
    account.executable ||
    !Array.isArray(account.data) ||
    account.data[1] !== "base64" ||
    typeof account.data[0] !== "string" ||
    account.data[0].length > 16000
  )
    return null;
  let data: Uint8Array;
  try {
    data = Uint8Array.from(atob(account.data[0]), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  const matches = (bytes: number[]) => bytes.every((v, i) => data[i] === v);
  if (
    account.owner === ORCA_WHIRLPOOL &&
    data.length >= 653 &&
    matches([63, 149, 209, 12, 225, 128, 99, 9])
  )
    return {
      mintA: key(data, 101),
      mintB: key(data, 181),
      sqrtPriceX64: u128(data, 65),
      kind: "Orca Whirlpool",
    };
  if (
    account.owner === RAYDIUM_CLMM &&
    data.length >= 1544 &&
    matches([247, 237, 227, 245, 215, 195, 222, 70])
  )
    return {
      mintA: key(data, 73),
      mintB: key(data, 105),
      decimalsA: data[233],
      decimalsB: data[234],
      sqrtPriceX64: u128(data, 253),
      kind: "Raydium CLMM",
    };
  if (
    account.owner === METEORA_DLMM &&
    data.length >= 904 &&
    matches([33, 11, 49, 98, 181, 101, 177, 13])
  ) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength),
      step = view.getUint16(80, true),
      activeId = view.getInt32(76, true);
    if (!step || step > 10000 || Math.abs(activeId) > 443636) return null;
    return {
      mintA: key(data, 88),
      mintB: key(data, 120),
      rawRatio: (1 + step / 10000) ** activeId,
      kind: "Meteora DLMM bin spot",
    };
  }
  return null;
}
export function knownDecimals(mint: string) {
  return mint === WSOL ? 9 : mint === USDC ? 6 : undefined;
}
export function poolQuote(
  state: PoolPriceState,
  mint: string,
  decimalsA: number,
  decimalsB: number,
) {
  if (
    ![decimalsA, decimalsB].every(
      (d) => Number.isInteger(d) && d >= 0 && d <= 18,
    ) ||
    (state.sqrtPriceX64 != null && state.sqrtPriceX64 <= 0n) ||
    state.mintA === state.mintB
  )
    return null;
  const ratio =
    (state.rawRatio ?? (Number(state.sqrtPriceX64) / 2 ** 64) ** 2) *
    10 ** (decimalsA - decimalsB);
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  if (mint === state.mintA) return { price: ratio, quoteMint: state.mintB };
  if (mint === state.mintB) return { price: 1 / ratio, quoteMint: state.mintA };
  return null;
}
