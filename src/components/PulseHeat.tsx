import { ageLabel, type AxiomCoin } from "../lib/axiom";
import { fmtUsd } from "../lib/format";

export function PulseHeat({
  coins,
  loading,
  onPick,
}: {
  coins: AxiomCoin[];
  loading?: boolean;
  onPick: (coin: AxiomCoin) => void;
}) {
  if (!coins.length) {
    return (
      <div className="heat">
        <div className="heat-strip">
          <span>NEW LAUNCHES</span>
        </div>
        <div className="bubble-empty">{loading ? "Scanning new pairs…" : "No fresh launches yet"}</div>
      </div>
    );
  }

  return (
    <div className="heat">
      <div className="heat-strip">
        <span>NEW LAUNCHES</span>
        <span>{coins.length} live</span>
      </div>
      <div className="heat-grid pulse-grid">
        {coins.map((c) => {
          const chg = c.change5m ?? c.change1h ?? c.change24h ?? 0;
          const up = chg >= 0;
          return (
            <button
              key={c.address || c.pairAddress || c.symbol}
              className={`heat-cell pulse-cell ${up ? "up" : "dn"}`}
              onClick={() => onPick(c)}
            >
              <i className="pulse-age">{ageLabel(c.createdAt)}</i>
              <b>{c.symbol}</b>
              <em>{fmtUsd(c.priceUsd, c.priceUsd < 1 ? 4 : 2)}</em>
              <small>
                liq {fmtUsd(c.liquidityUsd)} · vol {fmtUsd(c.volume1h ?? c.volume24h)}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
