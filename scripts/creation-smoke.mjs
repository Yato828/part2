import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = [];
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
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
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
}
async function generation(name) {
  await page
    .getByRole("button", { name: "Generate with Astra", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate with Astra", exact: true })
    .waitFor({ timeout: 55000 });
  const result = {
    name,
    errors: await page.locator(".tool-error").allTextContents(),
    notice: await page.locator(".tool-page p[role=status]").allTextContents(),
    tokenName: await page
      .getByRole("textbox", { name: "Token name", exact: true })
      .inputValue(),
  };
  results.push(result);
  console.log(JSON.stringify(result));
}
try {
  await page.goto("http://localhost:4664");
  await page
    .getByRole("button", { name: "Enter Terminal", exact: true })
    .first()
    .click();
  await page.locator(".term-overlay.on").waitFor();
  await open("Tweet to Token");
  await page
    .getByRole("textbox", { name: "Tweet text" })
    .fill(
      "Original concept: a small astronomy-themed community project on Solana. No affiliation, no endorsements, no financial promises. Keep the description under 35 words.",
    );
  await generation("Live Tweet to Token");
  await page.getByRole("button", { name: "Continue to Launchpad" }).click();
  await page.getByRole("heading", { name: "Launchpad", exact: true }).waitFor();
  results.push({
    name: "Draft handoff",
    tokenName: await page
      .getByRole("textbox", { name: "Token name", exact: true })
      .inputValue(),
  });
  await open("Website Builder");
  await page
    .getByRole("textbox", { name: "Website idea" })
    .fill(
      "An original, concise monochrome astronomy community landing page on Solana. No market data or promises.",
    );
  await generation("Live Website Builder");
  await page.getByRole("button", { name: "Update safe preview" }).click();
  const preview = page.frameLocator('iframe[title="Isolated website preview"]');
  results.push({
    name: "Generated preview",
    headings: await preview.locator("h1,h2").allTextContents(),
    scripts: await preview.locator("script").count(),
  });
  await open("KOL Analyzer");
  await page
    .getByRole("textbox", { name: "Public call text" })
    .fill(
      "Unverified user-pasted example: This Solana token will triple by Friday. No mint, author or dated source was supplied.",
    );
  await page.getByRole("button", { name: "Analyze with Astra" }).click();
  await page
    .locator(".generated-text,.tool-error")
    .first()
    .waitFor({ timeout: 55000 });
  results.push({
    name: "Live manual KOL",
    answer: await page.locator(".generated-text").allTextContents(),
    errors: await page.locator(".tool-error").allTextContents(),
  });
  await page.screenshot({ path: "/tmp/part-browser-review/live-kol.png" });
} catch (e) {
  errors.push(String(e));
  console.error(String(e));
} finally {
  await writeFile(
    "/tmp/part-creation-smoke.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
