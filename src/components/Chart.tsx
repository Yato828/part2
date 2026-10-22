import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  CANDLE_IVS,
  IV_MS,
  loadCandleResult,
  normalizeCandles,
  type Candle,
  type Interval,
} from "../lib/axiom";
import { chartPrecision, chartPrice } from "../lib/chartFormat";
import { errorMessage } from "../lib/validation";
import { fmtQty } from "../lib/format";
import { THEME, usePreferences } from "../features/preferences/preferences";
import { requestScenario } from "../features/astra/scenarioClient";
import type { ChartScenario } from "../features/astra/scenario";
import {
  canUpdateTail,
  mergeSourceCandles,
  observeSpot,
  withSpotCandle,
  type SpotCandle,
} from "../lib/liveCandles";
import {
  subscribePoolSpot,
  type SpotTick,
  type StreamStatus,
} from "../lib/poolStream";
const tint = (hex: string) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},0.35)`;
export function Chart({
  pool,
  token,
  symbol = "",
  priceUsd = 0,
  mcap,
  onSpot,
}: {
  pool: string;
  token: string;
  symbol?: string;
  priceUsd?: number;
  mcap?: number;
  onSpot?: (tick: SpotTick | null) => void;
}) {
  const { preferences: p, update } = usePreferences();
  const [iv, setIv] = useState<Interval>(p.defaultInterval),
    [mode, setMode] = useState<"price" | "mcap">("price");
  const [log, setLog] = useState(false),
    [expanded, setExpanded] = useState(false),
    [bars, setBars] = useState<Candle[]>([]),
    [hover, setHover] = useState<Candle | null>(null);
  const [error, setError] = useState(""),
    [historyNote, setHistoryNote] = useState(""),
    [busy, setBusy] = useState(true),
    [paging, setPaging] = useState(false),
    [retry, setRetry] = useState(0),
    [source, setSource] = useState(""),
    [at, setAt] = useState(0),
    [now, setNow] = useState(Date.now());
  const [scenario, setScenario] = useState<ChartScenario | null>(null),
    [scenarioBusy, setScenarioBusy] = useState(false),
    [scenarioError, setScenarioError] = useState("");
  const [tick, setTick] = useState<SpotTick | null>(null),
    [spot, setSpot] = useState<SpotCandle | null>(null),
    [feed, setFeed] = useState<StreamStatus | null>(null),
    [reconnect, setReconnect] = useState(0);
  const spotRef = useRef<SpotCandle | null>(null);
  const visibleBars = useMemo(() => withSpotCandle(bars, spot), [bars, spot]);
  const container = useRef<HTMLDivElement>(null),
    chart = useRef<IChartApi | null>(null),
    series = useRef<ISeriesApi<"Candlestick"> | null>(null),
    volume = useRef<ISeriesApi<"Histogram"> | null>(null),
    projection = useRef<ISeriesApi<"Line"> | null>(null);
  const barsRef = useRef<Candle[]>([]),
    drawn = useRef<{ bars: Candle[]; multiplier: number; colors: string }>({
      bars: [],
      multiplier: 1,
      colors: "",
    }),
    firstDraw = useRef(true),
    programmaticView = useRef(false),
    viewFrame = useRef(0),
    pageLock = useRef(false),
    generation = useRef(0),
    page = useRef<() => void>(() => {}),
    scenarioAbort = useRef<AbortController | null>(null),
    refreshVersion = useRef(-1);
  barsRef.current = visibleBars;
  const multiplier =
    mode === "mcap" && mcap && priceUsd > 0 ? mcap / priceUsd : 1;
  const theme = THEME[p.theme];
  const changeView = (action: () => void) => {
    programmaticView.current = true;
    cancelAnimationFrame(viewFrame.current);
    action();
    viewFrame.current = requestAnimationFrame(() => {
      programmaticView.current = false;
    });
  };
  const recentView = () => {
    const length = barsRef.current.length;
    if (length)
      changeView(() =>
        chart.current?.timeScale().setVisibleLogicalRange({
          from: Math.max(0, length - p.visibleCandles),
          to: length + (scenario ? p.scenarioSteps + 2 : 5),
        }),
      );
  };
  useEffect(() => {
    if (!container.current) return;
    const api = createChart(container.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.muted,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: theme.edge },
        horzLines: { color: theme.edge },
      },
      rightPriceScale: {
        borderColor: theme.edge,
        scaleMargins: { top: 0.08, bottom: 0.23 },
      },
      timeScale: {
        borderColor: theme.edge,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        shiftVisibleRangeOnNewBar: p.followLatest,
      },
      localization: { locale: "en-US" },
    });
    const candles = api.addSeries(CandlestickSeries, {
      upColor: p.upColor,
      downColor: p.downColor,
      borderUpColor: p.upColor,
      borderDownColor: p.downColor,
      wickUpColor: p.upColor,
      wickDownColor: p.downColor,
    });
    const vols = api.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    vols
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
    const path = api.addSeries(LineSeries, {
      color: "#a78bfa",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      title: "AI scenario · hypothetical",
    });
    chart.current = api;
    series.current = candles;
    volume.current = vols;
    projection.current = path;
    api.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setHover(null);
        return;
      }
      setHover(
        barsRef.current.find((b) => b.t === Number(param.time) * 1000) ?? null,
      );
    });
    api.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (
        range &&
        range.from < 2 &&
        !firstDraw.current &&
        !programmaticView.current
      )
        page.current();
    });
    return () => {
      api.remove();
      chart.current = null;
      series.current = null;
      volume.current = null;
      projection.current = null;
      scenarioAbort.current?.abort();
      cancelAnimationFrame(viewFrame.current);
    };
  }, []);
  useEffect(() => {
    const api = chart.current;
    if (!api) return;
    api.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.muted,
        fontSize: p.textSize === "large" ? 12 : 11,
      },
      grid: {
        vertLines: { color: theme.edge, visible: p.showGrid },
        horzLines: { color: theme.edge, visible: p.showGrid },
      },
      rightPriceScale: {
        borderColor: theme.edge,
        scaleMargins: { top: 0.08, bottom: p.showVolume ? 0.23 : 0.07 },
      },
      timeScale: {
        borderColor: theme.edge,
        shiftVisibleRangeOnNewBar: p.followLatest,
      },
      crosshair: {
        mode: p.showCrosshair ? CrosshairMode.Normal : CrosshairMode.Hidden,
        vertLine: { color: theme.muted, visible: p.showCrosshair },
        horzLine: { color: theme.muted, visible: p.showCrosshair },
      },
    });
    series.current?.applyOptions({
      upColor: p.hollowCandles ? theme.background : p.upColor,
      downColor: p.downColor,
      borderUpColor: p.upColor,
      borderDownColor: p.downColor,
      wickUpColor: p.upColor,
      wickDownColor: p.downColor,
    });
    volume.current?.applyOptions({ visible: p.showVolume });
  }, [
    p.theme,
    p.upColor,
    p.downColor,
    p.showVolume,
    p.showGrid,
    p.showCrosshair,
    p.hollowCandles,
    p.followLatest,
    p.textSize,
  ]);
  useEffect(() => {
    generation.current++;
    pageLock.current = false;
    firstDraw.current = true;
    drawn.current = { bars: [], multiplier: 1, colors: "" };
    barsRef.current = [];
    setBars([]);
    setHover(null);
    setSource("");
    setAt(0);
    setHistoryNote("");
    setError("");
    setBusy(true);
    setPaging(false);
  }, [pool, token, iv]);
  useEffect(() => {
    spotRef.current = null;
    setSpot(null);
    setTick(null);
    onSpot?.(null);
  }, [pool, token, iv, p.streamPrices, p.streamCommitment, p.streamEndpoint]);
  useEffect(() => {
    let stop: (() => void) | undefined,
      disposed = false,
      frame = 0;
    let latest: SpotTick | null = null;
    const connect = () => {
      stop?.();
      stop = undefined;
      if (disposed || !p.liveUpdates || !p.streamPrices || document.hidden)
        return;
      setFeed(null);
      stop = subscribePoolSpot({
        pool,
        mint: token,
        commitment: p.streamCommitment,
        endpoint: p.streamEndpoint,
        onStatus: (next) => {
          setFeed(next);
          if (next.state === "reconnecting") {
            spotRef.current = null;
            setSpot(null);
            setTick(null);
          }
        },
        onTick: (next) => {
          if (disposed) return;
          latest = next;
          spotRef.current = observeSpot(
            spotRef.current,
            next.price,
            next.receivedAt,
            IV_MS[iv],
          );
          if (!frame)
            frame = requestAnimationFrame(() => {
              frame = 0;
              if (disposed) return;
              setSpot(spotRef.current);
              setTick(latest);
            });
        },
      });
    };
    const visibility = () => {
      if (document.hidden) {
        stop?.();
        stop = undefined;
        setFeed(null);
      } else connect();
    };
    connect();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      stop?.();
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      onSpot?.(null);
    };
  }, [
    pool,
    token,
    iv,
    p.liveUpdates,
    p.streamPrices,
    p.streamCommitment,
    p.streamEndpoint,
    reconnect,
    onSpot,
  ]);
  const spotFresh = !!tick && now - tick.receivedAt < 15000;
  useEffect(() => {
    onSpot?.(
      p.liveUpdates && feed?.state === "live" && spotFresh ? tick : null,
    );
  }, [tick, feed?.state, p.liveUpdates, spotFresh, onSpot]);
  useEffect(() => {
    let stopped = false,
      inFlight = false,
      failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      if (stopped || inFlight) return;
      if (document.hidden) {
        if (p.liveUpdates) timer = setTimeout(run, p.refreshSeconds * 1000);
        return;
      }
      inFlight = true;
      try {
        const result = await loadCandleResult(
          pool,
          iv,
          token,
          undefined,
          0,
          retry ? 0 : p.refreshSeconds * 1000 - 100,
        );
        if (!stopped) {
          setBars((old) => mergeSourceCandles(old, result.bars));
          setSource(result.source);
          setAt(result.fetchedAt);
          setError("");
          failures = 0;
        }
      } catch (e) {
        if (!stopped) {
          setError(errorMessage(e));
          failures++;
        }
      } finally {
        inFlight = false;
        if (!stopped) {
          setBusy(false);
          if (p.liveUpdates)
            timer = setTimeout(
              run,
              failures
                ? Math.min(
                    60000,
                    Math.max(15000, p.refreshSeconds * 1000) * failures,
                  )
                : p.refreshSeconds * 1000,
            );
        }
      }
    };
    const resume = () => {
      if (!document.hidden && p.liveUpdates) {
        clearTimeout(timer);
        void run();
      }
    };
    const manual = refreshVersion.current !== retry;
    refreshVersion.current = retry;
    if (p.liveUpdates || !barsRef.current.length || manual) void run();
    document.addEventListener("visibilitychange", resume);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [pool, token, iv, retry, p.liveUpdates, p.refreshSeconds]);
  useEffect(() => {
    const candles = series.current,
      vols = volume.current;
    if (!candles || !vols) return;
    const precision = chartPrecision(
      (visibleBars.at(-1)?.c ?? priceUsd) * multiplier,
    );
    candles.applyOptions({
      priceFormat: {
        type: "custom",
        minMove: 10 ** -precision,
        formatter: (n: number) => chartPrice(n, precision),
      },
    });
    const candle = (b: Candle) => ({
      time: Math.floor(b.t / 1000) as UTCTimestamp,
      open: b.o * multiplier,
      high: b.h * multiplier,
      low: b.l * multiplier,
      close: b.c * multiplier,
    });
    const vol = (b: Candle) => ({
      time: Math.floor(b.t / 1000) as UTCTimestamp,
      value: b.v,
      color: tint(b.c >= b.o ? p.upColor : p.downColor),
    });
    const colors = `${p.upColor}:${p.downColor}`;
    const previous = drawn.current;
    if (
      previous.multiplier === multiplier &&
      previous.colors === colors &&
      canUpdateTail(previous.bars, visibleBars)
    ) {
      for (const b of visibleBars.slice(
        Math.max(0, previous.bars.length - 1),
      )) {
        candles.update(candle(b));
        vols.update(vol(b));
      }
    } else {
      candles.setData(
        visibleBars.map(candle) as CandlestickData<UTCTimestamp>[],
      );
      vols.setData(visibleBars.map(vol));
    }
    drawn.current = { bars: visibleBars, multiplier, colors };
    if (visibleBars.length && firstDraw.current) {
      recentView();
      firstDraw.current = false;
    }
  }, [visibleBars, multiplier, p.upColor, p.downColor]);
  useEffect(() => {
    chart.current?.priceScale("right").applyOptions({
      mode: log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
  }, [log]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", key);
    const t = setInterval(
      () => setNow(Date.now()),
      p.streamPrices ? 100 : 1000,
    );
    return () => {
      window.removeEventListener("keydown", key);
      clearInterval(t);
    };
  }, [p.streamPrices]);
  useEffect(() => {
    scenarioAbort.current?.abort();
    setScenario(null);
    setScenarioError("");
    setScenarioBusy(false);
  }, [token, pool, iv, p.aiScenario, p.scenarioSteps]);
  const scenarioEnded =
    !!scenario && !!bars.length && bars.at(-1)!.t >= scenario.points.at(-1)!.t;
  useEffect(() => {
    changeView(() =>
      projection.current?.setData(
        p.aiScenario && scenario && !scenarioEnded
          ? [
              {
                time: (scenario.anchor.t / 1000) as UTCTimestamp,
                value: scenario.anchor.price * multiplier,
              },
              ...scenario.points.map((pt) => ({
                time: (pt.t / 1000) as UTCTimestamp,
                value: pt.price * multiplier,
              })),
            ]
          : [],
      ),
    );
  }, [scenario, p.aiScenario, scenarioEnded, multiplier]);
  page.current = async () => {
    if (pageLock.current || busy || !barsRef.current.length) return;
    pageLock.current = true;
    setPaging(true);
    const version = generation.current,
      first = barsRef.current[0].t;
    try {
      const result = await loadCandleResult(pool, iv, token, first - 1);
      if (version !== generation.current) return;
      const older = result.bars.filter((b) => b.t < first);
      if (!older.length)
        setHistoryNote("No earlier history returned by connected sources.");
      else {
        const range = chart.current?.timeScale().getVisibleLogicalRange();
        setBars((old) => normalizeCandles([...older, ...old]));
        if (range)
          requestAnimationFrame(() =>
            changeView(() =>
              chart.current?.timeScale().setVisibleLogicalRange({
                from: range.from + older.length,
                to: range.to + older.length,
              }),
            ),
          );
      }
    } catch (e) {
      if (version === generation.current) setHistoryNote(errorMessage(e));
    } finally {
      if (version === generation.current) {
        pageLock.current = false;
        setPaging(false);
      }
    }
  };
  const generate = async () => {
    const ac = new AbortController();
    scenarioAbort.current?.abort();
    scenarioAbort.current = ac;
    setScenarioBusy(true);
    setScenarioError("");
    try {
      const result = await requestScenario(
        {
          chainId: "solana",
          mint: token,
          pool,
          interval: iv,
          steps: p.scenarioSteps,
        },
        ac.signal,
      );
      if (!ac.signal.aborted) {
        setScenario(result);
        changeView(() =>
          chart.current?.timeScale().setVisibleLogicalRange({
            from: Math.max(0, barsRef.current.length - p.visibleCandles),
            to: barsRef.current.length + p.scenarioSteps + 3,
          }),
        );
      }
    } catch (e) {
      if (!ac.signal.aborted) setScenarioError(errorMessage(e));
    } finally {
      if (!ac.signal.aborted) setScenarioBusy(false);
    }
  };
  const shown =
      (hover && visibleBars.find((b) => b.t === hover.t)) ?? visibleBars.at(-1),
    stale =
      !!error ||
      (p.liveUpdates &&
        at > 0 &&
        now - at > Math.max(30000, p.refreshSeconds * 3000));
  return (
    <div
      className={`sol-chart${expanded ? " expanded" : ""}`}
      data-candle-count={bars.length}
      data-last-candle={bars.at(-1)?.t ?? ""}
      data-last-close={bars.at(-1)?.c ?? ""}
      data-live-price={tick?.price ?? ""}
      data-live-received-at={tick?.receivedAt ?? ""}
      data-live-slot={tick?.slot ?? ""}
      data-rendered-close={visibleBars.at(-1)?.c ?? ""}
    >
      <div className="chart-toolbar">
        <div className="chart-intervals">
          {CANDLE_IVS.map((value) => (
            <button
              key={value}
              className={iv === value ? "selected" : ""}
              onClick={() => setIv(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="chart-options">
          <button
            className={mode === "price" ? "selected" : ""}
            onClick={() => setMode("price")}
          >
            Price
          </button>
          <button
            disabled={!mcap || priceUsd <= 0}
            className={mode === "mcap" ? "selected" : ""}
            onClick={() => setMode("mcap")}
          >
            MCap est.
          </button>
          <button aria-pressed={log} onClick={() => setLog((v) => !v)}>
            Log
          </button>
          <button onClick={recentView}>Latest</button>
          <button
            title="Fit all loaded history"
            onClick={() =>
              changeView(() => chart.current?.timeScale().fitContent())
            }
          >
            Fit
          </button>
          <button
            aria-label={expanded ? "Restore chart" : "Expand chart"}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "↙" : "↗"}
          </button>
        </div>
      </div>
      <div className="chart-legend">
        <b>
          {symbol} / {mode === "mcap" ? "MCap est. USD" : "USD"}
        </b>
        {shown && (
          <span className="candle-key">
            <span>O {chartPrice(shown.o * multiplier)}</span>
            <span>H {chartPrice(shown.h * multiplier)}</span>
            <span>L {chartPrice(shown.l * multiplier)}</span>
            <span className={shown.c >= shown.o ? "up" : "dn"}>
              C {chartPrice(shown.c * multiplier)}
            </span>
            {p.showVolume && (
              <span>
                {spot?.t === shown.t && !bars.some((b) => b.t === shown.t)
                  ? "V pending source"
                  : `V ${fmtQty(shown.v)} USD`}
              </span>
            )}
          </span>
        )}
        <button
          className={`live-indicator ${stale && !(feed?.state === "live" && spotFresh) ? "delayed" : ""}`}
          aria-pressed={p.liveUpdates}
          onClick={() => update({ liveUpdates: !p.liveUpdates })}
          title="Pause or resume the live pool feed and source candle updates"
        >
          {!p.liveUpdates
            ? "Paused"
            : p.streamPrices && feed?.state === "live" && spotFresh
              ? `LIVE · ${p.streamCommitment}`
              : p.streamPrices && feed?.state !== "unsupported"
                ? "Waiting · WSS"
                : `${stale ? "Delayed" : "Auto"} · ${p.refreshSeconds}s`}
        </button>
      </div>
      <div className="chart-frame">
        <div
          className="chart-surface chart-native"
          ref={container}
          aria-label={`${symbol} candlestick and volume chart`}
        />
        {!bars.length && (
          <div className="chart-state" role="status">
            <b>
              {busy
                ? "Connecting to candle source…"
                : "Candle data unavailable"}
            </b>
            <span>
              {busy
                ? "Real source candles will appear here."
                : error || "No historical candles returned."}
            </span>
            {!busy && (
              <button onClick={() => setRetry((n) => n + 1)}>
                Retry candle source
              </button>
            )}
          </div>
        )}
      </div>
      {p.streamPrices && (
        <div
          className={`spot-feed ${feed?.state === "live" && tick && now - tick.receivedAt < 15000 ? "receiving" : ""}`}
          role="status"
        >
          <div>
            <b>
              {!p.liveUpdates
                ? "Feed paused"
                : feed?.state === "live" && tick
                  ? now - tick.receivedAt < 15000
                    ? "Streaming pool spot"
                    : "Waiting for fresh spot"
                  : feed?.state === "unsupported"
                    ? "Source candles only"
                    : "Connecting pool feed"}
            </b>
            <span>
              {tick
                ? `≈ ${chartPrice(tick.price)} · ${Math.max(0, now - tick.receivedAt)} ms since receipt · slot ${tick.slot.toLocaleString()} · ${tick.commitment}`
                : (feed?.message ?? "Opening read-only WebSocket…")}
            </span>
            <small>
              {feed?.provider ?? "Solana mainnet"}
              {tick ? ` · ${tick.kind} · ${tick.quote}` : ""}
            </small>
          </div>
          <button
            aria-label="Reconnect live feed"
            onClick={() => setReconnect((n) => n + 1)}
            disabled={!p.liveUpdates}
          >
            Reconnect
          </button>
        </div>
      )}
      {error && bars.length > 0 && (
        <p className="data-note" role="alert">
          Stale candles · {error}
        </p>
      )}
      <div className="chart-bottom">
        <span>
          {source || "Waiting for source"} ·{" "}
          {at ? new Date(at).toISOString() : "No data"}
        </span>
        <div>
          <button
            onClick={() => {
              setHistoryNote("");
              if (!p.liveUpdates) {
                spotRef.current = null;
                setSpot(null);
                setTick(null);
              }
              setRetry((n) => n + 1);
            }}
          >
            Refresh
          </button>
          <button
            disabled={paging || busy || !bars.length}
            onClick={() => {
              setHistoryNote("");
              pageLock.current = false;
              void page.current();
            }}
          >
            {paging ? "Loading…" : "Older history"}
          </button>
          <a
            href={`https://dexscreener.com/solana/${pool}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Pool ↗
          </a>
        </div>
      </div>
      {historyNote && (
        <p className="data-note" role="status">
          {historyNote}
        </p>
      )}
      {p.aiScenario && (
        <div className="chart-scenario">
          <div>
            <b>
              <i /> Astra scenario <small>HYPOTHETICAL</small>
            </b>
            <span>
              One possible path over {p.scenarioSteps} intervals. Unvalidated
              illustration, not a trading signal.
            </span>
          </div>
          <div className="scenario-actions">
            <button
              disabled={scenarioBusy || bars.length < 20}
              title={
                bars.length < 20
                  ? "At least 20 real source candles are required"
                  : "Request one hypothetical path from Astra"
              }
              onClick={() => void generate()}
            >
              {scenarioBusy
                ? "Astra is drawing…"
                : scenario
                  ? "Regenerate scenario"
                  : "Generate scenario"}
            </button>
            {scenarioBusy && (
              <button
                onClick={() => {
                  scenarioAbort.current?.abort();
                  setScenarioBusy(false);
                }}
              >
                Stop scenario
              </button>
            )}
            {scenario && (
              <button onClick={() => setScenario(null)}>Clear scenario</button>
            )}
          </div>
          {scenarioError && <p role="alert">{scenarioError}</p>}
          {scenario && (
            <div className="scenario-detail">
              <p>
                {scenarioEnded
                  ? "This scenario horizon has ended; the path is hidden. "
                  : ""}
                {scenario.explanation}
              </p>
              <small>
                {scenario.model} · {scenario.source} · generated{" "}
                {new Date(scenario.generatedAt).toISOString()} · anchor{" "}
                {new Date(scenario.anchor.t).toISOString()}. Actual candles keep
                updating independently.
              </small>
              <details>
                <summary>Assumptions & limits</summary>
                <ul>
                  {scenario.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </div>
      )}
      <p className="chart-help">
        Drag to pan · scroll to zoom · OHLC in UTC.{" "}
        {p.liveUpdates
          ? `Source candles update automatically every ${p.refreshSeconds}s; provider delays may apply.`
          : "Auto updates paused."}{" "}
        {mode === "mcap"
          ? "Historical market cap estimates use current implied supply; supply changes are not reconstructed."
          : "Historical candles from source; gaps are not filled."}{" "}
        {p.streamPrices &&
          "Live candle overlay uses observed pool spot at browser receipt time, not executed trade OHLC. Processed state may roll back. Volume comes only from the historical source. "}
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          TradingView Lightweight Charts
        </a>
      </p>
    </div>
  );
}
