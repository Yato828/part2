export function fmtUsd(n: number | string | null | undefined, digits = 2) {
  const v = typeof n === "string" ? Number(n) : n;
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3 && digits < 4) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  if (abs >= 1) return `${sign}$${abs.toFixed(digits)}`;
  if (abs >= 0.01) return `${sign}$${abs.toFixed(4)}`;
  return `${sign}$${abs.toPrecision(3)}`;
}

export function fmtQty(n: number | string | null | undefined) {
  const v = typeof n === "string" ? Number(n) : n;
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString("en-US");
}

export function fmtInt(n: number | string | null | undefined) {
  const v = typeof n === "string" ? Number(n) : n;
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("en-US");
}

export function fmtPct(n: number | string | null | undefined) {
  const v = typeof n === "string" ? Number(n) : n;
  if (v == null || !Number.isFinite(v)) return "—";
  const p = v <= 1 && v >= 0 ? v * 100 : v;
  if (Math.abs(p) >= 10) return `${p.toFixed(1)}%`;
  if (Math.abs(p) >= 1) return `${p.toFixed(2)}%`;
  return `${p.toFixed(3)}%`;
}

export function shortAddr(addr?: string | null) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function mid(bid?: string, ask?: string) {
  const b = Number(bid);
  const a = Number(ask);
  if (Number.isFinite(b) && Number.isFinite(a)) return (b + a) / 2;
  if (Number.isFinite(b)) return b;
  if (Number.isFinite(a)) return a;
  return NaN;
}

export function supply(total?: string | null, decimals?: string | number | null) {
  if (!total) return NaN;
  const d = Number(decimals ?? 18);
  return Number(total) / 10 ** d;
}

export function clock() {
  return new Date().toISOString().replace("T", " ").slice(0, 19) + "Z";
}

export function pad(n: number, w = 2) {
  return String(n).padStart(w, "0");
}

export function localTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
