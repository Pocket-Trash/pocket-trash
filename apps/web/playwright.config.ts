import process from "node:process";
import { defineConfig, devices } from "playwright/test";

/** Credential for CI access to protected Vercel preview deployments. */
const vercelBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();

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
  testIgnore: [
    /local\//,
    ...(process.env.E2E_RUN_MUTATIONS === "true" ? [] : [/mutation\.spec\.ts/]),
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4005",
    screenshot: "only-on-failure",
    trace: vercelBypassSecret ? "off" : "retain-on-failure",
  },
  workers: process.env.CI || process.env.E2E_TARGET === "local" ? 1 : undefined,
  webServer:
    process.env.E2E_TARGET === "local"
      ? [
          {
            command: "node node_modules/vite/bin/vite.js dev --host 127.0.0.1",
            url: "http://localhost:4005",
            reuseExistingServer: false,
            timeout: 120_000,
          },
          {
            command: `node ../api/node_modules/wrangler/bin/wrangler.js dev --config ../api/wrangler.jsonc --local --ip 127.0.0.1 --port 4006 --env preview --var APP_ENV:development --env-file "${process.env.E2E_API_ENV_FILE}"`,
            url: "http://127.0.0.1:4006/api/v0/health",
            reuseExistingServer: false,
            timeout: 120_000,
          },
        ]
      : undefined,
});
