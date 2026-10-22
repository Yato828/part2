# PART — Solana trader deck

User requested a full Solana migration. All discovery, addresses, charts, swaps and explorer links must use Solana mainnet. Preserve base58 address case. No stock registry or EVM integrations.

All product copy, documentation, assistant prompts and future modules must describe PART as a Solana mainnet workspace. Robinhood Chain (4663), EVM/ERC-20 and stock requirements in `PART_CODEX_MASTER_PROMPT.md` are outdated; the user's Solana requirements take precedence.

Run `npm install && npm run dev`. Local URL: http://localhost:4664/.

- `src/App.tsx`: shared Solana selection/search, chart-first terminal and lazy workspace panels.
- `src/features/workspace/`: versioned local layout, launcher, tabs, pin/maximize/reorder, settings.
- `src/features/astra/`, `src/server/astra.ts`, `api/astra/`: real server-side Responses API chat and bounded read-only tools. Production requires persistent Upstash limits; never put server credentials in browser code.
- `src/features/intelligence/`, `src/features/create/`: evidence views, wallet watch, read-only exit quotes, manual social analysis, SPL drafts and sandboxed website export. Live deployment stays disabled.
- `src/terminal.css`, `src/features/preferences/`: responsive terminal styling, persistent dark themes, accents and independent trading colors.
- `src/lib/axiom.ts`: strictly Solana DEX Screener discovery, GeckoTerminal USD OHLCV, validated DexPaprika fallback.
- `src/lib/poolStream.ts`, `poolPrice.ts`: read-only Solana account PubSub, verified program/layout decoders, processed/confirmed spot updates, reconnect and provisional current-candle overlay. Supported: Orca Whirlpools, Raydium CLMM, Meteora DLMM; other pools retain explicit source-only mode. Never label an HTTP bootstrap as a live push or invent volume from spot prices.
- `src/lib/holders.ts`: shared RPC/indexed holder fallback with exact mint/owner validation, source attribution and fetch time distinct from unknown index balance time.
- `src/components/Chart.tsx`: Lightweight Charts candles + volume, OHLC crosshair, intervals, historical paging, log scale, estimated market cap, expand and latest controls.
- `src/lib/api.ts`, `rpcFeed.ts`: Solana RPC and GeckoTerminal trades. Holder map is largest-account owners, no inferred transfer edges.
- `src/lib/wallet.ts`: Phantom/Solflare connection.
- `src/lib/swap.ts`: SOL→SPL quotes and wallet-approved Raydium swaps. No automatic signing or trading.
- `src/components/HeroIntel.tsx`: disclosed local heuristic, no automatic paid AI calls. WebAudio retained. Branding uses the supplied halftone eye/hands and particle-sphere transition GIF.
- `vite.config.ts`: `/dex`, `/gecko`, `/paprika`, `/rpc`, `/ray` proxies.

Checks: `npm run typecheck`, `npm test`, `npm run test:live`, `npm run test:browser`, `npm run build`, `npm run ext:zip`. Browser tests need the dev server. See `docs/SETUP.md`.
Public APIs can rate limit; show explicit stale/error states and never synthesize historical candles. Charts stay empty until a token is selected. Use the supplied eye/hands branding and sphere GIF for animated transitions into the terminal and back home. User now explicitly requests customizable dark themes and accents, green/red candles, live updates and optional clearly labeled Astra scenarios. These newer preferences supersede the earlier monochrome-only rule. Never mix hypothetical scenario points into source candles.
