import { useId } from "react";
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
  progress = 0,
}: {
  onEnter?: () => void;
  onOpen?: (id: "docs" | "ext") => void;
  progress?: number;
}) {
  return (
    <div className="landing" style={{ "--p": progress } as React.CSSProperties}>
      <div className="land-stage">
        <img className="land-plate" src="/hero/landing/highway.png?v=3" alt="" />
        <img className="land-sit" src="/hero/landing/sit.png?v=2" alt="" />
        <div className="land-shade" />

        <nav className="land-nav" aria-label="PART">
          <a href="#twitter">Twitter</a>
          <button type="button" className="land-link" onClick={() => onOpen?.("docs")}>
            Docs
          </button>
          <a href="#coin">Coin</a>
          <a href="#faq">FAQ</a>
          <button type="button" className="land-add" onClick={() => onOpen?.("ext")}>
            <ChromeMark />
            Add to Chrome
          </button>
          <button type="button" className="land-nav-enter" onClick={() => onEnter?.()}>
            Enter Terminal
          </button>
        </nav>

        <div className="land-base">
          <h1 className="land-mark">
            PART<span className="land-star" aria-hidden />
          </h1>

          <div className="land-aside">
            <p>
              meet PART. a terminal on fable 5.1 — the fastest and most accurate read of the
              book. not an agent. it watches the market, understands your decisions, and grows
              with your trading history.
            </p>
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

        <button type="button" className="land-scroll" onClick={() => onEnter?.()}>
          <span>scroll into the fable 5.1 terminal</span>
          <i />
        </button>
      </div>
    </div>
  );
}
