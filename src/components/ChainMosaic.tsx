import { EXPLORER } from "../lib/const";
import { fmtInt } from "../lib/format";
import type { ChainBlock, ChainStats } from "../lib/api";
export function ChainMosaic({
  blocks,
  stats,
  error,
}: {
  blocks: ChainBlock[];
  stats: ChainStats | null;
  error?: string;
}) {
  return (
    <div className="mosaic">
      <div className="heat-strip">
        <span>SOLANA MAINNET</span>
        <span>
          {stats
            ? `${fmtInt(stats.tps)} TPS · slot ${fmtInt(stats.slot)}`
            : "Connecting to RPC…"}
        </span>
      </div>
      {error && <p className="data-note">{error}</p>}
      <div className="mosaic-grid">
        {blocks.map((b) => (
          <a
            className="mosaic-tile"
            key={b.hash}
            href={`${EXPLORER}/block/${b.height}`}
            target="_blank"
            rel="noreferrer"
          >
            <b>{fmtInt(b.height)}</b>
            <small>{b.transactions_count ? `${fmtInt(b.transactions_count)} transactions` : "confirmed slot"}</small>
            <small>{new Date(b.timestamp).toLocaleTimeString()}</small>
          </a>
        ))}
      </div>
    </div>
  );
}
