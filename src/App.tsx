import { useEffect, useMemo, useRef, useState } from "react";
import { BubbleMap } from "./components/BubbleMap";
import { ChainMosaic } from "./components/ChainMosaic";
import { Chart } from "./components/Chart";
import { FxLayer } from "./components/Fx";
import { HeroIntel } from "./components/HeroIntel";
import { PulseHeat } from "./components/PulseHeat";
import { StocksHeat } from "./components/StocksHeat";
import { WalletChip, WalletSwap } from "./components/WalletSwap";
import {
  axiomUrl,
  fetchAxiomLive,
  fetchPulseLaunches,
  fetchRhCoinByAddress,
  isPoolAddr,
  prefetchCandles,
  searchAxioms,
  type AxiomCoin,
} from "./lib/axiom";
import {
  fetchAssets,
  fetchBlockNumber,
  fetchBlocks,
  fetchChainTokens,
  fetchCorpActions,
  fetchPrice,
  fetchPrices,
  fetchStats,
  fetchToken,
  fetchTransfers,
  fetchTxs,
  rhAddress,
  type ChainBlock,
  type ChainStats,
  type ChainToken,
  type ChainTx,
  type RhAsset,
  type RhQuote,
  type TokenTransfer,
} from "./lib/api";
import { armAudio, sfx } from "./lib/audio";
import { CHAIN_ID, DEFAULT_WATCH, EXPLORER } from "./lib/const";
import { fmtInt, fmtQty, fmtUsd, mid, shortAddr } from "./lib/format";

type Log = { t: string; s: string; k?: "ok" | "err" };

type Pane = "PULSE" | "STOCKS" | "CHAIN" | "BUBBLE" | "FLOW" | "SWAP";

export default function App({
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
  const compact = mode === "popup";
  const [tab, setTab] = useState<Pane>("STOCKS");
  const [launches, setLaunches] = useState<AxiomCoin[]>([]);
  const [pulseLoading, setPulseLoading] = useState(true);
  const [assets, setAssets] = useState<RhAsset[]>([]);
  const [chainTokens, setChainTokens] = useState<ChainToken[]>([]);
  const [quotes, setQuotes] = useState<Map<string, RhQuote>>(new Map());
  const [symbol, setSymbol] = useState("");
  const [armed, setArmed] = useState(false);
  const [stats, setStats] = useState<ChainStats | null>(null);
  const [txs, setTxs] = useState<ChainTx[]>([]);
  const [blocks, setBlocks] = useState<ChainBlock[]>([]);
  const [blockNo, setBlockNo] = useState(0);
  const [onchain, setOnchain] = useState<ChainToken | null>(null);
  const [transfers, setTransfers] = useState<TokenTransfer[]>([]);
  const [query, setQuery] = useState("");
  const [axiomHits, setAxiomHits] = useState<AxiomCoin[]>([]);
  const [axiomCoin, setAxiomCoin] = useState<AxiomCoin | null>(null);
  const [omniOn, setOmniOn] = useState(false);
  const [logs, setLogs] = useState<Log[]>([
    { t: "SYS", s: "Fable 5.1 online — fastest and most accurate. Search a market when you are ready.", k: "ok" },
  ]);
  const [res, setRes] = useState({ w: 0, h: 0 });
  const [corpActions, setCorpActions] = useState<Array<{ tokenSymbol: string; type: string; status: string }>>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const outRef = useRef<HTMLDivElement>(null);

  const log = (t: string, s: string, k?: "ok" | "err") => {
    setLogs((prev) => [...prev.slice(-80), { t, s, k }]);
  };

  const assetMap = useMemo(() => {
    const m = new Map<string, RhAsset>();
    assets.forEach((a) => m.set(a.tokenSymbol.toUpperCase(), a));
    return m;
  }, [assets]);

  const asset = assetMap.get(symbol.toUpperCase());
  const quote = quotes.get(symbol.toUpperCase());
  const chainHit = chainTokens.find((t) => t.symbol?.toUpperCase() === symbol.toUpperCase());
  const px = armed && axiomCoin?.priceUsd
    ? axiomCoin.priceUsd
    : tab === "STOCKS"
      ? mid(quote?.bid, quote?.ask)
      : Number(onchain?.exchange_rate ?? chainHit?.exchange_rate);
  const lo = Number(quote?.dailyLow);
  const chg = armed && axiomCoin
    ? axiomCoin.change24h ?? axiomCoin.change1h ?? NaN
    : quote?.change24h != null
      ? quote.change24h
      : Number.isFinite(px) && Number.isFinite(lo) && lo > 0
        ? ((px - lo) / lo) * 100
        : NaN;

  useEffect(() => {
    const on = () => {
      setRes({ w: window.innerWidth, h: window.innerHeight });
    };
    on();
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("resize", on);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let live = true;
    void (async () => {
      try {
        const a = await fetchAssets();
        if (!live) return;
        setAssets(a);
        const want = DEFAULT_WATCH.filter((x) => a.some((z) => z.tokenSymbol === x));
        const priced = (want.length ? want : a.slice(0, 12).map((z) => z.tokenSymbol))
          .map((sym) => {
            const hit = a.find((z) => z.tokenSymbol === sym);
            const address = hit ? rhAddress(hit) : undefined;
            return hit && address ? { symbol: sym, address } : null;
          })
          .filter((x): x is { symbol: string; address: string } => Boolean(x));
        const q = await fetchPrices(priced);
        if (!live) return;
        setQuotes(q);
        q.forEach((quote) => {
          if (quote.pairAddress) prefetchCandles(quote.pairAddress, ["15m", "1m"]);
        });
        log("NET", `registry ${a.length} RH tokens`, "ok");
      } catch (e) {
        if (live) log("ERR", String(e), "err");
      }
    })();
    void Promise.allSettled([fetchStats(), fetchTxs(), fetchBlocks(), fetchChainTokens(), fetchCorpActions()]).then(
      (settled) => {
        if (!live) return;
        const val = <T,>(i: number, fallback: T) =>
          settled[i].status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<T>).value : fallback;
        setStats(val(0, null));
        setTxs(val(1, []));
        setBlocks(val(2, []));
        setChainTokens(val(3, []));
        const ca = val(4, { corpActions: [] as Array<{ tokenSymbol: string; type: string; status: string }> });
        setCorpActions(ca.corpActions ?? []);
      }
    );
    return () => {
      live = false;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const tick = async () => {
      const settled = await Promise.allSettled([fetchStats(), fetchTxs(), fetchBlocks(), fetchBlockNumber()]);
      if (settled[0].status === "fulfilled") setStats(settled[0].value);
      if (settled[1].status === "fulfilled") setTxs(settled[1].value);
      if (settled[2].status === "fulfilled") setBlocks(settled[2].value);
      if (settled[3].status === "fulfilled") setBlockNo(settled[3].value);
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const watch = DEFAULT_WATCH.map((s) => {
      const a = assetMap.get(s);
      const address = a ? rhAddress(a) : undefined;
      return a && address ? { symbol: s, address } : null;
    }).filter((x): x is { symbol: string; address: string } => Boolean(x));
    const id = setInterval(async () => {
      try {
        const q = await fetchPrices(watch);
        setQuotes((prev) => {
          const next = new Map(prev);
          q.forEach((v, k) => next.set(k, v));
          return next;
        });
      } catch {
        /* ignore */
      }
    }, 12000);
    return () => clearInterval(id);
  }, [active, assetMap]);

  useEffect(() => {
    if (!active || tab !== "STOCKS" || !assets.length) return;
    const extra = assets.slice(0, 24)
      .map((a) => {
        const address = rhAddress(a);
        return address ? { symbol: a.tokenSymbol, address } : null;
      })
      .filter((x): x is { symbol: string; address: string } => Boolean(x));
    void fetchPrices(extra).then((q) => {
      setQuotes((prev) => {
        const next = new Map(prev);
        q.forEach((v, k) => next.set(k, v));
        return next;
      });
    });
  }, [active, tab, assets]);

  useEffect(() => {
    if (!active) return;
    let live = true;
    const run = async () => {
      try {
        const stockSymbols = assets.length ? assets.map((a) => a.tokenSymbol) : DEFAULT_WATCH;
        const stockAddresses = assets
          .map((a) => rhAddress(a))
          .filter((x): x is string => Boolean(x));
        const rows = await fetchPulseLaunches({ stockSymbols, stockAddresses });
        if (!live) return;
        setLaunches(rows);
      } catch {
        /* keep last pulse */
      } finally {
        if (live) setPulseLoading(false);
      }
    };
    void run();
    const id = setInterval(run, 10000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [active, assets]);

  useEffect(() => {
    if (!active || !symbol) return;
    let stop = false;
    const run = async () => {
      try {
        const q = await fetchPrice(
          symbol,
          assetMap.get(symbol.toUpperCase())
            ? rhAddress(assetMap.get(symbol.toUpperCase())!)
            : chainTokens.find((t) => t.symbol?.toUpperCase() === symbol.toUpperCase())?.address_hash
        );
        if (q && !stop) {
          setQuotes((prev) => new Map(prev).set(symbol.toUpperCase(), q));
        }
        const a = assetMap.get(symbol.toUpperCase());
        const addr = a ? rhAddress(a) : chainTokens.find((t) => t.symbol?.toUpperCase() === symbol.toUpperCase())?.address_hash;
        if (addr) {
          const [tok, tr] = await Promise.all([fetchToken(addr), fetchTransfers(addr)]);
          if (!stop) {
            setOnchain(tok);
            setTransfers(tr);
          }
        } else {
          setOnchain(null);
          setTransfers([]);
        }
      } catch (e) {
        if (!stop) log("ERR", String(e), "err");
      }
    };
    run();
    const id = setInterval(run, 6000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [symbol, active, assetMap, chainTokens]);

  useEffect(() => {
    if (!active) return;
    let live = true;
    const q = query.trim();
    const t = setTimeout(() => {
      void (async () => {
        try {
          if (!q) {
            setAxiomHits([]);
            return;
          }
          const needle = q.toLowerCase();
          const local: AxiomCoin[] = assets
            .filter((a) => {
              const sym = a.tokenSymbol.toLowerCase();
              const name = a.tokenName.toLowerCase();
              const addr = rhAddress(a)?.toLowerCase();
              return sym.includes(needle) || name.includes(needle) || (needle.startsWith("0x") && addr === needle);
            })
            .slice(0, 12)
            .map((a) => {
              const quote = quotes.get(a.tokenSymbol.toUpperCase());
              const address = rhAddress(a) ?? "";
              const px = quote ? mid(quote.bid, quote.ask) : 0;
              return {
                symbol: a.tokenSymbol,
                name: a.tokenName,
                address,
                pairAddress: "",
                chainId: "robinhood",
                dex: quote?.dex ?? "robinhood",
                logo: a.logoUrl,
                priceUsd: Number.isFinite(px) ? px : 0,
                change24h: quote?.change24h,
                change1h: quote?.change1h,
                liquidityUsd: quote?.liquidityUsd,
                volume24h: quote ? Number(quote.dailyTradingVolume) : undefined,
              } satisfies AxiomCoin;
            });
          let remote: AxiomCoin[] = [];
          try {
            remote = await searchAxioms(q);
          } catch (e) {
            if (live) log("ERR", String(e), "err");
          }
          if (!live) return;
          const seen = new Set<string>();
          const hits: AxiomCoin[] = [];
          for (const c of [...remote, ...local]) {
            const k = (c.address || c.symbol).toLowerCase();
            if (seen.has(k)) continue;
            seen.add(k);
            hits.push(c);
          }
          setAxiomHits(hits);
          hits.slice(0, 6).forEach((c) => {
            if (c.pairAddress) prefetchCandles(c.pairAddress);
          });
          if (hits.length) sfx.found();
        } catch (e) {
          if (live) log("ERR", String(e), "err");
        }
      })();
    }, 24);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [active, query, assets]);

  useEffect(() => {
    if (!active || !axiomCoin) return;
    let stop = false;
    const run = async () => {
      try {
        const live = await fetchAxiomLive(axiomCoin);
        if (stop) return;
        setAxiomCoin(live);
      } catch {
        /* keep last */
      }
    };
    run();
    const id = setInterval(run, 2000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [active, tab, axiomCoin?.address, axiomCoin?.pairAddress]);

  const selectAxiom = (coin: AxiomCoin) => {
    setArmed(true);
    setAxiomCoin(coin);
    setSymbol(coin.symbol.toUpperCase());
    setQuery(coin.symbol);
    setOmniOn(false);
    const ivs =
      coin.createdAt && Date.now() - coin.createdAt < 8 * 3600_000 ? ["1m", "5m", "15m"] : ["15m"];
    if (isPoolAddr(coin.pairAddress)) prefetchCandles(coin.pairAddress, ivs);
    sfx.select();
    log("AXM", `${coin.symbol}  ${coin.chainId}  ${coin.name}`, "ok");
    if (coin.address) {
      void fetchRhCoinByAddress(coin.address).then((c) => {
        if (!c) return;
        const pool = isPoolAddr(coin.pairAddress) ? coin.pairAddress : c.pairAddress;
        const next = {
          ...c,
          pairAddress: pool,
          createdAt: Math.max(coin.createdAt ?? 0, c.createdAt ?? 0) || c.createdAt || coin.createdAt,
        };
        setAxiomCoin(next);
        if (isPoolAddr(next.pairAddress)) prefetchCandles(next.pairAddress, ivs);
      });
    }
  };

  const pickPulse = (coin: AxiomCoin) => {
    setTab("PULSE");
    selectAxiom(coin);
  };

  const select = (sym: string, source: "STOCKS" | "CHAIN" | "BUBBLE" = "STOCKS") => {
    setTab(source);
    setArmed(true);
    setSymbol(sym.toUpperCase());
    sfx.select();
    log("SEL", `${source} ${sym.toUpperCase()}`, "ok");
    const a = assetMap.get(sym.toUpperCase());
    const q = quotes.get(sym.toUpperCase());
    const address = a
      ? rhAddress(a)
      : chainTokens.find((t) => t.symbol?.toUpperCase() === sym.toUpperCase())?.address_hash;
    if (address || q?.pairAddress) {
      setAxiomCoin({
        symbol: sym.toUpperCase(),
        name: a?.tokenName ?? sym.toUpperCase(),
        address: address ?? "",
        pairAddress: q?.pairAddress ?? "",
        chainId: "robinhood",
        dex: q?.dex ?? "uniswap",
        logo: a?.logoUrl,
        priceUsd: Number.isFinite(mid(q?.bid, q?.ask)) ? mid(q?.bid, q?.ask) : 0,
        change24h: q?.change24h,
        liquidityUsd: q?.liquidityUsd,
        volume24h: q ? Number(q.dailyTradingVolume) : undefined,
      });
      if (q?.pairAddress) prefetchCandles(q.pairAddress, ["1m", "15m"]);
    }
    if (address) {
      void fetchRhCoinByAddress(address).then((c) => {
        if (c) {
          setAxiomCoin(c);
          prefetchCandles(c.pairAddress, ["1m", "15m"]);
        }
      });
    }
  };

  const corps = corpActions
    .filter((c) => c.tokenSymbol === symbol)
    .slice(0, 3)
    .map((c) => `${c.type.replace("CORPORATE_ACTION_TYPE_", "")} ${c.status.replace("CORPORATE_ACTION_STATUS_", "")}`);
  const addr = !armed
    ? undefined
    : axiomCoin?.address || (asset ? rhAddress(asset) : onchain?.address_hash);
  const name = !armed
    ? "awaiting query"
    : axiomCoin?.name || asset?.tokenName || onchain?.name || chainHit?.name || "—";
  const logo = !armed ? undefined : axiomCoin?.logo || asset?.logoUrl || onchain?.icon_url || chainHit?.icon_url;

  const searchBox = (
    <div className="chrome-cut" onMouseDown={() => searchRef.current?.focus()}>
      <input
        ref={searchRef}
        type="text"
        value={query}
        placeholder="Name, ticker, or 0x…"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onFocus={() => setOmniOn(true)}
        onBlur={() => setTimeout(() => setOmniOn(false), 80)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOmniOn(true);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && axiomHits[0]) {
            e.preventDefault();
            selectAxiom(axiomHits[0]);
          }
          if (e.key === "Escape") {
            setOmniOn(false);
            searchRef.current?.blur();
          }
        }}
      />
      {omniOn && query.trim() && (
        <div className="omni-drop">
          {axiomHits.length === 0 ? (
            <div className="miss">No matches</div>
          ) : (
            axiomHits.slice(0, 8).map((c) => (
              <button
                key={c.address || c.symbol}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectAxiom(c);
                }}
              >
                {c.logo ? <img src={c.logo} alt="" /> : <span className="ph">{c.symbol.slice(0, 2)}</span>}
                <b>{c.symbol}</b>
                <em>{c.name}</em>
                <span>{fmtUsd(c.priceUsd, c.priceUsd < 1 ? 4 : 2)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );

  const tapeRows = (armed && transfers.length ? transfers : txs).slice(0, 40).map((item, i) => {
    if ("hash" in item) {
      const tx = item as ChainTx;
      return (
        <div
          className="tx click"
          key={tx.hash + i}
          onClick={() => window.open(`${EXPLORER}/tx/${tx.hash}`, "_blank")}
        >
          <span>{tx.timestamp.slice(11, 19)}</span>
          <span className="wallets">
            <button
              title={tx.from.hash}
              onClick={(e) => {
                e.stopPropagation();
                window.open(`${EXPLORER}/address/${tx.from.hash}`, "_blank");
              }}
            >
              {shortAddr(tx.from.hash)}
            </button>
            <i>→</i>
            <button
              title={tx.to?.hash ?? ""}
              onClick={(e) => {
                e.stopPropagation();
                if (tx.to?.hash) window.open(`${EXPLORER}/address/${tx.to.hash}`, "_blank");
              }}
            >
              {shortAddr(tx.to?.hash)}
            </button>
          </span>
          <span className={tx.status === "ok" ? "up" : "dn"}>{tx.status}</span>
        </div>
      );
    }
    const tr = item as TokenTransfer;
    const val = tr.total ? Number(tr.total.value) / 10 ** Number(tr.total.decimals ?? 18) : 0;
    const hash = tr.tx_hash || tr.transaction_hash;
    return (
      <div
        className="tx click"
        key={(hash || i) + String(i)}
        onClick={() => hash && window.open(`${EXPLORER}/tx/${hash}`, "_blank")}
      >
        <span>{tr.timestamp?.slice(11, 19)}</span>
        <span className="wallets">
          <button
            title={tr.from.hash}
            onClick={(e) => {
              e.stopPropagation();
              window.open(`${EXPLORER}/address/${tr.from.hash}`, "_blank");
            }}
          >
            {shortAddr(tr.from.hash)}
          </button>
          <i>→</i>
          <button
            title={tr.to.hash}
            onClick={(e) => {
              e.stopPropagation();
              window.open(`${EXPLORER}/address/${tr.to.hash}`, "_blank");
            }}
          >
            {shortAddr(tr.to.hash)}
          </button>
        </span>
        <span className="up">{fmtQty(val)}</span>
      </div>
    );
  });

  const swapCoin =
    !armed
      ? null
      : axiomCoin && (!addr || axiomCoin.address.toLowerCase() === addr.toLowerCase())
        ? axiomCoin
        : addr
          ? {
              symbol,
              name,
              address: addr,
              pairAddress: axiomCoin?.pairAddress ?? "",
              chainId: "robinhood" as const,
              dex: axiomCoin?.dex ?? "uniswap",
              logo: logo || undefined,
              priceUsd: Number.isFinite(px) ? px : 0,
            }
          : axiomCoin;

  if (compact) {
    return (
      <div className="world compact" onMouseDown={() => armAudio()} onKeyDown={() => armAudio()}>
        <div className="shell lit">
          <header className="deck-bar">
            <div className="deck-brand">
              <span className="deck-word">PART</span>
              <span className="land-star" aria-hidden />
            </div>
            <WalletChip />
          </header>
          <div className="compact-search">{searchBox}</div>
          <div className="compact-token">
            {logo ? <img src={logo} alt="" /> : <div className="ph">{(symbol || "PRT").slice(0, 3)}</div>}
            <div>
              <h1>{armed ? symbol : "PART"}</h1>
              <p>{name}</p>
            </div>
            <div className="px-xl">
              <strong className={chg >= 0 ? "up" : "dn"}>{armed && Number.isFinite(px) ? fmtUsd(px) : "—"}</strong>
              <span className={chg >= 0 ? "up" : "dn"}>
                {armed && Number.isFinite(chg) ? `${chg >= 0 ? "+" : "−"} ${Math.abs(chg).toFixed(2)}%` : "idle"}
              </span>
            </div>
          </div>
          <div className="compact-chart">
            {armed ? (
              <Chart
                pool={axiomCoin?.pairAddress}
                token={addr}
                last={Number.isFinite(px) ? px : undefined}
                bornAt={axiomCoin?.createdAt}
              />
            ) : (
              <div className="await-chart">Search a market</div>
            )}
          </div>
          <HeroIntel
            compact
            armed={armed}
            symbol={symbol}
            stock={Boolean(asset)}
            halt={Boolean(quote?.isTradingHalt)}
            coin={axiomCoin}
            volume={axiomCoin?.volume24h ?? Number(quote?.dailyTradingVolume)}
            liquidity={axiomCoin?.liquidityUsd ?? quote?.liquidityUsd}
            holders={axiomCoin?.holders ?? Number(onchain?.holders_count)}
          />
          <div className="tabs">
            <button className={tab === "STOCKS" ? "on" : ""} onClick={() => setTab("STOCKS")}>
              Stocks
            </button>
            <button className={tab === "PULSE" ? "on" : ""} onClick={() => setTab("PULSE")}>
              Pulse
            </button>
            <button className={tab === "CHAIN" ? "on" : ""} onClick={() => setTab("CHAIN")}>
              Blocks
            </button>
            <button className={tab === "BUBBLE" ? "on" : ""} onClick={() => setTab("BUBBLE")}>
              Map
            </button>
            <button className={tab === "FLOW" ? "on" : ""} onClick={() => setTab("FLOW")}>
              Flow
            </button>
            <button className={tab === "SWAP" ? "on" : ""} onClick={() => setTab("SWAP")}>
              Swap
            </button>
          </div>
          <div className="compact-pane">
            {tab === "PULSE" && <PulseHeat coins={launches} loading={pulseLoading} onPick={pickPulse} />}
            {tab === "STOCKS" && (
              <StocksHeat assets={assets} quotes={quotes} corps={corpActions} onPick={(s) => select(s, "STOCKS")} />
            )}
            {tab === "CHAIN" && (
              <ChainMosaic blocks={blocks} stats={stats} tokens={chainTokens} onPick={(s) => select(s, "CHAIN")} />
            )}
            {tab === "BUBBLE" && (
              <BubbleMap
                token={armed ? addr : undefined}
                pool={armed ? axiomCoin?.pairAddress : undefined}
                symbol={armed ? symbol : undefined}
              />
            )}
            {tab === "FLOW" && (
              <div className="floor-tape">
                <div className="tape-head">
                  <span>time</span>
                  <span>from → to</span>
                  <span>amt</span>
                </div>
                <div className="tape">{tapeRows}</div>
              </div>
            )}
            {tab === "SWAP" && <WalletSwap coin={swapCoin} onLog={log} />}
          </div>
          <footer className="deck-foot">
            <div className="cli">
              <div className="cli-out" ref={outRef}>
                {logs.slice(-1).map((l, i) => (
                  <div key={i} className={l.k ?? ""}>
                    [{l.t}] {l.s}
                  </div>
                ))}
              </div>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="world" onMouseDown={() => armAudio()} onKeyDown={() => armAudio()}>
      <FxLayer />
      <div className={`shell${lit ? " lit" : ""}`}>
        <header className="deck-bar">
          <div className="deck-brand">
            <span className="deck-word">PART</span>
            <span className="land-star" aria-hidden />
          </div>
          <div className="ticker">
            <div className="ticker-track">
              {[...quotes.entries(), ...quotes.entries()].map(([sym, q], i) => {
                const p = mid(q.bid, q.ask);
                const d = q.change24h ?? (Number(q.dailyLow) ? ((p - Number(q.dailyLow)) / Number(q.dailyLow)) * 100 : 0);
                return (
                  <span className="tick" key={`${sym}-${i}`}>
                    <b>{sym}</b>
                    <span>{fmtUsd(p)}</span>
                    <span className={d >= 0 ? "up" : "dn"}>
                      {d >= 0 ? "+" : "−"} {Math.abs(Number(d)).toFixed(2)}%
                    </span>
                    <span>vol {fmtUsd(q.dailyTradingVolume)}</span>
                  </span>
                );
              })}
              {stats && (
                <span className="tick">
                  <b>ETH</b> {fmtUsd(stats.coin_price)} · chain {CHAIN_ID} · blk {fmtInt(blockNo || Number(stats.total_blocks))}
                </span>
              )}
            </div>
          </div>
          <div className="deck-tools">
            <span className="live">
              <i /> Live
            </span>
            <WalletChip />
            {onLeave && (
              <button type="button" className="leave-desk" onClick={onLeave}>
                House
              </button>
            )}
          </div>
        </header>

        <div className="deck">
          <aside className="rail">
            <section className="panel search-panel">
              <div className="hd">
                <span>
                  <b>Search</b> a market
                </span>
                <span>{armed ? symbol : "idle"}</span>
              </div>
              {searchBox}
            </section>

            <section className="panel token-panel">
              <div className="token-head">
                <div className="token-who">
                  {logo ? <img src={logo} alt="" /> : <div className="ph">{(symbol || "PRT").slice(0, 3)}</div>}
                  <div>
                    <h1>{armed ? symbol : "PART"}</h1>
                    <p>
                      {name}
                      {armed && axiomCoin ? ` · ${axiomCoin.dex}` : ""}
                      {quote?.isTradingHalt ? <span className="halt"> · halt</span> : ""}
                    </p>
                  </div>
                </div>
                <div className="px-xl">
                  <strong className={chg >= 0 ? "up" : "dn"}>{armed && Number.isFinite(px) ? fmtUsd(px) : "—"}</strong>
                  <span className={chg >= 0 ? "up" : "dn"}>
                    {armed && Number.isFinite(chg) ? `${chg >= 0 ? "+" : "−"} ${Math.abs(chg).toFixed(2)}% 24h` : "awaiting a pick"}
                  </span>
                </div>
              </div>
            </section>

            <section className="panel intel-panel">
              <div className="intel">
                <div className="kv">
                  <em>delta</em>
                  <b className={chg >= 0 ? "up" : "dn"}>{Number.isFinite(chg) ? `${chg.toFixed(2)}%` : "—"}</b>
                  <small>
                    5m {axiomCoin?.change5m != null ? `${axiomCoin.change5m.toFixed(2)}%` : "—"} · 1h{" "}
                    {(axiomCoin?.change1h ?? quote?.change1h) != null
                      ? `${(axiomCoin?.change1h ?? quote?.change1h)!.toFixed(2)}%`
                      : "—"}
                  </small>
                </div>
                <div className="kv">
                  <em>volume</em>
                  <b>{fmtUsd(axiomCoin?.volume24h ?? quote?.dailyTradingVolume ?? onchain?.volume_24h)}</b>
                  <small>
                    liq {fmtUsd(axiomCoin?.liquidityUsd ?? quote?.liquidityUsd)} · {axiomCoin?.dex || quote?.dex || "—"}
                  </small>
                </div>
                <div className="kv">
                  <em>mcap</em>
                  <b>{fmtUsd(axiomCoin?.mcap ?? quote?.fdv)}</b>
                  <small>holders {axiomCoin?.holders != null ? fmtInt(axiomCoin.holders) : fmtInt(onchain?.holders_count)}</small>
                </div>
                <div className="kv">
                  <em>contract</em>
                  <b
                    onClick={() => {
                      if (axiomCoin) window.open(axiomUrl(axiomCoin), "_blank");
                      else if (addr) window.open(`${EXPLORER}/token/${addr}`, "_blank");
                    }}
                    title={addr}
                  >
                    {shortAddr(addr)}
                  </b>
                  <small>
                    {axiomCoin ? "uniswap · robinhood" : asset ? `mult ${Number(asset.currentMultiplier).toFixed(4)}` : "erc-20"}
                    {corps[0] ? ` · ${corps[0]}` : ""}
                  </small>
                </div>
              </div>
            </section>

            <section className="panel swap-panel">
              <WalletSwap
                coin={
                  !armed
                    ? null
                    : axiomCoin && (!addr || axiomCoin.address.toLowerCase() === addr.toLowerCase())
                      ? axiomCoin
                      : addr
                        ? {
                            symbol,
                            name,
                            address: addr,
                            pairAddress: axiomCoin?.pairAddress ?? "",
                            chainId: "robinhood",
                            dex: axiomCoin?.dex ?? "uniswap",
                            logo: logo || undefined,
                            priceUsd: Number.isFinite(px) ? px : 0,
                          }
                        : axiomCoin
                }
                onLog={log}
              />
            </section>
          </aside>

          <div className="stage">
            <section className="panel chart-panel">
              {armed ? (
                <Chart
                  pool={axiomCoin?.pairAddress}
                  token={addr}
                  last={Number.isFinite(px) ? px : undefined}
                  bornAt={axiomCoin?.createdAt}
                />
              ) : (
                <div className="await-chart">Fable 5.1 is ready. Search a market to open the book</div>
              )}
              <HeroIntel
                armed={armed}
                symbol={symbol}
                stock={Boolean(asset)}
                halt={Boolean(quote?.isTradingHalt)}
                coin={axiomCoin}
                volume={axiomCoin?.volume24h ?? Number(quote?.dailyTradingVolume)}
                liquidity={axiomCoin?.liquidityUsd ?? quote?.liquidityUsd}
                holders={axiomCoin?.holders ?? Number(onchain?.holders_count)}
              />
            </section>

            <section className="panel floor-panel">
              <div className="floor-side">
                <div className="tabs">
                  <button className={tab === "STOCKS" ? "on" : ""} onClick={() => setTab("STOCKS")}>
                    Stocks
                  </button>
                  <button className={tab === "PULSE" ? "on" : ""} onClick={() => setTab("PULSE")}>
                    Pulse
                  </button>
                  <button className={tab === "CHAIN" ? "on" : ""} onClick={() => setTab("CHAIN")}>
                    Blocks
                  </button>
                  <button className={tab === "BUBBLE" ? "on" : ""} onClick={() => setTab("BUBBLE")}>
                    Bubble Map
                  </button>
                </div>
                {tab === "BUBBLE" && (
                  <BubbleMap
                    token={armed ? addr : undefined}
                    pool={armed ? axiomCoin?.pairAddress : undefined}
                    symbol={armed ? symbol : undefined}
                  />
                )}
                {tab === "PULSE" && <PulseHeat coins={launches} loading={pulseLoading} onPick={pickPulse} />}
                {tab === "STOCKS" && (
                  <StocksHeat assets={assets} quotes={quotes} corps={corpActions} onPick={(s) => select(s, "STOCKS")} />
                )}
                {tab === "CHAIN" && (
                  <ChainMosaic blocks={blocks} stats={stats} tokens={chainTokens} onPick={(s) => select(s, "CHAIN")} />
                )}
              </div>
              <div className="floor-tape">
                <div className="hd">
                  <span>
                    <b>Flow</b> wallets
                  </span>
                  <span>open explorer</span>
                </div>
                <div className="tape-head">
                  <span>time</span>
                  <span>from → to</span>
                  <span>amt</span>
                </div>
                <div className="tape">{tapeRows}</div>
              </div>
            </section>
          </div>
        </div>

        <footer className="deck-foot">
          <div className="cli">
            <div className="cli-out" ref={outRef}>
              {logs.slice(-1).map((l, i) => (
                <div key={i} className={l.k ?? ""}>
                  [{l.t}] {l.s}
                </div>
              ))}
            </div>
          </div>
          <div className="status">
            <span>
              {res.w}×{res.h} · {addr ? shortAddr(addr) : "no address"}
            </span>
            <span>
              Fable 5.1 · fastest · most accurate · gas{" "}
              {stats ? `${stats.gas_prices.slow}/${stats.gas_prices.average}/${stats.gas_prices.fast}` : "—"}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
