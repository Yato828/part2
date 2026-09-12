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
        PART is a trading terminal on <b>Fable 5.1</b> — the fastest and most accurate read of
        Robinhood Chain. It is a terminal, not an agent. It watches the book, scores the tape,
        and stays quiet until you pick a market.
      </p>

      <section>
        <h3>Enter</h3>
        <p>
          The highway is the first frame. Scroll, or press Enter Terminal. Fable 5.1 arms as the
          desk comes into view.
        </p>
      </section>

      <section>
        <h3>Search</h3>
        <p>
          Left rail. Type a name, ticker, or <code>0x</code> contract. The chart stays closed
          until you choose a hit. Nothing is auto-selected.
        </p>
      </section>

      <section>
        <h3>Desk</h3>
        <ul>
          <li>
            <b>Pulse</b> — heat of Robinhood stock tokens. Click to arm.
          </li>
          <li>
            <b>Blocks</b> — recent chain tiles, gas, new ERC-20s.
          </li>
          <li>
            <b>Bubble Map</b> — wallets as stippled nodes, webbed by flow. Drag to pull, empty
            drag to orbit, wheel to zoom.
          </li>
          <li>
            <b>Swap</b> — ETH into the armed token on Uniswap v3. MetaMask or Rabby, chain 4663.
          </li>
          <li>
            <b>Flow</b> — live tape. Click a wallet or hash to open the explorer.
          </li>
        </ul>
      </section>

      <section>
        <h3>Fable 5.1</h3>
        <p>
          The kernel behind every score, candle, and brief. Built for speed and precision — the
          fastest and most accurate terminal on this chain. Not a chatbot. A read of liquidity,
          volume, age, and tape, then a clear verdict.
        </p>
      </section>

      <section>
        <h3>Chain</h3>
        <p>
          Robinhood Chain only. EIP-155 <b>4663</b>. Quotes and swaps stay on this network. No
          other chains.
        </p>
      </section>
    </div>
  );
}

function ExtBody() {
  return (
    <div className="sheet-body">
      <p className="sheet-lead">
        PART is not listed in the Chrome Web Store. You install it from an archive, like a local
        tool. The popup is only the terminal — search, candles, pulse, blocks, map, tape, swap —
        in a 400×580 window that holds its layout.
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
