import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const { scripts } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

test("exposes the safe root E2E command", () => {
  assert.equal(scripts.e2e, "pnpm --filter @app/web test:e2e");
});

test("keeps Studio without the retired visualizer or combined viewer", () => {
  const root = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const database = JSON.parse(
    readFileSync(
      new URL("../packages/database/package.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(
    scripts["db:studio"],
    "pnpm --filter @package/database db:studio",
  );
  assert.equal(scripts["db:view"], undefined);
  for (const command of ["db:view", "db:view:shell", "db:visualizer"]) {
    assert.equal(database.scripts[command], undefined);
  }
  for (const dependency of ["drizzle-lab", "drizzle-view"]) {
    assert.equal(root.devDependencies[dependency], undefined);
  }
});

test("the generated database diagram preserves PostgreSQL array types", () => {
  const diagram = readFileSync(
    new URL("../docs/database-schema-diagram.html", import.meta.url),
    "utf8",
  );
  assert.ok(diagram.includes("storage_targets? text[]"));
});

test("exposes the committed pull-request validation command", () => {
  assert.equal(scripts["validate:pr"], "node scripts/validate-pr.mjs");
});

test("exposes disposable and personal migration validation commands", () => {
  assert.equal(
    scripts["db:validate:chain"],
    "pnpm --filter @package/database db:validate:chain",
  );
  assert.equal(
    scripts["db:validate:personal"],
    "pnpm --filter @package/database db:validate:personal",
  );
});

test("exposes the documented root development commands", () => {
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
