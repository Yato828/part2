import type { AxiomCoin } from "./axiom";

export type IntelId =
  | "idle"
  | "halt"
  | "rug"
  | "dead"
  | "thin"
  | "chase"
  | "long"
  | "buy"
  | "scalp"
  | "wait";

export type IntelBrief = {
  id: IntelId;
  score: number;
  verdict: string;
  action: string;
  review: string;
  social: string;
  flags: string[];
};

export type IntelInput = {
  armed: boolean;
  symbol?: string;
  stock?: boolean;
  halt?: boolean;
  coin?: AxiomCoin | null;
  volume?: number;
  liquidity?: number;
  holders?: number;
};

export function liveScore(input: IntelInput) {
  const c = input.coin;
  const liq = input.liquidity ?? c?.liquidityUsd ?? 0;
  const vol = input.volume ?? c?.volume24h ?? 0;
  const chg = Math.abs(c?.change24h ?? 0);
  const ageH = c?.createdAt ? (Date.now() - c.createdAt) / 36e5 : 24 * 30;
  const socials = Number(Boolean(c?.twitter)) + Number(Boolean(c?.website));
  const buys = c?.buys24h ?? 0;
  const sells = c?.sells24h ?? 0;
  const flow = buys + sells > 0 ? buys / (buys + sells) : 0.5;
  let s = 38;
  s += Math.min(22, Math.log10(Math.max(liq, 1)) * 4.2);
  s += Math.min(12, Math.log10(Math.max(vol, 1)) * 2.4);
  s += socials * 6;
  s += (flow - 0.5) * 20;
  if (ageH > 24 * 14) s += 8;
  if (ageH < 6) s -= 18;
  if (chg > 35) s -= 10;
  if (input.stock) s += 14;
  if (input.halt) s -= 40;
  if (liq > 0 && liq < 8000) s -= 22;
  return Math.max(1, Math.min(99, Math.round(s)));
}

export function briefIntel(input: IntelInput): IntelBrief {
  const score = input.armed ? liveScore(input) : 0;
  const c = input.coin;
  const liq = input.liquidity ?? c?.liquidityUsd ?? 0;
  const vol = input.volume ?? c?.volume24h ?? 0;
  const chg24 = c?.change24h ?? 0;
  const chg1h = c?.change1h ?? 0;
  const ageH = c?.createdAt ? (Date.now() - c.createdAt) / 36e5 : Infinity;
  const socials = Number(Boolean(c?.twitter)) + Number(Boolean(c?.website));
  const buys = c?.buys24h ?? 0;
  const sells = c?.sells24h ?? 0;
  const social =
    [c?.twitter ? "X LIVE" : null, c?.website ? "WEB LIVE" : null].filter(Boolean).join(" · ") || "NO SOCIALS";
  const flags: string[] = [];
  if (input.stock) flags.push("RH STOCK TOKEN");
  if (socials) flags.push("SOCIALS");
  else if (input.armed) flags.push("DARK SOCIAL");
  if (Number.isFinite(liq) && liq > 0) flags.push(`LIQ ${Math.round(liq)}`);
  if (ageH < 24) flags.push("FRESH PAIR");

  if (!input.armed) {
    return {
      id: "idle",
      score: 0,
      verdict: "STANDBY",
      action: "AWAITING TOKEN",
      review: "Fable 5.1 is watching — the fastest and most accurate read on this chain. Search a ticker in the left rail. I will score liquidity and tape, then say if this is a live buy, a wait, or a rug.",
      social: "—",
      flags: ["IDLE"],
    };
  }

  if (input.halt) {
    return {
      id: "halt",
      score,
      verdict: "HALT",
      action: "STAND DOWN",
      review: `${input.symbol} is in a trading halt. Do not average down. Wait for the halt to lift, then re-read the spread.`,
      social,
      flags: [...flags, "TRADING HALT"],
    };
  }

  const dump = chg24 < -25 || chg1h < -12;
  const micro = liq > 0 && liq < 12000;
  const newborn = ageH < 8;
  if ((micro && (newborn || socials === 0)) || (micro && dump && sells > buys * 1.4)) {
    return {
      id: "rug",
      score,
      verdict: "RUG RISK",
      action: "DO NOT BUY",
      review: `${input.symbol} looks like a rug: thin liquidity, sells dominating. Do not hold this long — you can get stuck with the bag.`,
      social,
      flags: [...flags, "RUG PATTERN"],
    };
  }

  if (vol < 50 && liq < 40000 && !input.stock) {
    return {
      id: "dead",
      score,
      verdict: "DEAD TAPE",
      action: "SKIP",
      review: `${input.symbol} tape is dead: no volume, no pulse. Not an entry — either boredom or everyone already left.`,
      social,
      flags: [...flags, "NO FLOW"],
    };
  }

  if (micro) {
    return {
      id: "thin",
      score,
      verdict: "THIN LIQ",
      action: "NO SIZE",
      review: `${input.symbol} liquidity is too thin. Even a small clip will move price. Do not size in — dust only, and that is still on you.`,
      social,
      flags: [...flags, "THIN BOOK"],
    };
  }

  if (chg1h > 12 || chg24 > 42) {
    return {
      id: "chase",
      score,
      verdict: "EXTENDED",
      action: "DO NOT CHASE",
      review: `${input.symbol} is already extended: sharp green on a short window. Buying now is catching a top. Do not hold long from this spike — wait for a pullback.`,
      social,
      flags: [...flags, "CHASE RISK"],
    };
  }

  if (input.stock && liq >= 40000) {
    return {
      id: "long",
      score,
      verdict: "STOCK TOKEN",
      action: "HOLD OK",
      review: `${input.symbol} is an official Robinhood Chain stock token, not a meme. Fine for a longer horizon if you understand the equity. Do not lever this like a degen mint — it is a share, not a rug.`,
      social,
      flags: [...flags, "HOLD OK"],
    };
  }

  const healthy = liq >= 80000 && vol >= 5000 && (socials > 0 || input.stock) && Math.abs(chg24) < 28;
  if (healthy && (chg24 >= -4 || (buys >= sells && chg1h >= 0))) {
    return {
      id: "buy",
      score,
      verdict: "LIVE WINDOW",
      action: "BUY OK NOW",
      review: `${input.symbol} is live: liquidity is real, volume is printing. Fable 5.1 reads a clean window. Short entry is OK. Do not marry it — this is a DEX, not a treasury.`,
      social,
      flags: [...flags, "LIVE BUY"],
    };
  }

  if (vol >= 20000 && Math.abs(chg24) >= 8) {
    return {
      id: "scalp",
      score,
      verdict: "SCALP ONLY",
      action: "SHORT HOLD ONLY",
      review: `${input.symbol} is noisy, not an investment. Do not hold long — scalp a slice or sit out. Keep a hard exit or the tape will eat you.`,
      social,
      flags: [...flags, "INTRADAY"],
    };
  }

  return {
    id: "wait",
    score,
    verdict: "WAIT",
    action: "WAIT",
    review: `${input.symbol}: mixed signals, no clean edge. You are not obligated to buy. Wait for volume or a cleaner impulse — FOMO does not pay here.`,
    social,
    flags: [...flags, "NO EDGE"],
  };
}
