import { useEffect, useRef, useState } from "react";
import { SignalField } from "./SignalField";
import { Atmosphere } from "./Atmosphere";
import { BlinkingEye } from "./BlinkingEye";
import { ConnectionOrb } from "./ConnectionOrb";
import "../landing.css";

const CA = "B5mM74YD2uy17pQcmsdrdwb6Pd41KAHCSwZaMWGRpump";
const EYE = "/hero/signal/eye.png";

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"} />
    </svg>
  );
}
function BrowserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 8.5h8M9 13.8l-4 7M15 13.8l-4-7" />
    </svg>
  );
}
const previews = [
  { id: "terminal", label: "The terminal", icon: "⌁" },
  { id: "intelligence", label: "On-chain intelligence", icon: "◉" },
  { id: "astra", label: "Astra assistant", icon: "✳" },
] as const;
type Preview = (typeof previews)[number]["id"];

export function Landing({
  onEnter,
  onOpen,
}: {
  onEnter: () => void;
  onOpen: (id: "docs" | "ext") => void;
}) {
  const page = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [menu, setMenu] = useState(false);
  const [preview, setPreview] = useState<Preview>("terminal");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    const el = page.current;
    if (!el) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    el.querySelectorAll<HTMLElement>("[data-reveal]").forEach((item) =>
      observer.observe(item),
    );
    el.classList.add("motion-ready");
    let raf = 0;
    const update = () => {
      raf = 0;
      setStuck(window.scrollY > 24);
      const hero = el.querySelector<HTMLElement>(".signal-hero");
      const hands = el.querySelector<HTMLElement>(".signal-connection");
      if (!motion.matches) {
        hero?.style.setProperty(
          "--scroll",
          `${Math.min(window.scrollY * 0.15, 140)}px`,
        );
        if (hands)
          hands.style.setProperty(
            "--hands-shift",
            `${Math.max(-65, Math.min(65, hands.getBoundingClientRect().top * 0.1))}px`,
          );
      }
    };
    const scroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const pointer = (event: PointerEvent) => {
      if (motion.matches || event.pointerType === "touch") return;
      el.style.setProperty(
        "--pointer-x",
        `${(event.clientX / window.innerWidth - 0.5) * 20}px`,
      );
      el.style.setProperty(
        "--pointer-y",
        `${(event.clientY / window.innerHeight - 0.5) * 14}px`,
      );
    };
    update();
    window.addEventListener("scroll", scroll, { passive: true });
    el.addEventListener("pointermove", pointer, { passive: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", scroll);
      el.removeEventListener("pointermove", pointer);
      clearTimeout(copyTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  const go = () => setMenu(false);
  const enter = () => {
    setMenu(false);
    onEnter();
  };
  const open = (id: "docs" | "ext") => {
    setMenu(false);
    onOpen(id);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CA);
      setCopied(true);
      setCopyError(false);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <div className="signal-page" ref={page}>
      <Atmosphere />
      <a className="signal-skip" href="#workspace">
        Skip to workspace
      </a>
      <div className="signal-progress" aria-hidden="true" />
      <header className={`signal-header${stuck ? " is-stuck" : ""}`}>
        <a
          className="signal-brand"
          href="#top"
          aria-label="PART home"
          onClick={go}
        >
          <img src={EYE} width="48" height="48" alt="" />
          <span>
            PART<span className="signal-brand-dot">®</span>
          </span>
        </a>
        <nav className="signal-desktop-nav" aria-label="Main navigation">
          <a href="#workspace">Workspace</a>
          <a href="#astra">Astra</a>
          <a href="#extension">Extension</a>
        </nav>
        <div className="signal-header-actions">
          <button
            className="signal-docs-link"
            type="button"
            onClick={() => open("docs")}
          >
            Docs <Arrow diagonal />
          </button>
          <button
            className="signal-button signal-button-small"
            type="button"
            onClick={enter}
            aria-label="Enter Terminal"
          >
            <span>Enter Terminal</span>
            <Arrow diagonal />
          </button>
          <button
            className="signal-menu-toggle"
            type="button"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            aria-controls="signal-mobile-nav"
            onClick={() => setMenu(!menu)}
          >
            <span />
            <span />
          </button>
        </div>
        <nav
          id="signal-mobile-nav"
          className="signal-mobile-nav"
          aria-label="Mobile navigation"
          hidden={!menu}
        >
          <a href="#workspace" onClick={go}>
            Workspace <Arrow diagonal />
          </a>
          <a href="#astra" onClick={go}>
            Astra <Arrow diagonal />
          </a>
          <a href="#extension" onClick={go}>
            Extension <Arrow diagonal />
          </a>
          <button type="button" onClick={() => open("docs")}>
            Documentation <Arrow diagonal />
          </button>
        </nav>
      </header>
      <main>
        <section
          className="signal-hero"
          id="top"
          aria-labelledby="signal-title"
        >
          <div className="signal-hero-grid" aria-hidden="true" />
          <div className="signal-hero-art" aria-hidden="true">
            <SignalField />
            <div className="signal-eye-orbit">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="signal-eye-wrap">
              <BlinkingEye />
            </div>
            <span className="signal-cross signal-cross-one">+</span>
            <span className="signal-cross signal-cross-two">+</span>
          </div>
          <div className="signal-hero-copy">
            <p className="signal-eyebrow signal-hero-reveal">
              <span className="signal-status-dot" /> SOLANA MAINNET WORKSPACE
            </p>
            <h1 id="signal-title" className="signal-hero-reveal">
              See beyond
              <br />
              the <span className="signal-outline">noise.</span>
              <span className="signal-title-period">↗</span>
            </h1>
            <p className="signal-description signal-hero-reveal">
              Your instinct. A sharper perspective.
              <br />
              Charts, on-chain intelligence and Astra.
              <br />
              One workspace. All Solana.
            </p>
            <div className="signal-hero-buttons signal-hero-reveal">
              <button
                className="signal-button"
                type="button"
                onClick={enter}
                aria-label="Enter Terminal"
              >
                <span>Enter Terminal</span>
                <Arrow diagonal />
              </button>
              <button
                className="signal-button signal-button-outline"
                type="button"
                onClick={() => open("ext")}
              >
                <BrowserIcon />
                <span>Get extension</span>
              </button>
            </div>
          </div>
          <div className="signal-hero-bottom">
            <a href="#workspace" aria-label="Scroll to workspace">
              <span className="signal-scroll-arrow" aria-hidden="true">
                ↓
              </span>
            </a>
          </div>
        </section>

        <section
          className="signal-workspace signal-section"
          id="workspace"
          aria-labelledby="workspace-title"
        >
          <div className="signal-section-meta" data-reveal>
            <p className="signal-eyebrow">Workspace</p>
          </div>
          <div className="signal-section-heading" data-reveal>
            <h2 id="workspace-title">
              Everything in sight.
              <br />
              <span>Nothing in your way.</span>
            </h2>
            <p>
              A chart-first terminal that moves with you.
              <br />
              Find a market, connect the dots, build your own desk.
            </p>
          </div>
          <div className="signal-preview" data-reveal>
            <div className="signal-preview-bar">
              <span className="signal-preview-word">
                PART<span> / WORKSPACE PREVIEW</span>
              </span>
              <span className="signal-preview-address">
                <span className="signal-status-dot" /> SOLANA MAINNET
              </span>
              <span className="signal-window-dots">
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="signal-preview-body">
              <div className="signal-preview-sidebar">
                <div role="tablist" aria-label="Workspace preview">
                  {previews.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      role="tab"
                      id={`preview-tab-${item.id}`}
                      aria-controls="workspace-preview-panel"
                      aria-selected={preview === item.id}
                      onClick={() => setPreview(item.id)}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                      <Arrow diagonal />
                    </button>
                  ))}
                </div>
              </div>
              <div
                className="signal-preview-content"
                role="tabpanel"
                id="workspace-preview-panel"
                aria-labelledby={`preview-tab-${preview}`}
                tabIndex={0}
              >
                <div className="signal-preview-toolbar">
                  <span>
                    {preview === "terminal"
                      ? "⌕  Search token or paste Solana mint"
                      : preview === "intelligence"
                        ? "◉  Follow the on-chain picture"
                        : "✳  The context stays with you"}
                  </span>
                  <kbd>{preview === "astra" ? "ASTRA" : "⌘ K"}</kbd>
                </div>
                {preview === "terminal" ? (
                  <div className="signal-preview-empty" key="terminal">
                    <div className="signal-preview-reticle">
                      <img
                        src={EYE}
                        width="200"
                        height="200"
                        alt=""
                        loading="lazy"
                      />
                      <i />
                      <i />
                    </div>
                    <h3>Find your next market.</h3>
                    <p>
                      Select a Solana token to explore source candles,
                      <br />
                      market activity and the on-chain picture.
                    </p>
                    <button
                      type="button"
                      className="signal-text-link"
                      onClick={enter}
                    >
                      Explore the terminal <Arrow diagonal />
                    </button>
                  </div>
                ) : preview === "intelligence" ? (
                  <div className="signal-preview-intel" key="intelligence">
                    <h3>Connect the dots.</h3>
                    <div className="signal-intel-nodes">
                      {[
                        "Token X-Ray",
                        "Wallet Watch",
                        "Bubble Map",
                        "Trade Flow",
                      ].map((name, i) => (
                        <span key={name}>
                          <i>{["◎", "⌁", "⠿", "⇄"][i]}</i>
                          {name}
                        </span>
                      ))}
                    </div>
                    <p>
                      Explore holders, follow wallets and inspect market
                      activity.
                      <br />
                      Sources and data limits stay visible.
                    </p>
                    <button
                      type="button"
                      className="signal-text-link"
                      onClick={enter}
                    >
                      Open your workspace <Arrow diagonal />
                    </button>
                  </div>
                ) : (
                  <div className="signal-preview-astra" key="astra">
                    <span className="signal-astra-symbol">✳</span>
                    <h3>A second perspective.</h3>
                    <p>
                      Bring a question to your Solana research.
                      <br />
                      Astra works with read-only tools when configured.
                    </p>
                    <div className="signal-example">
                      <span>EXAMPLE PROMPT</span>What should I look at before
                      trading this token?
                    </div>
                    <button
                      type="button"
                      className="signal-text-link"
                      onClick={enter}
                    >
                      Meet Astra in the terminal <Arrow diagonal />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="signal-features">
            <article data-reveal>
              <h3>Find your signal.</h3>
              <p>
                Discover Solana markets. Go from a mint address to charts,
                liquidity and trading activity.
              </p>
            </article>
            <article data-reveal>
              <h3>See the connections.</h3>
              <p>
                Explore holders, watch wallets and put market activity in
                context with Astra.
              </p>
            </article>
            <article data-reveal>
              <h3>Make it your own.</h3>
              <p>
                Arrange panels, pin your tools and tune the theme. Your
                workspace, the way you think.
              </p>
            </article>
          </div>
        </section>

        <section
          className="signal-connection"
          id="astra"
          aria-labelledby="astra-title"
        >
          <div className="signal-section-meta" data-reveal>
            <p className="signal-eyebrow">Astra</p>
          </div>
          <div className="signal-connection-title" data-reveal>
            <h2 id="astra-title">
              Human instinct.
              <br />
              <span>Machine perspective.</span>
            </h2>
            <ConnectionOrb />
          </div>
          <div className="signal-hands-art">
            <img
              src="/hero/signal/hands.png"
              width="2172"
              height="724"
              alt="A hand made of white particles reaching toward a human hand"
              loading="lazy"
              decoding="async"
            />
            <span className="signal-touch-point" aria-hidden="true" />
          </div>
          <div className="signal-astra-bottom" data-reveal>
            <p>
              A little more context.
              <br />A different way to see it.
            </p>
            <div>
              <p>
                Ask Astra about your Solana research. Explore on-chain
                information with read-only tools and keep the decision in your
                hands.
              </p>
              <button
                type="button"
                className="signal-text-link"
                onClick={enter}
              >
                Meet your assistant <Arrow diagonal />
              </button>
            </div>
            <span className="signal-astra-disclosure">
              ASTRA REQUIRES SERVER CONFIGURATION.
              <br />
              TRADES ALWAYS REQUIRE YOUR APPROVAL.
            </span>
          </div>
        </section>

        <section
          className="signal-extension signal-section"
          id="extension"
          aria-labelledby="extension-title"
        >
          <div className="signal-extension-copy" data-reveal>
            <p className="signal-eyebrow">Browser extension</p>
            <h2 id="extension-title">
              Same instinct.
              <br />
              <span>Smaller window.</span>
            </h2>
            <p>
              The PART terminal, one click from your browser.
              <br />
              Open the popup for a quick look, or give your desk a full tab.
            </p>
            <button
              type="button"
              className="signal-button"
              onClick={() => open("ext")}
            >
              <BrowserIcon />
              <span>Get the extension</span>
              <Arrow diagonal />
            </button>
            <span className="signal-extension-note">
              CHROME & CHROMIUM BROWSERS · INSTALL FROM ZIP
            </span>
          </div>
          <div className="signal-extension-art" data-reveal>
            <div className="signal-browser-frame" aria-hidden="true">
              <div className="signal-browser-top">
                <span>←</span>
                <span>→</span>
                <div>your next perspective</div>
                <span className="signal-browser-puzzle">✚</span>
                <img src={EYE} width="32" height="32" alt="" />
              </div>
              <div className="signal-browser-text">
                Keep your eyes
                <br />
                on the market.
              </div>
            </div>
            <div className="signal-popup-card">
              <div className="signal-popup-header">
                <strong>PART</strong>
                <span>◉ SOLANA</span>
                <Arrow diagonal />
              </div>
              <div className="signal-popup-search">
                ⌕ <span>Search Solana tokens...</span>
                <kbd>/</kbd>
              </div>
              <img src={EYE} width="180" height="180" alt="" loading="lazy" />
              <h3>A new point of view.</h3>
              <button type="button" onClick={() => open("ext")}>
                Get PART extension <Arrow diagonal />
              </button>
            </div>
          </div>
        </section>

        <section
          className="signal-final signal-section"
          aria-labelledby="final-title"
        >
          <h2 id="final-title" data-reveal>
            Find your <span>perspective.</span>
            <i>↗</i>
          </h2>
          <div className="signal-final-row" data-reveal>
            <p>
              Find yours with PART.
              <br />
              Your Solana workspace is ready.
            </p>
            <button
              type="button"
              className="signal-button"
              onClick={enter}
              aria-label="Enter Terminal"
            >
              <span>Enter Terminal</span>
              <Arrow diagonal />
            </button>
          </div>
        </section>
      </main>
      <footer className="signal-footer">
        <div className="signal-footer-top">
          <a className="signal-brand" href="#top" aria-label="PART home">
            <img src={EYE} width="48" height="48" alt="" />
            <span>
              PART<span className="signal-brand-dot">®</span>
            </span>
          </a>
          <div>
            <button type="button" onClick={() => open("docs")}>
              Docs <Arrow diagonal />
            </button>
            <button type="button" onClick={() => open("ext")}>
              Extension <Arrow diagonal />
            </button>
            <a href="#top">Back to top ↑</a>
          </div>
        </div>
        <div className="signal-footer-bottom">
          <span>PART © {new Date().getFullYear()}</span>
          <button
            type="button"
            className="signal-ca"
            onClick={() => void copy()}
            aria-label={`Copy contract address ${CA}`}
          >
            <span>CA</span>
            <code>{CA}</code>
            <span aria-live="polite">
              {copied ? "COPIED ✓" : copyError ? "SELECT TO COPY" : "COPY ↗"}
            </span>
          </button>
          <span>
            SOLANA MAINNET <i className="signal-status-dot" />
          </span>
        </div>
      </footer>
    </div>
  );
}
