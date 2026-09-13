import { useEffect, useState } from "react";
import { streamFable, toFableFacts } from "../lib/fable";
import { briefIntel, type IntelInput } from "../lib/intel";

export function HeroIntel({ compact, ...props }: IntelInput & { compact?: boolean }) {
  const brief = briefIntel(props);
  const [review, setReview] = useState(brief.review);

  useEffect(() => {
    setReview(brief.review);
    if (!props.armed) return;
    const ac = new AbortController();
    const facts = toFableFacts(props, brief);
    void streamFable(facts, ac.signal, setReview).catch(() => {
      /* keep local brief */
    });
    return () => ac.abort();
  }, [brief.id, brief.review, props.symbol, props.armed, compact]);

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
        {review}
        <span className="block-caret" />
      </p>
    </div>
  );
}
