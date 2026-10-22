# PART — session context

Solana-only trading terminal. User requested removing the previous chain and stock integrations and making candles comfortable like Axiom.

User reaffirmed: all product copy, documentation, assistant prompts and future modules must use Solana mainnet. Robinhood Chain (4663), EVM/ERC-20 and stock requirements in `PART_CODEX_MASTER_PROMPT.md` are outdated and superseded by this instruction.

Local: `npm run dev`, http://localhost:4664/.
Landing uses halftone eye/hands branding, the supplied particle-wave GIF as a locally encoded video background and a separate supplied particle-sphere GIF for entry/exit transitions. WebAudio remains intact. The customizable dark terminal defaults to chart/search only; secondary tools open as lazy workspace tabs.
Keep landing copy minimal: the user removed decorative numbered captions, repeated micro-slogans and labels around the artwork.
Search: DEX Screener, strictly Solana. Mint and pool strings remain case-sensitive.
Candles: Lightweight Charts, GeckoTerminal USD OHLCV for the selected mint; validated DexPaprika fallback. No synthetic ticks. Price/MCap (current-supply estimate), volume, log, history, crosshair, pan/zoom, latest and expanded mode.
Wallets: Phantom / Solflare. Raydium SOL→SPL quotes and explicit wallet signing. Jupiter external fallback. Extension popups cannot receive injected wallets; use website for wallet actions.
Holders: largest token-account owners through RPC, not full supply distribution; transfer edges unavailable without an indexer.
Workspace: Ctrl/Cmd+K launcher, open/close/pin/maximize/reorder tabs, local versioned persistence. Markets, Pulse, New Tokens, Trends, Blocks, Bubble Map and Flow remain discoverable.
Astra: server-side Responses API, explicit owner model (default gpt-6-astra), bounded local threads and real read-only Solana tools. No automatic AI call on token changes. Production fails closed without persistent rate limits. Local heuristics are labeled separately.
Creation: shared local SPL draft, manual or real Astra concept generation, isolated website preview/export. Live deployment, social ingestion, push/Telegram and hosting are not connected.
Setup and capability boundaries: `docs/SETUP.md`. Validation and live browser findings: `docs/IMPLEMENTATION_REPORT.md`.
Public API failures remain visible. Live swaps require a funded wallet and have not been executed by the agent.
Do not publish personal remotes, author names or handles in the UI.

Latest user update: customizable dark interface, readable navigation, green/red candles (user-selectable), source-backed automatic candle updates without page reload, optional explicitly hypothetical Astra path overlays. These supersede the monochrome-only styling constraint.

Latest realtime update: current candles can include an explicitly provisional observed pool-spot overlay from Solana account PubSub, independently of the 5–30s indexed OHLCV refresh. Supported state decoders: Orca Whirlpools, Raydium CLMM, Meteora DLMM. USDC≈USD assumption is labeled; SOL quotes use a fresh streamed SOL/USDC reference. Other pools stay source-only. No fabricated volume, executed trade price or guaranteed millisecond delivery/trade priority. Fast processed state may roll back. Settings offers confirmed mode and a browser-visible dedicated WSS endpoint. Pause/hidden views disconnect; reconnect clears provisional state.
X-Ray and Bubble Map share RPC/RugCheck holder fallback. Index balance time is unknown, fetch time is separate, mint and owners are validated. Unavailable providers remain explicit; retries retain existing evidence. Extension 1.3.0 supports WSS and `popup.html?view=desk`, with cross-tab preference synchronization. Latest report: `docs/REALTIME_REPORT.md`.
