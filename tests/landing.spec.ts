import { test, expect } from "@playwright/test";
import { fixtures, errors } from "./support";

test.afterEach(async ({ page }) => expect(errors.get(page) ?? []).toEqual([]));

test("sphere transition waits for the terminal and plays again on the way home", async ({
  page,
}) => {
  await fixtures(page);
  let release: () => void = () => {};
  let intercepted = false;
  const pendingModule = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    /\/(?:src\/App\.tsx|assets\/App-[^/]+\.js)(?:\?|$)/,
    async (route) => {
      intercepted = true;
      await pendingModule;
      await route.continue();
    },
  );
  try {
    await page.goto("/");
    await page
      .locator(".signal-header")
      .getByRole("button", { name: "Enter Terminal", exact: true })
      .click();
    const entering = page.getByRole("status", {
      name: "Opening terminal",
      exact: true,
    });
    await expect(entering).toBeVisible();
    await expect(entering.locator("img")).toHaveAttribute(
      "src",
      "/hero/signal/transition.gif",
    );
    await expect.poll(() => intercepted).toBe(true);
    // A stalled module must keep the GIF visible beyond the decorative delay.
    await page.waitForTimeout(1800);
    await expect(entering).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Search Solana tokens" }),
    ).toHaveCount(0);
    release();
    await expect(
      page.getByRole("combobox", { name: "Search Solana tokens" }),
    ).toBeVisible();
    await expect(entering).toHaveCount(0);
    await page.getByRole("button", { name: "House", exact: false }).click();
    const leaving = page.getByRole("status", {
      name: "Returning home",
      exact: true,
    });
    await expect(leaving).toBeVisible();
    await expect(leaving.locator("img")).toHaveAttribute(
      "src",
      "/hero/signal/transition.gif",
    );
    await expect(leaving).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /See beyond/ }),
    ).toBeVisible();
    await expect(
      page.locator('img[src*="sit.png"], img[src*="degen-"]'),
    ).toHaveCount(0);
  } finally {
    release();
  }
});

test("homepage previews, modal focus and the terminal round trip", async ({
  page,
}) => {
  await fixtures(page);
  const dataRequests: string[] = [];
  page.on("request", (request) => {
    if (
      /\/(api|rpc|gecko|paprika|ray|dex)\b/.test(
        new URL(request.url()).pathname,
      )
    )
      dataRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /See beyond/ })).toBeVisible();
  await page.getByRole("tab", { name: "On-chain intelligence" }).click();
  await expect(
    page.getByRole("heading", { name: "Connect the dots." }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Astra assistant" }).click();
  await expect(
    page.getByRole("heading", { name: "A second perspective." }),
  ).toBeVisible();
  expect(dataRequests).toEqual([]);

  const docs = page.locator(".signal-docs-link");
  await docs.click();
  const dialog = page.getByRole("dialog", { name: "PART documentation" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Close", exact: true }),
  ).toBeFocused();
  expect(await dialog.evaluate((el) => el.matches(":modal"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(docs).toBeFocused();

  await page
    .locator(".signal-hero-buttons")
    .getByRole("button", { name: "Get extension" })
    .click();
  const extension = page.getByRole("dialog", { name: "Get the extension" });
  await expect(
    extension.getByRole("link", { name: /Download archive/ }),
  ).toHaveAttribute("href", "/part-ext.zip");
  await expect(
    extension.getByRole("link", { name: /Download archive/ }),
  ).toHaveAttribute("download", "part-ext.zip");
  await page.keyboard.press("Escape");
  await page
    .locator(".signal-header")
    .getByRole("button", { name: "Enter Terminal", exact: true })
    .click();
  await expect(page.locator(".term-overlay.on")).toBeVisible();
  await expect(page.locator(".chart-native")).toHaveCount(0);
  await page.getByRole("button", { name: "House", exact: false }).click();
  await expect(page.getByRole("heading", { name: /See beyond/ })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.overflow))
    .toBe("");
});

test("mobile navigation, narrow layouts and reduced motion", async ({
  page,
}) => {
  await fixtures(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Astra" }).click();
  await expect(nav).toBeHidden();
  await expect(page).toHaveURL(/#astra$/);
  await expect(
    page.getByRole("heading", { name: /Human instinct/ }),
  ).toBeInViewport();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".signal-header")
    .getByRole("button", { name: "Enter Terminal", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Search Solana tokens" }),
  ).toBeVisible();
  await expect(page.locator(".gate")).toHaveCount(0);
  await page.getByRole("button", { name: "House", exact: false }).click();
  await expect(page.locator(".gate")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /See beyond/ })).toBeVisible();
});
