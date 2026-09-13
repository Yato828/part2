import { partFetch } from "./http";
import { briefIntel, type IntelBrief, type IntelInput } from "./intel";
import { sseDelta, type FableFacts } from "./fableCore";

export type { FableFacts } from "./fableCore";
export { fableMessages, parseFableFacts, sseDelta } from "./fableCore";

export function toFableFacts(input: IntelInput, brief: IntelBrief = briefIntel(input)): FableFacts {
  const c = input.coin;
  return {
    symbol: (input.symbol || c?.symbol || "").slice(0, 16),
    id: brief.id,
    score: brief.score,
    verdict: brief.verdict,
    action: brief.action,
    stock: Boolean(input.stock),
    halt: Boolean(input.halt),
    liq: Math.round(input.liquidity ?? c?.liquidityUsd ?? 0),
    vol: Math.round(input.volume ?? c?.volume24h ?? 0),
    chg1h: Number((c?.change1h ?? 0).toFixed(2)),
    chg24: Number((c?.change24h ?? 0).toFixed(2)),
    holders: Math.round(input.holders ?? c?.holders ?? 0),
    flags: brief.flags.slice(0, 6),
  };
}

export async function streamFable(
  facts: FableFacts,
  signal: AbortSignal,
  onText: (full: string) => void
) {
  if (!facts.symbol) return;
  const res = await partFetch("/api/fable", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(facts),
    signal,
  });
  if (!res.ok || !res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    for (const line of parts) {
      const hit = sseDelta(line);
      if (hit.done) return;
      if (hit.text) {
        out += hit.text;
        onText(out.trim());
      }
    }
  }
}
