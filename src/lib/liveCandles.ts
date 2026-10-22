import { normalizeCandles, type Candle } from "./axiom";
export const mergeSourceCandles = (old: Candle[], fresh: Candle[]) =>
  normalizeCandles([...old, ...fresh]);
export type SpotCandle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  receivedAt: number;
  observations: number;
};
export function observeSpot(
  old: SpotCandle | null,
  price: number,
  receivedAt: number,
  intervalMs: number,
): SpotCandle | null {
  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isFinite(receivedAt) ||
    receivedAt <= 0 ||
    intervalMs <= 0
  )
    return old;
  if (old && receivedAt < old.receivedAt) return old;
  const t = Math.floor(receivedAt / intervalMs) * intervalMs;
  return old && old.t === t
    ? {
        ...old,
        h: Math.max(old.h, price),
        l: Math.min(old.l, price),
        c: price,
        receivedAt,
        observations: old.observations + 1,
      }
    : {
        t,
        o: price,
        h: price,
        l: price,
        c: price,
        receivedAt,
        observations: 1,
      };
}
/** Only the current observed spot bar overlays the source. No invented volume or historical bars. */
export function withSpotCandle(
  source: Candle[],
  spot: SpotCandle | null,
): Candle[] {
  if (!spot || !source.length || spot.t < source.at(-1)!.t) return source;
  const last = source.at(-1)!;
  const candle =
    spot.t === last.t
      ? {
          ...last,
          h: Math.max(last.h, spot.h),
          l: Math.min(last.l, spot.l),
          c: spot.c,
        }
      : { t: spot.t, o: spot.o, h: spot.h, l: spot.l, c: spot.c, v: 0 };
  return spot.t === last.t
    ? [...source.slice(0, -1), candle]
    : [...source, candle];
}
const same = (a: Candle, b: Candle) =>
  a.t === b.t &&
  a.o === b.o &&
  a.h === b.h &&
  a.l === b.l &&
  a.c === b.c &&
  a.v === b.v;
/** Tail updates keep the user's viewport intact; historical corrections require a full replacement. */
export function canUpdateTail(previous: Candle[], next: Candle[]) {
  return (
    previous.length > 0 &&
    next.length >= previous.length &&
    previous.slice(0, -1).every((b, i) => !!next[i] && same(b, next[i])) &&
    next[previous.length - 1]?.t === previous.at(-1)?.t
  );
}
