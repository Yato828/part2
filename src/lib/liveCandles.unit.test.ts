import { describe, expect, it } from "vitest";
import { canUpdateTail, mergeSourceCandles } from "./liveCandles";
const a = { t: 1700000000000, o: 1, h: 3, l: 1, c: 2, v: 100 },
  b = { ...a, t: a.t + 300000 },
  c = { ...a, t: a.t + 600000 };
describe("live source candles", () => {
  it("replaces an open source candle and appends closed/new bars without duplicating time", () => {
    const fresh = { ...b, c: 2.5, h: 4, v: 150 };
    const next = mergeSourceCandles([a, b], [fresh, c]);
    expect(next).toEqual([a, fresh, c]);
    expect(canUpdateTail([a, b], next)).toBe(true);
  });
  it("replaces history when a source corrects older OHLC or older pages are prepended", () => {
    expect(canUpdateTail([a, b], [{ ...a, c: 1.5 }, b])).toBe(false);
    expect(canUpdateTail([b], [a, b])).toBe(false);
  });
  it("never fills missing time intervals or invents invalid prices", () => {
    expect(mergeSourceCandles([a], [c, { ...b, c: -1 }])).toEqual([a, c]);
    expect(canUpdateTail([], [])).toBe(false);
  });
});

import { observeSpot, withSpotCandle } from "./liveCandles";
describe("provisional observed spot bars", () => {
  it("retains all intra-frame extremes and the latest close without inventing volume", () => {
    const t = 1700000100000;
    let spot = observeSpot(null, 10, t, 300000);
    spot = observeSpot(spot, 12, t + 1, 300000);
    spot = observeSpot(spot, 9, t + 2, 300000);
    spot = observeSpot(spot, 11, t + 3, 300000);
    expect(spot).toMatchObject({ o: 10, h: 12, l: 9, c: 11, observations: 4 });
    const source = [{ t: spot!.t, o: 9.5, h: 10.5, l: 9.5, c: 10, v: 123 }];
    const original = JSON.stringify(source);
    expect(withSpotCandle(source, spot)[0]).toMatchObject({
      o: 9.5,
      h: 12,
      l: 9,
      c: 11,
      v: 123,
    });
    expect(JSON.stringify(source)).toBe(original);
  });
  it("starts a new observed interval without filling missing history and rejects late/invalid observations", () => {
    const old = observeSpot(null, 10, 1700000100000, 60000)!;
    expect(observeSpot(old, 999, old.receivedAt - 1, 60000)).toBe(old);
    expect(observeSpot(old, Infinity, old.receivedAt + 1, 60000)).toBe(old);
    const next = observeSpot(old, 20, old.t + 180000, 60000)!;
    const source = [{ ...old, v: 10 }];
    expect(withSpotCandle(source, next)).toHaveLength(2);
    expect(next.o).toBe(20);
    expect(withSpotCandle(source, next).at(-1)?.v).toBe(0);
    expect(withSpotCandle([], next)).toEqual([]);
  });
});
