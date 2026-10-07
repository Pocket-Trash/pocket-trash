import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { allMutationE2eSpecs } from "./classify-changes.mjs";

/**
 * Reads one repository file for a static workflow contract.
 *
 * @param {string} path - Repository-relative path.
 * @returns {string} File contents.
 */
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("local browser regressions are isolated from mutation infrastructure", () => {
  const localConfig = read("apps/web/playwright.local.config.ts");
  const deployedConfig = read("apps/web/playwright.config.ts");

  assert.match(localConfig, /testDir: "\.\/e2e\/local"/u);
  assert.match(localConfig, /grepInvert: \/@mutation\//u);
  assert.match(localConfig, /reuseExistingServer: false/u);
  assert.doesNotMatch(localConfig, /globalSetup/u);
  assert.match(deployedConfig, /\/local\\\//u);
});

test("deployed preview smoke and guarded mutation suites remain enabled", () => {
  const workflow = read(".github/workflows/deploy.yml");

  assert.match(workflow, /test:e2e:ci/u);
  assert.match(
    workflow,
    /playwright test "\$\{mutation_specs\[@\]\}" --grep @mutation/u,
  );
  assert.match(workflow, /Verify isolated mutation preview/u);
});

test("workflow classifier fallbacks retain the complete mutation suite", () => {
  const fallback = `echo 'mutation_e2e_specs=${JSON.stringify(allMutationE2eSpecs)}' >> "$GITHUB_OUTPUT"`;

  assert.ok(read(".github/workflows/ci.yml").includes(fallback));
  assert.ok(read(".github/workflows/deploy.yml").includes(fallback));
});
