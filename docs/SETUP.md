# PART Solana workspace

PART supports **Solana mainnet**. Product UI is English with customizable dark themes, accents and green/red candles by default. The user's current Solana and customization requirements supersede the external master prompt's outdated chain and monochrome constraints.

## Local development

Use Node 22.15+ (the extension ZIP script uses `node:zlib.crc32`; validation used Node 26.8.1).

```sh
npm install
cp .env.example .env.local
# Set OPENAI_API_KEY in .env.local; never prefix credentials with VITE_.
npm run dev
```

Open http://localhost:4664/ and enter the terminal. Vite serves `/api/astra/chat`, `/api/astra/scenario`, `/api/astra/status` and `/api/health` using the same handler as the Vercel routes; a separate backend process is unnecessary. Restart dev after changing server environment variables. An existing `.env.local` should be edited, not overwritten with the example.

`ASTRA_MODEL` defaults to the explicitly requested `gpt-6-astra`. Account access is checked by real upstream calls; other models are used only when the owner explicitly sets that environment variable. The UI displays ASTRA GPT-6 only after a response identifies the served GPT-6 Astra model. No fallback model is silently substituted.

Without a key, chat and AI generation show a configuration error. Market search, candles, watchlists, local drafts, website templates, preview and export remain usable. Chat uses a stable JSON response with Stop/Abort and a 45-second server deadline; token streaming is not implemented.

## Homepage

The homepage uses the supplied halftone eye and hands under `public/hero/signal/`. It introduces the Solana mainnet workspace, Astra and the existing extension archive. The workspace illustration is a labeled interactive preview; it makes no market or AI requests. Enter Terminal opens the existing lazy-loaded terminal. House returns to the homepage. Both transitions display the supplied particle-sphere GIF with a fade, and entry waits for the terminal to finish rendering. Reduced motion uses a still frame and skips the decorative delay. The website favicon and extension icons use the halftone eye.

The background uses the user's supplied particle-wave GIF, preserved under `assets/background/particle-wave.gif`. Local MP4/WebM versions retain its original motion and timing, cover the homepage and pause in hidden tabs or while the terminal is open. A matching still appears for reduced motion, unavailable media or blocked autoplay. The background loads no external runtime and has no watermark. A dark overlay preserves text contrast.

The "Human instinct. Machine perspective." section uses the supplied rotating number-sphere GIF in place of its decorative asterisk. Its source is preserved under `assets/connection-orb/source.gif`; local video versions retain the original 6.6-second loop and pause offscreen. Reduced motion uses a matching still.

The large eye uses the four supplied pose images under `assets/eye-blink/`. `scripts/build-eye-loop.py` encodes a 30 fps loop with motion interpolation: eight seconds open, then a two-second close/reopen sequence. Its matching first/last poses keep the ten-second loop seamless. WebM and MP4 versions plus a still fallback live under `public/hero/signal/`; no video processing dependency ships to the browser or server. The media pauses offscreen and in hidden tabs. Reduced motion, unavailable codecs or blocked autoplay retain the open-eye still. To regenerate, install Pillow and FFmpeg with minterpolate/libvpx-vp9/libx264, then run `python3 scripts/build-eye-loop.py --ffmpeg /path/to/ffmpeg`.

The background, ambient particles, eye, scroll reveals and hands parallax respect the system's reduced-motion setting. The native documentation/extension dialogs trap focus, close on Escape and restore focus to their opener. The server, market sources, wallet and swap behavior are unchanged by the homepage redesign.

## Interface preferences and live charts

Open **Settings** in the header or module launcher. The website and extension start with the Black theme and a white accent to match the homepage; existing saved preferences are retained. Appearance offers Midnight, Graphite and Black themes, custom accents, spacing, text size, navigation labels, artwork and reduced motion. Chart settings include independent candle colors, green/red and blue/orange presets, volume, grid, crosshair, hollow candles and header metrics. Preferences apply immediately and persist in `part.preferences.v1`.

Indexed historical candles/volume reconcile every **5 seconds** by default (5/10/15/30 seconds). Independently, **WebSocket pool prices** streams on-chain spot changes for Orca Whirlpools, Raydium CLMM and Meteora DLMM. Updates are batched into browser animation frames, preserving all observed high/low extremes. The current bar is explicitly provisional pool spot, not executed-trade OHLC; its time is browser receipt time. Processed state may roll back; confirmed mode waits for network confirmation. USDC is treated as approximately USD, and SOL-quoted tokens need a fresh streamed SOL/USDC reference. No volume or missing historical candles are fabricated. Other pool layouts retain explicit source-only mode.

The chart shows receipt age in milliseconds, slot, commitment and node hostname. Receipt age is not end-to-end network latency. Public nodes may delay/drop updates or restrict methods; one-millisecond delivery and first trade priority are not promised. **Settings → Connections → Dedicated Solana WebSocket** accepts an optional mainnet `wss://` endpoint. It is stored locally and visible to the browser user: use a provider credential scoped for browser use, never a server OpenAI secret. Empty selects public nodes with bounded reconnect/failover.

Pause stops both channels; manual Refresh still reads the historical source. Hidden charts disconnect and reconnect when visible. Provider failures preserve explicit stale states. Follow-latest preserves manual history navigation; Latest returns to the recent window and Fit shows loaded history. RPC and indexed holder fallbacks are shared by X-Ray/Bubble Map. RugCheck does not supply a holder balance timestamp; the UI distinguishes that from report fetch time.

To enable the optional drawing, choose **Settings → Features & Astra → Enable Astra chart scenarios**, then open a selected token chart and press **Generate scenario**. Enabling the switch alone makes no paid request. The server verifies the exact Solana pool and fetches recent source candles itself; client-supplied prices/prompts are ignored. Astra returns 6 or 12 hypothetical future points as a separate dashed line, with source/time/model and assumptions. This unvalidated illustration has no established predictive accuracy. It never replaces actual candles or signs transactions. Stop, Clear and Regenerate are available; switching token/timeframe cancels and clears it. It uses the same server key, request limits and production limiter as chat.

Restore defaults resets interface/chart/feature preferences. Reset layout closes panels but retains preferences. Clear local module data removes module drafts, chat threads and watchlists. It does not remove preferences.

Connection endpoints are retained by Restore defaults. Extension Astra can use **Settings → Connections → Astra backend → Local development** at `http://localhost:4664`, or the hosted API. Local mode requires the dev server and an exact `chrome-extension://<installed-id>` entry in `.env.local`'s `ASTRA_ALLOWED_ORIGINS`. This session registered the unpacked build's local origin without changing existing credentials. A different installed ID must be registered separately. Local API preflight is handled by the same exact-origin API handler; Vite's default CORS middleware is disabled so it cannot intercept that preflight. Production origin checks remain unchanged. No OpenAI key is copied into the extension.

## Deployment on Vercel

Link/import this existing repository in Vercel with framework **Vite**, build command `npm run build`, output `dist`. Keep the `api/` directory: its edge functions are deployed separately from the static bundle. Existing DEX/RPC/Raydium rewrites do not match `/api/**`.

Configure these **server environment variables** for each deployed environment:

- `OPENAI_API_KEY` from the owner's billed OpenAI project.
- `ASTRA_MODEL=gpt-6-astra` (or the owner's explicitly chosen accessible model).
- `ASTRA_MAX_OUTPUT_TOKENS=1200`, `ASTRA_REQUESTS_PER_MINUTE=10`, `ASTRA_DAILY_REQUEST_LIMIT=100`.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from an Upstash Redis instance. Production fails closed without persistent limits. Atomic Redis counters enforce per-IP, per-session and global daily request budgets across instances. Local development uses bounded in-memory counters.
- `ASTRA_ALLOWED_ORIGINS`: exact permitted origins separated by commas. Include the actual deployed site; for extension chat include its exact `chrome-extension://<installed-id>`. Unlisted extension origins are rejected. A request's own origin is always permitted.

The daily request cap and bounded input/output/tool rounds limit usage; they are not a USD-denominated billing guarantee. Configure and monitor the OpenAI project's billing controls independently. A ChatGPT subscription does not provide this server key or API billing.

If already linked and using the Vercel CLI, `npx vercel build` builds locally, `npx vercel` creates a preview deployment, and `npx vercel --prod` publishes production. No deployment was performed by this implementation. Check `/api/health` and make a real chat request after setting environment variables; health reports configuration, not provider availability.

## Extension

```sh
npm run ext:dev     # compact shell at http://localhost:4666/
npm run ext:zip     # dist-ext/ and public/part-ext.zip
```

Load `dist-ext` as an unpacked extension in Chrome developer mode or distribute the ZIP. Version 1.3.0 includes WebSocket prices and holder fallback; reload an existing installation in `chrome://extensions`. The 400×580 popup runs the same full terminal as the website, with compact controls, local eye branding and a sticky header. All workspace modules remain accessible. **Open desk** opens a full browser tab and carries the selected mint; closing the popup does not close that tab's feed. Appearance/connection preferences sync across extension views. Secure WSS connections are permitted by the website and extension CSP. Quotes work inside the extension. **Wallet on site** and the Swap panel open the website terminal with the exact selected mint; the website resolves the real Solana pool and requests wallet approval only after the user chooses to connect and trade. Extension pages do not receive injected wallet providers. Built extension market calls go directly to allowlisted public providers; Astra calls go to `https://part-woad.vercel.app` as defined in `src/lib/http.ts`. Update that deployment origin and the manifest permissions together if hosting changes. The server must allow the installed extension's exact origin. A local rebuild does not deploy server endpoints or publish the extension to a store.

## Validation

With the dev server running:

```sh
npm run typecheck
npm test
npm run test:live
npm run test:browser
npm run build
npm run ext:zip
npm run test:extension
```

Browser tests use Playwright with installed Google Chrome locally. In CI run `npx playwright install --with-deps chromium`; set `CI=1` to use Playwright Chromium. `PART_TEST_BASE` overrides the browser base URL. Live tests depend on public APIs and may fail when providers rate limit.

The extension integration check installs the built extension in Playwright Chromium, then checks native charts, controls, all workspace modules, persistence, compact layout and wallet/desk handoffs against deterministic provider fixtures. It does not bill AI or sign transactions. The latest release results are in `docs/FINAL_VALIDATION.md`.

`npm run test:smoke` performs an unmocked browser walkthrough and writes screenshots/report under `/tmp/part-browser-review`. `node scripts/creation-smoke.mjs` exercises live creative generation. These live walkthroughs use the configured billed OpenAI key; they never send wallet transactions. The deterministic browser suite uses clearly identified API fixtures and does not bill OpenAI.

## Capability boundaries

- DEX search/discovery, source candles, block stats, observed trades, sampled holders and wallet activity use real public Solana sources. Errors and stale snapshots remain visible. Never replace missing historical candles with current-price-anchored estimates.
- Token X-Ray covers largest token-account owners, not full supply distribution or inferred transfer clusters. Smart Money labels net balance changes; it does not reconstruct audited PnL or identify every swap.
- Exit Simulator requests a read-only Raydium SPL→SOL quote. Buy/Swap preserves explicit wallet review, quote validation, simulation and confirmation handling.
- Launchpad is an SPL **draft/review/export** flow. No deployment adapter, rent estimate, transaction or live mint creation is claimed. Deploy stays disabled until a verified metadata/deployment/wallet flow is implemented.
- X ingestion, social history, KOL performance, Telegram/web push, AI image generation and website hosting are not connected. Pasted public text can be analyzed through Astra. Template previews are text layouts, not generated bitmap artwork.
- Website AI generates editable project copy into a trusted template. Preview/export rebuild HTML from an allowlist; scripts, arbitrary CSS, embeds, forms and external resource loads are removed. The iframe is sandboxed without script/origin privileges.
- Local storage is versioned and bounded: one pinned secondary panel, 20 wallets, 100 market-watch mints, 10 chat threads and 24 messages per thread. Chat context/history sent upstream is bounded. Browsers with blocked storage show an explicit persistence error.
- Labs trading games, autonomous trading and additional chains are absent.

Responses/tool integration follows the [official OpenAI function-calling guide](https://developers.openai.com/api/docs/guides/function-calling) and [Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create). The chart uses the [Lightweight Charts API](https://tradingview.github.io/lightweight-charts/docs/api/interfaces/IChartApi).
