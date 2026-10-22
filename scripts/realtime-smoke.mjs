import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const out = process.env.PART_REALTIME_OUT || "/tmp/part-realtime-review";
await mkdir(out, { recursive: true });
const report = { at: new Date().toISOString(), results: [], errors: [] };
const record = (name, data) => {
  report.results.push({ name, ...data });
  console.log(name + ": " + JSON.stringify(data));
};
const open = async (p, title) => {
  await p
    .getByRole("button", { name: "Add Panel", exact: true })
    .first()
    .click();
  await p.getByRole("textbox", { name: "Find a module" }).fill(title);
  await p
    .locator(".launcher-results button")
    .filter({ has: p.getByText(title, { exact: true }) })
    .click();
};
const select = async (p, mint) => {
  await p.getByRole("combobox", { name: "Search Solana tokens" }).fill(mint);
  await p
    .getByRole("listbox")
    .getByRole("option")
    .first()
    .click({ timeout: 20000 });
};
async function observe(p, label) {
  await select(p, "So11111111111111111111111111111111111111112");
  await p.waitForFunction(
    () =>
      Number(
        document.querySelector(".sol-chart")?.getAttribute("data-live-price"),
      ) > 0,
    { timeout: 30000 },
  );
  await p.evaluate(() => {
    window.__spotMeasurements = [];
    let last = 0;
    const el = document.querySelector(".sol-chart");
    window.__spotObserver = new MutationObserver(() => {
      const at = Number(el.getAttribute("data-live-received-at"));
      if (at && at !== last) {
        last = at;
        window.__spotMeasurements.push({
          price: Number(el.getAttribute("data-live-price")),
          slot: Number(el.getAttribute("data-live-slot")),
          domCommitMs: Math.max(0, Date.now() - at),
        });
      }
    });
    window.__spotObserver.observe(el, {
      attributes: true,
      attributeFilter: ["data-live-received-at"],
    });
  });
  await p.waitForTimeout(20000);
  const measurements = await p.evaluate(() => {
    window.__spotObserver.disconnect();
    return window.__spotMeasurements;
  });
  record(label, {
    feed: await p.locator(".spot-feed").innerText(),
    sourceCandles: await p
      .locator(".sol-chart")
      .getAttribute("data-candle-count"),
    measurements,
    distinctPrices: new Set(measurements.map((m) => m.price)).size,
    notes:
      "domCommitMs measures browser receipt-to-DOM only; it excludes network/node delay and canvas paint.",
  });
  await p.screenshot({ path: out + "/" + label + ".png", fullPage: true });
}
let browser, context;
try {
  browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto("http://localhost:4664");
  await page
    .getByRole("button", { name: "Enter Terminal", exact: true })
    .first()
    .click();
  await observe(page, "website-stream");
  await select(page, "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263");
  await open(page, "Token X-Ray");
  await page
    .getByRole("button", { name: "Refresh evidence", exact: true })
    .waitFor({ timeout: 25000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector(".holder-status")
        ?.textContent?.includes("owners loaded"),
    { timeout: 20000 },
  );
  record("website-holders", {
    status: await page.locator(".holder-status").innerText(),
    rows: await page
      .locator(".evidence-grid tbody")
      .first()
      .locator("tr")
      .count(),
    errors: await page.locator(".tool-error").allTextContents(),
  });
  await page.screenshot({ path: out + "/website-xray.png", fullPage: true });
  await browser.close();
  browser = undefined;
  const extension = resolve("dist-ext");
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      "--disable-extensions-except=" + extension,
      "--load-extension=" + extension,
    ],
    viewport: { width: 400, height: 600 },
  });
  const popup = await context.newPage();
  popup.on("pageerror", (e) => report.errors.push(e.message));
  await popup.goto("chrome://extensions");
  const id = await popup.locator("extensions-item").first().getAttribute("id");
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await observe(popup, "extension-stream");
  record("extension-csp", {
    origin: new URL(popup.url()).origin,
    width: await popup.evaluate(() => document.documentElement.scrollWidth),
    version: "1.3.0",
  });
  const tabPromise = context.waitForEvent("page");
  await popup
    .getByRole("button", { name: "Open desk ↗", exact: true })
    .click();
  const desk = await tabPromise;
  await desk.setViewportSize({ width: 1440, height: 900 });
  desk.on("pageerror", (e) => report.errors.push(e.message));
  await desk.waitForURL("**/popup.html?view=desk");
  await desk.getByRole("combobox", { name: "Search Solana tokens" }).waitFor();
  record("extension-wide-desk", {
    compact: await desk.locator(".sol-compact").count(),
    width: await desk.evaluate(() => document.documentElement.scrollWidth),
    viewport: 1440,
  });
  await open(desk, "Settings");
  await desk.getByRole("button", { name: "Graphite", exact: false }).click();
  await expectTheme(popup, "graphite");
  record("extension-shared-preferences", {
    popupTheme: await popup
      .locator(".modular-terminal")
      .getAttribute("data-theme"),
  });
  await desk.screenshot({ path: out + "/extension-wide-settings.png" });
  for (const title of [
    "Markets",
    "Pulse",
    "New Tokens",
    "Trend Radar",
    "Blocks",
    "Bubble Map",
    "Flow",
    "Token X-Ray",
    "Wallet Watch",
    "Smart Money",
    "Exit Simulator",
    "Buy / Swap",
    "Astra",
    "KOL Analyzer",
    "Launchpad",
    "Tweet to Token",
    "Website Builder",
    "Settings",
  ]) {
    await open(desk, title);
    await desk.waitForTimeout(350);
    record("extension-module", {
      title,
      heading: await desk
        .locator(".module-panel h1,.module-panel h2")
        .first()
        .allTextContents(),
      errors: await desk.locator(".tool-error").allTextContents(),
    });
  }
  await open(desk, "Buy / Swap");
  await desk
    .getByRole("link", { name: "the PART website ↗", exact: true })
    .waitFor();
  record("extension-wallet", { guidance: true, transactionsSent: 0 });
  await desk.screenshot({ path: out + "/extension-swap.png" });
  await select(desk, "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263");
  await open(desk, "Token X-Ray");
  await desk.waitForFunction(
    () =>
      document
        .querySelector(".holder-status")
        ?.textContent?.includes("owners loaded"),
    { timeout: 25000 },
  );
  record("extension-holders", {
    status: await desk.locator(".holder-status").innerText(),
    rows: await desk
      .locator(".evidence-grid tbody")
      .first()
      .locator("tr")
      .count(),
  });
  await desk.screenshot({ path: out + "/extension-xray.png", fullPage: true });
} catch (error) {
  report.errors.push(String(error));
  console.error(String(error));
  for (const p of [
    ...(browser?.contexts().flatMap((c) => c.pages()) ?? []),
    ...(context?.pages() ?? []),
  ]) {
    await p
      .screenshot({
        path: out + "/unexpected-error-" + Date.now() + ".png",
        fullPage: true,
      })
      .catch(() => {});
    console.log(
      "Error page",
      p.url(),
      await p
        .locator(".sol-search-results")
        .allTextContents()
        .catch(() => []),
    );
  }
} finally {
  await browser?.close();
  await context?.close();
  await writeFile(out + "/report.json", JSON.stringify(report, null, 2));
  if (report.errors.length) process.exitCode = 1;
}
async function expectTheme(page, value) {
  await page.waitForFunction(
    (value) =>
      document
        .querySelector(".modular-terminal")
        ?.getAttribute("data-theme") === value,
    value,
    { timeout: 10000 },
  );
}
