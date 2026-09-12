import { formatEther, parseEther, type Address } from "viem";
import { sfx } from "../lib/audio";
import { formatOut, quoteEthToToken, swapEthToToken, type QuoteHit } from "../lib/swap";
import { CHAIN_ID, EXPLORER } from "../lib/const";
import { isExtension } from "../lib/env";
import { fmtUsd, shortAddr } from "../lib/format";
import type { AxiomCoin } from "../lib/axiom";
import { connectWallet, disconnectWallet, refreshAccount, useWallet } from "../lib/wallet";
import { useEffect, useState } from "react";

function preferWallets(wallets: ReturnType<typeof useWallet>["wallets"]) {
  const named = wallets.filter((w) => /metamask|rabby/i.test(`${w.rdns} ${w.name}`));
  return named.length ? named : wallets;
}

export function WalletChip() {
  const { account, walletName, bal, chain } = useWallet();
  const onChain = chain.toLowerCase() === "0x" + CHAIN_ID.toString(16);
  if (!account) {
    return (
      <button className="mm-btn" onClick={() => void connectWallet()}>
        Connect
      </button>
    );
  }
  return (
    <span className={`acct ${onChain ? "up" : "dn"}`} title={account}>
      <i />
      {walletName || "WALLET"} {shortAddr(account)} · {Number(formatEther(bal)).toFixed(4)} ETH
    </span>
  );
}

export function WalletSwap({
  coin,
  onLog,
}: {
  coin: AxiomCoin | null;
  onLog: (t: string, s: string, k?: "ok" | "err") => void;
}) {
  const { account, walletName, bal, chain, wallets } = useWallet();
  const [amt, setAmt] = useState("0.01");
  const [quote, setQuote] = useState<QuoteHit | null>(null);
  const [busy, setBusy] = useState(false);
  const onChain = chain.toLowerCase() === "0x" + CHAIN_ID.toString(16);
  const picks = preferWallets(wallets);
  let tooPoor = false;
  try {
    tooPoor = parseEther(amt || "0") > bal;
  } catch {
    tooPoor = true;
  }

  useEffect(() => {
    if (!coin?.address || !amt) {
      setQuote(null);
      return;
    }
    const t = setTimeout(() => {
      void quoteEthToToken(coin.address as Address, amt)
        .then((q) => setQuote(q))
        .catch(() => setQuote(null));
    }, 400);
    return () => clearTimeout(t);
  }, [coin?.address, amt]);

  const connect = async (rdns?: string) => {
    try {
      const acc = await connectWallet(rdns);
      sfx.ok();
      onLog("WAL", `${walletName || "wallet"} ${shortAddr(acc)} · chain ${CHAIN_ID}`, "ok");
    } catch (e) {
      sfx.err();
      onLog("ERR", String(e), "err");
    }
  };

  const swap = async () => {
    if (!account || !coin || !quote) return;
    setBusy(true);
    try {
      const hash = await swapEthToToken(account as Address, coin.address as Address, amt, quote);
      sfx.ok();
      onLog("SWP", `ETH→${coin.symbol}  ${String(hash)}`, "ok");
      window.open(`${EXPLORER}/tx/${hash}`, "_blank");
      await refreshAccount();
    } catch (e) {
      sfx.err();
      onLog("ERR", String(e), "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="swap">
      <div className="hd">
        <span>
          <b>Swap</b> ETH → {coin?.symbol ?? "token"}
        </span>
        {account ? (
          <span className={onChain ? "up" : "dn"}>connected</span>
        ) : (
          <span>wallet</span>
        )}
      </div>
      {!account && (
        <div className="wallet-pick">
          <button className="mm-big" onClick={() => void connect()}>
            Connect wallet
          </button>
          <div className="wallet-btns">
            {(picks.length
              ? picks
              : [
                  { rdns: "io.metamask", name: "MetaMask" },
                  { rdns: "io.rabby", name: "Rabby Wallet" },
                ]
            ).map((w) => (
              <button key={w.rdns} className="mm-btn" onClick={() => void connect(w.rdns)}>
                {w.name}
              </button>
            ))}
          </div>
          <small>
            MetaMask / Rabby · Robinhood Chain 4663
            {isExtension() ? " · popup opens a chain tab so the wallet can sign without us touching keys" : ""}
          </small>
        </div>
      )}
      {account && (
        <div className="acct-card">
          <div>
            <em>ACCOUNT</em>
            <b title={account}>{shortAddr(account)}</b>
            <small>
              {walletName || "Wallet"} · {Number(formatEther(bal)).toFixed(4)} ETH
            </small>
          </div>
          <button className="mm-btn" onClick={() => disconnectWallet()}>
            Leave
          </button>
        </div>
      )}
      {account && !onChain && (
        <button className="mm-big" onClick={() => void connect()}>
          SWITCH TO ROBINHOOD 4663
        </button>
      )}
      {account && onChain && (
        <div className="swap-body">
          <label>
            pay eth
            <input value={amt} onChange={(e) => setAmt(e.target.value)} />
          </label>
          <div className="swap-eq">▼ Uniswap v3</div>
          <label>
            GET {coin?.symbol ?? "—"}
            <input readOnly value={quote ? formatOut(quote) : "no pool / quoting…"} />
          </label>
          <small>
            {quote
              ? quote.path
                ? `route WETH→USDG→${coin?.symbol}  fee ${quote.fee}/${quote.fee2}`
                : `route WETH→${coin?.symbol}  fee ${quote.fee / 10000}%`
              : "quote Uniswap SwapRouter02"}
            {coin ? ` · ${fmtUsd(coin.priceUsd)}` : ""}
          </small>
          <button className="mm-big" disabled={busy || !quote || tooPoor} onClick={() => void swap()}>
            {busy ? "SIGNING…" : tooPoor ? "INSUFFICIENT ETH" : `SWAP ETH → ${coin?.symbol ?? "TOKEN"}`}
          </button>
        </div>
      )}
    </div>
  );
}
