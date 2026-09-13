export type FableFacts = {
  symbol: string;
  id: string;
  score: number;
  verdict: string;
  action: string;
  stock: boolean;
  halt: boolean;
  liq: number;
  vol: number;
  chg1h: number;
  chg24: number;
  holders: number;
  flags: string[];
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function parseFableFacts(raw: unknown): FableFacts | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const symbol = String(o.symbol ?? "").replace(/[^\w.$/:-]/g, "").slice(0, 16);
  if (!symbol) return null;
  const flags = Array.isArray(o.flags)
    ? o.flags.map((f) => String(f).slice(0, 28)).filter(Boolean).slice(0, 6)
    : [];
  return {
    symbol,
    id: String(o.id ?? "wait").slice(0, 16),
    score: Math.max(0, Math.min(99, Math.round(num(o.score)))),
    verdict: String(o.verdict ?? "WAIT").slice(0, 24),
    action: String(o.action ?? "WAIT").slice(0, 28),
    stock: Boolean(o.stock),
    halt: Boolean(o.halt),
    liq: Math.max(0, Math.round(num(o.liq))),
    vol: Math.max(0, Math.round(num(o.vol))),
    chg1h: Number(num(o.chg1h).toFixed(2)),
    chg24: Number(num(o.chg24).toFixed(2)),
    holders: Math.max(0, Math.round(num(o.holders))),
    flags,
  };
}

export function fableMessages(facts: FableFacts) {
  return [
    {
      role: "system" as const,
      content:
        "You are Fable 5.1 on PART. Reply with one or two short spoken sentences. Confirm the verdict. Do not invent prices. No slogans. English.",
    },
    {
      role: "user" as const,
      content: [
        facts.symbol,
        facts.verdict,
        facts.action,
        `score ${facts.score}`,
        `liq ${facts.liq}`,
        `vol ${facts.vol}`,
        `1h ${facts.chg1h}%`,
        `24h ${facts.chg24}%`,
        facts.stock ? "RH stock token" : "dex pair",
        facts.halt ? "HALT" : "",
        facts.flags.join(" "),
      ]
        .filter(Boolean)
        .join(" "),
    },
  ];
}

export function sseDelta(line: string): { done?: boolean; text?: string } {
  const t = line.trim();
  if (!t.startsWith("data:")) return {};
  const data = t.slice(5).trim();
  if (data === "[DONE]") return { done: true };
  try {
    const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
    const text = json.choices?.[0]?.delta?.content;
    return text ? { text } : {};
  } catch {
    return {};
  }
}
