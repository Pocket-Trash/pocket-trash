import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

import { classifyChanges } from "./classify-changes.mjs";

/** Validation domains emitted by the change classifier. */
const domains = [
  "api",
  "scraper",
  "web",
  "database",
  "storybook",
  "safe_e2e",
  "mutation_e2e",
  "validation",
];

/** Parsed CI workflow under test. */
const ciWorkflow = parse(
  readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
);

/**
 * Builds a complete expected classifier result.
 *
 * @param {string[]} enabled - Domains expected to be relevant.
 * @returns {Record<string, boolean>} Complete expected result.
 */
function expected(...enabled) {
  return Object.fromEntries(
    domains.map((domain) => [domain, enabled.includes(domain)]),
  );
}

test("classifies application and package changes by affected domain", () => {
  for (const [path, enabled] of [
    [
      "apps/api/src/index.ts",
      ["api", "safe_e2e", "mutation_e2e", "validation"],
    ],
    ["apps/scraper/src/index.ts", ["scraper", "validation"]],
    [
      "apps/web/src/components/product-card.tsx",
      ["web", "storybook", "safe_e2e", "mutation_e2e", "validation"],
    ],
    [
      "apps/web/e2e/collection-covers.spec.ts",
      ["web", "safe_e2e", "mutation_e2e", "validation"],
    ],
    ["packages/database/src/schema/product.ts", domains],
    ["packages/figjam/src/cli.ts", ["validation"]],
  ]) {
    assert.deepEqual(classifyChanges([path]), expected(...enabled), path);
  }
});

test("classifies shared dependencies and root build configuration conservatively", () => {
  for (const path of [
    "packages/services/src/index.ts",
    "packages/logger/src/index.ts",
    "packages/tsconfig/base.json",
    "package.json",
    "pnpm-lock.yaml",
    "turbo.json",
  ]) {
    assert.deepEqual(classifyChanges([path]), expected(...domains), path);
  }
});

test("skips documentation-only changes and fails open for unknown paths", () => {
  assert.deepEqual(
    classifyChanges(["docs/storybook.md", ".changeset/calm-rules.md"]),
    expected(),
  );
  assert.deepEqual(
    classifyChanges(["tools/new-config.toml"]),
    expected(...domains),
  );
  assert.deepEqual(classifyChanges([null]), expected(...domains));
  assert.deepEqual(
    classifyChanges([], { diffFailed: true }),
    expected(...domains),
  );
});

test("CLI fails open when the base commit is missing or malformed", () => {
  const script = fileURLToPath(
    new URL("./classify-changes.mjs", import.meta.url),
  );
  const allRelevant = `${Object.entries(expected(...domains))
    .map(([domain, relevant]) => `${domain}=${relevant}`)
    .join("\n")}\n`;

  for (const baseSha of [undefined, "not-a-commit"]) {
    assert.equal(
      execFileSync(process.execPath, [script], {
        encoding: "utf8",
        env: {
          ...process.env,
          BASE_SHA: baseSha,
          GITHUB_OUTPUT: "",
          HEAD_SHA: "HEAD",
        },
        stdio: ["ignore", "pipe", "ignore"],
      }),
      allRelevant,
    );
  }
});

test("applies persistent label overrides without rerunning unrelated jobs", () => {
  assert.deepEqual(
    classifyChanges(["docs/storybook.md"], {
      action: "labeled",
      labels: ["test:storybook"],
    }),
    expected("storybook"),
  );
  assert.deepEqual(
    classifyChanges(["docs/storybook.md"], {
      action: "synchronize",
      labels: ["test:storybook"],
    }),
    expected("storybook"),
  );
  assert.deepEqual(
    classifyChanges(["apps/api/src/index.ts"], {
      action: "labeled",
      labels: ["triage"],
    }),
    expected(),
  );
  assert.deepEqual(
    classifyChanges(["apps/api/src/index.ts"], {
      action: "labeled",
      eventLabel: "triage",
      labels: ["test:storybook", "triage"],
    }),
    expected(),
  );
});

test("uses the same conservative rules for pushes to main", () => {
  assert.deepEqual(
    classifyChanges(["apps/scraper/src/index.ts"], { eventName: "push" }),
    expected("scraper", "validation"),
  );
  assert.deepEqual(
    classifyChanges(["unknown.config.js"], { eventName: "push" }),
    expected(...domains),
  );
});

test("CI keeps required names and gates jobs with one classifier", () => {
  const jobs = ciWorkflow.jobs;

  assert.deepEqual(ciWorkflow.on.pull_request.types, [
    "opened",
    "synchronize",
    "reopened",
    "edited",
    "labeled",
    "unlabeled",
  ]);
  assert.ok(jobs["classify-changes"]);

  for (const [job, name, output] of [
    ["scraper-artifact", "Scraper Artifact", "scraper"],
    ["api-artifact", "API Artifact", "api"],
    ["web-artifact", "Web Artifact", "web"],
    ["lint", "Lint and Typecheck", "validation"],
    ["test", "Test", "validation"],
    ["storybook-test", "Storybook Tests", "storybook"],
    ["drizzle-check", "Drizzle Migration Check", "database"],
  ]) {
    assert.equal(jobs[job].name, name);
    assert.equal(jobs[job].needs, "classify-changes");
    assert.match(jobs[job].if, new RegExp(`outputs\\.${output} == 'true'`));
  }
  assert.equal(jobs.changeset.name, "Changeset");
});
