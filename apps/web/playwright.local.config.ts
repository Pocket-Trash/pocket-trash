import { defineConfig, devices } from "playwright/test";

/** Dedicated origin for the local browser regression harness. */
const baseURL = "http://127.0.0.1:4178";

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  grepInvert: /@mutation/,
  outputDir: "test-results/local",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: "line",
  retries: 0,
  testDir: "./e2e/local",
  testIgnore: ["src/**"],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --config vite.local-e2e.config.ts",
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
  workers: 1,
});
