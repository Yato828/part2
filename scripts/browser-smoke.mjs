import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const out = process.env.PART_SMOKE_OUT || "/tmp/part-browser-review";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const report = {
  at: new Date().toISOString(),
  base: process.env.PART_TEST_BASE || "http://localhost:4664",
  results: [],
  errors: [],
  screenshots: [],
};
page.on("pageerror", (e) => report.errors.push(e.message));
const record = (name, detail) => {
  report.results.push({ name, detail });
  console.log(name + ": " + JSON.stringify(detail));
};
async function capture(name) {
  const path = out + "/" + name + ".png";
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
}
async function open(title) {
  await page
    .getByRole("button", { name: "Add Panel", exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: "Find a module" }).fill(title);
  await page
    .locator(".launcher-results button")
    .filter({ has: page.getByText(title, { exact: true }) })
    .click();
  await page
    .locator(".module-panel .panel-controls>b")
    .filter({ hasText: title })
    .waitFor();
  await page.waitForTimeout(500);
}
async function wait(ms) {
  await page.waitForTimeout(ms);
}
try {
  await page.goto(report.base);
  await page
    .getByRole("button", { name: "Enter Terminal", exact: true })
    .first()
    .click();
  await page.locator(".term-overlay.on").waitFor();
  record("fresh desk", {
    empty: await page
      .getByRole("heading", { name: "Find your next market." })
      .isVisible(),
    chartCount: await page.locator(".chart-native").count(),
    panels: await page.locator(".module-panel").count(),
  });
  await capture("desktop-empty");
  await page
    .getByRole("combobox", { name: "Search Solana tokens" })
    .fill("So11111111111111111111111111111111111111112");
  await page.getByRole("option").first().waitFor({ timeout: 20000 });
  await page.getByRole("option").first().click();
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector(".sol-chart")?.getAttribute("data-candle-count"),
      ) > 0 ||
      document
        .querySelector(".chart-state")
        ?.textContent?.includes("Candle data unavailable"),
    { timeout: 40000 },
  );
  record("live chart", {
    token: await page.locator(".token-identity").innerText(),
    source: await page.locator(".chart-bottom").innerText(),
    notes: await page.locator(".sol-chart .data-note").allTextContents(),
  });
  await capture("desktop-live-chart");
  await page.getByRole("button", { name: "1h", exact: true }).click();
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector(".sol-chart")?.getAttribute("data-candle-count"),
      ) > 0 ||
      document
        .querySelector(".chart-state")
        ?.textContent?.includes("Candle data unavailable"),
    { timeout: 40000 },
  );
  record("1h chart", {
    source: await page.locator(".chart-bottom").innerText(),
    notes: await page.locator(".sol-chart .data-note").allTextContents(),
  });
  for (const title of [
    "Markets",
    "Pulse",
    "New Tokens",
    "Trend Radar",
    "Blocks",
    "Bubble Map",
    "Flow",
    "Token X-Ray",
  ]) {
    await open(title);
    await wait(
      ["Blocks", "Flow", "Token X-Ray"].includes(title) ? 22000 : 14000,
    );
    record(title, {
      rows: await page.locator(".module-panel tbody tr").count(),
      notes: await page
        .locator(
          ".module-panel .data-note, .module-panel .tool-error, .module-panel .bubble-empty",
        )
        .allTextContents(),
    });
    if (title === "Token X-Ray") await capture("desktop-live-xray");
  }
  await open("Wallet Watch");
  await page
    .getByRole("textbox", { name: "Wallet address" })
    .fill("So11111111111111111111111111111111111111112");
  await page
    .getByRole("textbox", { name: "Wallet label" })
    .fill("Public RPC inspection");
  await page.getByRole("button", { name: "Track Wallet", exact: true }).click();
  await wait(16000);
  record("Wallet Watch", {
    rows: await page.locator(".module-panel tbody tr").count(),
    notes: await page.locator(".tool-error").allTextContents(),
  });
  await open("Smart Money");
  await wait(14000);
  record("Smart Money", {
    rows: await page.locator(".module-panel tbody tr").count(),
    notes: await page.locator(".tool-error").allTextContents(),
  });
  await open("Buy / Swap");
  record("Swap SOL selected", {
    button: await page
      .locator(".swap-tab button.primary-action")
      .allTextContents(),
  });
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  record(
    "No injected wallet",
    await page.locator(".wallet-error").allTextContents(),
  );
  await open("Astra");
  await page
    .getByRole("textbox", { name: "Message Astra" })
    .fill(
      "Use the read-only get_chain_stats tool to report the current Solana slot and its source/time. If unavailable, say so. Do not infer or guess.",
    );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page
    .locator(".chat-message.assistant, .tool-error")
    .first()
    .waitFor({ timeout: 55000 });
  record("live Astra read-only tool", {
    answer: await page.locator(".chat-message.assistant").allTextContents(),
    errors: await page.locator(".tool-error").allTextContents(),
  });
  await capture("desktop-astra");
  for (const title of [
    "KOL Analyzer",
    "Launchpad",
    "Tweet to Token",
    "Website Builder",
    "Settings",
  ]) {
    await open(title);
    await page
      .locator(".tool-heading h1")
      .filter({ hasText: title === "Settings" ? "Your desk." : title })
      .waitFor();
    record(title, {
      title: await page.locator(".tool-heading h1").innerText(),
      errors: await page.locator(".tool-error").allTextContents(),
    });
  }
  await page
    .locator(".wallet-error")
    .click()
    .catch(() => {});
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("mobile-settings");
  record("mobile 390", {
    width: await page.evaluate(() => document.documentElement.scrollWidth),
    viewport: 390,
  });
  await page.goto(report.base + "/popup.html");
  await page.setViewportSize({ width: 400, height: 600 });
  await wait(1000);
  await capture("popup");
  record("popup", {
    search: await page
      .getByRole("combobox", { name: "Search Solana tokens" })
      .isVisible(),
  });
} catch (e) {
  report.errors.push(String(e));
  console.error(String(e));
  await capture("unexpected-error");
} finally {
  await writeFile(out + "/report.json", JSON.stringify(report, null, 2));
  await browser.close();
}
