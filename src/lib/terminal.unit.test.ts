import { describe, expect, it } from "vitest";
import { fmtPct } from "./format";
import { gasRibbon, heatScore, mosaicShares } from "./terminal";

describe("terminal widgets", () => {
  it("scores heat cells by log volume and change", () => {
    expect(heatScore(1_000_000, 0)).toBeGreaterThan(heatScore(100, 0));
    expect(heatScore(1000, 40)).toBeGreaterThan(heatScore(1000, 0));
    expect(heatScore(0, 0)).toBeGreaterThan(0);
  });

  it("normalizes mosaic tiles to 1", () => {
    const s = mosaicShares([10, 30, 60]);
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(s[2]).toBeCloseTo(0.6);
  });

  it("scales gas ribbon against the fastest leg", () => {
    const g = gasRibbon(1, 2, 4);
    expect(g.fast).toBe(1);
    expect(g.avg).toBe(0.5);
    expect(g.slow).toBe(0.25);
  });

  it("formats holder share percents", () => {
    expect(fmtPct(0.1234)).toBe("12.3%");
    expect(fmtPct(0.002)).toBe("0.200%");
  });
});
