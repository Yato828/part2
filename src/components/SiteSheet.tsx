type Sheet = "docs" | "ext";

export function SiteSheet({
  kind,
  onClose,
}: {
  kind: Sheet | null;
  onClose: () => void;
}) {
  if (!kind) return null;

  return (
    <div className="sheet" role="dialog" aria-modal="true">
      <button type="button" className="sheet-dim" onClick={onClose} aria-label="Close" />
      <div className="sheet-card">
        <header className="sheet-head">
          <div>
            <em>{kind === "docs" ? "documentation" : "chrome extension"}</em>
            <h2>{kind === "docs" ? "PART" : "Add to Chrome"}</h2>
          </div>
          <button type="button" className="sheet-x" onClick={onClose}>
            Close
          </button>
        </header>

        {kind === "docs" ? <DocsBody /> : <ExtBody />}
      </div>
    </div>
  );
}

function DocsBody() {
  return (
    <div className="sheet-body">
      <p className="sheet-lead">
        Terminal for Robinhood Chain. <b>Fable 5.1</b> reads the book. Not an agent.
      </p>

      <section>
        <h3>Enter</h3>
        <p>Highway, tape, then he watches. Press Enter Terminal for the desk.</p>
      </section>

      <section>
        <h3>Search</h3>
        <p>
          Name, ticker, or <code>0x</code>. Chart opens only after you pick a hit.
        </p>
      </section>

      <section>
        <h3>Desk</h3>
        <ul>
          <li>
            <b>Pulse</b> — new launches. Age, liq, vol. Stocks stay out.
          </li>
          <li>
            <b>Stocks</b> — RH stock tokens, halts, corp actions.
          </li>
          <li>
            <b>Blocks</b> — tiles, gas, new ERC-20s.
          </li>
          <li>
            <b>Bubble Map</b> — wallet graph. Drag a node, wheel to zoom.
          </li>
          <li>
            <b>Swap</b> — ETH → token, Uniswap v3, chain 4663.
          </li>
          <li>
            <b>Flow</b> — tape. Click a wallet or hash.
          </li>
        </ul>
      </section>

      <section>
        <h3>Fable 5.1</h3>
        <p>Scores, candles, briefs. Liquidity, volume, age, tape — then a verdict.</p>
      </section>

      <section>
        <h3>Chain</h3>
        <p>
          EIP-155 <b>4663</b> only. Quotes and swaps stay here.
        </p>
      </section>
    </div>
  );
}

function ExtBody() {
  return (
    <div className="sheet-body">
      <p className="sheet-lead">
        Not in the Chrome Web Store. Load the archive. Popup is the terminal, 400×580.
      </p>

      <a className="sheet-dl" href="/part-ext.zip" download="part-ext.zip">
        Download archive
        <span>part-ext.zip</span>
      </a>

      <ol className="sheet-steps">
        <li>
          <b>Unzip the archive.</b> <code>manifest.json</code> must sit in the root of the folder
          — not one extra directory down.
        </li>
        <li>
          Open <code>chrome://extensions</code> and turn on <b>Developer mode</b>.
        </li>
        <li>
          Click <b>Load unpacked</b> and select that folder.
        </li>
        <li>Pin the PART icon next to the address bar.</li>
      </ol>

      <p className="sheet-note">
        Chrome will warn that the extension is not from the Chrome Web Store. That is expected.
        Edge uses <code>edge://extensions</code>. Brave uses <code>brave://extensions</code>. Same
        steps.
      </p>
    </div>
  );
}
