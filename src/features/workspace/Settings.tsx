import { useEffect, useState, type ReactNode } from "react";
import { astraStatus } from "../astra/client";
import type { AstraStatus } from "../astra/types";
import { errorMessage } from "../../lib/validation";
import { CANDLE_IVS } from "../../lib/axiom";
import {
  DEFAULT_PREFERENCES,
  usePreferences,
  type Preferences,
} from "../preferences/preferences";
import { validStreamUrl } from "../../lib/poolStream";
import { isExtension } from "../../lib/env";
function SettingRow({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <b>{title}</b>
        <p>{detail}</p>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}
export default function Settings({
  reset,
  collapsed,
  toggleNav,
}: {
  reset: () => void;
  collapsed: boolean;
  toggleNav: () => void;
}) {
  const {
    preferences: p,
    update,
    reset: resetPreferences,
    storageError,
  } = usePreferences();
  const [section, setSection] = useState("appearance");
  const [streamUrl, setStreamUrl] = useState(p.streamEndpoint);
  useEffect(() => setStreamUrl(p.streamEndpoint), [p.streamEndpoint]);
  const [status, setStatus] = useState<AstraStatus | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [at, setAt] = useState(0),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const ac = new AbortController();
    setError("");
    const timer = setTimeout(() => {
      void astraStatus(ac.signal)
        .then((s) => {
          setStatus(s);
          setAt(Date.now());
        })
        .catch((e) => {
          if (!ac.signal.aborted) setError(errorMessage(e));
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [retry, p.astraBackend]);
  const toggle = (key: keyof Preferences, label: string) => (
    <input
      className="settings-switch"
      aria-label={label}
      type="checkbox"
      role="switch"
      checked={p[key] === true}
      onChange={(e) => update({ [key]: e.target.checked })}
    />
  );
  return (
    <section className="tool-page settings-page">
      <header className="tool-heading">
        <div>
          <small>SETTINGS / SOLANA MAINNET</small>
          <h1>Your desk. Your layout.</h1>
          <p>
            Make the workspace comfortable for the way you trade. Changes apply
            immediately and save in this browser.
          </p>
        </div>
        <button
          onClick={() => {
            resetPreferences();
            setNotice("Appearance, chart and feature preferences restored.");
          }}
        >
          Restore defaults
        </button>
      </header>
      <div
        className="settings-sections"
        role="tablist"
        aria-label="Settings sections"
      >
        {[
          ["appearance", "Appearance"],
          ["chart", "Chart & live data"],
          ["features", "Features & Astra"],
          ["connections", "Connections"],
          ["data", "Layout & data"],
        ].map(([id, title]) => (
          <button
            key={id}
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
          >
            {title}
          </button>
        ))}
      </div>
      {section === "appearance" && (
        <div className="settings-section">
          <h2>Make it yours</h2>
          <p className="settings-intro">
            Choose a quiet background and clear accents. Trading colors stay
            independent of the interface theme.
          </p>
          <div className="theme-presets">
            {[
              ["midnight", "Midnight", "#0b1018"],
              ["graphite", "Graphite", "#1b1f24"],
              ["black", "Black", "#090909"],
            ].map(([value, label, color]) => (
              <button
                key={value}
                aria-pressed={p.theme === value}
                onClick={() => update({ theme: value as Preferences["theme"] })}
              >
                <span style={{ background: color }}>
                  <i />
                  <i />
                  <i />
                </span>
                <b>{label}</b>
                <small>{p.theme === value ? "Selected" : "Use theme"}</small>
              </button>
            ))}
          </div>
          <SettingRow
            title="Interface accent"
            detail="Selected tabs, focus outlines and primary controls."
          >
            <div className="color-options">
              {["#77bdfb", "#72d6b0", "#c4a2ff", "#f0bd75", "#eeeeee"].map(
                (color) => (
                  <button
                    key={color}
                    title={color}
                    aria-label={`Accent ${color}`}
                    aria-pressed={p.accent === color}
                    style={{ background: color }}
                    onClick={() => update({ accent: color })}
                  />
                ),
              )}
              <input
                aria-label="Custom accent color"
                type="color"
                value={p.accent}
                onChange={(e) => update({ accent: e.target.value })}
              />
            </div>
          </SettingRow>
          <SettingRow
            title="Spacing"
            detail="Comfortable gives controls more room. Compact fits more information."
          >
            <select
              aria-label="Interface density"
              value={p.density}
              onChange={(e) =>
                update({ density: e.target.value as Preferences["density"] })
              }
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </SettingRow>
          <SettingRow
            title="Text size"
            detail="Increase text and control sizes throughout the workspace."
          >
            <select
              aria-label="Interface text size"
              value={p.textSize}
              onChange={(e) =>
                update({ textSize: e.target.value as Preferences["textSize"] })
              }
            >
              <option value="normal">Standard</option>
              <option value="large">Large</option>
            </select>
          </SettingRow>
          <SettingRow
            title="Navigation labels"
            detail="Show readable group names and tools in the sidebar."
          >
            <button onClick={toggleNav}>
              {collapsed
                ? "Expand navigation labels"
                : "Collapse navigation labels"}
            </button>
          </SettingRow>
          <SettingRow
            title="Token artwork"
            detail="Keep original token logos; turn off to use grayscale artwork."
          >
            {toggle("tokenArtwork", "Show original token artwork")}
          </SettingRow>
          <SettingRow
            title="Reduced motion"
            detail="Stop decorative animation and smooth scrolling in the terminal."
          >
            {toggle("reducedMotion", "Reduce interface motion")}
          </SettingRow>
          <div className="appearance-preview">
            <span>WORKSPACE PREVIEW</span>
            <b>
              SOL / USD <em>+2.48%</em>
            </b>
            <div
              className="preview-candles"
              aria-label="Illustrative appearance preview"
            >
              {[30, 50, 42, 65, 56, 80, 68, 100].map((height, i) => (
                <i
                  key={i}
                  style={{
                    height,
                    background: i % 3 === 1 ? p.downColor : p.upColor,
                    color: i % 3 === 1 ? p.downColor : p.upColor,
                  }}
                />
              ))}
            </div>
            <small>
              Illustration of your selected colors; not market data.
            </small>
          </div>
        </div>
      )}
      {section === "chart" && (
        <div className="settings-section">
          <h2>Candles & live updates</h2>
          <SettingRow
            title="WebSocket pool prices"
            detail="Receive on-chain pool spot changes as events, without waiting for the candle refresh timer. Supported: Orca Whirlpools, Raydium CLMM and Meteora DLMM; other pools keep source candle updates."
          >
            {toggle("streamPrices", "Stream live pool prices")}
          </SettingRow>
          <SettingRow
            title="Speed / confirmation"
            detail="Processed is the earliest node observation and may roll back. Confirmed waits for network confirmation. Neither mode guarantees millisecond delivery or trade priority."
          >
            <select
              aria-label="Live feed commitment"
              value={p.streamCommitment}
              onChange={(e) =>
                update({
                  streamCommitment: e.target
                    .value as Preferences["streamCommitment"],
                })
              }
            >
              <option value="processed">Fast · processed</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </SettingRow>
          <SettingRow
            title="Rising candles"
            detail="Close above open. Candle bodies, borders, wicks and volume use this color."
          >
            <input
              aria-label="Rising candle color"
              type="color"
              value={p.upColor}
              onChange={(e) => update({ upColor: e.target.value })}
            />
          </SettingRow>
          <SettingRow
            title="Falling candles"
            detail="Close below open. Independent from the interface accent."
          >
            <input
              aria-label="Falling candle color"
              type="color"
              value={p.downColor}
              onChange={(e) => update({ downColor: e.target.value })}
            />
          </SettingRow>
          <SettingRow
            title="Candle palette"
            detail="Restore standard green/red or use an accessible blue/orange pair."
          >
            <div className="tool-actions">
              <button
                onClick={() =>
                  update({
                    upColor: DEFAULT_PREFERENCES.upColor,
                    downColor: DEFAULT_PREFERENCES.downColor,
                  })
                }
              >
                Green / red
              </button>
              <button
                onClick={() =>
                  update({ upColor: "#60a5fa", downColor: "#fb923c" })
                }
              >
                Blue / orange
              </button>
            </div>
          </SettingRow>
          <SettingRow
            title="Automatic updates"
            detail="Run the price stream and reconcile source candles. Pause freezes both feeds."
          >
            {toggle("liveUpdates", "Automatically update candles")}
          </SettingRow>
          <SettingRow
            title="Historical candle refresh"
            detail="Reconcile indexed OHLCV and volume. Live WebSocket prices arrive independently of this interval. Public source limits still apply."
          >
            <select
              aria-label="Candle refresh interval"
              value={p.refreshSeconds}
              onChange={(e) =>
                update({
                  refreshSeconds: Number(
                    e.target.value,
                  ) as Preferences["refreshSeconds"],
                })
              }
            >
              {[5, 10, 15, 30].map((n) => (
                <option key={n} value={n}>
                  Every {n} seconds
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow
            title="Default timeframe"
            detail="Used when a new token chart opens."
          >
            <select
              aria-label="Default chart interval"
              value={p.defaultInterval}
              onChange={(e) =>
                update({
                  defaultInterval: e.target
                    .value as Preferences["defaultInterval"],
                })
              }
            >
              {CANDLE_IVS.map((iv) => (
                <option key={iv}>{iv}</option>
              ))}
            </select>
          </SettingRow>
          <SettingRow
            title="Candles in view"
            detail="Start with a readable recent window. Pan left or load older history for more."
          >
            <select
              aria-label="Visible candle count"
              value={p.visibleCandles}
              onChange={(e) =>
                update({
                  visibleCandles: Number(
                    e.target.value,
                  ) as Preferences["visibleCandles"],
                })
              }
            >
              {[80, 120, 200].map((n) => (
                <option key={n} value={n}>
                  {n} candles
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow
            title="Follow the latest candle"
            detail="New bars stay in view when you are at the live edge. Panning into history keeps your position."
          >
            {toggle("followLatest", "Follow latest candles")}
          </SettingRow>
          {(
            [
              [
                "showVolume",
                "Volume",
                "Show source trading volume below candles.",
              ],
              [
                "showGrid",
                "Chart grid",
                "Display horizontal and vertical reference lines.",
              ],
              [
                "showCrosshair",
                "Crosshair",
                "Inspect time, price and OHLC by moving over the chart.",
              ],
              [
                "hollowCandles",
                "Hollow rising candles",
                "Use an outlined body for rising candles.",
              ],
              [
                "showMetrics",
                "Token statistics",
                "Show market cap, liquidity and volume in the token header.",
              ],
            ] as const
          ).map(([key, title, detail]) => (
            <SettingRow key={key} title={title} detail={detail}>
              {toggle(key, title)}
            </SettingRow>
          ))}
        </div>
      )}
      {section === "features" && (
        <div className="settings-section">
          <h2>Enable the tools you use</h2>
          <SettingRow
            title="Astra chart scenarios"
            detail="Adds an optional AI-drawn hypothetical path to the chart. You choose when to generate it; enabling this never sends a paid request automatically."
          >
            {toggle("aiScenario", "Enable Astra chart scenarios")}
          </SettingRow>
          <SettingRow
            title="Scenario horizon"
            detail="How many future chart intervals the generated illustration covers."
          >
            <select
              aria-label="Astra scenario horizon"
              value={p.scenarioSteps}
              onChange={(e) =>
                update({ scenarioSteps: Number(e.target.value) as 6 | 12 })
              }
            >
              <option value={6}>6 candles</option>
              <option value={12}>12 candles</option>
            </select>
          </SettingRow>
          <div className="scenario-explainer">
            <b>Possible path, not a price forecast</b>
            <p>
              Astra receives a verified source snapshot and proposes one
              illustrative scenario. It has no validated predictive accuracy,
              success rate or trading signal. Actual market candles remain
              separate. Generate requests use your configured billed API.
            </p>
          </div>
          <SettingRow
            title="Trade tape"
            detail="Make the Flow panel available for the selected pool."
          >
            {toggle("tradeFeed", "Enable trade tape")}
          </SettingRow>
          <SettingRow
            title="Holder research"
            detail="Enable Token X-Ray and Bubble Map. Sample coverage and missing-data states remain visible."
          >
            {toggle("holderTools", "Enable holder research")}
          </SettingRow>
          <SettingRow
            title="Creation tools"
            detail="Enable Launchpad drafts, Tweet to Token and Website Builder. Live deployment stays disabled."
          >
            {toggle("creationTools", "Enable creation tools")}
          </SettingRow>
        </div>
      )}
      {section === "connections" && (
        <div className="settings-section">
          <h2>Data & assistant connections</h2>
          {isExtension() && (
            <SettingRow
              title="Astra backend"
              detail="Hosted uses the deployed PART API. Local uses http://localhost:4664 while npm run dev is running. The server must allow this installed extension's exact origin; OpenAI keys remain server-side."
            >
              <select
                aria-label="Extension Astra backend"
                value={p.astraBackend}
                onChange={(e) =>
                  update({ astraBackend: e.target.value as "hosted" | "local" })
                }
              >
                <option value="hosted">Hosted PART API</option>
                <option value="local">Local development · port 4664</option>
              </select>
            </SettingRow>
          )}
          <SettingRow
            title="Dedicated Solana WebSocket"
            detail="Optional wss:// mainnet endpoint for your own faster node. Empty uses public Solana nodes with reconnect/failover. This URL is stored in this browser and visible to its user; use a browser-scoped provider credential."
          >
            <div className="stream-endpoint-control">
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                aria-label="Solana WebSocket endpoint"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="wss://your-mainnet-node"
              />
              <button
                onClick={() => {
                  const value = validStreamUrl(streamUrl);
                  if (streamUrl.trim() && !value) {
                    setError(
                      "Enter a valid secure wss:// endpoint without a URL username or password.",
                    );
                    return;
                  }
                  update({ streamEndpoint: value });
                  setError("");
                  setNotice(
                    value
                      ? "WebSocket endpoint saved. The selected chart will reconnect."
                      : "Public WebSocket nodes selected.",
                  );
                }}
              >
                Apply endpoint
              </button>
              <button
                onClick={() => {
                  update({ streamEndpoint: "" });
                  setStreamUrl("");
                  setError("");
                  setNotice("Public WebSocket nodes selected.");
                }}
              >
                Use public nodes
              </button>
            </div>
          </SettingRow>
          <div className="tool-actions">
            <button onClick={() => setRetry((r) => r + 1)}>
              Check API connection
            </button>
            <span className="connection-badge">
              {status?.ready ? "Astra configured" : "Setup required"}
            </span>
          </div>
          <div className="settings-grid">
            <div>
              <h3>Astra / OpenAI</h3>
              <p>{status?.reason ?? "Checking…"}</p>
              <p>
                Configured model: {status?.model ?? "None"}
                <br />
                Rate limiter: {status?.rateLimit ?? "Unknown"}
              </p>
            </div>
            <div>
              <h3>Markets / chart</h3>
              <p>
                Solana DEX Screener discovery · GeckoTerminal USD candles ·
                validated DexPaprika fallback. Public source delays are shown on
                each panel.
              </p>
            </div>
            <div>
              <h3>Wallet / quotes</h3>
              <p>
                Phantom, Solflare and Wallet Standard · Raydium. Every live swap
                needs independent wallet review. Extension wallet actions
                require the website.
              </p>
            </div>
            <div>
              <h3>Social / deployment</h3>
              <p>
                X history, Telegram/push, live SPL deployment and hosting are
                not connected. Manual analysis and local drafts remain
                available.
              </p>
            </div>
          </div>
          <p className="data-note">
            Configuration checked: {at ? new Date(at).toISOString() : "Pending"}
            . Configuration does not verify provider uptime or account model
            access.
          </p>
        </div>
      )}
      {section === "data" && (
        <div className="settings-section">
          <h2>Layout & local data</h2>
          <SettingRow
            title="Reset workspace layout"
            detail="Close panels and clear selected token context. Appearance and chart preferences stay saved."
          >
            <button onClick={reset}>Reset layout</button>
          </SettingRow>
          <p>
            Wallet watchlists, bounded chat threads, drafts and market favorites
            stay in this browser. No private keys are stored.
          </p>
          <button
            onClick={() => {
              try {
                for (const key of [
                  "part.astra.threads.v1",
                  "part.astra.session",
                  "part.wallets.v1",
                  "part.wallet.selected",
                  "part.tokenDraft.v1",
                  "part.marketWatch.v1",
                ])
                  localStorage.removeItem(key);
                window.dispatchEvent(new Event("part:clear-data"));
                setNotice("Local module data cleared.");
              } catch {
                setError("Local storage is unavailable.");
              }
            }}
          >
            Clear local module data
          </button>
        </div>
      )}
      {(error || storageError) && (
        <p className="tool-error" role="alert">
          {error ||
            "Local storage unavailable. Preferences cannot survive reload."}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
