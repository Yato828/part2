import { useEffect, useRef } from "react";

/** Ambient particles pause offscreen and respect reduced motion. */
export function SignalField() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      width = 0,
      height = 0,
      tick = 0,
      inView = true;
    const pointer = { x: -1000, y: -1000 };
    const dots = Array.from({ length: 95 }, (_, i) => ({
      x: ((i * 137.508) % 1000) / 1000,
      y: ((i * 231.71 + 71) % 1000) / 1000,
      radius: i % 7 === 0 ? 1.4 : 0.7,
      phase: i * 2.39,
    }));
    const draw = () => {
      frame = 0;
      ctx.clearRect(0, 0, width, height);
      for (const dot of dots) {
        let x = dot.x * width + Math.sin(tick * 0.003 + dot.phase) * 9;
        let y = dot.y * height + Math.cos(tick * 0.002 + dot.phase) * 13;
        const dx = x - pointer.x,
          dy = y - pointer.y,
          distance = Math.hypot(dx, dy);
        if (distance < 120 && distance > 0) {
          const push = (1 - distance / 120) * 22;
          x += (dx / distance) * push;
          y += (dy / distance) * push;
        }
        ctx.beginPath();
        ctx.arc(x, y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(235,235,235,${0.1 + (Math.sin(tick * 0.012 + dot.phase) + 1) * 0.13})`;
        ctx.fill();
      }
      tick++;
      if (inView && !document.hidden && !motion.matches)
        frame = requestAnimationFrame(draw);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      draw();
    };
    const resize = () => {
      width = el.clientWidth;
      height = el.clientHeight;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      el.width = width * scale;
      el.height = height * scale;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      start();
    };
    const move = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      pointer.x = e.clientX - box.left;
      pointer.y = e.clientY - box.top;
    };
    const observer = new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      if (inView) start();
      else cancelAnimationFrame(frame);
    });
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    observer.observe(el);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", start);
    motion.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", start);
      motion.removeEventListener("change", start);
    };
  }, []);
  return (
    <canvas className="signal-particles" ref={canvas} aria-hidden="true" />
  );
}
