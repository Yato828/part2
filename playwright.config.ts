import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PART_TEST_BASE || "http://localhost:4664",
    channel: process.env.CI ? undefined : "chrome",
    viewport: { width: 1440, height: 900 },
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
