import { useEffect } from "react";

export function EnterGate({
  playing,
  onDone,
}: {
  playing: boolean;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(onDone, 900);
    return () => window.clearTimeout(id);
  }, [playing, onDone]);

  if (!playing) return null;

  return (
    <div className="gate" aria-hidden>
      <img className="gate-road" src="/hero/landing/highway.png?v=3" alt="" />
      <img className="gate-sit" src="/hero/landing/sit.png?v=2" alt="" />
      <div className="gate-fog" />
      <div className="gate-slit" />
      <div className="gate-bloom" />
      <div className="gate-copy">
        <b>PART</b>
        <em>Fable 5.1</em>
      </div>
    </div>
  );
}
