import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  decodePoolPrice,
  poolQuote,
  ORCA_WHIRLPOOL,
  RAYDIUM_CLMM,
  METEORA_DLMM,
  type RpcAccount,
} from "./poolPrice";
import { WSOL, USDC } from "./const";
import { poolAccount } from "../../tests/poolFixture";
describe("on-chain pool spot decoders", () => {
  for (const program of [ORCA_WHIRLPOOL, RAYDIUM_CLMM])
    it(`decodes ${program} and respects mint direction/decimals`, () => {
      const state = decodePoolPrice(poolAccount(123.45, program))!;
      expect(poolQuote(state, WSOL, 9, 6)?.price).toBeCloseTo(123.45, 10);
      expect(poolQuote(state, USDC, 9, 6)?.price).toBeCloseTo(1 / 123.45, 12);
      expect(
        poolQuote(state, "11111111111111111111111111111111", 9, 6),
      ).toBeNull();
    });
  it("decodes the active Meteora bin with decimal scaling", () => {
    const data = new Uint8Array(904);
    data.set([33, 11, 49, 98, 181, 101, 177, 13]);
    const view = new DataView(data.buffer);
    view.setInt32(76, -100, true);
    view.setUint16(80, 10, true);
    data.set(new PublicKey(WSOL).toBytes(), 88);
    data.set(new PublicKey(USDC).toBytes(), 120);
    const state = decodePoolPrice({
      owner: METEORA_DLMM,
      data: [Buffer.from(data).toString("base64"), "base64"],
    })!;
    expect(poolQuote(state, WSOL, 9, 6)?.price).toBeCloseTo(
      1.001 ** -100 * 1000,
      10,
    );
  });
  it("rejects wrong programs, discriminators, malformed/truncated accounts and decimal/price errors", () => {
    const account = poolAccount();
    for (const patch of [
      { owner: WSOL },
      { executable: true },
      { data: ["AA==", "base64"] },
      { data: [account.data[0], "jsonParsed"] },
      { data: ["!", "base64"] },
    ])
      expect(
        decodePoolPrice({ ...account, ...patch } as RpcAccount),
      ).toBeNull();
    const state = decodePoolPrice(account)!;
    expect(poolQuote({ ...state, sqrtPriceX64: 0n }, WSOL, 9, 6)).toBeNull();
    expect(poolQuote(state, WSOL, 999, 6)).toBeNull();
  });
});
