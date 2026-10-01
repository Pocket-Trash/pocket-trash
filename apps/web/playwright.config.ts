import process from "node:process";
import { defineConfig, devices } from "playwright/test";

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  globalSetup: "./e2e/global.setup.ts",
  grepInvert:
    process.env.E2E_RUN_MUTATIONS === "true" ? undefined : /@mutation/,
  outputDir: "test-results",
  projects: [
    {
      name: "chromium",
      testMatch: /.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [
    ["line"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  retries: process.env.CI ? 1 : 0,
  testDir: "./e2e",
  testIgnore:
    process.env.E2E_RUN_MUTATIONS === "true" ? undefined : /mutation\.spec\.ts/,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:4005",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  workers: process.env.CI ? 1 : undefined,
});
