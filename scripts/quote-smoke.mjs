import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("/tmp/part-browser-review", { recursive: true });
const b = await chromium.launch({ channel: "chrome" }),
  p = await b.newPage({ viewport: { width: 1440, height: 900 } }),
  results = [];
async function open(title) {
  await p
    .getByRole("button", { name: "Add Panel", exact: true })
    .first()
    .click();
  await p.getByRole("textbox", { name: "Find a module" }).fill(title);
  await p
    .locator(".launcher-results button")
    .filter({ has: p.getByText(title, { exact: true }) })
    .click();
}
try {
  await p.goto("http://localhost:4664");
  await p
    .getByRole("button", { name: "Enter Terminal", exact: true })
    .first()
    .click();
  await p.locator(".term-overlay.on").waitFor();
  await p
    .getByRole("combobox", { name: "Search Solana tokens" })
    .fill("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  await p.getByRole("option").first().click();
  await open("Buy / Swap");
  await p.getByRole("button", { name: "Get quote", exact: true }).click();
  await p
    .getByRole("button", { name: "Get quote", exact: true })
    .waitFor({ timeout: 35000 });
  await expect(p.locator(".quote-details")).toBeVisible();
  results.push({
    name: "Live SOL→USDC quote",
    details: await p.locator(".quote-details").allTextContents(),
    notes: await p.locator(".swap-tab p[role=status]").allTextContents(),
    signButtonDisabled: await p
      .getByRole("button", { name: "Connect wallet to swap", exact: true })
      .isDisabled()
      .catch(() => null),
  });
  await open("Exit Simulator");
  await p.getByRole("textbox", { name: "Sale amount" }).fill("10");
  await p.getByRole("button", { name: "Simulate sale", exact: true }).click();
  await p
    .getByRole("button", { name: "Simulate sale", exact: true })
    .waitFor({ timeout: 35000 });
  await expect(p.locator(".metric-grid")).toContainText("Quoted output");
  await expect(p.locator(".tool-error")).toHaveCount(0);
  results.push({
    name: "Live USDC→SOL exit quote",
    values: await p.locator(".metric-grid").allTextContents(),
    errors: await p.locator(".tool-error").allTextContents(),
  });
  await p.screenshot({ path: "/tmp/part-browser-review/live-exit.png" });
} catch (e) {
  results.push({ error: String(e) });
  console.error(String(e));
  process.exitCode = 1;
} finally {
  console.log(JSON.stringify(results, null, 2));
  await writeFile(
    "/tmp/part-quote-smoke.json",
    JSON.stringify(results, null, 2),
  );
  await b.close();
}
