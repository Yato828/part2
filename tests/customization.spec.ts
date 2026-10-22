import { test, expect, type Page } from "@playwright/test";
import { fixtures, enter, launch, choose, mint, pool, errors } from "./support";
const preferences = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("part.preferences.v1") ?? "{}"),
  );
const settings = async (page: Page, section: string) => {
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await page.getByRole("tab", { name: section, exact: true }).click();
};
const back = async (page: Page) =>
  page.getByRole("tab", { name: "Terminal", exact: true }).click();
async function color(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).evaluate((node, value) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}
test.afterEach(async ({ page }) => expect(errors.get(page) ?? []).toEqual([]));
test("all appearance controls apply immediately, persist and reset", async ({
  page,
}) => {
  await fixtures(page);
  await enter(page);
  await settings(page, "Appearance");
  for (const [name, id] of [
    ["Graphite", "graphite"],
    ["Black", "black"],
    ["Midnight", "midnight"],
  ]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.locator(".modular-terminal")).toHaveAttribute(
      "data-theme",
      id,
    );
  }
  for (const value of ["#77bdfb", "#72d6b0", "#c4a2ff", "#f0bd75", "#eeeeee"]) {
    await page
      .getByRole("button", { name: `Accent ${value}`, exact: true })
      .click();
    await expect.poll(async () => (await preferences(page)).accent).toBe(value);
  }
  await color(page, "Custom accent color", "#ffcc44");
  await expect
    .poll(async () => (await preferences(page)).accent)
    .toBe("#ffcc44");
  await page.getByLabel("Interface density").selectOption("compact");
  await page.getByLabel("Interface text size").selectOption("large");
  await page.getByRole("switch", { name: "Reduce interface motion" }).check();
  await page
    .getByRole("switch", { name: "Show original token artwork" })
    .uncheck();
  await page
    .getByRole("button", { name: "Collapse navigation labels" })
    .click();
  await expect(page.locator(".workspace-nav")).toHaveClass(/collapsed/);
  await page.getByRole("button", { name: "Expand navigation labels" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Enter Terminal", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Your desk. Your layout." }),
  ).toBeVisible();
  await expect(page.locator(".modular-terminal")).toHaveAttribute(
    "data-density",
    "compact",
  );
  await expect(page.locator(".modular-terminal")).toHaveAttribute(
    "data-text-size",
    "large",
  );
  await page.getByRole("button", { name: "Restore defaults" }).click();
  await expect.poll(() => preferences(page)).toMatchObject({
    theme: "black",
    accent: "#eeeeee",
    upColor: "#22c55e",
    downColor: "#ef4444",
  });
  await expect(page.locator(".modular-terminal")).toHaveAttribute(
    "data-density",
    "comfortable",
  );
});
test("chart preferences, color presets and every chart switch are saved", async ({
  page,
}) => {
  await fixtures(page);
  await enter(page);
  await settings(page, "Chart & live data");
  await page
    .getByRole("button", { name: "Blue / orange", exact: true })
    .click();
  await expect
    .poll(async () => (await preferences(page)).upColor)
    .toBe("#60a5fa");
  await page.getByRole("button", { name: "Green / red", exact: true }).click();
  await expect
    .poll(async () => (await preferences(page)).downColor)
    .toBe("#ef4444");
  await color(page, "Rising candle color", "#10b981");
  await color(page, "Falling candle color", "#f43f5e");
  await page.getByLabel("Candle refresh interval").selectOption("10");
  await page.getByLabel("Default chart interval").selectOption("1h");
  await page.getByLabel("Visible candle count").selectOption("80");
  for (const label of [
    "Automatically update candles",
    "Follow latest candles",
    "Volume",
    "Chart grid",
    "Crosshair",
    "Token statistics",
  ])
    await page.getByRole("switch", { name: label, exact: true }).uncheck();
  await page
    .getByRole("switch", { name: "Hollow rising candles", exact: true })
    .check();
  expect(await preferences(page)).toMatchObject({
    upColor: "#10b981",
    downColor: "#f43f5e",
    refreshSeconds: 10,
    defaultInterval: "1h",
    visibleCandles: 80,
    showVolume: false,
    showGrid: false,
    showCrosshair: false,
    showMetrics: false,
    hollowCandles: true,
    liveUpdates: false,
    followLatest: false,
  });
  await choose(page);
  await expect(page.locator(".chart-intervals .selected")).toHaveText("1h");
  await expect(
    page.getByRole("button", { name: "Paused", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".token-metric:visible")).toHaveCount(0);
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await page.getByRole("button", { name: "Latest", exact: true }).click();
});
test("feature switches disable only their tools; layout and data actions work", async ({
  page,
}) => {
  await fixtures(page);
  await enter(page);
  await settings(page, "Features & Astra");
  for (const name of [
    "Enable trade tape",
    "Enable holder research",
    "Enable creation tools",
  ])
    await page.getByRole("switch", { name, exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Add Panel", exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: "Find a module" }).fill("Launchpad");
  await expect(page.locator(".launcher-results button")).toBeDisabled();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  for (const name of [
    "Enable trade tape",
    "Enable holder research",
    "Enable creation tools",
  ])
    await page.getByRole("switch", { name, exact: true }).check();
  await launch(page, "Launchpad");
  await expect(
    page.getByRole("heading", { name: "Launchpad", exact: true }),
  ).toBeVisible();
  await settings(page, "Connections");
  await page
    .getByRole("button", { name: "Check API connection", exact: true })
    .click();
  await expect(page.getByText(/Configuration checked:/)).toBeVisible();
  await page.getByRole("tab", { name: "Layout & data", exact: true }).click();
  await page.evaluate(() => {
    localStorage.setItem(
      "part.wallets.v1",
      JSON.stringify([{ address: "demo" }]),
    );
    localStorage.setItem("part.tokenDraft.v1", "{}");
  });
  await page
    .getByRole("button", { name: "Clear local module data", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Local module data cleared",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("part.wallets.v1")),
  ).toBeNull();
  await page.getByRole("button", { name: "Reset layout", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Find your next market." }),
  ).toBeVisible();
});
test("live candles change in place, append bars, pause, refresh and resume without page navigation", async ({
  page,
}) => {
  await fixtures(page);
  let calls = 0;
  const start = Math.floor(Date.now() / 300000) * 300000 - 600000;
  await page.route("**/gecko/**/ohlcv/**", (route) => {
    const url = new URL(route.request().url());
    const before = url.searchParams.has("before_timestamp");
    if (!before) calls++;
    const n = calls;
    const last = start + (n >= 3 ? 300000 : 0);
    return route.fulfill({
      json: {
        data: {
          attributes: {
            ohlcv_list: before
              ? []
              : Array.from({ length: n >= 3 ? 41 : 40 }, (_, i) => {
                  const close = i === 0 ? 1 + n * 0.001 : 1;
                  return [last - i * 300000, 1, 1.1, 0.9, close, 1000 + n];
                }),
          },
        },
      },
    });
  });
  await enter(page);
  await choose(page);
  await expect.poll(() => calls).toBeGreaterThan(0);
  await expect(page.locator(".sol-chart")).toHaveAttribute(
    "data-last-close",
    "1.001",
  );
  await page
    .locator(".chart-native")
    .evaluate((el) => el.setAttribute("data-test-identity", "same-chart"));
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  await page.clock.install();
  await page.clock.fastForward(6000);
  await expect(page.locator(".sol-chart")).toHaveAttribute(
    "data-last-close",
    "1.002",
  );
  await page.clock.fastForward(6000);
  await expect(page.locator(".sol-chart")).toHaveAttribute(
    "data-candle-count",
    "41",
  );
  await expect(page.locator(".chart-native")).toHaveAttribute(
    "data-test-identity",
    "same-chart",
  );
  expect(navigations).toBe(0);
  await page.locator(".live-indicator").click();
  await expect(page.locator(".live-indicator")).toHaveText("Paused");
  const paused = calls;
  await page.clock.fastForward(20000);
  expect(calls).toBe(paused);
  await page
    .locator(".chart-bottom")
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await expect.poll(() => calls).toBe(paused + 1);
  await page.locator(".live-indicator").click();
  await expect(page.locator(".live-indicator")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
test("Astra scenario is opt-in, separate from candles, clearable and abortable", async ({
  page,
}) => {
  await fixtures(page);
  let calls = 0,
    delay = 0,
    fail = false;
  await page.route("**/api/astra/scenario", async (route) => {
    calls++;
    const request = route.request().postDataJSON();
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (fail) {
      await route
        .fulfill({
          status: 503,
          json: { error: "Source snapshot unavailable." },
        })
        .catch(() => {});
      return;
    }
    const t = Number(
        await page.locator(".sol-chart").getAttribute("data-last-candle"),
      ),
      price = Number(
        await page.locator(".sol-chart").getAttribute("data-last-close"),
      );
    await route
      .fulfill({
        json: {
          ...request,
          hypothetical: true,
          anchor: { t, price },
          points: Array.from({ length: request.steps }, (_, i) => ({
            t: t + (i + 1) * 300000,
            price: price * (1 + (i + 1) / 1000),
          })),
          explanation:
            "Test fixture: a hypothetical path; either direction remains possible.",
          assumptions: ["No predictive accuracy is established."],
          model: "fixture-model",
          source: "Fixture source",
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
        },
      })
      .catch(() => {});
  });
  await enter(page);
  await choose(page);
  await expect(page.locator(".chart-scenario")).toHaveCount(0);
  await settings(page, "Features & Astra");
  await page
    .getByRole("switch", { name: "Enable Astra chart scenarios", exact: true })
    .check();
  await page.getByLabel("Astra scenario horizon").selectOption("12");
  expect(calls).toBe(0);
  await back(page);
  await expect(
    page.getByRole("button", { name: "Generate scenario", exact: true }),
  ).toBeEnabled();
  const candleCount = await page
    .locator(".sol-chart")
    .getAttribute("data-candle-count");
  await page
    .getByRole("button", { name: "Generate scenario", exact: true })
    .click();
  await expect(page.locator(".scenario-detail")).toContainText(
    "hypothetical path",
  );
  expect(calls).toBe(1);
  await expect(page.locator(".sol-chart")).toHaveAttribute(
    "data-candle-count",
    candleCount!,
  );
  await page.getByText("Assumptions & limits", { exact: true }).click();
  await expect(
    page.getByText("No predictive accuracy is established.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Regenerate scenario", exact: true })
    .click();
  await expect.poll(() => calls).toBe(2);
  await expect(
    page.getByRole("button", { name: "Clear scenario", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear scenario", exact: true })
    .click();
  await expect(page.locator(".scenario-detail")).toHaveCount(0);
  delay = 1000;
  await page
    .getByRole("button", { name: "Generate scenario", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stop scenario", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Generate scenario", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".scenario-detail")).toHaveCount(0);
  delay = 0;
  fail = true;
  await page
    .getByRole("button", { name: "Generate scenario", exact: true })
    .click();
  await expect(page.locator(".chart-scenario [role=alert]")).toContainText(
    "Source snapshot unavailable",
  );
  await expect(page.locator(".scenario-detail")).toHaveCount(0);
  await settings(page, "Features & Astra");
  await page
    .getByRole("switch", { name: "Enable Astra chart scenarios", exact: true })
    .uncheck();
  await back(page);
  await expect(page.locator(".chart-scenario")).toHaveCount(0);
});
test("each settings section fits a mobile screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixtures(page);
  await enter(page);
  await launch(page, "Settings");
  for (const section of [
    "Appearance",
    "Chart & live data",
    "Features & Astra",
    "Connections",
    "Layout & data",
  ]) {
    await page.getByRole("tab", { name: section, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
