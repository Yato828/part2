export function heatScore(volume: number, absChange: number) {
  const vol = Number.isFinite(volume) ? Math.max(volume, 1) : 1;
  const ch = Number.isFinite(absChange) ? Math.min(Math.abs(absChange), 80) : 0;
  return Math.max(0.22, Math.log10(vol)) * (1 + ch / 80);
}

export function mosaicShares(txCounts: number[]) {
  const weights = txCounts.map((n) => Math.max(Number(n) || 1, 1));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w) => w / sum);
}

export function gasRibbon(slow: number, avg: number, fast: number) {
  const max = Math.max(slow, avg, fast, 1);
  return {
    slow: slow / max,
    avg: avg / max,
    fast: fast / max,
  };
}
