import { useEffect, useRef } from "react";

type Sheet = "docs" | "ext";

export function SiteSheet({
  kind,
  onClose,
}: {
  kind: Sheet | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (kind && el && !el.open) el.showModal();
    return () => {
      if (el?.open) el.close();
      if (kind && opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [kind]);
  if (!kind) return null;

  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-labelledby="site-sheet-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sheet-card">
        <header className="sheet-head">
          <div>
            <em>{kind === "docs" ? "documentation" : "chrome extension"}</em>
            <h2 id="site-sheet-title">
              {kind === "docs" ? "PART documentation" : "Get the extension"}
            </h2>
          </div>
          <button type="button" className="sheet-x" onClick={onClose}>
            Close
          </button>
        </header>

        {kind === "docs" ? <DocsBody /> : <ExtBody />}
      </div>
    </dialog>
  );
}

function DocsBody() {
  return (
    <div className="sheet-body">
      <p className="sheet-lead">
        Terminal for Solana. <b>Astra</b> is the built-in assistant; server
        configuration is required.
      </p>

      <section>
        <h3>Enter</h3>
        <p>
          Press Enter Terminal to open your Solana mainnet workspace. Use House
          in the terminal header to return to the homepage.
        </p>
      </section>

      <section>
        <h3>Search</h3>
        <p>
          Name, ticker, or a <code>Solana mint</code>. Chart opens only after
          you pick a hit.
        </p>
      </section>

      <section>
        <h3>Desk</h3>
        <ul>
          <li>
            <b>New pairs</b> — recently profiled Solana tokens. Age, liquidity,
            volume.
          </li>
          <li>
            <b>Markets</b> — Solana DEX tokens, sortable by volume, change and
            liquidity.
          </li>
          <li>
            <b>Network</b> — Solana slots, transactions and network activity.
          </li>
          <li>
            <b>Holders map</b> — largest token-account owners. Drag a node,
            wheel to zoom.
          </li>
          <li>
            <b>Swap</b> — SOL → SPL token through Raydium. Phantom / Solflare.
          </li>
          <li>
            <b>Flow</b> — tape. Click a wallet or hash.
          </li>
        </ul>
      </section>

      <section>
        <h3>Astra</h3>
        <p>
          Contextual assistant with read-only Solana tools when configured.
          Local market briefs are labeled separately.
        </p>
      </section>

      <section>
        <h3>Chain</h3>
        <p>
          Solana <b>mainnet</b> only. Quotes and swaps stay here.
        </p>
      </section>
    </div>
  );
}

function ExtBody() {
  return (
    <div className="sheet-body">
      <p className="sheet-lead">
        Not in the Chrome Web Store. Load the archive. Popup shows the Solana
        terminal. Connect wallets in the website; browser extensions do not
        inject wallets into other extension popups.
      </p>

      <a className="sheet-dl" href="/part-ext.zip" download="part-ext.zip">
        Download archive
        <span>part-ext.zip</span>
      </a>

      <ol className="sheet-steps">
        <li>
          <b>Unzip the archive.</b> <code>manifest.json</code> must sit in the
          root of the folder — not one extra directory down.
        </li>
        <li>
          Open <code>chrome://extensions</code> and turn on{" "}
          <b>Developer mode</b>.
        </li>
        <li>
          Click <b>Load unpacked</b> and select that folder.
        </li>
        <li>Pin the PART icon next to the address bar.</li>
      </ol>

      <p className="sheet-note">
        Chrome will warn that the extension is not from the Chrome Web Store.
        That is expected. Edge uses <code>edge://extensions</code>. Brave uses{" "}
        <code>brave://extensions</code>. Same steps.
      </p>
    </div>
  );
}
