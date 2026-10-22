import { useEffect, useState } from "react";
import type { AxiomCoin } from "../lib/axiom";
import { safeLogo, tokenLogo } from "../lib/tokenLogo";

export function TokenIcon({ coin }: { coin: AxiomCoin }) {
  // Remount on mint changes so a failed image cannot hide the next token's icon.
  return <MintIcon key={coin.address} coin={coin} />;
}
function MintIcon({ coin }: { coin: AxiomCoin }) {
  const [fallback, setFallback] = useState<string>();
  const [failed, setFailed] = useState<string[]>([]);
  const primary = safeLogo(coin.logo);
  const src = [primary, fallback].find(
    (url): url is string => !!url && !failed.includes(url),
  );
  useEffect(() => {
    if (primary && !failed.includes(primary)) return;
    let live = true;
    void tokenLogo(coin.address).then((url) => {
      if (live) setFallback(url);
    });
    return () => {
      live = false;
    };
  }, [coin.address, primary, failed]);
  return src ? (
    <img
      src={src}
      alt={`${coin.symbol} logo`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed((old) => [...old, src])}
    />
  ) : (
    <span
      className="coin-fallback"
      aria-label={`${coin.symbol} icon unavailable`}
    >
      {coin.symbol.slice(0, 2)}
    </span>
  );
}
