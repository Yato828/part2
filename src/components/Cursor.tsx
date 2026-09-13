import { useEffect, useRef } from "react";

/** Custom site cursor — eye-arrow, same follow/hotspot as utopiaagent.app. */
export function SiteCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    document.documentElement.classList.add("has-site-cursor");
    const pos = { x: 0, y: 0, visible: false };
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      pos.visible = e.pointerType !== "touch";
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      el.classList.toggle("hot", Boolean(hit?.closest("button, a, input, summary")));
    };
    const onLeave = () => {
      pos.visible = false;
    };
    const tick = () => {
      el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-3.2%, -10.4%)`;
      el.style.opacity = pos.visible ? "1" : "0";
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      document.documentElement.classList.remove("has-site-cursor");
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={ref} className="site-cursor" aria-hidden>
      <img src="/hero/landing/eye-cursor.png" alt="" draggable={false} />
    </div>
  );
}
