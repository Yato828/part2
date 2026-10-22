import { test, expect } from "@playwright/test";
import { fixtures, choose, mint, pool, wallet, errors } from "./support";

test.afterEach(async ({ page }) => expect(errors.get(page) ?? []).toEqual([]));

test("extension wallet link opens the selected mint over an existing saved workspace", async ({
  page,
}) => {
  await fixtures(page);
  await page.addInitScript(
    ({ wallet, pool }) => {
      localStorage.setItem(
        "part.workspace.v1",
        JSON.stringify({
          version: 1,
          open: ["terminal", "settings"],
          active: "settings",
          pinned: [],
          selectedMint: wallet,
          selectedPool: pool,
          maximized: true,
        }),
      );
    },
    { wallet, pool },
  );
  await page.goto(`/?terminal=1&mint=${mint}`);
  await expect(page.locator(".term-overlay.on")).toBeVisible();
  await expect(page.locator(".workspace-context")).toContainText("USDC");
  await expect(page.locator(".sol-chart")).toHaveAttribute(
    "data-candle-count",
    "40",
  );
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("part.workspace.v1") ?? "{}")
            .selectedMint,
      ),
    )
    .toBe(mint);
  await page.getByRole("button", { name: "House", exact: false }).click();
  await expect(page.locator(".term-overlay.on")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /See beyond/ })).toBeVisible();
});

test("an unavailable linked mint stays empty and can be selected through search after recovery", async ({
  page,
}) => {
  await fixtures(page);
  let available = false;
  await page.route(`**/dex/token-pairs/v1/solana/${mint}`, (route) =>
    available ? route.fallback() : route.fulfill({ json: [] }),
  );
  await page.goto(`/?terminal=1&mint=${mint}`);
  await expect(page.locator(".term-overlay.on")).toBeVisible();
  await expect(page.locator(".sol-status")).toContainText(
    "Linked token unavailable",
  );
  await expect(page.locator(".chart-native")).toHaveCount(0);
  available = true;
  await choose(page);
  await expect(page.locator(".sol-chart")).toHaveAttribute(
    "data-candle-count",
    "40",
  );
});
