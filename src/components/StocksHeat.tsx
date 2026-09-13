import { heatScore } from "../lib/terminal";
import { fmtUsd, mid } from "../lib/format";
import type { RhAsset, RhQuote } from "../lib/api";

export function StocksHeat({
  assets,
  quotes,
  corps,
  onPick,
}: {
  assets: RhAsset[];
  quotes: Map<string, RhQuote>;
  corps: Array<{ tokenSymbol: string; type: string; status: string }>;
  onPick: (symbol: string) => void;
}) {
  const rows = assets
    .map((a) => {
      const q = quotes.get(a.tokenSymbol);
      const px = mid(q?.bid, q?.ask);
      const chg =
        q?.change24h ??
        (q && Number(q.dailyLow) ? ((px - Number(q.dailyLow)) / Number(q.dailyLow)) * 100 : 0);
      const vol = Number(q?.dailyTradingVolume ?? 0);
      return { a, q, px, chg, vol, score: heatScore(vol || 1, chg) };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, 24);

  const halts = rows.filter((r) => r.q?.isTradingHalt);
  const alerts = corps.slice(0, 6);

  if (!rows.length) {
    return (
      <div className="heat">
        <div className="heat-strip">
          <span>STOCKS</span>
        </div>
        <div className="bubble-empty">Loading Robinhood stock tokens…</div>
      </div>
    );
  }

  return (
    <div className="heat">
      <div className="heat-strip">
        {halts.length ? (
          halts.map((h) => (
            <span key={h.a.tokenSymbol} className="halt">
              HALT {h.a.tokenSymbol}
            </span>
          ))
        ) : (
          <span>NO HALTS</span>
        )}
        {alerts.map((c, i) => (
          <span key={i}>
            {c.tokenSymbol} {c.type.replace("CORPORATE_ACTION_TYPE_", "")}
          </span>
        ))}
      </div>
      <div className="heat-grid">
        {rows.map((r) => {
          const up = r.chg >= 0;
          return (
            <button
              key={r.a.id}
              className={`heat-cell ${up ? "up" : "dn"}`}
              style={{ flex: `${Math.max(0.8, r.score)} 1 ${Math.max(70, r.score * 28)}px` }}
              onClick={() => onPick(r.a.tokenSymbol)}
            >
              <b>{r.a.tokenSymbol}</b>
              <em>{Number.isFinite(r.px) ? fmtUsd(r.px) : "…"}</em>
              <small>
                {Number.isFinite(r.chg) ? `${r.chg >= 0 ? "+" : ""}${r.chg.toFixed(1)}%` : "—"}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
