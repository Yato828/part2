import { useEffect, useState } from "react";
import {
  connectWallet,
  disconnectWallet,
  refreshAccount,
  useWallet,
} from "../lib/wallet";
import { executeSwap, parseSolIn, quoteSol, type QuoteHit } from "../lib/swap";
import { EXPLORER, WSOL } from "../lib/const";
import type { AxiomCoin } from "../lib/axiom";
import { isExtension } from "../lib/env";
import { fmtQty, shortAddr } from "../lib/format";
import { usePreferences } from "../features/preferences/preferences";
import { walletWebsiteHref } from "../lib/siteLink";

export function WalletChip() {
  const w = useWallet();
  const [error, setError] = useState("");
  return (
    <div className="wallet-chip-wrap">
      <button
        className="wallet-chip"
        onClick={() => {
          setError("");
          void (w.account ? disconnectWallet() : connectWallet()).catch((e) =>
            setError(String(e.message)),
          );
        }}
      >
        {w.account ? `${shortAddr(w.account)} · Disconnect` : "Connect wallet"}
      </button>
      {error && (
        <div className="wallet-error" role="alert" onClick={() => setError("")}>
          {error}
        </div>
      )}
    </div>
  );
}
export function WalletSwap({ coin }: { coin: AxiomCoin | null }) {
  const w = useWallet();
  const { preferences } = usePreferences();
  const [amount, setAmount] = useState("0.1");
  const [slippage, setSlippage] = useState(100);
  const [quote, setQuote] = useState<QuoteHit | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setQuote(null);
    setMessage("");
    setSignature("");
  }, [coin?.address, amount, slippage, w.account]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const expired = !!quote && now - quote.createdAt > 45000;
  const getQuote = async () => {
    if (!coin) return;
    setBusy(true);
    setQuote(null);
    setMessage("Finding route…");
    try {
      setQuote(await quoteSol(coin.address, amount, slippage));
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Quote unavailable");
    } finally {
      setBusy(false);
    }
  };
  const swap = async () => {
    if (!quote) return;
    setBusy(true);
    setMessage("Review the transaction in your wallet");
    try {
      await executeSwap(quote, (sig) => {
        setSignature(sig);
        setMessage("Submitted · waiting for confirmation…");
      });
      setMessage("Swap confirmed");
      setQuote(null);
      void refreshAccount();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Swap rejected");
    } finally {
      setBusy(false);
    }
  };
  let insufficient = false;
  try {
    insufficient =
      w.bal !== null && Number(parseSolIn(amount)) / 1e9 + 0.005 > w.bal;
  } catch {}
  return (
    <div className="sol-swap">
      <div className="section-caption">
        <b>Swap</b>
        <span>SOL → {coin?.symbol ?? "token"}</span>
      </div>
      {isExtension() && (
        <p className="data-note">
          Quotes are available here. Connect your wallet and approve swaps on{" "}
          <a
            href={walletWebsiteHref(coin?.address, preferences.astraBackend)}
            target="_blank"
            rel="noopener noreferrer"
            className="extension-wallet-handoff"
          >
            the PART website ↗
          </a>
          .
        </p>
      )}
      {!w.account && !isExtension() && (
        <div className="wallet-choices">
          {w.wallets.map((wallet) => (
            <button
              key={wallet.rdns}
              disabled={busy}
              onClick={() => {
                setMessage("");
                void connectWallet(wallet.rdns).catch((e) =>
                  setMessage(e.message),
                );
              }}
            >
              {wallet.name}
            </button>
          ))}
          {!w.wallets.length && (
            <p className="data-note">
              No compatible wallet found. Install a Solana Wallet Standard
              wallet such as Phantom, Solflare, Backpack, or MetaMask with
              Solana enabled, then refresh. Rabby currently exposes EVM accounts
              and cannot sign this Solana swap.
            </p>
          )}
        </div>
      )}
      <label className="swap-amount">
        <span>
          You pay{" "}
          <small>
            {w.account
              ? `Balance ${w.bal === null ? "unavailable" : w.bal.toFixed(4) + " SOL"}`
              : "Solana mainnet"}
          </small>
        </span>
        <div>
          <input
            aria-label="Amount in SOL"
            inputMode="decimal"
            value={amount}
            disabled={busy}
            onChange={(e) => setAmount(e.target.value)}
          />
          <b>SOL</b>
        </div>
      </label>
      <div className="swap-presets">
        {["0.1", "0.5", "1", "5"].map((v) => (
          <button key={v} disabled={busy} onClick={() => setAmount(v)}>
            {v}
          </button>
        ))}
      </div>
      <label className="swap-slippage">
        Slippage
        <select
          value={slippage}
          disabled={busy}
          onChange={(e) => setSlippage(Number(e.target.value))}
        >
          <option value={50}>0.5%</option>
          <option value={100}>1%</option>
          <option value={200}>2%</option>
          <option value={500}>5%</option>
        </select>
      </label>
      {quote && (
        <div className="quote-details">
          <span>
            You receive{" "}
            <b>
              {fmtQty(
                Number(quote.response.data.outputAmount) / 10 ** quote.decimals,
              )}{" "}
              {coin?.symbol}
            </b>
          </span>
          <span>
            Minimum{" "}
            <b>
              {fmtQty(
                Number(quote.response.data.otherAmountThreshold) /
                  10 ** quote.decimals,
              )}
            </b>
          </span>
          <span>
            Price impact <b>{quote.response.data.priceImpactPct}%</b>
          </span>
          <small>
            {expired
              ? "Quote expired"
              : `Quote valid for ${Math.min(45, Math.max(0, 45 - Math.floor((now - quote.createdAt) / 1000)))}s`}{" "}
            · Raydium
          </small>
        </div>
      )}
      <button
        className="primary-action"
        disabled={busy || !coin || coin.address === WSOL}
        onClick={() => void getQuote()}
      >
        {busy
          ? "Working…"
          : !coin
            ? "Select a token"
            : coin.address === WSOL
              ? "Choose a token to buy"
              : "Get quote"}
      </button>
      {quote && isExtension() ? (
        <a
          className="primary-action extension-wallet-handoff"
          href={walletWebsiteHref(coin?.address, preferences.astraBackend)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Connect wallet on PART ↗
        </a>
      ) : quote ? (
        <button
          className="primary-action"
          disabled={busy || expired || !w.account || insufficient}
          onClick={() => void swap()}
        >
          {!w.account
            ? "Connect wallet to swap"
            : insufficient
              ? "Insufficient SOL + fee reserve"
              : expired
                ? "Refresh quote"
                : "Review & swap"}
        </button>
      ) : null}
      {message && (
        <p className="data-note" role="status">
          {message}
        </p>
      )}
      {signature && (
        <a
          href={`${EXPLORER}/tx/${signature}`}
          target="_blank"
          rel="noreferrer"
        >
          View transaction ↗
        </a>
      )}
      {coin && (
        <a
          className="external-route"
          href={`https://jup.ag/swap/${WSOL}-${coin.address}`}
          target="_blank"
          rel="noreferrer"
        >
          Open {coin.symbol} on Jupiter ↗
        </a>
      )}
    </div>
  );
}
