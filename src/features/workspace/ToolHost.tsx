import { lazy, Suspense } from "react";
import type { AxiomCoin } from "../../lib/axiom";
import type { ModuleId } from "./store";
const Astra = lazy(() => import("../astra/AstraChat"));
const Intelligence = lazy(() => import("../intelligence/Intelligence"));
const Creation = lazy(() => import("../create/Creation"));
const Settings = lazy(() => import("./Settings"));
export default function ToolHost({
  id,
  coin,
  open,
  selectMint,
  selectedWallet,
  selectWallet,
  reset,
  collapsed,
  toggleNav,
}: {
  id: ModuleId;
  coin: AxiomCoin | null;
  open: (id: ModuleId) => void;
  selectMint: (mint: string, target?: ModuleId) => void;
  selectedWallet: string;
  selectWallet: (address: string) => void;
  reset: () => void;
  collapsed: boolean;
  toggleNav: () => void;
}) {
  return (
    <Suspense fallback={<p className="data-note">Loading tool…</p>}>
      {id === "astra" ? (
        <Astra
          wallet={selectedWallet || null}
          context={
            coin
              ? {
                  chainId: "solana",
                  mint: coin.address,
                  pool: coin.pairAddress,
                  symbol: coin.symbol,
                }
              : null
          }
          onSettings={() => open("settings")}
        />
      ) : ["launch", "tweet", "website"].includes(id) ? (
        <Creation
          key={id}
          kind={id as "launch" | "tweet" | "website"}
          open={open}
        />
      ) : id === "settings" ? (
        <Settings reset={reset} collapsed={collapsed} toggleNav={toggleNav} />
      ) : (
        <Intelligence
          id={id}
          coin={coin}
          open={open}
          selectMint={selectMint}
          selectWallet={selectWallet}
        />
      )}
    </Suspense>
  );
}
