// Deterministic integration check against the actual packaged extension origin.
// Build first with npm run ext. No model calls, wallet signatures or live trades.
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const out = "/tmp/part-extension-terminal";
await mkdir(out, { recursive: true });
const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const pool = "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE";
const wallet = "So11111111111111111111111111111111111111112";
const signature = "4".repeat(88);
const pair = {
  chainId: "solana",
  dexId: "raydium",
  pairAddress: pool,
  baseToken: { address: mint, symbol: "USDC", name: "Extension fixture USDC" },
  quoteToken: { address: wallet, symbol: "SOL" },
  priceUsd: "1",
  marketCap: 1000000,
  liquidity: { usd: 200000 },
  volume: { h24: 100000 },
  priceChange: { h24: 0.1 },
  txns: { h24: { buys: 30, sells: 25 } },
  pairCreatedAt: Date.now() - 86400000,
};
const results = [],
  errors = [];
const extension = resolve("dist-ext");
const ctx = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ],
  viewport: { width: 400, height: 580 },
});
const page = await ctx.newPage();
ctx.on("page", (p) => p.on("pageerror", (error) => errors.push(error.message)));
page.on("pageerror", (error) => errors.push(error.message));
await ctx.routeWebSocket(/wss:\/\//, () => {});
await ctx.route(/^https?:\/\//, async (route) => {
  const u = new URL(route.request().url());
  const json = (body) => route.fulfill({ json: body });
  if (u.hostname === "api.dexscreener.com")
    return json(
      u.pathname.includes("token-profiles")
        ? [{ chainId: "solana", tokenAddress: mint }]
        : u.pathname.includes("/latest/dex/")
          ? { pairs: [pair] }
          : [pair],
    );
  if (u.hostname === "api.geckoterminal.com") {
    if (u.pathname.includes("ohlcv")) {
      const end =
        Number(u.searchParams.get("before_timestamp")) ||
        Math.floor(Date.now() / 300000) * 300;
      return json({
        data: {
          attributes: {
            ohlcv_list: Array.from({ length: 40 }, (_, i) => [
              end - (i + 1) * 300,
              1,
              1.02,
              0.98,
              1.001,
              1000,
            ]),
          },
        },
      });
    }
    return json({
      data: [
        {
          attributes: {
            tx_hash: signature,
            tx_from_address: wallet,
            kind: "buy",
            volume_in_usd: "10",
            from_token_amount: "0.05",
            to_token_amount: "10",
            price_from_in_usd: "200",
            price_to_in_usd: "1",
            block_timestamp: new Date().toISOString(),
            from_token_address: wallet,
            to_token_address: mint,
          },
        },
      ],
    });
  }
  if (u.hostname === "api.dexpaprika.com")
    return route.fulfill({
      status: 503,
      json: { error: "Fixture fallback unavailable" },
    });
  if (
    ["api.mainnet-beta.solana.com", "solana-rpc.publicnode.com"].includes(
      u.hostname,
    )
  ) {
    const call = (c) => ({
      jsonrpc: "2.0",
      id: c.id,
      result:
        c.method === "getSlot"
          ? 123456
          : c.method === "getRecentPerformanceSamples"
            ? [{ numTransactions: 1000, samplePeriodSecs: 1 }]
            : c.method === "getBlocks"
              ? [123450, 123451]
              : c.method === "getBlock"
                ? {
                    blockhash: signature,
                    blockTime: 1700000000,
                    signatures: [signature],
                  }
                : c.method === "getTokenSupply"
                  ? { value: { decimals: 6, uiAmountString: "1000000" } }
                  : c.method === "getAccountInfo"
                    ? { value: null }
                    : c.method === "getSignaturesForAddress"
                      ? []
                      : { value: [] },
    });
    const body = route.request().postDataJSON();
    return json(Array.isArray(body) ? body.map(call) : call(body));
  }
  if (u.hostname === "transaction-v1.raydium.io")
    return json({
      success: true,
      data: {
        inputMint: u.searchParams.get("inputMint"),
        outputMint: u.searchParams.get("outputMint"),
        inputAmount: u.searchParams.get("amount"),
        outputAmount: "1000000",
        otherAmountThreshold: "990000",
        slippageBps: 100,
        priceImpactPct: 0.1,
        routePlan: [{}],
      },
    });
  if (u.hostname === "api.rugcheck.xyz")
    return json({ mint, topHolders: null });
  if (u.pathname === "/api/astra/status")
    return json({
      configured: false,
      ready: false,
      model: null,
      reason: "Astra is unavailable in this fixture.",
      rateLimit: "local",
    });
  if (u.pathname.startsWith("/api/astra/"))
    return route.fulfill({
      status: 503,
      json: { error: "Astra is unavailable in this fixture." },
    });
  if (["localhost", "part-woad.vercel.app"].includes(u.hostname))
    return route.fulfill({
      contentType: "text/html",
      body: "<title>Website wallet handoff fixture</title>",
    });
  return route.continue();
});
const launch = async (title) => {
  await page
    .getByRole("button", { name: "Add Panel", exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: "Find a module" }).fill(title);
  await page
    .locator(".launcher-results button")
    .filter({ has: page.getByText(title, { exact: true }) })
    .click();
  if (title !== "Terminal") {
    await expect(
      page.getByRole("region", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Loading tool…", { exact: true })).toHaveCount(
      0,
    );
  }
};
try {
  await page.goto("chrome://extensions");
  const id = await page.locator("extensions-item").first().getAttribute("id");
  if (!id)
    throw new Error(
      "The packaged extension was not installed. Run npm run ext first.",
    );
  await page.goto(`chrome-extension://${id}/popup.html`);
  await expect(
    page.getByRole("heading", { name: "Find your next market." }),
  ).toBeVisible();
  await expect(page.locator(".chart-native")).toHaveCount(0);
  expect(
    await page
      .locator(".sol-brand-eye")
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  await page.screenshot({ path: `${out}/popup-empty.png` });
  results.push(
    "Packaged 400×580 popup opens the shared terminal with local eye branding and no invented chart.",
  );

  await page.getByRole("combobox", { name: "Search Solana tokens" }).fill(mint);
  await page.getByRole("listbox").getByRole("option").first().click();
  await expect(page.locator(".chart-native canvas").first()).toBeVisible();
  await expect(page.locator(".sol-chart")).toHaveAttribute(
    "data-candle-count",
    "40",
  );
  await expect(page.locator(".chart-bottom")).toContainText("GeckoTerminal");
  for (const interval of ["1m", "15m", "1h", "5m"]) {
    await page
      .locator(".chart-intervals")
      .getByRole("button", { name: interval, exact: true })
      .click();
    await expect(page.locator(".sol-chart")).toHaveAttribute(
      "data-candle-count",
      "40",
    );
  }
  await page.getByRole("button", { name: "Log", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Log", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator(".live-indicator").click();
  await expect(page.locator(".live-indicator")).toHaveText("Paused");
  await page.locator(".live-indicator").click();
  await expect(page.locator(".live-indicator")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Expand chart", exact: true }).click();
  await expect(page.locator(".sol-chart")).toHaveClass(/expanded/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".sol-chart")).not.toHaveClass(/expanded/);
  await page.locator(".sol-terminal").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: `${out}/popup-chart.png` });
  results.push(
    "Selected Solana mint renders native candles, interval/log/live controls and expand/restore.",
  );

  const modules = [
    "Astra",
    "Token X-Ray",
    "Wallet Watch",
    "Smart Money",
    "KOL Analyzer",
    "Exit Simulator",
    "Markets",
    "Pulse",
    "Trend Radar",
    "New Tokens",
    "Blocks",
    "Bubble Map",
    "Flow",
    "Buy / Swap",
    "Launchpad",
    "Tweet to Token",
    "Website Builder",
    "Settings",
  ];
  for (const title of modules) {
    await launch(title);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.locator(".sol-terminal").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  expect(
    await page
      .locator(".sol-header")
      .evaluate((el) => el.getBoundingClientRect().top),
  ).toBe(0);
  await page.getByRole("button", { name: /Graphite/ }).click();
  await page
    .getByRole("button", { name: "Accent #c4a2ff", exact: true })
    .click();
  await expect(page.locator(".sol-terminal")).toHaveAttribute(
    "data-theme",
    "graphite",
  );
  await page.reload();
  await expect(page.locator(".sol-terminal")).toHaveAttribute(
    "data-theme",
    "graphite",
  );
  expect(
    await page
      .locator(".sol-terminal")
      .evaluate((el) => el.style.getPropertyValue("--accent")),
  ).toBe("#c4a2ff");
  results.push(
    `All ${modules.length} workspace modules remain accessible; theme/accent persist on reload.`,
  );

  await launch("Buy / Swap");
  await page.getByRole("button", { name: "Get quote", exact: true }).click();
  const walletLink = page.getByRole("link", {
    name: "Connect wallet on PART ↗",
    exact: true,
  });
  await expect(walletLink).toBeVisible();
  const href = new URL(await walletLink.getAttribute("href"));
  expect(href.origin).toBe("https://part-woad.vercel.app");
  expect(href.searchParams.get("terminal")).toBe("1");
  expect(href.searchParams.get("mint")).toBe(mint);
  await expect(page.locator(".extension-wallet-link")).toHaveAttribute(
    "href",
    href.href,
  );
  const handoffPromise = ctx.waitForEvent("page");
  await walletLink.click();
  const handoff = await handoffPromise;
  await handoff.waitForLoadState();
  expect(new URL(handoff.url()).searchParams.get("mint")).toBe(mint);
  await handoff.close();
  results.push(
    "Read-only Raydium quote works; wallet action opens website terminal with exact-case selected mint.",
  );

  await launch("Settings");
  await page.getByRole("tab", { name: "Connections", exact: true }).click();
  await page.getByLabel("Extension Astra backend").selectOption("local");
  const localHref = new URL(
    await page.locator(".extension-wallet-link").getAttribute("href"),
  );
  expect(localHref.origin).toBe("http://localhost:4664");
  expect(localHref.searchParams.get("mint")).toBe(mint);
  await page.getByLabel("Extension Astra backend").selectOption("hosted");
  await page
    .locator(".workspace-nav")
    .getByRole("button", { name: "Back to Terminal", exact: true })
    .click();
  await expect(page.locator(".sol-chart")).toHaveAttribute(
    "data-candle-count",
    "40",
  );
  const deskPromise = ctx.waitForEvent("page");
  await page.getByRole("button", { name: "Open desk ↗", exact: true }).click();
  const desk = await deskPromise;
  await desk.setViewportSize({ width: 1440, height: 900 });
  await desk.waitForLoadState();
  await expect(desk.locator("html")).toHaveClass(/extension-desk/);
  await expect(desk.locator(".sol-terminal")).toHaveAttribute(
    "data-theme",
    "graphite",
  );
  await expect(desk.locator(".sol-chart")).toHaveAttribute(
    "data-candle-count",
    "40",
  );
  await expect(desk.locator(".token-identity")).toContainText("USDC");
  await desk.screenshot({ path: `${out}/extension-desk.png` });
  await desk.close();
  results.push(
    "Local/hosted handoff follows settings; full-size extension desk restores token and appearance.",
  );
  expect(errors).toEqual([]);
} catch (error) {
  errors.push(String(error));
  await page.screenshot({ path: `${out}/failure.png` });
  process.exitCode = 1;
} finally {
  console.log(JSON.stringify({ results, errors }, null, 2));
  await writeFile(
    `${out}/results.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  await ctx.close();
}
