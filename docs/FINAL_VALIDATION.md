# Final validation — 22 October 2026

PART is a Solana mainnet workspace. This release includes the eye/hands homepage, supplied animated media, minimal landing copy and the full shared terminal in a compact Chrome extension.

## Results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 109 passed; 4 opt-in live tests skipped |
| `npm run test:live` | All 4 live source checks passed (111 total tests in that run, before the two handoff unit cases were added) |
| `npm run test:browser` | 26 passed; no page errors |
| `npm run build` | Passed |
| `npm run ext:zip` | Passed; archive contents match `dist-ext` byte for byte |
| Installed extension integration (`scripts/extension-terminal-smoke.mjs`) | All 5 groups passed; no page errors |
| Unmocked installed extension | SOL discovery and 500 GeckoTerminal source candles loaded; no horizontal overflow or page errors |
| `node scripts/quote-smoke.mjs` | Real Raydium SOL→USDC and USDC→SOL exit quotes returned; signing remained disabled without a wallet |
| `git diff --check` | Passed |

The normal unit/browser/extension integration checks use explicit fixtures; the live source checks and the unmocked extension/quote walkthroughs use public Solana data. No wallet transactions were signed or broadcast, and this final pass made no paid model-generation calls.

## Extension behavior

The 400×580 popup imports the same `App` as the website terminal. It retains native candles, intervals, historical paging, price/market-cap controls, log scale, live/pause controls, chart expansion, search and every workspace module. The compact header stays available while scrolling. Fresh preferences use Black with a white accent; saved themes, custom accents and independent green/red candle colors remain intact.

The installed-origin check opens all 18 secondary modules, changes/reloads appearance, obtains a read-only quote, follows the wallet link and opens the full extension desk. Site handoff browser tests verify that a linked mint overrides an older saved selection, retains base58 case, opens the real terminal and recovers through search if the source cannot find the mint. Invalid addresses never enter linked-token discovery. Returning home clears the handoff query.

Wallet providers do not inject into extension pages. **Wallet on site** and the Swap action therefore open the selected token in the website terminal; users connect and approve transactions there. This is an explicit handoff, not wallet signing inside the popup.

Screenshots: [empty popup](test-artifacts/final/popup-empty.png), [selected chart](test-artifacts/final/popup-chart.png), [full extension desk with a saved custom theme](test-artifacts/final/extension-desk.png).

## Server and publishing boundaries

The extension ZIP is `public/part-ext.zip`, suitable for unpacking through Chrome developer mode. It is not a Chrome Web Store publication. GitHub delivery does not itself verify hosting or production server environment variables.

Astra uses server credentials and exact allowed origins. Production additionally requires the persistent Upstash limiter. The existing hosted `/api/health` returned 404 before this release was pushed, while the deployed homepage returned 200; the new API routes must be deployed and configured before hosted Astra can work. Local market/terminal and installed-extension checks do not establish production AI availability. No credentials were added to browser code or this commit.
