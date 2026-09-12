import { useCallback, useEffect, useState } from "react";
import App from "../App";
import { EnterGate } from "./EnterGate";
import { Landing } from "./Landing";
import { SiteSheet } from "./SiteSheet";

export function Experience() {
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);
  const [sheet, setSheet] = useState<"docs" | "ext" | null>(null);
  const [gate, setGate] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      if (gate) return;
      const max = Math.max(1, window.innerHeight);
      const p = Math.min(1, Math.max(0, window.scrollY / max));
      setProgress(p);
      if (p > 0.42) setActive(true);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [gate]);

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
    setActive(true);
    setGate(true);
    document.documentElement.style.overflow = "hidden";
  };

  const finishGate = useCallback(() => {
    window.scrollTo({ top: window.innerHeight, behavior: "auto" });
    setProgress(1);
    setGate(false);
    document.documentElement.style.overflow = "";
  }, []);

  return (
    <div className="site">
      <section className="land-lock">
        <Landing onEnter={enter} onOpen={setSheet} progress={progress} />
        <div className="land-veil" style={{ opacity: Math.min(1, progress * 1.15) }} />
      </section>
      <section className="term-lock" aria-label="PART terminal">
        <App active={active} lit={progress > 0.88} />
      </section>
      <SiteSheet kind={sheet} onClose={() => setSheet(null)} />
      <EnterGate playing={gate} onDone={finishGate} />
    </div>
  );
}
