# PART — trader deck

Lime-on-black CRT terminal for Robinhood Chain + Axiom-style coin intel. Mascot: **HERO**. Visual language: dither, scanlines, phosphor `#c6ff1a` on `#000`.

## Run

```powershell
cd C:\Users\Admin\PART
npm install
npm run dev
```

Open http://localhost:4663/  
First click on boot plays the CRT score (browser blocks autoplay). Second click skips boot. Enter jack-in with sound.

## Layout

- `src/App.tsx` — shell, tabs, tape, bottom SEARCH dock, CLI
- `src/lib/axiom.ts` — Robinhood-only search + DexPaprika OHLCV (`/paprika`, Gecko fallback)
- `src/lib/api.ts` — Robinhood Chain (Blockscout, RH registry, RPC, holders, paprika swaps)
- `src/lib/wallet.ts` — EIP-6963 Connect Wallet: MetaMask + Rabby, add/switch chain 4663
- `src/lib/swap.ts` — ETH→token via Uniswap SwapRouter02 + QuoterV2
- `src/lib/audio.ts` — boot drone / arpeggio / ticks
- `src/lib/bubble.ts` — wallet cluster graph for the bubble map
- `src/components/Boot.tsx` — HERO particle assemble
- `src/components/WalletSwap.tsx` — Connect Wallet + account chip + quote + swap
- `src/components/Chart.tsx` — Axiom-style candles: TIME 1m/5m/15m/1h/4h/1d, drag pan, wheel zoom
- `src/components/BubbleMap.tsx` — 3D CRT orbs, drag / orbit / zoom (Bubblemaps + Obsidian grid)
- `src/components/StocksHeat.tsx` — Finviz-style RH stock-token heatmap
- `src/components/ChainMosaic.tsx` — block treemap + gas ribbon
- `public/hero/` — mascot stills
- `public/registry.json` — RH stock-token registry fallback (api.robinhood.com is geo-blocked here)
- `vite.config.ts` — proxies `/dex` `/gecko` `/paprika` `/chain` `/rhj` `/rpc`
- `CONTEXT.md` — session memory for the next agent

Removed: GlyphOracle ASCII jokes, CSS radar, matrix rain, Jupiter/Solana, top omni search (search lives at the **bottom**).

## Tabs

- **SEARCH** — cutout in the **top chrome**, center of the frame. Dropdown opens downward. Charts stay empty until a hit is chosen. Left default is STOCKS heat, not the bubble map.
- **HERO AGENT** — bottom dock. Live score + scenario (rug / halt / dead / thin / chase / long / buy / scalp / wait). Socials from Dex pair. CLI stays as a thin strip under the brief.
- **Candles** — hidden until the user picks a token. DexPaprika OHLCV with cache / prefetch. TIME 1m/5m/15m/1h/4h/1d, drag pan, wheel zoom, LIVE.
- **BUBBLE tab** — 3D CRT orbs of tx-origin wallets, directed arrows + cluster web. Hidden until the tab is opened.
- **STOCKS** — Finviz-style heat of Robinhood stock tokens + halt / corp-action strip (default left pane)
- **CHAIN** — block mosaic (mempool-style) + gas ribbon + newest Blockscout ERC-20s
- **Wallet** — CONNECT WALLET. MetaMask / Rabby EIP-6963. Swap ETH→token via SwapRouter02 + QuoterV2. 2% slippage.
- **TAPE** — clickable from/to wallets and tx hash → Blockscout. Chain txs until a token is armed, then token transfers.

CLI: `axiom NVDA` | `search HOOD` | `token AAPL` | `connect` | `open` | `boot` | `help`

## Data reality

Axiom REST (`api*.axiom.trade`) returns `No auth cookies present`. Public stand-ins: Dexscreener (`chainId=robinhood`) + DexPaprika OHLCV (`/paprika`). No Solana / Jupiter. Blockscout needs a browser User-Agent (set in Vite proxy). GeckoTerminal OHLCV is Cloudflare-blocked (403); do not rely on it.

## Do not

Do not restyle to blue/white. Do not drop HERO. Do not re-add the CSS radar or glyph oracle. Keep sounds WebAudio (no binary samples required). Do not bring Solana/Jupiter back. Search sits in the top chrome cutout; the bottom dock is HERO AGENT.
