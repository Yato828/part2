import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { EnterGate } from "./EnterGate";
import { Landing } from "./Landing";
import { SiteSheet } from "./SiteSheet";
import { readTerminalLink } from "../lib/siteLink";

const App = lazy(() => import("../App"));

export function Experience() {
  const [linked] = useState(
    () => readTerminalLink(window.location.search).open,
  );
  const [desk, setDesk] = useState(false);
  const [armed, setArmed] = useState(linked);
  const [sheet, setSheet] = useState<"docs" | "ext" | null>(null);
  const [transition, setTransition] = useState<"enter" | "leave" | null>(
    linked ? "enter" : null,
  );
  const [terminalReady, setTerminalReady] = useState(false);

  useEffect(() => {
    if (!desk && !transition && !sheet) return;
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, [desk, transition, sheet]);

  const enter = () => {
    if (transition || desk) return;
    setSheet(null);
    setTerminalReady(false);
    setArmed(true);
    setTransition("enter");
  };

  const markTerminalReady = useCallback(() => setTerminalReady(true), []);
  const switchView = useCallback(() => {
    if (transition === "enter") setDesk(true);
    if (transition === "leave") {
      setDesk(false);
      setArmed(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [transition]);
  const finishTransition = useCallback(() => {
    const entering = transition === "enter";
    setTransition(null);
    if (entering) return;
    requestAnimationFrame(() => {
      if (document.activeElement !== document.body) return;
      document
        .querySelector<HTMLElement>(
          '.signal-header button[aria-label="Enter Terminal"]',
        )
        ?.focus({ preventScroll: true });
    });
  }, [transition]);

  const leave = () => {
    if (transition || !desk) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("terminal");
    url.searchParams.delete("mint");
    window.history.replaceState(window.history.state, "", url);
    setTransition("leave");
  };

  return (
    <div className={`site${desk ? " is-desk" : ""}`}>
      <div
        className="site-hold"
        hidden={desk}
        inert={desk || Boolean(transition)}
      >
        <Landing onEnter={enter} onOpen={setSheet} />
      </div>
      {armed && (
        <div
          className={`term-overlay${desk ? " visible" : ""}${desk && !transition ? " on" : ""}`}
          aria-hidden={!desk || Boolean(transition)}
          inert={!desk || Boolean(transition)}
        >
          <Suspense fallback={null}>
            <App active={armed && !transition} lit={desk} onLeave={leave} />
            <TerminalReady onReady={markTerminalReady} />
          </Suspense>
        </div>
      )}
      <SiteSheet kind={sheet} onClose={() => setSheet(null)} />
      {transition && (
        <EnterGate
          key={transition}
          direction={transition}
          ready={transition === "leave" || terminalReady}
          onCovered={switchView}
          onDone={finishTransition}
        />
      )}
    </div>
  );
}

// This effect commits only after the lazy terminal has rendered successfully.
function TerminalReady({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}
