import { useEffect, useState } from "react";

export function EnterGate({
  direction,
  ready,
  onCovered,
  onDone,
}: {
  direction: "enter" | "leave";
  ready: boolean;
  onCovered: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"cover" | "hold" | "reveal">("cover");
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (phase !== "cover") return;
    const timer = window.setTimeout(
      () => {
        onCovered();
        setPhase("hold");
      },
      reducedMotion ? 0 : 220,
    );
    return () => clearTimeout(timer);
  }, [phase, reducedMotion, onCovered]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setMinimumElapsed(true),
      reducedMotion ? 0 : 1150,
    );
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  useEffect(() => {
    if (phase === "hold" && ready && minimumElapsed && mediaReady)
      setPhase("reveal");
  }, [phase, ready, minimumElapsed, mediaReady]);

  useEffect(() => {
    if (phase !== "reveal") return;
    const timer = window.setTimeout(onDone, reducedMotion ? 0 : 460);
    return () => clearTimeout(timer);
  }, [phase, reducedMotion, onDone]);

  const label = direction === "enter" ? "Opening terminal" : "Returning home";

  return (
    <div
      className={`gate gate-${direction} gate-${phase}`}
      role="status"
      aria-label={label}
      aria-live="polite"
    >
      <div className="gate-content">
        <img
          className="gate-animation"
          src={
            reducedMotion || mediaFailed
              ? "/hero/signal/transition-poster.png"
              : "/hero/signal/transition.gif"
          }
          width="600"
          height="600"
          alt=""
          onLoad={() => setMediaReady(true)}
          onError={() => {
            setMediaFailed(true);
            setMediaReady(true);
          }}
        />
        <div className="gate-copy">
          <b>PART</b>
          <em>{label}</em>
        </div>
        <span className="gate-track" aria-hidden="true">
          <i />
        </span>
      </div>
    </div>
  );
}
