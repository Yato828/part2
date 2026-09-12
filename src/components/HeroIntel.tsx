import { useEffect, useState } from "react";
import { briefIntel, type IntelInput } from "../lib/intel";

export function HeroIntel({ compact, ...props }: IntelInput & { compact?: boolean }) {
  const brief = briefIntel(props);
  const [typed, setTyped] = useState(compact ? brief.review : "");

  useEffect(() => {
    if (compact) {
      setTyped(brief.review);
      return;
    }
    setTyped("");
    let i = 0;
    const text = brief.review;
    const id = setInterval(() => {
      i += 1;
      setTyped(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [brief.id, brief.review, props.symbol, compact]);

  const tone = brief.id === "rug" || brief.id === "halt" || brief.id === "dead" ? "dn" : brief.id === "buy" || brief.id === "long" ? "up" : "";

  return (
    <div className={`hero-intel ${brief.id}`}>
      <div className="intel-top">
        <div className="intel-who">
          <div>
            <em>Fable 5.1</em>
            <b>fastest · most accurate</b>
          </div>
        </div>
        <div className={`intel-score ${tone}`}>
          <em>score</em>
          <strong>{brief.score.toString().padStart(2, "0")}</strong>
        </div>
        <div className={`intel-verdict ${tone}`}>
          <em>verdict</em>
          <b>{brief.verdict}</b>
          <span>{brief.action}</span>
        </div>
      </div>
      <div className="intel-flags">
        {brief.flags.filter((f) => !/social/i.test(f)).map((f) => (
          <i key={f}>{f}</i>
        ))}
      </div>
      <p className="intel-review">
        {typed}
        <span className="block-caret" />
      </p>
    </div>
  );
}
