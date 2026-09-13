import { useEffect, useId, useRef, useState } from "react";
import { WatchEnd } from "./WatchEnd";
import "../landing.css";

function ChromeMark() {
  const uid = useId().replace(/:/g, "");
  const clip = `${uid}clip`;
  return (
    <svg className="land-chrome-mark" viewBox="0 0 48 48" aria-hidden>
      <defs>
        <clipPath id={clip}>
          <circle cx="24" cy="24" r="22" />
        </clipPath>
      </defs>
      <circle cx="24" cy="24" r="23" fill="#fff" />
      <g clipPath={`url(#${clip})`}>
        <path fill="#EA4335" d="M24 24L4.947 13A22 22 0 0 1 43.053 13Z" />
        <path fill="#FBBC04" d="M24 24L43.053 13A22 22 0 0 1 24 46Z" />
        <path fill="#34A853" d="M24 24L24 46A22 22 0 0 1 4.947 13Z" />
      </g>
      <circle cx="24" cy="24" r="10.2" fill="#fff" />
      <circle cx="24" cy="24" r="8" fill="#4285F4" />
    </svg>
  );
}

export function Landing({
  onEnter,
  onOpen,
}: {
  onEnter?: () => void;
  onOpen?: (id: "docs" | "ext") => void;
}) {
  const [p, setP] = useState(0);
  const [stuck, setStuck] = useState(false);
  const paper = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setP(Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight))));
      setStuck(window.scrollY > 48);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = paper.current;
    if (!el) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    const onScroll = () => {
      if (window.matchMedia("(pointer: fine)").matches) return;
      const r = el.getBoundingClientRect();
      const y = Math.min(r.height, Math.max(0, -r.top + window.innerHeight * 0.4));
      el.style.setProperty("--mx", `${r.width * 0.5}px`);
      el.style.setProperty("--my", `${y}px`);
    };
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "24%");
    el.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("pointermove", move);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="site-page">
      <nav className={`land-nav${stuck ? " stuck" : ""}`} aria-label="PART">
        <button type="button" className="land-word" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          PART<span className="land-star" aria-hidden />
        </button>
        <div className="land-nav-links">
          <button type="button" className="land-link" onClick={() => go("paper")}>
            Tape
          </button>
          <button type="button" className="land-link" onClick={() => go("watch")}>
            Watch
          </button>
          <button type="button" className="land-link" onClick={() => onOpen?.("docs")}>
            Docs
          </button>
          <button type="button" className="land-add" onClick={() => onOpen?.("ext")}>
            <ChromeMark />
            Add to Chrome
          </button>
          <button type="button" className="land-nav-enter" onClick={() => onEnter?.()}>
            Enter Terminal
          </button>
        </div>
      </nav>

      <section className="land-hero" aria-label="Opening">
        <div className="landing" style={{ "--p": p } as React.CSSProperties}>
          <div className="land-stage">
            <img className="land-plate" src="/hero/landing/highway.png?v=3" alt="" />
            <img className="land-sit" src="/hero/landing/sit.png?v=2" alt="" />
            <div className="land-shade" />
            <div className="land-base">
              <div>
                <p className="land-omen">he sat on the road and opened the book</p>
                <h1 className="land-mark">
                  PART<span className="land-star" aria-hidden />
                </h1>
              </div>
              <div className="land-aside">
                <p>DEGEN loved to trade. He did not come home. This is the desk he left on — Robinhood Chain, Fable 5.1.</p>
                <div className="land-row">
                  <button type="button" className="land-cta" onClick={() => onEnter?.()}>
                    Enter Terminal
                    <span className="land-arrow" aria-hidden>
                      →
                    </span>
                  </button>
                  <button type="button" className="land-ext" onClick={() => onOpen?.("ext")}>
                    Add Extension
                    <ChromeMark />
                  </button>
                </div>
              </div>
            </div>
            <button type="button" className="land-scroll" onClick={() => go("paper")}>
              <span>the tape</span>
              <i />
            </button>
          </div>
        </div>
      </section>

      <section id="paper" className="paper-room" ref={paper} aria-label="The Evening Tape">
        <div className="paper-lamp" />
        <article className="paper">
          <header className="paper-mast">
            <em>4663</em>
            <b>THE EVENING TAPE</b>
            <span>night edition</span>
          </header>
          <h2>
            MISSING
            <i>DEGEN</i>
          </h2>
          <div className="paper-grid">
            <figure className="paper-mug">
              <img src="/hero/landing/degen-face.png" alt="" />
              <figcaption>Last seen. Eyes empty.</figcaption>
            </figure>
            <div className="paper-col">
              <p>Loved to trade. Did not come home. Charts still open. Terminal still armed.</p>
              <p>If you find the desk, do not close the book.</p>
            </div>
          </div>
        </article>
        <div className="paper-sink" />
      </section>

      <WatchEnd onEnter={onEnter} />
    </div>
  );
}
