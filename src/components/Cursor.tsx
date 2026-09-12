import { useEffect, useRef, useState } from "react";

type Trail = { x: number; y: number; id: number };

export function Cursor() {
  const [pos, setPos] = useState({ x: -40, y: -40 });
  const [hot, setHot] = useState(false);
  const [trails, setTrails] = useState<Trail[]>([]);
  const id = useRef(0);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      const t = { x: e.clientX, y: e.clientY, id: id.current++ };
      setTrails((prev) => [...prev.slice(-10), t]);
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const tag = el?.tagName.toLowerCase();
      setHot(tag === "button" || tag === "input" || el?.closest("button, .row, input") != null);
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  return (
    <>
      {trails.map((t, i) => (
        <div
          key={t.id}
          className="cursor-trail"
          style={{ left: t.x, top: t.y, opacity: (i + 1) / trails.length / 2.4 }}
        />
      ))}
      <div className={`cursor${hot ? " hot" : ""}`} style={{ left: pos.x, top: pos.y }}>
        <svg viewBox="0 0 32 32" width="28" height="28">
          <polygon points="16,2 28,28 16,22 4,28" fill="none" stroke="#c6ff1a" strokeWidth="1.6" />
          <ellipse cx="16" cy="14" rx="6" ry="3.4" fill="none" stroke="#c6ff1a" strokeWidth="1.4" />
          <circle cx="16" cy="14" r="1.6" fill="#c6ff1a" />
        </svg>
      </div>
    </>
  );
}
