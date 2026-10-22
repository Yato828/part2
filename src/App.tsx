import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { TokenIcon } from "./components/TokenIcon";
import { Chart } from "./components/Chart";
import { Navigation, Launcher } from "./features/workspace/Navigation";
import {
  MODULES,
  useWorkspace,
  type ModuleId,
} from "./features/workspace/store";
import { isSolanaAddress, readLocal, saveLocal } from "./lib/validation";
import { readTerminalLink } from "./lib/siteLink";
const BubbleMap = lazy(() =>
  import("./components/BubbleMap").then((m) => ({ default: m.BubbleMap })),
);
const ChainMosaic = lazy(() =>
  import("./components/ChainMosaic").then((m) => ({ default: m.ChainMosaic })),
);
const PulseHeat = lazy(() =>
  import("./components/PulseHeat").then((m) => ({ default: m.PulseHeat })),
);
const ToolHost = lazy(() => import("./features/workspace/ToolHost"));
import { WalletChip, WalletSwap } from "./components/WalletSwap";
import { walletWebsiteHref } from "./lib/siteLink";
import {
  ageLabel,
  fetchAxiomFeed,
  fetchAxiomLive,
  fetchPulseLaunches,
  searchAxioms,
  type AxiomCoin,
} from "./lib/axiom";
import {
  fetchBlocks,
  fetchStats,
  fetchTrades,
  type ChainBlock,
  type ChainStats,
  type Trade,
} from "./lib/api";
import { EXPLORER } from "./lib/const";
import { fmtUsd, fmtQty, shortAddr } from "./lib/format";
import {
  PreferencesProvider,
  usePreferences,
  featureEnabled,
  THEME,
  accentInk,
} from "./features/preferences/preferences";
import { armAudio } from "./lib/audio";
import type { SpotTick } from "./lib/poolStream";
import { isExtension } from "./lib/env";
import "./terminal.css";
import "./features/workspace/workspace.css";
import "./features/preferences/customization.css";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Data unavailable";
const change = (v?: number) =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
type AppProps = {
  active?: boolean;
  lit?: boolean;
  mode?: "desk" | "popup";
  onLeave?: () => void;
};
export default function App(props: AppProps) {
  return (
    <PreferencesProvider>
      <Terminal {...props} />
    </PreferencesProvider>
  );
}
function Terminal({
  active = true,
  lit = false,
  mode = "desk",
  onLeave,
}: {
  active?: boolean;
  lit?: boolean;
  mode?: "desk" | "popup";
  onLeave?: () => void;
}) {
  const workspace = useWorkspace();
  const { preferences: prefs, storageError: preferenceError } =
    usePreferences();
  const theme = THEME[prefs.theme];
  useEffect(() => {
    if (!featureEnabled(workspace.state.active, prefs))
      workspace.open("settings");
    if (workspace.state.pinned.some((id) => !featureEnabled(id, prefs)))
      workspace.setState((s) => ({
        ...s,
        pinned: s.pinned.filter((id) => featureEnabled(id, prefs)),
      }));
  }, [
    prefs.tradeFeed,
    prefs.holderTools,
    prefs.creationTools,
    workspace.state.active,
  ]);
  const [launcher, setLauncher] = useState(false);
  const panel =
    workspace.state.active === "terminal"
      ? (workspace.state.pinned[0] ?? null)
      : workspace.state.active;
  const tab = panel ?? "terminal";
  const showChart =
    workspace.state.active === "terminal" && !workspace.state.maximized;
  const [filter, setFilter] = useState("");
  const [watchOnly, setWatchOnly] = useState(false);
  const [marketWatch, setMarketWatch] = useState<string[]>(() =>
    readLocal(
      "part.marketWatch.v1",
      (raw) =>
        Array.isArray(raw) ? raw.filter(isSolanaAddress).slice(0, 100) : [],
      [],
    ),
  );
  const [socialTab, setSocialTab] = useState(false);
  const [markets, setMarkets] = useState<AxiomCoin[]>([]);
  const [newCoins, setNewCoins] = useState<AxiomCoin[]>([]);
  const [coin, setCoin] = useState<AxiomCoin | null>(null);
  const [liveSpot, setLiveSpot] = useState<SpotTick | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AxiomCoin[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [open, setOpen] = useState(false);
  const [hitIndex, setHitIndex] = useState(0);
  const [feedError, setFeedError] = useState("");
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedRetry, setFeedRetry] = useState(0);
  const [newError, setNewError] = useState("");
  const [newLoading, setNewLoading] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeError, setTradeError] = useState("");
  const [tradeLoading, setTradeLoading] = useState(false);
  const [stats, setStats] = useState<ChainStats | null>(null);
  const [blocks, setBlocks] = useState<ChainBlock[]>([]);
  const [networkError, setNetworkError] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [updated, setUpdated] = useState(0);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<"volume" | "change" | "liquidity">("volume");
  useEffect(() => {
    if (
      !active ||
      (!(
        ["markets", "trends"].includes(tab) && !(tab === "trends" && socialTab)
      ) &&
        !open)
    )
      return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      try {
        const rows = await fetchAxiomFeed();
        if (!stopped) {
          setMarkets(rows);
          setFeedError("");
        }
      } catch (e) {
        if (!stopped) setFeedError(errorText(e));
      } finally {
        if (!stopped) {
          setFeedLoading(false);
          timer = setTimeout(run, 60000);
        }
      }
    };
    void run();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, feedRetry, tab, open, socialTab]);
  useEffect(() => {
    if (!active || !["new", "pulse"].includes(tab)) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    setNewLoading(true);
    const run = async () => {
      try {
        const rows = await fetchPulseLaunches();
        if (!stopped) {
          setNewCoins(rows);
          setNewError("");
        }
      } catch (e) {
        if (!stopped) setNewError(errorText(e));
      } finally {
        if (!stopped) {
          setNewLoading(false);
          timer = setTimeout(run, 60000);
        }
      }
    };
    void run();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, tab, feedRetry]);
  useEffect(() => {
    if (!active || tab !== "network") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      const result = await Promise.allSettled([fetchStats(), fetchBlocks()]);
      if (stopped) return;
      if (result[0].status === "fulfilled") setStats(result[0].value);
      if (result[1].status === "fulfilled") setBlocks(result[1].value);
      setNetworkError(
        result.some((r) => r.status === "rejected")
          ? "Public RPC is unavailable or rate limited. Retrying…"
          : "",
      );
      timer = setTimeout(run, 30000);
    };
    void run();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, tab]);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    setHits([]);
    setHitIndex(0);
    setSearchError("");
    if (!query.trim()) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void searchAxioms(query)
        .then((rows) => {
          if (!stopped) setHits(rows);
        })
        .catch((e) => {
          if (!stopped) setSearchError(errorText(e));
        })
        .finally(() => {
          if (!stopped) setSearching(false);
        });
    }, 300);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, query]);
  useEffect(() => {
    if (!active || !coin || !showChart || !prefs.liveUpdates) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const selected = coin;
    const run = async () => {
      try {
        const row = await fetchAxiomLive(selected);
        if (!stopped) {
          setCoin(row);
          setUpdated(Date.now());
          setQuoteError("");
        }
      } catch {
        if (!stopped) setQuoteError("Price feed delayed");
      } finally {
        if (!stopped) timer = setTimeout(run, prefs.refreshSeconds * 1000);
      }
    };
    void run();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [
    active,
    showChart,
    prefs.liveUpdates,
    prefs.refreshSeconds,
    coin?.address,
    coin?.pairAddress,
  ]);
  useEffect(() => {
    setTrades([]);
    setTradeError("");
    if (!active || !coin || tab !== "flow") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    setTradeLoading(true);
    const selected = coin;
    const run = async () => {
      try {
        const rows = await fetchTrades(
          selected.pairAddress,
          selected.address,
          selected.priceUsd,
        );
        if (!stopped) {
          setTrades(rows);
          setTradeError("");
        }
      } catch {
        if (!stopped) setTradeError("Trade feed unavailable. Retrying…");
      } finally {
        if (!stopped) {
          setTradeLoading(false);
          timer = setTimeout(run, 30000);
        }
      }
    };
    void run();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, tab, coin?.address, coin?.pairAddress]);
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setLauncher((v) => !v);
        setOpen(false);
        return;
      }
      if (e.key === "Escape") {
        setLauncher(false);
        setOpen(false);
      }
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active]);
  useEffect(() => {
    saveLocal("part.marketWatch.v1", marketWatch);
  }, [marketWatch]);
  useEffect(() => {
    const clear = () => {
      setMarketWatch([]);
      workspace.setState((s) => ({ ...s, selectedWallet: "" }));
    };
    window.addEventListener("part:clear-data", clear);
    return () => window.removeEventListener("part:clear-data", clear);
  }, []);
  const selectionEpoch = useRef(0);
  const [terminalLink] = useState(() =>
    readTerminalLink(window.location.search),
  );
  const initialSelection = useRef({
    mint: terminalLink.mint ?? workspace.state.selectedMint,
    pool: terminalLink.mint ? "" : workspace.state.selectedPool,
    fromLink: terminalLink.open,
  });
  useEffect(() => {
    const saved = initialSelection.current;
    if (saved.fromLink)
      workspace.setState((s) => ({
        ...s,
        active: "terminal",
        maximized: false,
      }));
    if (!saved.mint) return;
    if (saved.fromLink) setQuoteError("Loading selected Solana token…");
    let stopped = false;
    const epoch = selectionEpoch.current;
    void searchAxioms(saved.mint)
      .then((rows) => {
        const match =
          rows.find(
            (c) => c.address === saved.mint && c.pairAddress === saved.pool,
          ) ?? rows.find((c) => c.address === saved.mint);
        if (!stopped && epoch === selectionEpoch.current && match) {
          setCoin(match);
          setUpdated(Date.now());
          setQuoteError("");
          if (saved.fromLink)
            workspace.setState((s) => ({
              ...s,
              selectedMint: match.address,
              selectedPool: match.pairAddress,
            }));
        } else if (!stopped && epoch === selectionEpoch.current)
          setQuoteError(
            saved.fromLink
              ? "Linked token unavailable. Search again."
              : "Saved token unavailable. Search again.",
          );
      })
      .catch(() => {
        if (!stopped && epoch === selectionEpoch.current)
          setQuoteError(
            saved.fromLink
              ? "Linked token could not be loaded. Search again."
              : "Saved token could not be refreshed. Search again.",
          );
      });
    return () => {
      stopped = true;
    };
  }, []);
  const openModule = (id: ModuleId) => {
    if (!featureEnabled(id, prefs)) {
      workspace.open("settings");
      return;
    }
    workspace.open(id);
    if (id === "terminal")
      workspace.setState((s) => ({ ...s, maximized: false }));
  };
  const pick = (c: AxiomCoin, target: ModuleId = "terminal") => {
    if (c.chainId !== "solana") return;
    selectionEpoch.current++;
    setCoin(c);
    workspace.setState((s) => ({
      ...s,
      selectedMint: c.address,
      selectedPool: c.pairAddress,
      active: target,
      open: s.open.includes(target) ? s.open : [...s.open, target],
      maximized: false,
    }));
    setQuery("");
    setOpen(false);
    setCopied(false);
    setUpdated(Date.now());
    setQuoteError("");
  };
  const selectMint = async (mint: string, target: ModuleId = "terminal") => {
    if (!isSolanaAddress(mint)) return;
    setSearchError("");
    const epoch = ++selectionEpoch.current;
    try {
      const match = (await searchAxioms(mint)).find((c) => c.address === mint);
      if (!match)
        throw new Error("No indexed Solana pool found for this mint.");
      if (epoch === selectionEpoch.current) pick(match, target);
    } catch (e) {
      if (epoch !== selectionEpoch.current) return;
      setSearchError(errorText(e));
      setQuery(mint);
      setOpen(true);
      input.current?.focus();
    }
  };
  const rows = (["new", "pulse"].includes(tab) ? newCoins : markets)
    .filter(
      (c) =>
        (!watchOnly || marketWatch.includes(c.address)) &&
        `${c.name} ${c.symbol} ${c.address}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
    )
    .slice()
    .sort((a, b) =>
      ["new", "pulse"].includes(tab)
        ? (b.createdAt ?? 0) - (a.createdAt ?? 0)
        : sort === "change"
          ? (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity)
          : sort === "liquidity"
            ? (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0)
            : (b.volume24h ?? 0) - (a.volume24h ?? 0),
    );
  const suggestions = query.trim() ? hits : markets.slice(0, 8);
  return (
    <div
      data-theme={prefs.theme}
      data-density={prefs.density}
      data-text-size={prefs.textSize}
      data-reduced-motion={prefs.reducedMotion}
      data-artwork={prefs.tokenArtwork}
      style={
        {
          "--accent": prefs.accent,
          "--accent-ink": accentInk(prefs.accent),
          "--trade-up": prefs.upColor,
          "--trade-down": prefs.downColor,
          "--desk-bg": theme.background,
          "--desk-panel": theme.panel,
          "--desk-raised": theme.raised,
          "--desk-edge": theme.edge,
          "--desk-text": theme.text,
          "--desk-muted": theme.muted,
        } as React.CSSProperties
      }
      className={`sol-terminal modular-terminal${workspace.state.maximized ? " maximized" : ""}${mode === "popup" ? " sol-compact" : ""}${lit ? " lit" : ""}`}
      onPointerDown={() => armAudio()}
    >
      <header className="sol-header">
        <div className="sol-brand">
          <img
            className="sol-brand-eye"
            src={`${import.meta.env.BASE_URL}favicon.png`}
            alt=""
            width={34}
            height={34}
          />
          PART
          <span className="sol-network">
            <i />
            SOLANA
          </span>
        </div>
        <div className="sol-search">
          <span className="search-glyph">⌕</span>
          <input
            ref={input}
            aria-label="Search Solana tokens"
            role="combobox"
            aria-expanded={open}
            aria-controls="sol-search-results"
            aria-autocomplete="list"
            aria-activedescendant={
              open && suggestions[hitIndex]
                ? `sol-result-${hitIndex}`
                : undefined
            }
            value={query}
            placeholder="Search token or paste Solana mint…"
            autoComplete="off"
            spellCheck={false}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHitIndex((i) =>
                  Math.max(
                    0,
                    Math.min(i + 1, Math.min(suggestions.length, 10) - 1),
                  ),
                );
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHitIndex((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter" && suggestions[hitIndex])
                pick(suggestions[hitIndex]);
            }}
          />
          <kbd>/</kbd>
          {open && (
            <div
              className="sol-search-results"
              id="sol-search-results"
              role="listbox"
            >
              <div className="search-caption">
                {query.trim() ? "SOLANA RESULTS" : "DISCOVER SOLANA"}
                <span>
                  {searching ? "Searching…" : `${suggestions.length} tokens`}
                </span>
              </div>
              {searchError ? (
                <p role="alert">{searchError}</p>
              ) : !searching && !suggestions.length ? (
                <p>No Solana markets found. Try a mint address.</p>
              ) : (
                suggestions.slice(0, 10).map((c, i) => (
                  <button
                    key={c.address}
                    id={`sol-result-${i}`}
                    role="option"
                    aria-selected={i === hitIndex}
                    className={i === hitIndex ? "selected" : ""}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(c)}
                  >
                    <TokenIcon coin={c} />
                    <span>
                      <b>{c.symbol}</b>
                      <small>
                        {c.name} · {shortAddr(c.address)}
                      </small>
                    </span>
                    <span>
                      <b>{fmtUsd(c.priceUsd)}</b>
                      <small>
                        Liq {fmtUsd(c.liquidityUsd)} · {c.dex}
                      </small>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <div className="sol-header-actions">
          <button
            className="add-panel-button"
            onClick={() => setLauncher(true)}
          >
            Add Panel <kbd>⌘ K</kbd>
          </button>
          <button
            className="settings-shortcut"
            aria-label="Open settings"
            onClick={() => openModule("settings")}
          >
            Settings
          </button>
          {isExtension() ? (
            <a
              className="wallet-chip extension-wallet-link"
              href={walletWebsiteHref(coin?.address, prefs.astraBackend)}
              target="_blank"
              rel="noopener noreferrer"
              title="Open PART in a website tab to connect your Solana wallet"
            >
              Wallet on site ↗
            </a>
          ) : (
            <WalletChip />
          )}
          {isExtension() && mode === "popup" && (
            <button
              className="extension-desk-button"
              onClick={() => {
                const deskUrl = new URL(
                  "popup.html?view=desk",
                  window.location.href,
                );
                if (coin) deskUrl.searchParams.set("mint", coin.address);
                window.open(
                  deskUrl.href,
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
              title="Keep charts and the live feed open in a browser tab"
            >
              Open desk ↗
            </button>
          )}
          {onLeave && (
            <button className="home-button" onClick={onLeave}>
              House ↗
            </button>
          )}
        </div>
      </header>
      <div className="workspace-frame">
        <Navigation
          state={workspace.state}
          open={openModule}
          launcher={() => setLauncher(true)}
        />
        <div className="workspace-body">
          <div
            className="workspace-tabs"
            role="tablist"
            aria-label="Open workspace panels"
          >
            {workspace.state.open.map((id) => (
              <div
                key={id}
                className={workspace.state.active === id ? "selected" : ""}
              >
                <button
                  role="tab"
                  aria-selected={workspace.state.active === id}
                  onClick={() => openModule(id)}
                >
                  {MODULES.find((m) => m.id === id)?.title}
                </button>
                {id !== "terminal" && (
                  <button
                    aria-label={`Close ${MODULES.find((m) => m.id === id)?.title}`}
                    onClick={() => workspace.close(id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {workspace.storageError && (
            <p role="alert" className="data-note">
              Local storage unavailable. Layout will not survive reload.
            </p>
          )}
          {coin && (
            <div className="workspace-context">
              <span>
                {coin.symbol} <small>{shortAddr(coin.address)} · Solana</small>
              </span>
              <div>
                <button onClick={() => openModule("swap")}>Buy / Swap</button>
                <button onClick={() => openModule("xray")}>Analyze</button>
                <button onClick={() => openModule("astra")}>Ask Astra</button>
              </div>
            </div>
          )}
          <main
            className={`sol-workspace${showChart && panel ? " with-pinned-panel" : ""}`}
          >
            <div className="sol-main">
              {showChart && (
                <section className="sol-chart-panel">
                  {coin ? (
                    <>
                      <div className="sol-token-bar">
                        <div className="token-identity">
                          <TokenIcon coin={coin} />
                          <div>
                            <h1>
                              {coin.symbol}
                              <span>{coin.dex}</span>
                            </h1>
                            <button
                              className="mint-copy"
                              title={coin.address}
                              onClick={() => {
                                void navigator.clipboard
                                  .writeText(coin.address)
                                  .then(() => setCopied(true))
                                  .catch(() => setCopied(false));
                              }}
                            >
                              {copied
                                ? "Copied mint ✓"
                                : shortAddr(coin.address) + " ⧉"}
                            </button>
                          </div>
                        </div>
                        <div className="token-price">
                          <strong>
                            {liveSpot ? "≈ " : ""}
                            {fmtUsd(
                              liveSpot?.price ?? coin.priceUsd,
                              (liveSpot?.price ?? coin.priceUsd) < 1 ? 6 : 2,
                            )}
                          </strong>
                          <small className="spot-price-label">
                            {liveSpot
                              ? `Pool spot · ${liveSpot.commitment}`
                              : "DEX snapshot"}
                          </small>
                          <span
                            className={(coin.change24h ?? 0) >= 0 ? "up" : "dn"}
                          >
                            {change(coin.change24h)} <small>24h</small>
                          </span>
                        </div>
                        <div
                          className={`token-metric${!prefs.showMetrics ? " pref-hidden" : ""}`}
                        >
                          <small>Market cap</small>
                          <b>{fmtUsd(coin.mcap ?? coin.fdv)}</b>
                        </div>
                        <div
                          className={`token-metric${!prefs.showMetrics ? " pref-hidden" : ""}`}
                        >
                          <small>Liquidity</small>
                          <b>{fmtUsd(coin.liquidityUsd)}</b>
                        </div>
                        <div
                          className={`token-metric${!prefs.showMetrics ? " pref-hidden" : ""}`}
                        >
                          <small>24h volume</small>
                          <b>{fmtUsd(coin.volume24h)}</b>
                        </div>
                        <a
                          className="token-explorer"
                          href={`${EXPLORER}/token/${coin.address}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Open mint on Solscan"
                        >
                          ↗
                        </a>
                      </div>
                      <Chart
                        key={coin.pairAddress + coin.address}
                        pool={coin.pairAddress}
                        token={coin.address}
                        symbol={coin.symbol}
                        priceUsd={coin.priceUsd}
                        mcap={coin.mcap}
                        onSpot={setLiveSpot}
                      />
                    </>
                  ) : (
                    <div className="sol-empty">
                      <img
                        className="terminal-empty-eye"
                        src={`${import.meta.env.BASE_URL}favicon.png`}
                        alt=""
                        width={128}
                        height={128}
                      />
                      <div className="empty-eyebrow">
                        YOUR SOLANA TRADING DESK
                      </div>
                      <h1>Find your next market.</h1>
                      <p>
                        Search a token or paste its mint address.
                        <br />
                        Your chart comes first. Open tools when you need them.
                      </p>
                      <button
                        className="primary-action"
                        onClick={() => input.current?.focus()}
                      >
                        Search Solana tokens <kbd>/</kbd>
                      </button>
                      <div className="empty-tools">
                        <button onClick={() => openModule("markets")}>
                          Discover markets ↗
                        </button>
                        <button onClick={() => setLauncher(true)}>
                          Explore tools ↗
                        </button>
                      </div>
                      <div className="quick-markets">
                        {markets.slice(0, 4).map((c) => (
                          <button key={c.address} onClick={() => pick(c)}>
                            <TokenIcon coin={c} />
                            {c.symbol}
                            <span
                              className={(c.change24h ?? 0) >= 0 ? "up" : "dn"}
                            >
                              {change(c.change24h)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
              {panel && (
                <section
                  className={`module-panel ${showChart ? "pinned-panel" : ""}`}
                  aria-label={MODULES.find((m) => m.id === panel)?.title}
                >
                  <div className="panel-controls">
                    <b>{MODULES.find((m) => m.id === panel)?.title}</b>
                    <div>
                      <button
                        aria-label="Move panel left"
                        onClick={() =>
                          workspace.setState((s) => {
                            const ids = [...s.open];
                            const i = ids.indexOf(panel);
                            if (i > 1)
                              [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                            return { ...s, open: ids };
                          })
                        }
                      >
                        ←
                      </button>
                      <button
                        aria-label="Move panel right"
                        onClick={() =>
                          workspace.setState((s) => {
                            const ids = [...s.open];
                            const i = ids.indexOf(panel);
                            if (i > 0 && i < ids.length - 1)
                              [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]];
                            return { ...s, open: ids };
                          })
                        }
                      >
                        →
                      </button>
                      <button onClick={() => workspace.pin(panel)}>
                        {workspace.state.pinned.includes(panel)
                          ? "Unpin"
                          : "Pin"}
                      </button>
                      <button
                        onClick={() =>
                          workspace.setState((s) => ({
                            ...s,
                            maximized: !s.maximized,
                          }))
                        }
                      >
                        {workspace.state.maximized ? "Restore" : "Maximize"}
                      </button>
                      <button onClick={() => openModule("terminal")}>
                        Back to Terminal
                      </button>
                      <button
                        aria-label="Close panel"
                        onClick={() => workspace.close(panel)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <Suspense
                    fallback={<p className="data-note">Loading panel…</p>}
                  >
                    {[
                      "markets",
                      "new",
                      "pulse",
                      "trends",
                      "holders",
                      "flow",
                      "swap",
                      "network",
                    ].includes(tab) ? (
                      <section className="sol-floor">
                        {["markets", "new", "trends"].includes(tab) && (
                          <>
                            {tab === "trends" && (
                              <div className="tool-actions">
                                <button
                                  className={!socialTab ? "selected" : ""}
                                  onClick={() => setSocialTab(false)}
                                >
                                  On-chain Trends
                                </button>
                                <button
                                  className={socialTab ? "selected" : ""}
                                  onClick={() => setSocialTab(true)}
                                >
                                  X Trends
                                </button>
                              </div>
                            )}
                            {tab === "trends" && socialTab ? (
                              <div className="tool-empty">
                                <h2>X provider not connected.</h2>
                                <p>
                                  No live social mentions or trending counts are
                                  available.
                                </p>
                                <button onClick={() => openModule("kol")}>
                                  Analyze pasted public text
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="market-table-head">
                                  <span>
                                    {tab === "new"
                                      ? "Recently profiled tokens"
                                      : "Discover markets · ranked by activity"}
                                  </span>
                                  {tab !== "new" && (
                                    <select
                                      aria-label="Sort markets"
                                      value={sort}
                                      onChange={(e) =>
                                        setSort(e.target.value as typeof sort)
                                      }
                                    >
                                      <option value="volume">
                                        24h volume ↓
                                      </option>
                                      <option value="change">
                                        24h change ↓
                                      </option>
                                      <option value="liquidity">
                                        Liquidity ↓
                                      </option>
                                    </select>
                                  )}
                                </div>
                                <div className="market-filters">
                                  <input
                                    aria-label="Filter markets"
                                    placeholder="Filter name, ticker or mint…"
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                  />
                                  <label>
                                    <input
                                      type="checkbox"
                                      checked={watchOnly}
                                      onChange={(e) =>
                                        setWatchOnly(e.target.checked)
                                      }
                                    />{" "}
                                    Watchlist only
                                  </label>
                                  <button
                                    onClick={() => setFeedRetry((n) => n + 1)}
                                  >
                                    Refresh
                                  </button>
                                </div>
                                {(tab !== "new" ? feedError : newError) && (
                                  <p className="data-note">
                                    {tab !== "new" ? feedError : newError}
                                  </p>
                                )}
                                <div className="market-table-scroll">
                                  <table className="market-table">
                                    <thead>
                                      <tr>
                                        <th>Watch</th>
                                        <th>Token</th>
                                        <th>Price</th>
                                        <th>5m</th>
                                        <th>1h</th>
                                        <th>24h</th>
                                        <th>Liquidity</th>
                                        <th>24h volume</th>
                                        <th>Age</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rows.map((c) => (
                                        <tr
                                          key={c.address}
                                          className={
                                            coin?.address === c.address
                                              ? "active"
                                              : ""
                                          }
                                          onClick={() => pick(c)}
                                        >
                                          <td>
                                            <button
                                              aria-label={`${marketWatch.includes(c.address) ? "Unwatch" : "Watch"} ${c.symbol}`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setMarketWatch((ws) =>
                                                  ws.includes(c.address)
                                                    ? ws.filter(
                                                        (a) => a !== c.address,
                                                      )
                                                    : [...ws, c.address].slice(
                                                        -100,
                                                      ),
                                                );
                                              }}
                                            >
                                              {marketWatch.includes(c.address)
                                                ? "●"
                                                : "+"}
                                            </button>
                                          </td>
                                          <td>
                                            <button
                                              className="market-name"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                pick(c);
                                              }}
                                            >
                                              <TokenIcon coin={c} />
                                              <span>
                                                <b>{c.symbol}</b>
                                                <small>
                                                  {c.dex} ·{" "}
                                                  {shortAddr(c.address)}
                                                </small>
                                              </span>
                                            </button>
                                          </td>
                                          <td>{fmtUsd(c.priceUsd)}</td>
                                          <td
                                            className={
                                              (c.change5m ?? 0) >= 0
                                                ? "up"
                                                : "dn"
                                            }
                                          >
                                            {change(c.change5m)}
                                          </td>
                                          <td
                                            className={
                                              (c.change1h ?? 0) >= 0
                                                ? "up"
                                                : "dn"
                                            }
                                          >
                                            {change(c.change1h)}
                                          </td>
                                          <td
                                            className={
                                              (c.change24h ?? 0) >= 0
                                                ? "up"
                                                : "dn"
                                            }
                                          >
                                            {change(c.change24h)}
                                          </td>
                                          <td>{fmtUsd(c.liquidityUsd)}</td>
                                          <td>{fmtUsd(c.volume24h)}</td>
                                          <td>{ageLabel(c.createdAt)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {!rows.length && (
                                    <p className="data-note">
                                      {(
                                        tab === "new" ? newLoading : feedLoading
                                      )
                                        ? "Loading Solana pools…"
                                        : "No markets available. Use search or retry."}
                                    </p>
                                  )}
                                </div>
                                <p className="data-note">
                                  DEX Screener · Solana mainnet.{" "}
                                  {tab === "new"
                                    ? "Recently observed token profiles; pool age is shown when supplied by the source. This is not a complete list of new mints."
                                    : "Ranked by observed DEX activity; no social trend claims."}
                                </p>
                              </>
                            )}
                          </>
                        )}
                        {tab === "pulse" && (
                          <>
                            <p className="data-note">
                              DEX Screener · recently profiled Solana markets.{" "}
                              {newError}
                            </p>
                            <PulseHeat
                              coins={newCoins}
                              loading={newLoading}
                              onPick={pick}
                            />
                          </>
                        )}
                        {tab === "holders" && (
                          <div className="holder-map">
                            <BubbleMap
                              token={coin?.address}
                              pool={coin?.pairAddress}
                              symbol={coin?.symbol}
                            />
                          </div>
                        )}
                        {tab === "flow" && (
                          <div className="flow-tab">
                            {!coin && (
                              <p className="data-note">
                                Select a token to open its transaction tape.
                              </p>
                            )}
                            {tradeError && (
                              <p className="data-note">{tradeError}</p>
                            )}
                            <table className="market-table">
                              <thead>
                                <tr>
                                  <th>Time</th>
                                  <th>Maker</th>
                                  <th>Side</th>
                                  <th>USD</th>
                                  <th>Tokens</th>
                                </tr>
                              </thead>
                              <tbody>
                                {trades.map((t, i) => (
                                  <tr key={t.hash + i}>
                                    <td>
                                      <a
                                        href={`${EXPLORER}/tx/${t.hash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {new Date(
                                          t.timestamp,
                                        ).toLocaleTimeString()}{" "}
                                        ↗
                                      </a>
                                    </td>
                                    <td>
                                      <a
                                        href={`${EXPLORER}/account/${t.wallet}`}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {shortAddr(t.wallet)}
                                      </a>
                                    </td>
                                    <td>{t.side.toUpperCase()}</td>
                                    <td>{fmtUsd(t.usd)}</td>
                                    <td>{fmtQty(t.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {coin && !trades.length && (
                              <p className="data-note">
                                {tradeLoading
                                  ? "Loading trades…"
                                  : "No recent trades returned."}
                              </p>
                            )}
                          </div>
                        )}
                        {tab === "swap" && (
                          <div className="swap-tab">
                            <WalletSwap
                              key={coin?.address ?? "idle"}
                              coin={coin}
                            />
                          </div>
                        )}
                        {tab === "network" && (
                          <ChainMosaic
                            stats={stats}
                            blocks={blocks}
                            error={networkError}
                          />
                        )}
                      </section>
                    ) : (
                      <ToolHost
                        key={panel}
                        id={panel}
                        selectedWallet={workspace.state.selectedWallet}
                        selectWallet={(address) =>
                          workspace.setState((s) => ({
                            ...s,
                            selectedWallet: address,
                          }))
                        }
                        coin={coin}
                        open={openModule}
                        selectMint={(mint, target) =>
                          void selectMint(mint, target)
                        }
                        reset={() => {
                          selectionEpoch.current++;
                          workspace.reset();
                          setCoin(null);
                        }}
                        collapsed={workspace.state.collapsed}
                        toggleNav={() =>
                          workspace.setState((s) => ({
                            ...s,
                            collapsed: !s.collapsed,
                          }))
                        }
                      />
                    )}
                  </Suspense>
                </section>
              )}
            </div>
          </main>
        </div>
      </div>
      {launcher && (
        <Launcher onOpen={openModule} onClose={() => setLauncher(false)} />
      )}
      <footer className="sol-status">
        <span>
          <i />
          SOLANA MAINNET
        </span>
        <span>
          {quoteError ||
            (updated
              ? `Price updated ${new Date(updated).toLocaleTimeString()}`
              : "Select a market to begin")}
        </span>
        <span>PART / ASTRA</span>
      </footer>
    </div>
  );
}
