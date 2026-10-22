import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const out = "/tmp/part-realtime-review";
await mkdir(out, { recursive: true });
const results = [],
  errors = [];
const extension = resolve("dist-ext");
const ctx = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  args: [
    "--disable-extensions-except=" + extension,
    "--load-extension=" + extension,
  ],
  viewport: { width: 1440, height: 1000 },
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(e.message));
const open = async (title) => {
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
try {
  await p.goto("chrome://extensions");
  const id = await p.locator("extensions-item").first().getAttribute("id");
  await p.goto(`chrome-extension://${id}/popup.html?view=desk`);
  await open("Settings");
  await p.getByRole("tab", { name: "Connections", exact: true }).click();
  await p.getByLabel("Extension Astra backend").selectOption("local");
  await p
    .getByText("Astra configured", { exact: true })
    .waitFor({ timeout: 20000 });
  results.push({
    name: "local backend",
    origin: `chrome-extension://${id}`,
    ready: true,
  });
  await open("Astra");
  await p
    .getByRole("textbox", { name: "Message Astra" })
    .fill(
      "State which blockchain PART supports in one short sentence. Do not trade or generate transactions.",
    );
  await p.getByRole("button", { name: "Send", exact: true }).click();
  await p.locator(".chat-message.assistant").waitFor({ timeout: 55000 });
  results.push({
    name: "real extension chat",
    answer: await p.locator(".chat-message.assistant").allTextContents(),
    errors: await p.locator(".tool-error").allTextContents(),
  });
  await p.screenshot({ path: out + "/extension-astra.png" });
  await p
    .getByRole("combobox", { name: "Search Solana tokens" })
    .fill("So11111111111111111111111111111111111111112");
  await p.getByRole("listbox").getByRole("option").first().click();
  await open("Settings");
  await p.getByRole("tab", { name: "Features & Astra", exact: true }).click();
  await p
    .getByRole("switch", { name: "Enable Astra chart scenarios", exact: true })
    .check();
  await p.getByRole("tab", { name: "Terminal", exact: true }).click();
  await p
    .getByRole("button", { name: "Generate scenario", exact: true })
    .waitFor({ timeout: 25000 });
  await p.waitForFunction(
    () =>
      Number(
        document.querySelector(".sol-chart")?.getAttribute("data-candle-count"),
      ) >= 20,
    null,
    { timeout: 25000 },
  );
  const responsePromise = p.waitForResponse(
    (r) => r.url().endsWith("/api/astra/scenario"),
    { timeout: 55000 },
  );
  await p
    .getByRole("button", { name: "Generate scenario", exact: true })
    .click();
  const response = await responsePromise;
  const body = await response.json();
  results.push({
    name: "real extension scenario",
    http: response.status(),
    model: body.model,
    points: body.points?.length,
    hypothetical: body.hypothetical,
    error: body.error,
  });
  if (!response.ok) throw new Error(body.error ?? "Scenario unavailable");
  await p.locator(".scenario-detail").waitFor();
  await p.screenshot({ path: out + "/extension-scenario.png", fullPage: true });
} catch (e) {
  errors.push(String(e));
  console.error(String(e));
  console.log(
    "visible errors",
    await p.locator(".tool-error").allTextContents(),
  );
  await p.screenshot({ path: out + "/extension-astra-error.png" });
} finally {
  console.log(JSON.stringify({ results, errors }, null, 2));
  await writeFile(
    out + "/extension-astra.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  await ctx.close();
  if (errors.length) process.exitCode = 1;
}
