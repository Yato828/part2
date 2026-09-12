import { gasRibbon, mosaicShares } from "../lib/terminal";
import { fmtInt, fmtUsd } from "../lib/format";
import { EXPLORER } from "../lib/const";
import type { ChainBlock, ChainStats, ChainToken } from "../lib/api";

export function ChainMosaic({
  blocks,
  stats,
  tokens,
  onPick,
}: {
  blocks: ChainBlock[];
  stats: ChainStats | null;
  tokens: ChainToken[];
  onPick: (symbol: string) => void;
}) {
  const slice = blocks.slice(0, 18);
  const shares = mosaicShares(slice.map((b) => b.transactions_count));
  const gas = stats ? gasRibbon(stats.gas_prices.slow, stats.gas_prices.average, stats.gas_prices.fast) : null;
  const born = tokens.slice(0, 8);

  return (
    <div className="mosaic">
      <div className="gas-ribbon">
        <span>GAS</span>
        {gas ? (
          <div className="gas-bars">
            <i style={{ width: `${gas.slow * 100}%` }} title="slow" />
            <i className="mid" style={{ width: `${gas.avg * 100}%` }} title="avg" />
            <i className="fast" style={{ width: `${gas.fast * 100}%` }} title="fast" />
          </div>
        ) : (
          <span>—</span>
        )}
        <em>{stats ? `${Math.round(stats.network_utilization_percentage)}% UTIL` : ""}</em>
      </div>
      <div className="mosaic-grid">
        {slice.map((b, i) => (
          <button
            key={b.hash}
            className="mosaic-tile"
            style={{ flex: `${Math.max(0.6, shares[i] * 12)} 1 ${Math.max(52, shares[i] * 220)}px` }}
            onClick={() => window.open(`${EXPLORER}/block/${b.height}`, "_blank")}
            title={`#${b.height}  ${b.transactions_count} tx`}
          >
            <b>{fmtInt(b.height)}</b>
            <small>{b.transactions_count} TX</small>
          </button>
        ))}
      </div>
      <div className="born">
        <span>NEW ERC-20</span>
        {born.map((t) => (
          <button key={t.address_hash} onClick={() => onPick(t.symbol)}>
            {t.symbol}
            <em>{fmtUsd(t.exchange_rate)}</em>
          </button>
        ))}
      </div>
    </div>
  );
}
