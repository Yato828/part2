import { useEffect, useRef, useState } from "react";
import type { AxiomCoin } from "../../lib/axiom";
import { fetchTrades, type Trade } from "../../lib/api";
import { fetchHolderSnapshot, type HolderSnapshot } from "../../lib/holders";
import { rpc } from "../../lib/rpcFeed";
import { getJson } from "../../lib/http";
import { EXPLORER, WSOL } from "../../lib/const";
import {
  errorMessage,
  isSolanaAddress,
  readLocal,
  saveLocal,
  safeUrl,
} from "../../lib/validation";
import { fmtQty, fmtUsd, shortAddr } from "../../lib/format";
import { HeroIntel } from "../../components/HeroIntel";
import {
  walletActivity,
  parseWatchlist,
  type WalletEvent,
  type WatchedWallet,
} from "./walletData";
import { askAstra } from "../astra/client";
import type { ModuleId } from "../workspace/store";

type Props = {
  coin: AxiomCoin | null;
  open: (id: ModuleId) => void;
  selectMint: (mint: string, target?: ModuleId) => void;
  selectWallet?: (address: string) => void;
};
function TokenRequired({ open }: { open: Props["open"] }) {
  return (
    <div className="tool-empty">
      <h2>Select a Solana token first.</h2>
      <p>Search by name or paste its mint address in the header.</p>
      <button className="primary-action" onClick={() => open("terminal")}>
        Back to Terminal
      </button>
    </div>
  );
}
export function XRay({ coin, open }: Props) {
  const [snapshot, setSnapshot] = useState<HolderSnapshot | null>(null),
    [trades, setTrades] = useState<Trade[]>([]);
  const [supply, setSupply] = useState(0),
    [busy, setBusy] = useState(false),
    [errors, setErrors] = useState<string[]>([]),
    [at, setAt] = useState(0),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    setSnapshot(null);
    setTrades([]);
    setSupply(0);
    setErrors([]);
    setAt(0);
  }, [coin?.address, coin?.pairAddress]);
  useEffect(() => {
    if (!coin) return;
    let stopped = false;
    setBusy(true);
    void Promise.allSettled([
      fetchHolderSnapshot(coin.address, retry > 0),
      rpc<{ value: { uiAmountString: string } }>(
        "getTokenSupply",
        [coin.address],
        retry > 0,
      ),
      fetchTrades(coin.pairAddress, coin.address, coin.priceUsd),
    ]).then((results) => {
      if (stopped) return;
      const evidence =
        results[0].status === "fulfilled" ? results[0].value : null;
      if (evidence) setSnapshot(evidence);
      if (results[1].status === "fulfilled")
        setSupply(Number(results[1].value.value.uiAmountString));
      else if (evidence?.supply) setSupply(evidence.supply);
      if (results[2].status === "fulfilled")
        setTrades(results[2].value.slice(0, 12));
      setErrors(
        results.flatMap((r, i) =>
          r.status === "rejected" && !(i === 1 && evidence?.supply)
            ? [
                `${["Holders", "Supply", "Trades"][i]}: ${errorMessage(r.reason)}`,
              ]
            : [],
        ),
      );
      setAt(Date.now());
      setBusy(false);
    });
    return () => {
      stopped = true;
    };
  }, [coin?.address, coin?.pairAddress, retry]);
  if (!coin) return <TokenRequired open={open} />;
  const holders = snapshot?.holders ?? [];
  const sample = holders.reduce((n, h) => n + Number(h.value), 0);
  return (
    <section className="tool-page">
      <header className="tool-heading">
        <div>
          <small>SOLANA / TOKEN INTELLIGENCE</small>
          <h1>{coin.symbol} / Token X-Ray</h1>
          <p>
            {coin.name} · {coin.dex}
          </p>
        </div>
        <button disabled={busy} onClick={() => setRetry((r) => r + 1)}>
          {busy ? "Loading…" : "Refresh evidence"}
        </button>
      </header>
      <div className="tool-actions">
        <a
          href={`${EXPLORER}/token/${coin.address}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Mint on Solscan ↗
        </a>
        <a
          href={`https://dexscreener.com/solana/${coin.pairAddress}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Verified pool ↗
        </a>
        <button onClick={() => open("astra")}>
          Ask Astra about this token
        </button>
        <button onClick={() => open("holders")}>Open Bubble Map</button>
      </div>
      <div className="metric-grid">
        <div>
          <small>Known · DEX price</small>
          <strong>{fmtUsd(coin.priceUsd)}</strong>
        </div>
        <div>
          <small>
            {coin.liquidityUsd == null ? "Unknown" : "Known"} · liquidity
          </small>
          <strong>{fmtUsd(coin.liquidityUsd)}</strong>
        </div>
        <div>
          <small>24h volume</small>
          <strong>{fmtUsd(coin.volume24h)}</strong>
        </div>
        <div>
          <small>Sample / mint supply</small>
          <strong>
            {supply > 0 && holders.length
              ? `${((sample / supply) * 100).toFixed(2)}%`
              : "Unknown"}
          </strong>
        </div>
      </div>
      <div className="holder-status" role="status">
        <b>
          {busy
            ? "Refreshing evidence…"
            : snapshot
              ? `${holders.length} owners loaded`
              : "Holder data unavailable"}
        </b>
        <span>
          {snapshot
            ? `${snapshot.source} · fetched ${new Date(snapshot.fetchedAt).toISOString().slice(11, 19)} UTC${errors.some((e) => e.startsWith("Holders:")) ? " · retained snapshot" : ""}`
            : "RPC and indexed fallback"}
        </span>
      </div>
      <details className="holder-coverage">
        <summary>Holder coverage & sources</summary>
        <p className="data-note">
          Largest {snapshot?.accountCount ?? 20} token accounts, aggregated by
          owner; not the full holder distribution. Pool, exchange and custody
          accounts can appear here. No inferred wallet clusters or transfer
          edges.
        </p>
        {snapshot?.source === "RugCheck" && (
          <p className="data-note">
            RugCheck indexed snapshot; the provider does not supply the holder
            balance timestamp. Fetch time is shown separately. Percentages are
            snapshot estimates.
          </p>
        )}
        {snapshot?.partial && (
          <p className="data-note">
            Some account owners could not be resolved; only known owners are
            displayed.
          </p>
        )}
      </details>
      {errors.map((e) => (
        <p className="tool-error" key={e} role="alert">
          {e}
        </p>
      ))}
      <div className="evidence-grid">
        <div>
          <h2>Largest-account owners</h2>
          <table className="market-table">
            <thead>
              <tr>
                <th>Owner</th>
                <th>Tokens</th>
                <th>Mint supply</th>
              </tr>
            </thead>
            <tbody>
              {holders.map((h) => (
                <tr key={h.address.hash}>
                  <td>
                    <a
                      href={`${EXPLORER}/account/${h.address.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {shortAddr(h.address.hash)} ↗
                    </a>
                  </td>
                  <td>{fmtQty(h.value)}</td>
                  <td>
                    {supply > 0
                      ? `${((Number(h.value) / supply) * 100).toFixed(2)}%`
                      : "Unknown"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!holders.length && (
            <p className="data-note">
              {busy ? "Loading…" : "Data unavailable from connected sources"}
            </p>
          )}
        </div>
        <div>
          <h2>Observed pool trades</h2>
          <table className="market-table">
            <thead>
              <tr>
                <th>UTC time</th>
                <th>Side</th>
                <th>USD</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={t.hash + i}>
                  <td>
                    <a
                      href={`${EXPLORER}/tx/${t.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {new Date(t.timestamp).toISOString().slice(11, 19)} ↗
                    </a>
                  </td>
                  <td>{t.side}</td>
                  <td>{fmtUsd(t.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="data-note">
            RPC fallback USD values use a current price estimate; inspect the
            transaction for execution details.
          </p>
        </div>
      </div>
      <h2>Risk evidence</h2>
      <ul className="evidence-list">
        <li>
          Liquidity:{" "}
          {coin.liquidityUsd == null
            ? "Unknown"
            : coin.liquidityUsd < 12000
              ? "Low in this pool snapshot; quotes may move sharply."
              : "Available in this pool snapshot; no safety guarantee."}
        </li>
        <li>
          Mint authority:{" "}
          {snapshot?.mintAuthority === null
            ? "Revoked in indexed snapshot"
            : snapshot?.mintAuthority
              ? "Present in indexed snapshot"
              : "Unknown"}
          . Freeze authority:{" "}
          {snapshot?.freezeAuthority === null
            ? "Revoked in indexed snapshot"
            : snapshot?.freezeAuthority
              ? "Present in indexed snapshot"
              : "Unknown"}
          . Liquidity locks: unknown from this view.
        </li>
        <li>Social activity, wallet identities and audited safety: unknown.</li>
      </ul>
      <details>
        <summary>Local market heuristic</summary>
        <HeroIntel armed symbol={coin.symbol} coin={coin} />
      </details>
      <p className="tool-disclaimer">
        Sources: DEX Screener snapshot; holders from{" "}
        {snapshot?.source ?? "unavailable providers"}, supply from Solana RPC or
        indexed fallback; trades from DexPaprika, Solana RPC or GeckoTerminal.
        Last evidence fetch: {at ? new Date(at).toISOString() : "Pending"}.
      </p>
    </section>
  );
}

export function WalletWatch({
  smart = false,
  open,
  selectMint,
  selectWallet,
}: Props & { smart?: boolean }) {
  const [wallets, setWallets] = useState(() =>
    readLocal("part.wallets.v1", parseWatchlist, []),
  );
  const [address, setAddress] = useState(""),
    [label, setLabel] = useState("");
  const [selected, setSelected] = useState(() =>
    readLocal(
      "part.wallet.selected",
      (raw) =>
        typeof raw === "string" && wallets.some((w) => w.address === raw)
          ? raw
          : (wallets[0]?.address ?? ""),
      wallets[0]?.address ?? "",
    ),
  );
  const [checked, setChecked] = useState<string[]>(() =>
    wallets.slice(0, 3).map((w) => w.address),
  );
  const [rows, setRows] = useState<WalletEvent[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [at, setAt] = useState(0),
    [before, setBefore] = useState<string | undefined>();
  const [alerts, setAlerts] = useState(false),
    [notice, setNotice] = useState("");
  const generation = useRef(0),
    seen = useRef(new Set<string>());
  useEffect(() => {
    if (!saveLocal("part.wallets.v1", wallets))
      setError("Local storage unavailable. Watchlist will not survive reload.");
  }, [wallets]);
  useEffect(() => {
    if (!smart) {
      saveLocal("part.wallet.selected", selected);
      selectWallet?.(selected);
    }
  }, [selected, smart]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const load = async (more = false, notify = false) => {
    const chosen = smart
      ? wallets.filter((w) => checked.includes(w.address)).slice(0, 3)
      : wallets.filter((w) => w.address === selected);
    if (!chosen.length) {
      setRows([]);
      setBusy(false);
      return;
    }
    const version = ++generation.current;
    setBusy(true);
    setError("");
    const result = await Promise.allSettled(
      chosen.map((w) => walletActivity(w, more ? before : undefined)),
    );
    if (generation.current !== version) return;
    const next = result
      .flatMap((r) => (r.status === "fulfilled" ? r.value.rows : []))
      .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
    if (notify && next.some((r) => !seen.current.has(r.hash)))
      setNotice("New observed activity. Inspect the transaction links below.");
    seen.current = new Set(next.map((r) => r.hash));
    setRows((old) =>
      more
        ? [
            ...old,
            ...next.filter(
              (r) =>
                !old.some(
                  (o) =>
                    o.hash === r.hash &&
                    o.mint === r.mint &&
                    o.wallet === r.wallet,
                ),
            ),
          ]
        : next,
    );
    setBefore(
      result.length === 1 && result[0].status === "fulfilled"
        ? result[0].value.before
        : undefined,
    );
    if (
      result.some(
        (r) =>
          r.status === "rejected" ||
          (r.status === "fulfilled" && r.value.partial),
      )
    )
      setError(
        "Some RPC details are unavailable or rate limited. Loaded rows are retained; retry later.",
      );
    setAt(Date.now());
    setBusy(false);
  };
  useEffect(() => {
    setRows([]);
    setBefore(undefined);
    setNotice("");
    seen.current.clear();
    void load();
    return () => {
      generation.current++;
    };
  }, [selected, smart, checked.join(",")]);
  useEffect(() => {
    if (!alerts || smart) return;
    const t = setInterval(() => {
      if (!document.hidden && !busy) void load(false, true);
    }, 30000);
    return () => clearInterval(t);
  }, [alerts, selected, busy, smart]);
  const update = (wallet: WatchedWallet, patch: Partial<WatchedWallet>) =>
    setWallets((ws) =>
      ws.map((w) => (w.address === wallet.address ? { ...w, ...patch } : w)),
    );
  return (
    <section className="tool-page">
      <header className="tool-heading">
        <div>
          <small>SOLANA / PUBLIC WALLETS</small>
          <h1>{smart ? "Smart Money" : "Wallet Watch"}</h1>
          <p>
            {smart
              ? "Observed public activity from up to three watched wallets. PnL unavailable; no performance ranking."
              : "Follow public addresses. No connection or signature required."}
          </p>
        </div>
        <button disabled={busy} onClick={() => void load()}>
          {busy ? "Loading…" : "Refresh activity"}
        </button>
      </header>
      {!smart && (
        <form
          className="tool-form inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            const a = address.trim();
            if (!isSolanaAddress(a)) {
              setError("Enter a valid case-sensitive Solana address.");
              return;
            }
            if (wallets.some((w) => w.address === a)) {
              setError("Wallet already saved.");
              return;
            }
            if (wallets.length >= 20) {
              setError("Watchlist limit: 20 wallets.");
              return;
            }
            setWallets((ws) => [
              ...ws,
              {
                address: a,
                label: label.trim() || shortAddr(a),
                pinned: false,
              },
            ]);
            setSelected(a);
            setAddress("");
            setLabel("");
          }}
        >
          <label>
            Public Solana address
            <input
              aria-label="Wallet address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={44}
            />
          </label>
          <label>
            Label
            <input
              aria-label="Wallet label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={48}
            />
          </label>
          <button className="primary-action" disabled={wallets.length >= 20}>
            Track Wallet
          </button>
        </form>
      )}
      {!wallets.length && (
        <div className="tool-empty">
          <h2>Your watchlist is empty.</h2>
          <p>Save a public Solana wallet to view real RPC transactions.</p>
          {smart && (
            <button onClick={() => open("watch")}>Open Wallet Watch</button>
          )}
        </div>
      )}
      <div className="watchlist">
        {wallets
          .slice()
          .sort((a, b) => Number(b.pinned) - Number(a.pinned))
          .map((w) => (
            <div
              key={w.address}
              className={selected === w.address ? "selected" : ""}
            >
              {smart ? (
                <label>
                  <input
                    type="checkbox"
                    checked={checked.includes(w.address)}
                    disabled={
                      !checked.includes(w.address) && checked.length >= 3
                    }
                    onChange={(e) =>
                      setChecked((cs) =>
                        e.target.checked
                          ? [...cs, w.address]
                          : cs.filter((a) => a !== w.address),
                      )
                    }
                  />
                  {w.label}
                </label>
              ) : (
                <>
                  <button onClick={() => setSelected(w.address)}>
                    {shortAddr(w.address)}
                  </button>
                  <input
                    aria-label={`Rename ${w.address}`}
                    maxLength={48}
                    value={w.label}
                    onChange={(e) => update(w, { label: e.target.value })}
                  />
                  <button onClick={() => update(w, { pinned: !w.pinned })}>
                    {w.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    aria-label={`Remove ${w.address}`}
                    onClick={() => {
                      setWallets((ws) =>
                        ws.filter((v) => v.address !== w.address),
                      );
                      if (selected === w.address) setSelected("");
                    }}
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          ))}
      </div>
      {!smart && wallets.length > 0 && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={alerts}
            onChange={(e) => setAlerts(e.target.checked)}
          />{" "}
          In-app alerts while this view is open (30s). Telegram / web push: not
          connected.
        </label>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert" className="tool-error">
          {error}
        </p>
      )}
      <div className="table-overflow">
        <table className="market-table">
          <thead>
            <tr>
              <th>Wallet / UTC time</th>
              <th>Asset</th>
              <th>Observed action</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.wallet}-${r.hash}-${r.mint}-${i}`}>
                <td>
                  <b>
                    {wallets.find((w) => w.address === r.wallet)?.label ??
                      r.label}
                  </b>
                  <br />
                  <a
                    href={`${EXPLORER}/tx/${r.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {r.timestamp
                      ? r.timestamp.replace("T", " ").slice(0, 19)
                      : "Time unavailable"}{" "}
                    ↗
                  </a>
                </td>
                <td title={r.mint}>
                  {r.mint === "SOL" ? "SOL" : shortAddr(r.mint)}
                </td>
                <td>{r.action}</td>
                <td>{r.amount ? fmtQty(r.amount) : "—"}</td>
                <td>
                  {isSolanaAddress(r.mint) && (
                    <button onClick={() => selectMint(r.mint)}>
                      Open in Chart
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelected(r.wallet);
                      saveLocal("part.wallet.selected", r.wallet);
                      if (smart) open("watch");
                    }}
                  >
                    Track Wallet
                  </button>
                  <button
                    onClick={() => {
                      selectWallet?.(r.wallet);
                      if (isSolanaAddress(r.mint)) selectMint(r.mint, "astra");
                      else open("astra");
                    }}
                  >
                    Ask Astra
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!busy && !rows.length && wallets.length > 0 && (
        <p className="data-note">
          {at
            ? "No transactions returned by connected RPC. This does not establish wallet inactivity."
            : "Select a watched wallet."}
        </p>
      )}
      {!smart && before && (
        <button
          className="primary-action"
          disabled={busy}
          onClick={() => void load(true)}
        >
          Load older activity
        </button>
      )}
      <p className="tool-disclaimer">
        Source: Solana mainnet RPC ·{" "}
        {at ? new Date(at).toISOString() : "Not fetched"}. Net balance changes
        are observations; they do not identify swaps, counterparties or
        investment performance. SOL deltas include fees and account rent.
      </p>
    </section>
  );
}

export function ExitSimulator({ coin, open }: Props) {
  const [amount, setAmount] = useState("1"),
    [quote, setQuote] = useState<{
      sol: string;
      min: string;
      impact: number;
      at: number;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const generation = useRef(0);
  useEffect(() => {
    setQuote(null);
    setError("");
    generation.current++;
  }, [coin?.address, amount]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      generation.current++;
    };
  }, []);
  const simulate = async () => {
    if (!coin) return;
    const version = ++generation.current;
    setBusy(true);
    setError("");
    setQuote(null);
    try {
      const supply = await rpc<{ value: { decimals: number } }>(
        "getTokenSupply",
        [coin.address],
      );
      const decimals = supply.value.decimals;
      if (
        !Number.isInteger(decimals) ||
        decimals < 0 ||
        decimals > 18 ||
        !/^\d+(\.\d+)?$/.test(amount) ||
        (amount.split(".")[1]?.length ?? 0) > decimals
      )
        throw new Error(
          "Enter a positive amount within the token's decimal precision.",
        );
      const [whole, fraction = ""] = amount.split(".");
      const input =
        BigInt(whole) * 10n ** BigInt(decimals) +
        BigInt(fraction.padEnd(decimals, "0") || "0");
      if (input <= 0n || input > 18446744073709551615n)
        throw new Error("Amount is outside the SPL token range.");
      const response = await getJson<{
        success: boolean;
        data?: {
          inputMint: string;
          outputMint: string;
          inputAmount: string;
          outputAmount: string;
          otherAmountThreshold: string;
          slippageBps: number;
          priceImpactPct: number;
          routePlan: unknown[];
        };
      }>(
        `/ray/compute/swap-base-in?inputMint=${coin.address}&outputMint=${WSOL}&amount=${input}&slippageBps=100&txVersion=V0`,
        15000,
      );
      const q = response.data;
      if (
        !response.success ||
        !q ||
        q.inputMint !== coin.address ||
        q.outputMint !== WSOL ||
        q.inputAmount !== String(input) ||
        q.slippageBps !== 100 ||
        !/^\d+$/.test(q.outputAmount) ||
        !/^\d+$/.test(q.otherAmountThreshold) ||
        BigInt(q.outputAmount) <= 0n ||
        BigInt(q.otherAmountThreshold) <= 0n ||
        BigInt(q.otherAmountThreshold) > BigInt(q.outputAmount) ||
        !Number.isFinite(Number(q.priceImpactPct)) ||
        Number(q.priceImpactPct) < 0 ||
        Number(q.priceImpactPct) > 100 ||
        !q.routePlan?.length
      )
        throw new Error(
          "Simulation unavailable. Raydium did not return a valid sell route.",
        );
      if (version === generation.current)
        setQuote({
          sol: (Number(q.outputAmount) / 1e9).toFixed(9),
          min: (Number(q.otherAmountThreshold) / 1e9).toFixed(9),
          impact: Number(q.priceImpactPct),
          at: Date.now(),
        });
    } catch (e) {
      if (version === generation.current) setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (!coin) return <TokenRequired open={open} />;
  return (
    <section className="tool-page">
      <header className="tool-heading">
        <div>
          <small>SOLANA / HYPOTHETICAL EXIT</small>
          <h1>Exit Simulator</h1>
          <p>
            Request a real read-only Raydium sell quote for {coin.symbol} → SOL.
          </p>
        </div>
      </header>
      <form
        className="tool-form"
        onSubmit={(e) => {
          e.preventDefault();
          void simulate();
        }}
      >
        <label>
          Hypothetical token amount
          <input
            aria-label="Sale amount"
            inputMode="decimal"
            value={amount}
            maxLength={40}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Sale size
          <input
            aria-label="Sale size slider"
            type="range"
            min="1"
            max="10000"
            step="1"
            value={Math.min(10000, Math.max(1, Number(amount) || 1))}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <button
          className="primary-action"
          disabled={busy || coin.address === WSOL}
        >
          {busy ? "Requesting quote…" : "Simulate sale"}
        </button>
      </form>
      {error && (
        <p role="alert" className="tool-error">
          {error}
        </p>
      )}
      {quote && (
        <>
          <div className="metric-grid">
            <div>
              <small>Quoted output</small>
              <strong>{quote.sol} SOL</strong>
            </div>
            <div>
              <small>Minimum · 1% slippage</small>
              <strong>{quote.min} SOL</strong>
            </div>
            <div>
              <small>Provider price impact</small>
              <strong>{quote.impact}%</strong>
            </div>
          </div>
          <p className="data-note">
            Raydium · {new Date(quote.at).toISOString()} ·{" "}
            {now - quote.at > 45000
              ? "Stale quote. Simulate again."
              : "Snapshot only; refresh before making a decision."}
          </p>
        </>
      )}
      <p className="tool-disclaimer">
        Hypothetical route estimate, not a prediction of selling pressure or
        future price. Pool fees, network costs, MEV and reserve changes affect
        execution. This tool does not create, sign or send transactions.
      </p>
    </section>
  );
}

export function KOLAnalyzer({ open }: Props) {
  const [text, setText] = useState(""),
    [url, setUrl] = useState(""),
    [published, setPublished] = useState("");
  const [answer, setAnswer] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const mints = [
    ...new Set(
      text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g)?.filter(isSolanaAddress) ?? [],
    ),
  ];
  return (
    <section className="tool-page">
      <header className="tool-heading">
        <div>
          <small>INTELLIGENCE / MANUAL SOURCE</small>
          <h1>KOL Analyzer</h1>
          <p>
            X search and historical performance are not connected. Paste the
            original public text.
          </p>
        </div>
      </header>
      <form
        className="tool-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const ac = new AbortController();
          abort.current = ac;
          try {
            const result = await askAstra(
              [
                {
                  role: "user",
                  content: `Analyze this unverified user-pasted public call. Separate claims from evidence; do not invent publication date, returns or author identity. Source URL (not fetched): ${safeUrl(url) ?? "Not provided"}. User-supplied UTC publication time: ${published || "Unknown"}. Exact pasted quote:\n${text}`,
                },
              ],
              null,
              ac.signal,
            );
            if (!ac.signal.aborted) setAnswer(result.text);
          } catch (err) {
            setError(
              ac.signal.aborted ? "Analysis stopped." : errorMessage(err),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Public post URL (reference only)
          <input
            aria-label="Public post URL"
            value={url}
            maxLength={512}
            type="url"
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label>
          Publication time (UTC, user supplied)
          <input
            type="datetime-local"
            aria-label="Publication time UTC"
            value={published}
            onChange={(e) => setPublished(e.target.value)}
          />
        </label>
        <label>
          Exact pasted quote
          <textarea
            aria-label="Public call text"
            value={text}
            maxLength={4000}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button className="primary-action" disabled={busy || !text.trim()}>
          Analyze with Astra
        </button>
        {busy && (
          <button type="button" onClick={() => abort.current?.abort()}>
            Stop generating
          </button>
        )}
      </form>
      <p className="data-note">
        Method: manual quote review. Tickers are ambiguous until mapped to a
        verified Solana mint. Publication date and authorship are not verified;
        URL content is not retrieved.
      </p>
      {mints.length > 0 && (
        <p>
          Candidate Solana addresses (unverified asset mapping):{" "}
          {mints.join(", ")}
        </p>
      )}
      {safeUrl(url) && (
        <a href={safeUrl(url)} target="_blank" rel="noopener noreferrer">
          Open supplied source ↗
        </a>
      )}
      {error && (
        <p role="alert" className="tool-error">
          {error}
        </p>
      )}
      {answer && <article className="generated-text">{answer}</article>}
      <button onClick={() => open("astra")}>Open Astra</button>
    </section>
  );
}

export default function Intelligence(props: Props & { id: ModuleId }) {
  if (props.id === "xray") return <XRay {...props} />;
  if (props.id === "watch" || props.id === "smart")
    return (
      <WalletWatch key={props.id} {...props} smart={props.id === "smart"} />
    );
  if (props.id === "exit") return <ExitSimulator {...props} />;
  if (props.id === "kol") return <KOLAnalyzer {...props} />;
  return null;
}
