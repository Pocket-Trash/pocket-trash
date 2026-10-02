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
  "preview",
  "safe_e2e",
  "mutation_e2e",
  "validation",
];

/** Parsed CI workflow under test. */
const ciWorkflow = parse(
  readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
);

/** Parsed Deploy workflow under test. */
const deployWorkflow = parse(
  readFileSync(
    new URL("../.github/workflows/deploy.yml", import.meta.url),
    "utf8",
  ),
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
      ["api", "preview", "safe_e2e", "mutation_e2e", "validation"],
    ],
    ["apps/scraper/src/index.ts", ["scraper", "preview", "validation"]],
    [
      "apps/web/src/components/product-card.tsx",
      ["web", "storybook", "preview", "safe_e2e", "mutation_e2e", "validation"],
    ],
    [
      "apps/web/e2e/collection-covers.spec.ts",
      ["web", "preview", "safe_e2e", "mutation_e2e", "validation"],
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
  assert.deepEqual(
    classifyChanges(["docs/e2e-testing.md"], {
      action: "labeled",
      eventLabel: "test:e2e",
      labels: ["test:e2e"],
    }),
    expected("preview", "safe_e2e", "mutation_e2e"),
  );
  assert.deepEqual(
    classifyChanges(["docs/e2e-testing.md"], {
      action: "synchronize",
      labels: ["test:e2e"],
    }),
    expected("preview", "safe_e2e", "mutation_e2e"),
  );
});

test("uses the same conservative rules for pushes to main", () => {
  assert.deepEqual(
    classifyChanges(["apps/scraper/src/index.ts"], { eventName: "push" }),
    expected("scraper", "preview", "validation"),
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

test("Deploy gates preview work and runs Playwright in a separate job", () => {
  assert.equal(deployWorkflow.on.pull_request.paths, undefined);

  const jobs = deployWorkflow.jobs;
  assert.ok(jobs["classify-changes"]);
  assert.equal(jobs.preview.needs, "classify-changes");
  assert.match(jobs.preview.if, /outputs\.preview == 'true'/u);

  assert.deepEqual(jobs.e2e.needs, ["classify-changes", "preview"]);
  assert.match(jobs.e2e.if, /outputs\.safe_e2e == 'true'/u);
  assert.match(jobs.e2e.if, /outputs\.mutation_e2e == 'true'/u);

  const previewSteps = jobs.preview.steps;
  assert.equal(
    previewSteps.some((step) => /Playwright|E2E/u.test(step.name ?? "")),
    false,
  );

  const e2eSteps = jobs.e2e.steps;
  const checkout = e2eSteps.find(
    (step) => step.name === "Check out pull request head",
  );
  assert.equal(checkout.with.ref, "${{ github.event.pull_request.head.sha }}");
  assert.ok(e2eSteps.some((step) => step.name === "Run safe E2E smoke tests"));
  assert.ok(
    e2eSteps.some((step) => step.name === "Run isolated E2E mutation fixtures"),
  );
  assert.ok(
    e2eSteps.some((step) => step.name === "Upload failed Playwright report"),
  );

  const prepareDatabase = previewSteps.find(
    (step) => step.name === "Prepare Neon preview database",
  );
  assert.match(
    prepareDatabase.env.ISOLATION_REQUIRED,
    /outputs\.mutation_e2e/u,
  );
});
