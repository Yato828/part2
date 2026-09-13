import { describe, expect, it } from "vitest";
import { fableMessages, parseFableFacts, sseDelta, toFableFacts } from "./fable";
import { handleFable } from "./fableServer";
import { briefIntel } from "./intel";
import type { AxiomCoin } from "./axiom";

const coin = (extra: Partial<AxiomCoin> = {}): AxiomCoin => ({
  symbol: "HOOD",
  name: "Robinhood",
  address: "0x1111111111111111111111111111111111111111",
  pairAddress: "0x2222222222222222222222222222222222222222",
  chainId: "robinhood",
  dex: "uniswap",
  priceUsd: 12,
  liquidityUsd: 200000,
  volume24h: 80000,
  change1h: 1.2,
  change24h: -3.4,
  ...extra,
});

describe("Fable 5.1 GPT facts", () => {
  it("packs a short payload from the live brief", () => {
    const input = { armed: true, symbol: "HOOD", stock: true, coin: coin() };
    const facts = toFableFacts(input, briefIntel(input));
    expect(facts.symbol).toBe("HOOD");
    expect(facts.stock).toBe(true);
    expect(facts.liq).toBe(200000);
    expect(fableMessages(facts)[1].content).toContain("HOOD");
    expect(fableMessages(facts)[1].content).toContain("liq 200000");
  });

  it("rejects empty facts and strips junk symbols", () => {
    expect(parseFableFacts({})).toBeNull();
    expect(parseFableFacts({ symbol: "NVDA!!!" })?.symbol).toBe("NVDA");
  });

  it("reads OpenAI SSE deltas", () => {
    expect(sseDelta("data: [DONE]")).toEqual({ done: true });
    expect(sseDelta('data: {"choices":[{"delta":{"content":"Wait."}}]}')).toEqual({ text: "Wait." });
    expect(sseDelta("event: ping")).toEqual({});
  });

  it("answers CORS preflight without waiting on the model", async () => {
    const res = await handleFable(new Request("http://x/api/fable", { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
