import { useCallback, useEffect, useState } from "react";
import App from "../App";
import { SiteCursor } from "./Cursor";
import { EnterGate } from "./EnterGate";
import { Landing } from "./Landing";
import { SiteSheet } from "./SiteSheet";

export function Experience() {
  const [desk, setDesk] = useState(false);
  const [armed, setArmed] = useState(false);
  const [sheet, setSheet] = useState<"docs" | "ext" | null>(null);
  const [gate, setGate] = useState(false);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheet(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  const enter = () => {
    setSheet(null);
    setArmed(true);
    setGate(true);
    document.documentElement.style.overflow = "hidden";
  };

  const finishGate = useCallback(() => {
    setGate(false);
    setDesk(true);
  }, []);

  const leave = () => {
    setDesk(false);
    setGate(false);
    document.documentElement.style.overflow = "";
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <div className={`site${desk ? " is-desk" : ""}`}>
      {!desk && <SiteCursor />}
      <div className="site-hold" hidden={desk} {...(desk ? { inert: true } : {})}>
        <Landing onEnter={enter} onOpen={setSheet} />
      </div>
      {armed && (
        <div className={`term-overlay${desk && !gate ? " on" : ""}`} aria-hidden={!desk}>
          <App active={armed} lit={desk} onLeave={leave} />
        </div>
      )}
      <SiteSheet kind={sheet} onClose={() => setSheet(null)} />
      <EnterGate playing={gate} onDone={finishGate} />
    </div>
  );
}
