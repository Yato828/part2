import { PublicKey } from "@solana/web3.js";
import { ORCA_WHIRLPOOL, type RpcAccount } from "../src/lib/poolPrice";
import { WSOL, USDC } from "../src/lib/const";
export function poolAccount(price = 100, program = ORCA_WHIRLPOOL): RpcAccount {
  const data = new Uint8Array(program === ORCA_WHIRLPOOL ? 653 : 1544);
  const orca = program === ORCA_WHIRLPOOL;
  data.set(
    orca
      ? [63, 149, 209, 12, 225, 128, 99, 9]
      : [247, 237, 227, 245, 215, 195, 222, 70],
  );
  data.set(new PublicKey(WSOL).toBytes(), orca ? 101 : 73);
  data.set(new PublicKey(USDC).toBytes(), orca ? 181 : 105);
  let sqrt = BigInt(Math.floor(Math.sqrt(price / 1000) * 2 ** 64));
  const offset = orca ? 65 : 253;
  for (let i = 0; i < 16; i++) {
    data[offset + i] = Number(sqrt & 255n);
    sqrt >>= 8n;
  }
  if (!orca) {
    data[233] = 9;
    data[234] = 6;
  }
  return {
    owner: program,
    data: [Buffer.from(data).toString("base64"), "base64"],
  };
}
