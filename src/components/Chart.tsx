import { useEffect, useRef, useState } from "react";
import { fetchBestPool, fetchCandles, isPoolAddr, peekCandles, patchLastCandle, prefetchCandles, type Candle } from "../lib/axiom";
import { fmtUsd } from "../lib/format";

const IVS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

function startIv(bornAt?: number): (typeof IVS)[number] {
  if (bornAt && Date.now() - bornAt < 8 * 60 * 60 * 1000) return "1m";
  return "15m";
}

export function Chart({
  pool,
  token,
  last,
  bornAt,
}: {
  pool?: string;
  token?: string;
  last?: number;
  bornAt?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [iv, setIv] = useState<(typeof IVS)[number]>(() => startIv(bornAt));
  const [bars, setBars] = useState<Candle[]>([]);
  const [live, setLive] = useState(true);
  const hover = useRef<{ x: number; y: number } | null>(null);
  const view = useRef({ offset: 0, span: 96, drag: false, lastX: 0, moved: false });

  useEffect(() => {
    setIv(startIv(bornAt));
    setBars([]);
  }, [pool, token, bornAt]);

  useEffect(() => {
    view.current.offset = 0;
    view.current.span = 96;
    setLive(true);
  }, [pool, iv]);

  useEffect(() => {
    if (!pool && !token) {
      setBars([]);
      return;
    }
    const instant = isPoolAddr(pool) ? peekCandles(pool, iv) : undefined;
    if (instant?.length) setBars(instant);
    let stop = false;
    const load = async () => {
      try {
        let p = isPoolAddr(pool) ? pool : undefined;
        if (!p && token) p = await fetchBestPool(token);
        if (!p) return;
        const cached = peekCandles(p, iv);
        if (cached?.length && !stop) setBars(cached);
        let rows = await fetchCandles(p, iv);
        if (!stop && rows.length < 2 && iv !== "1m") {
          const m1 = await fetchCandles(p, "1m");
          if (m1.length > rows.length) {
            rows = m1;
            setIv("1m");
          }
        }
        if (!stop && rows.length) setBars(rows);
        window.setTimeout(() => {
          if (stop) return;
          prefetchCandles(
            p,
            IVS.filter((x) => x !== iv)
          );
        }, 80);
      } catch {
        /* keep last bars */
      }
    };
    void load();
    const id = setInterval(() => void load(), 4000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [pool, token, iv]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const maxOff = () => Math.max(0, bars.length - 12);

    const onDown = (e: MouseEvent) => {
      view.current.drag = true;
      view.current.moved = false;
      view.current.lastX = e.clientX;
      c.style.cursor = "grabbing";
    };
    const onMove = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      const over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (over) hover.current = { x: e.clientX - r.left, y: e.clientY - r.top };
      else if (!view.current.drag) hover.current = null;
      if (!view.current.drag) return;
      const dx = e.clientX - view.current.lastX;
      if (Math.abs(dx) > 2) view.current.moved = true;
      view.current.lastX = e.clientX;
      const span = Math.max(12, Math.min(view.current.span, bars.length || view.current.span));
      const candleW = Math.max(2, (r.width - 102) / span);
      view.current.offset = Math.max(0, Math.min(maxOff(), view.current.offset - Math.round(dx / candleW)));
      const isLive = view.current.offset === 0;
      setLive((prev) => (prev === isLive ? prev : isLive));
    };
    const onUp = () => {
      view.current.drag = false;
      c.style.cursor = "grab";
    };
    const onLeave = () => {
      hover.current = null;
      view.current.drag = false;
      c.style.cursor = "grab";
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = e.deltaY > 0 ? view.current.span * 1.12 : view.current.span * 0.88;
      view.current.span = Math.max(16, Math.min(Math.max(bars.length, 16), Math.round(next)));
      view.current.offset = Math.max(0, Math.min(maxOff(), view.current.offset));
      setLive(view.current.offset === 0);
    };

    c.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    c.addEventListener("mouseleave", onLeave);
    c.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(() => {
      /* next raf reads clientWidth */
    });
    ro.observe(c);

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== w * dpr || c.height !== h * dpr) {
        c.width = w * dpr;
        c.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (w < 40 || h < 40) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const source = (isPoolAddr(pool) ? peekCandles(pool, iv) : undefined) ?? bars;
      const all = patchLastCandle(source, last);
      if (!all.length) {
        ctx.fillStyle = "rgba(243,234,215,0.45)";
        ctx.font = "12px 'Instrument Sans', sans-serif";
        ctx.fillText(pool || token ? "Fable 5.1 fetching candles…" : "Awaiting a market", 16, 24);
        raf = requestAnimationFrame(draw);
        return;
      }
      const span = Math.max(1, Math.min(view.current.span, all.length));
      const offset = Math.max(0, Math.min(Math.max(0, all.length - 1), view.current.offset));
      const end = all.length - offset;
      const start = Math.max(0, end - span);
      const data = all.slice(start, end);
      const slots = Math.max(28, data.length);
      const lead = slots - data.length;

      const volH = Math.floor(h * 0.22);
      const chartH = h - volH - 8;
      let min = Math.min(...data.map((b) => b.l));
      let max = Math.max(...data.map((b) => b.h));
      if (Number.isFinite(last) && offset === 0) {
        min = Math.min(min, last!);
        max = Math.max(max, last!);
      }
      if (max - min < 1e-12) {
        min *= 0.999;
        max *= 1.001;
      }
      const pad = (max - min) * 0.08;
      min -= pad;
      max += pad;
      const maxV = Math.max(...data.map((b) => b.v), 1);
      const gap = 1.5;
      const right = 58;
      const left = 44;
      const bw = Math.max(2.5, (w - left - right) / slots - gap);
      const yAt = (v: number) => 10 + (1 - (v - min) / (max - min)) * (chartH - 20);
      const xAt = (i: number) => left + (i + lead) * (bw + gap);

      ctx.strokeStyle = "rgba(243,234,215,0.08)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = 10 + (i / 4) * (chartH - 20);
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(w - right + 8, y);
        ctx.stroke();
        ctx.fillStyle = "rgba(243,234,215,0.42)";
        ctx.font = "10px 'Instrument Sans', sans-serif";
        const label = fmtUsd(max - ((max - min) * i) / 4, 4);
        ctx.textAlign = "right";
        ctx.fillText(label, w - 6, y + 3);
      }
      ctx.textAlign = "left";

      data.forEach((b, i) => {
        const x = xAt(i);
        const up = b.c >= b.o;
        const col = up ? "#e8d7a8" : "#c45c4a";
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + bw / 2, yAt(b.h));
        ctx.lineTo(x + bw / 2, yAt(b.l));
        ctx.stroke();
        const y1 = yAt(Math.max(b.o, b.c));
        const y2 = yAt(Math.min(b.o, b.c));
        const bh = Math.max(1, y2 - y1);
        ctx.globalAlpha = up ? 0.92 : 0.78;
        ctx.fillRect(x, y1, bw, bh);
        ctx.globalAlpha = 1;
        const vh = (b.v / maxV) * (volH - 10);
        ctx.globalAlpha = 0.42;
        ctx.fillRect(x, h - 4 - vh, bw, vh);
        ctx.globalAlpha = 1;
      });

      if (Number.isFinite(last) && offset === 0) {
        const y = yAt(last!);
        ctx.strokeStyle = "rgba(243,234,215,0.4)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(w - right + 8, y);
        ctx.stroke();
        ctx.setLineDash([]);
        const tag = fmtUsd(last!, 4);
        ctx.font = "11px 'Instrument Sans', sans-serif";
        const tw = tag.length * 7 + 10;
        const lastOpen = data[data.length - 1]?.o ?? last!;
        ctx.fillStyle = last! >= lastOpen ? "#e8d7a8" : "#c45c4a";
        ctx.fillRect(w - tw - 4, y - 8, tw, 16);
        ctx.fillStyle = "#17150f";
        ctx.textAlign = "left";
        ctx.fillText(tag, w - tw + 2, y + 4);
      }

      ctx.fillStyle = "rgba(243,234,215,0.5)";
      ctx.font = "10px 'Instrument Sans', sans-serif";
      ctx.textAlign = "left";
      if (data[0]) {
        ctx.fillText(new Date(data[0].t).toISOString().slice(5, 16).replace("T", " "), left, h - volH + 12);
      }
      if (data[data.length - 1]) {
        const t = new Date(data[data.length - 1].t).toISOString().slice(5, 16).replace("T", " ");
        ctx.fillText(t, Math.max(left, w - right - t.length * 6), h - volH + 12);
      }

      const hv = hover.current;
      if (hv && !view.current.drag) {
        const i = Math.min(
          data.length - 1,
          Math.max(0, Math.floor((hv.x - left) / (bw + gap) - lead))
        );
        const b = data[i];
        if (b) {
          ctx.strokeStyle = "rgba(243,234,215,0.28)";
          ctx.beginPath();
          ctx.moveTo(xAt(i) + bw / 2, 0);
          ctx.lineTo(xAt(i) + bw / 2, h);
          ctx.stroke();
          const label = `${new Date(b.t).toISOString().slice(0, 16).replace("T", " ")}  O ${fmtUsd(b.o, 4)}  H ${fmtUsd(b.h, 4)}  L ${fmtUsd(b.l, 4)}  C ${fmtUsd(b.c, 4)}`;
          ctx.fillStyle = "#17150f";
          ctx.fillRect(48, 8, Math.min(w - 60, label.length * 7), 16);
          ctx.fillStyle = "#f3ead7";
          ctx.fillText(label, 52, 20);
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      c.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      c.removeEventListener("mouseleave", onLeave);
      c.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, [bars, last, pool, iv]);

  return (
    <div className="chart-wrap">
      <canvas ref={ref} />
      <div
        className="ivs"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={live ? "on" : ""}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            view.current.offset = 0;
            setLive(true);
          }}
        >
          Live
        </button>
        <span className="ivs-lab">range</span>
        {IVS.map((x) => (
          <button
            key={x}
            type="button"
            className={x === iv ? "on" : ""}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIv(x)}
          >
            {x}
          </button>
        ))}
      </div>
    </div>
  );
}
