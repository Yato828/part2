import { EXPLORER } from "../lib/const";
import { fmtPct, fmtQty, shortAddr } from "../lib/format";
import { fetchBubbleGraph, type BubbleGraph, type BubbleNode } from "../lib/bubble";
import { useEffect, useRef, useState } from "react";

const PALETTE = ["#f3ead7", "#e8d7a8", "#c4a574", "#efe6d4", "#d9c7a2", "#c45c4a", "#b9a888"];

type Sim = BubbleNode & {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  pinned: boolean;
};

type Cam = { yaw: number; pitch: number; zoom: number; panX: number; panY: number };

export function BubbleMap({
  token,
  pool,
  symbol,
}: {
  token?: string;
  pool?: string;
  symbol?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [graph, setGraph] = useState<BubbleGraph>({ nodes: [], links: [] });
  const [status, setStatus] = useState<"idle" | "load" | "ready">("idle");
  const nodesRef = useRef<Sim[]>([]);
  const cam = useRef<Cam>({ yaw: 0.35, pitch: 0.18, zoom: 1, panX: 0, panY: 0 });
  const hover = useRef<string | null>(null);
  const drag = useRef<{ id?: string; orbit: boolean; lastX: number; lastY: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (!token && !pool) {
      setGraph({ nodes: [], links: [] });
      setStatus("idle");
      nodesRef.current = [];
      return;
    }
    let live = true;
    setStatus("load");
    void fetchBubbleGraph(token, pool).then((g) => {
      if (!live) return;
      setGraph(g);
      setStatus("ready");
    });
    return () => {
      live = false;
    };
  }, [token, pool]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const FL = 520;

    const layout = (nodes: BubbleNode[]) => {
      const groups = new Map<number, BubbleNode[]>();
      for (const n of nodes) {
        const list = groups.get(n.cluster) ?? [];
        list.push(n);
        groups.set(n.cluster, list);
      }
      const keys = [...groups.keys()];
      const R = 170;
      const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
      const out: Sim[] = [];
      keys.forEach((cl, ci) => {
        const a = (ci / Math.max(keys.length, 1)) * Math.PI * 2 - Math.PI / 2;
        const cx = Math.cos(a) * R;
        const cz = Math.sin(a) * R;
        const cy = ((ci % 3) - 1) * 36;
        (groups.get(cl) ?? []).forEach((n, i) => {
          const old = prev.get(n.id);
          const jitter = 28 + (n.share ?? 0) * 40;
          out.push({
            ...n,
            x: old?.x ?? cx + Math.sin(i * 2.3) * jitter,
            y: old?.y ?? cy + Math.cos(i * 1.7) * jitter,
            z: old?.z ?? cz + Math.sin(i * 3.1 + ci) * jitter,
            vx: 0,
            vy: 0,
            vz: 0,
            pinned: old?.pinned ?? false,
          });
        });
      });
      nodesRef.current = out;
    };

    const project = (n: Sim) => {
      const camv = cam.current;
      const cy = Math.cos(camv.yaw);
      const sy = Math.sin(camv.yaw);
      const cp = Math.cos(camv.pitch);
      const sp = Math.sin(camv.pitch);
      const x1 = n.x * cy - n.z * sy;
      const z1 = n.x * sy + n.z * cy;
      const y1 = n.y * cp - z1 * sp;
      const z2 = n.y * sp + z1 * cp;
      const s = (camv.zoom * FL) / (FL + z2);
      return {
        x: w / 2 + camv.panX + x1 * s,
        y: h / 2 + camv.panY + y1 * s,
        z: z2,
        s,
        r: Math.max(10, (10 + Math.sqrt(Math.max(n.share, 0.002)) * 92) * s * 0.55),
      };
    };

    const hitAt = (px: number, py: number) => {
      const ranked = nodesRef.current.map((n) => ({ n, p: project(n) })).sort((a, b) => a.p.z - b.p.z);
      for (const row of ranked) {
        if (Math.hypot(row.p.x - px, row.p.y - py) <= row.p.r) return row.n;
      }
      return null;
    };

    const tick = () => {
      const nodes = nodesRef.current;
      const byId = new Map(nodes.map((n) => [n.id, n]));
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (!a.pinned) {
          a.vx -= a.x * 0.00035;
          a.vy -= a.y * 0.00035;
          a.vz -= a.z * 0.00035;
        }
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dz = b.z - a.z;
          const dist = Math.hypot(dx, dy, dz) || 0.01;
          const min = 48 + (a.share + b.share) * 80;
          if (dist < min) {
            const push = ((min - dist) / dist) * 0.08;
            if (!a.pinned) {
              a.vx -= dx * push;
              a.vy -= dy * push;
              a.vz -= dz * push;
            }
            if (!b.pinned) {
              b.vx += dx * push;
              b.vy += dy * push;
              b.vz += dz * push;
            }
          }
        }
      }
      for (const l of graph.links) {
        const a = byId.get(l.source);
        const b = byId.get(l.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dy, dz) || 0.01;
        const rest = 70;
        const k = (dist - rest) * 0.004;
        if (!a.pinned) {
          a.vx += dx * k;
          a.vy += dy * k;
          a.vz += dz * k;
        }
        if (!b.pinned) {
          b.vx -= dx * k;
          b.vy -= dy * k;
          b.vz -= dz * k;
        }
      }
      for (const n of nodes) {
        if (n.pinned) {
          n.vx = 0;
          n.vy = 0;
          n.vz = 0;
          continue;
        }
        n.vx *= 0.86;
        n.vy *= 0.86;
        n.vz *= 0.86;
        n.x += n.vx;
        n.y += n.vy;
        n.z += n.vz;
      }
    };

    const hash = (n: number) => {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };

    const stipple = (cx: number, cy: number, r: number, seed: number, ink: string, dens: number) => {
      const count = Math.max(28, Math.floor(r * r * dens));
      ctx.fillStyle = ink;
      for (let i = 0; i < count; i++) {
        const u = hash(seed + i);
        const v = hash(seed + i + 91);
        const ang = u * Math.PI * 2;
        const rad = Math.sqrt(v) * r * 0.96;
        ctx.fillRect(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, 1.15, 1.15);
      }
    };

    const drawOrb = (x: number, y: number, r: number, col: string, hot: boolean, dim: boolean, isolated: boolean) => {
      const seed = Math.floor(x * 13 + y * 29 + r * 7);

      ctx.save();
      ctx.globalAlpha = dim ? 0.2 : 1;

      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.7, r * 0.62, r * 0.14, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(5,8,12,0.88)";
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      stipple(x, y, r, seed, hot ? "#fff6e4" : col, hot ? 0.72 : 0.5);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = isolated ? "rgba(243,234,215,0.28)" : hot ? "#fff6e4" : "rgba(243,234,215,0.42)";
      ctx.setLineDash(isolated ? [2.5, 2.5] : []);
      ctx.lineWidth = hot ? 1.5 : 0.85;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    };

    const onDown = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const hit = hitAt(x, y);
      if (hit) {
        hit.pinned = true;
        drag.current = { id: hit.id, orbit: false, lastX: e.clientX, lastY: e.clientY, moved: false };
      } else {
        drag.current = { orbit: true, lastX: e.clientX, lastY: e.clientY, moved: false };
      }
    };
    const onMove = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const over = hitAt(x, y);
      hover.current = over?.id ?? null;
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;
      if (Math.hypot(dx, dy) > 3) d.moved = true;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      if (d.id) {
        const n = nodesRef.current.find((q) => q.id === d.id);
        if (!n) return;
        const cy = Math.cos(cam.current.yaw);
        const sy = Math.sin(cam.current.yaw);
        const k = 0.9 / cam.current.zoom;
        n.x += dx * k * cy;
        n.z += dx * k * sy;
        n.y += dy * k;
      } else if (d.orbit) {
        cam.current.yaw += dx * 0.008;
        cam.current.pitch = Math.max(-1.05, Math.min(1.05, cam.current.pitch + dy * 0.006));
      }
    };
    const onUp = () => {
      const d = drag.current;
      if (d?.id && !d.moved) {
        window.open(`${EXPLORER}/address/${d.id}`, "_blank");
      }
      if (d?.id) {
        const n = nodesRef.current.find((q) => q.id === d.id);
        if (n) n.pinned = false;
      }
      drag.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.current.zoom = Math.max(0.45, Math.min(2.6, cam.current.zoom * (e.deltaY > 0 ? 0.92 : 1.09)));
    };
    const onDbl = () => {
      cam.current = { yaw: 0.35, pitch: 0.18, zoom: 1, panX: 0, panY: 0 };
      nodesRef.current.forEach((n) => (n.pinned = false));
      if (graph.nodes.length) layout(graph.nodes);
    };

    c.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    c.addEventListener("wheel", onWheel, { passive: false });
    c.addEventListener("dblclick", onDbl);
    nodesRef.current = [];

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      w = c.clientWidth;
      h = c.clientHeight;
      if (c.width !== w * dpr || c.height !== h * dpr) {
        c.width = w * dpr;
        c.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (w > 40 && h > 40 && graph.nodes.length && nodesRef.current.length !== graph.nodes.length) {
        layout(graph.nodes);
      }
      if (nodesRef.current.length) tick();

      const hid = hover.current;
      const linked = new Set<string>();
      if (hid) {
        linked.add(hid);
        for (const l of graph.links) {
          if (l.source === hid) linked.add(l.target);
          if (l.target === hid) linked.add(l.source);
        }
      }

      const projected = nodesRef.current.map((n) => ({ n, p: project(n) })).sort((a, b) => b.p.z - a.p.z);
      const byId = new Map(projected.map((row) => [row.n.id, row]));

      const drawSilk = (x1: number, y1: number, x2: number, y2: number, alpha: number, width: number) => {
        ctx.strokeStyle = `rgba(243,234,215,${alpha})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12;
        const my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();
      };

      const drawArrow = (
        x1: number,
        y1: number,
        r1: number,
        x2: number,
        y2: number,
        r2: number,
        focus: boolean
      ) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < r1 + r2 + 8) return;
        const ux = dx / dist;
        const uy = dy / dist;
        const sx = x1 + ux * (r1 + 1);
        const sy = y1 + uy * (r1 + 1);
        const ex = x2 - ux * (r2 + 2);
        const ey = y2 - uy * (r2 + 2);
        ctx.strokeStyle = focus ? "rgba(243,234,215,0.85)" : "rgba(243,234,215,0.32)";
        ctx.fillStyle = focus ? "#f3ead7" : "rgba(243,234,215,0.5)";
        ctx.lineWidth = focus ? 1.8 : 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        const ah = focus ? 9 : 7;
        const aw = ah * 0.55;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - ux * ah - uy * aw, ey - uy * ah + ux * aw);
        ctx.lineTo(ex - ux * ah + uy * aw, ey - uy * ah - ux * aw);
        ctx.closePath();
        ctx.fill();
      };

      const clusters = new Map<number, typeof projected>();
      for (const row of projected) {
        const list = clusters.get(row.n.cluster) ?? [];
        list.push(row);
        clusters.set(row.n.cluster, list);
      }
      for (const group of clusters.values()) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i];
            const b = group[j];
            const focus = !hid || linked.has(a.n.id) || linked.has(b.n.id);
            drawSilk(a.p.x, a.p.y, b.p.x, b.p.y, focus ? 0.14 : 0.04, 0.7);
          }
        }
      }

      for (const l of graph.links) {
        const a = byId.get(l.source);
        const b = byId.get(l.target);
        if (!a || !b) continue;
        const focus = !hid || linked.has(l.source) || linked.has(l.target);
        drawSilk(a.p.x, a.p.y, b.p.x, b.p.y, focus ? 0.28 : 0.08, 1);
        drawArrow(a.p.x, a.p.y, a.p.r, b.p.x, b.p.y, b.p.r, focus);
      }

      const deg = new Map<string, number>();
      for (const l of graph.links) {
        deg.set(l.source, (deg.get(l.source) ?? 0) + 1);
        deg.set(l.target, (deg.get(l.target) ?? 0) + 1);
      }

      for (const row of projected) {
        const col = PALETTE[row.n.cluster % PALETTE.length];
        const dim = Boolean(hid && !linked.has(row.n.id));
        drawOrb(row.p.x, row.p.y, row.p.r, col, hid === row.n.id, dim, (deg.get(row.n.id) ?? 0) === 0);
      }

      const clusterIds = new Set(graph.nodes.map((n) => n.cluster));
      let lx = 8;
      ctx.font = "9px 'Instrument Sans', sans-serif";
      ctx.textAlign = "left";
      [...clusterIds].forEach((cl, i) => {
        ctx.fillStyle = PALETTE[cl % PALETTE.length];
        ctx.beginPath();
        ctx.arc(lx + 5, h - 12, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(243,234,215,0.7)";
        ctx.fillText(`C${i + 1}`, lx + 12, h - 9);
        lx += 38;
      });

      const hn = hid ? byId.get(hid) : undefined;
      if (hn) {
        const label = `${hn.n.name || shortAddr(hn.n.id)}  ${fmtPct(hn.n.share)}  txs ${fmtQty(hn.n.txs)}  ${hn.n.contract ? "CONTRACT" : "EOA"}`;
        ctx.font = "11px 'Instrument Sans', sans-serif";
        const tw = Math.min(w - 16, label.length * 7 + 14);
        const tx = Math.max(8, Math.min(w - tw - 8, hn.p.x - tw / 2));
        const ty = Math.max(8, hn.p.y - hn.p.r - 22);
        ctx.fillStyle = "#17150f";
        ctx.fillRect(tx, ty, tw, 16);
        ctx.strokeStyle = "rgba(243,234,215,0.4)";
        ctx.strokeRect(tx, ty, tw, 16);
        ctx.fillStyle = "#f3ead7";
        ctx.fillText(label, tx + 6, ty + 12);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      c.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      c.removeEventListener("wheel", onWheel);
      c.removeEventListener("dblclick", onDbl);
    };
  }, [graph]);

  return (
    <div className="bubble-wrap">
      <canvas ref={ref} />
      {status === "idle" && <div className="bubble-empty">Search a market to spin the web</div>}
      {status === "load" && !graph.nodes.length && <div className="bubble-empty">Mapping the web…</div>}
      {status === "ready" && !graph.nodes.length && <div className="bubble-empty">No flow · {symbol || "—"}</div>}
      <div className="bubble-hint">pull a node · drag empty space to orbit · wheel zoom</div>
    </div>
  );
}
