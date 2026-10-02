import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("exposes the documented root development commands", () => {
  const { scripts } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );

  assert.equal(
    scripts.dev,
    "turbo run dev --filter=@app/api --filter=@app/web --filter=@package/logger",
  );
  assert.equal(
    scripts["dev:all"],
    "turbo run dev --filter='./apps/*' --filter=@package/logger",
  );
  assert.equal(
    scripts["dev:webhooks"],
    "pnpm users:reconcile && tsx packages/infisical-runner/src/cli.ts webhooks listen -- node scripts/dev-webhooks.mjs",
  );
  for (const command of [
    "check",
    "dev:web",
    "dev:web:verbose",
    "dev:web:webhooks",
    "scraper:process",
    "scraper:scrape:autmog",
    "scraper:scrape:grimsmo-fjell",
    "scraper:scrape:grimsmo-norseman",
    "scraper:scrape:grimsmo-rask",
    "scraper:scrape:grimsmo-saga",
  ]) {
    assert.equal(scripts[command], undefined, command);
  }
  assert.deepEqual(Object.keys(scripts), Object.keys(scripts).toSorted());
});
