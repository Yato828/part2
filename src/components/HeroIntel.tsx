import { briefIntel, type IntelInput } from "../lib/intel";

export function HeroIntel({
  compact,
  ...props
}: IntelInput & { compact?: boolean }) {
  const brief = briefIntel(props);
  const review = brief.review;

  const tone =
    brief.id === "rug" || brief.id === "halt" || brief.id === "dead"
      ? "dn"
      : brief.id === "buy" || brief.id === "long"
        ? "up"
        : "";

  return (
    <div className={`hero-intel ${brief.id}`}>
      <div className="intel-top">
        <div className="intel-who">
          <span className="intel-mark" aria-hidden="true">
            ◉
          </span>
          <div>
            <em>Market brief</em>
            <b>Local heuristic · not AI</b>
          </div>
        </div>
        <div className={`intel-score ${tone}`}>
          <em>heuristic</em>
          <strong>{brief.score.toString().padStart(2, "0")}</strong>
        </div>
        <div className={`intel-verdict ${tone}`}>
          <em>verdict</em>
          <b>{brief.verdict}</b>
          <span>{brief.action}</span>
        </div>
      </div>
      <div className="intel-flags">
        {brief.flags
          .filter((f) => !/social/i.test(f))
          .map((f) => (
            <i key={f}>{f}</i>
          ))}
      </div>
      <details className="data-note">
        <summary>How this heuristic works</summary>
        <p>
          Starts at 38, adds bounded log liquidity (22 max), log volume (12
          max), listed links (6 each), buy/sell ratio and age; deducts for a new
          pool, large moves and thin liquidity. Clamped to 1–99. This is a local
          activity heuristic, not a safety rating or a forecast. Listed links do
          not verify social activity.
        </p>
      </details>
      <p className="intel-review">
        {review}
        <span className="block-caret" />
      </p>
    </div>
  );
}
