import { useEffect, useRef } from "react";

const IMG = "/hero/landing/degen-face.png";
const POS_X = 0.5;
const POS_Y = 0.22;

function coverRect(cw: number, ch: number, nw: number, nh: number) {
  const scale = Math.max(cw / nw, ch / nh);
  const w = nw * scale;
  const h = nh * scale;
  return {
    x: (cw - w) * POS_X,
    y: (ch - h) * POS_Y,
    w,
    h,
  };
}

export function WatchEnd({
  onEnter,
}: {
  onEnter?: () => void;
}) {
  const stage = useRef<HTMLElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const face = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    const picture = img.current;
    const overlay = face.current;
    if (!el || !picture || !overlay) return;

    const layout = () => {
      const nw = picture.naturalWidth || 1024;
      const nh = picture.naturalHeight || 1024;
      const r = coverRect(el.clientWidth, el.clientHeight, nw, nh);
      overlay.style.left = `${r.x}px`;
      overlay.style.top = `${r.y}px`;
      overlay.style.width = `${r.w}px`;
      overlay.style.height = `${r.h}px`;
    };

    const look = (e: PointerEvent) => {
      const box = overlay.getBoundingClientRect();
      if (!box.width) return;
      const cx = box.left + box.width * 0.5;
      const cy = box.top + box.height * 0.217;
      const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / Math.max(64, box.width * 0.28)));
      const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / Math.max(64, box.height * 0.22)));
      overlay.style.setProperty("--lx", `${nx * 28}%`);
      overlay.style.setProperty("--ly", `${ny * 18}%`);
    };

    const reset = () => {
      overlay.style.setProperty("--lx", "0%");
      overlay.style.setProperty("--ly", "0%");
    };

    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(el);
    picture.addEventListener("load", layout);
    window.addEventListener("pointermove", look, { passive: true });
    window.addEventListener("pointerleave", reset);
    return () => {
      ro.disconnect();
      picture.removeEventListener("load", layout);
      window.removeEventListener("pointermove", look);
      window.removeEventListener("pointerleave", reset);
    };
  }, []);

  return (
    <section id="watch" className="watch-room" ref={stage} aria-label="He is watching">
      <div className="watch-fog" />
      <img ref={img} className="watch-body" src={IMG} alt="" />
      <div className="watch-face" ref={face}>
        <span className="watch-socket l">
          <i className="watch-iris" />
        </span>
        <span className="watch-socket r">
          <i className="watch-iris" />
        </span>
      </div>
      <div className="watch-copy">
        <p>the last room</p>
        <h2>He is watching the book.</h2>
        <p className="watch-end">
          Pulse is new names. Stocks is the tape. Fable 5.1 reads both. Robinhood Chain 4663. The
          desk is still armed.
        </p>
        <button type="button" className="land-cta" onClick={() => onEnter?.()}>
          Enter Terminal
          <span className="land-arrow" aria-hidden>
            →
          </span>
        </button>
      </div>
    </section>
  );
}
