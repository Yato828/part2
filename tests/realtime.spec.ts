import { test, expect, type WebSocketRoute } from "@playwright/test";
import { fixtures, enter, choose, launch, mint, pool, errors } from "./support";
import { poolAccount } from "./poolFixture";
import { WSOL } from "../src/lib/const";
async function selectSol(page: import("@playwright/test").Page) {
  await page.route("**/dex/**", (r) =>
    r.fulfill({
      json: r.request().url().includes("/latest/dex/")
        ? { pairs: [] }
        : [
            {
              chainId: "solana",
              dexId: "orca",
              pairAddress: pool,
              baseToken: { address: WSOL, name: "Solana", symbol: "SOL" },
              priceUsd: "100",
              liquidity: { usd: 100000 },
            },
          ],
    }),
  );
  await page.getByRole("combobox", { name: "Search Solana tokens" }).fill(WSOL);
  await page.getByRole("listbox").getByRole("option").first().click();
  await expect(page.locator(".sol-chart")).toHaveAttribute(
    "data-candle-count",
    "40",
  );
}
function notify(socket: WebSocketRoute, price: number, slot: number) {
  socket.send(
    JSON.stringify({
      method: "accountNotification",
      params: {
        subscription: 77,
        result: { context: { slot }, value: poolAccount(price) },
      },
    }),
  );
}
test.afterEach(async ({ page }) => expect(errors.get(page) ?? []).toEqual([]));
test("pool stream updates candles between source polls, preserves canvas and stops on pause/visibility changes", async ({
  page,
}) => {
  await fixtures(page, { liveSocket: true });
  const sockets: WebSocketRoute[] = [];
  let closed = 0;
  await page.routeWebSocket(/wss:\/\//, (socket) => {
    sockets.push(socket);
    socket.onMessage((raw) => {
      const m = JSON.parse(String(raw));
      if (m.method === "accountSubscribe")
        socket.send(JSON.stringify({ id: m.id, result: 77 }));
    });
    socket.onClose(() => closed++);
  });
  await enter(page);
  await selectSol(page);
  await expect.poll(() => sockets.length).toBe(1);
  const source = await page
    .locator(".sol-chart")
    .getAttribute("data-last-close");
  await page
    .locator(".chart-native")
    .evaluate((el) => el.setAttribute("data-same-canvas", "yes"));
  let navigations = 0;
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) navigations++;
  });
  notify(sockets[0], 100, 100);
  await expect
    .poll(async () =>
      Number(await page.locator(".sol-chart").getAttribute("data-live-price")),
    )
    .toBeCloseTo(100, 8);
  notify(sockets[0], 102, 101);
  await expect
    .poll(async () =>
      Number(
        await page.locator(".sol-chart").getAttribute("data-rendered-close"),
      ),
    )
    .toBeCloseTo(102, 8);
  await expect(page.locator(".token-price")).toContainText(
    "Pool spot · processed",
  );
  expect(await page.locator(".sol-chart").getAttribute("data-last-close")).toBe(
    source,
  );
  await expect(page.locator(".chart-native")).toHaveAttribute(
    "data-same-canvas",
    "yes",
  );
  expect(navigations).toBe(0);
  notify(sockets[0], 999, 99);
  await expect
    .poll(async () =>
      Number(await page.locator(".sol-chart").getAttribute("data-live-price")),
    )
    .toBeCloseTo(102, 8);
  await page.locator(".live-indicator").click();
  await expect.poll(() => closed).toBe(1);
  await expect(page.locator(".spot-feed")).toContainText("Feed paused");
  await page.locator(".live-indicator").click();
  await expect.poll(() => sockets.length).toBe(2);
  notify(sockets[1], 103, 102);
  await expect
    .poll(async () =>
      Number(await page.locator(".sol-chart").getAttribute("data-live-price")),
    )
    .toBeCloseTo(103, 8);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => closed).toBe(2);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => sockets.length).toBe(3);
});
test("unknown pool layouts stay explicitly on source candles; user can reconnect and change stream settings", async ({
  page,
}) => {
  await fixtures(page, { liveSocket: true });
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(/wss:\/\//, (s) => {
    socket = s;
    s.onMessage((raw) => {
      const m = JSON.parse(String(raw));
      if (m.method === "accountSubscribe")
        s.send(JSON.stringify({ id: m.id, result: 77 }));
    });
  });
  await enter(page);
  await selectSol(page);
  await expect.poll(() => !!socket).toBe(true);
  const bad = poolAccount();
  bad.owner = WSOL;
  socket!.send(
    JSON.stringify({
      method: "accountNotification",
      params: {
        subscription: 77,
        result: { context: { slot: 100 }, value: bad },
      },
    }),
  );
  await expect(page.locator(".spot-feed")).toContainText("Source candles only");
  await expect(page.locator(".sol-chart")).toHaveAttribute(
    "data-live-price",
    "",
  );
  await page.getByRole("button", { name: "Reconnect live feed" }).click();
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await page
    .getByRole("tab", { name: "Chart & live data", exact: true })
    .click();
  await page.getByLabel("Live feed commitment").selectOption("confirmed");
  await page
    .getByRole("switch", { name: "Stream live pool prices", exact: true })
    .uncheck();
  await page.getByRole("tab", { name: "Connections", exact: true }).click();
  await page
    .getByLabel("Solana WebSocket endpoint")
    .fill("https://bad.example");
  await page
    .getByRole("button", { name: "Apply endpoint", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("secure wss://");
  await page
    .getByLabel("Solana WebSocket endpoint")
    .fill("wss://node.example/mainnet");
  await page
    .getByRole("button", { name: "Apply endpoint", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("part.preferences.v1")!).streamEndpoint,
    ),
  ).toBe("wss://node.example/mainnet");
  await page
    .getByRole("button", { name: "Use public nodes", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("part.preferences.v1")!).streamEndpoint,
    ),
  ).toBe("");
});
test("X-Ray recovers restricted holder RPC with an indexed owner snapshot and retains it on failed refresh", async ({
  page,
}) => {
  await fixtures(page);
  let fail = false;
  await page.route("**/rugcheck/**", (r) =>
    fail
      ? r.fulfill({ status: 503, json: { error: "Fixture source failure" } })
      : r.fulfill({
          json: {
            mint,
            topHolders: [{ owner: WSOL, uiAmountString: "500", decimals: 6 }],
            token: {
              supply: 1000000000,
              decimals: 6,
              mintAuthority: null,
              freezeAuthority: null,
            },
          },
        }),
  );
  // A limited provider can disable largest-account scans while other RPC methods remain usable.
  await page.route(/\/rpc(?:-backup)?$/, async (r) => {
    const body = r.request().postDataJSON();
    return r.fulfill({
      json: {
        jsonrpc: "2.0",
        id: body.id,
        error: { code: 429, message: "Fixture RPC holder scan restricted" },
      },
    });
  });
  await enter(page);
  await choose(page);
  await launch(page, "Token X-Ray");
  await expect(page.locator(".holder-status")).toContainText("1 owners loaded");
  await expect(page.locator(".holder-status")).toContainText("RugCheck");
  await expect(
    page.locator(".evidence-grid tbody").first().locator("tr"),
  ).toHaveCount(1);
  await expect(page.locator(".evidence-list")).toContainText("Revoked");
  await page.getByText("Holder coverage & sources", { exact: true }).click();
  await expect(
    page.getByText(/does not supply the holder balance timestamp/),
  ).toBeVisible();
  fail = true;
  await page
    .getByRole("button", { name: "Refresh evidence", exact: true })
    .click();
  await expect(page.locator(".holder-status")).toContainText(
    "retained snapshot",
  );
  await expect(
    page.locator(".evidence-grid tbody").first().locator("tr"),
  ).toHaveCount(1);
  await expect(page.getByRole("alert").first()).toContainText(
    "Holder sources are unavailable",
  );
});
