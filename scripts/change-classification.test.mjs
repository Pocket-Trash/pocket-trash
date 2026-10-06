import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

import { classifyChanges, validationDomains } from "./classify-changes.mjs";

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
 * Builds a complete expected domain result.
 *
 * @param {string[]} enabled - Domains expected to be relevant.
 * @returns {Record<string, boolean>} Complete expected domain result.
 */
function expectedDomains(...enabled) {
  return Object.fromEntries(
    validationDomains.map((domain) => [domain, enabled.includes(domain)]),
  );
}

/**
 * Builds a complete expected classification response.
 *
 * @param {string[]} enabled - Domains expected to be relevant.
 * @param {object} [details] - Expected classification metadata.
 * @param {"diff-failed" | "malformed-input" | null} [details.error] - Failure type.
 * @param {string[]} [details.noCodePaths] - Intentionally non-code paths.
 * @param {string[]} [details.unknownPaths] - Unclassified paths.
 * @returns {{domains: Record<string, boolean>, error: "diff-failed" | "malformed-input" | null, noCodePaths: string[], unknownPaths: string[]}} Expected response.
 */
function expected(
  enabled,
  { error = null, noCodePaths = [], unknownPaths = [] } = {},
) {
  return {
    domains: expectedDomains(...enabled),
    error,
    noCodePaths,
    unknownPaths,
  };
}

test("classifies representative application paths", () => {
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
    [
      "apps/web/e2e/public.spec.ts",
      ["web", "preview", "safe_e2e", "validation"],
    ],
  ]) {
    assert.deepEqual(classifyChanges([path]), expected(enabled), path);
  }
});

test("classifies package paths by affected domains", () => {
  for (const [path, enabled] of [
    ["packages/database/src/schema/product.ts", validationDomains],
    ["packages/services/src/index.ts", validationDomains],
    [
      "packages/markdown/src/index.ts",
      ["scraper", "web", "storybook", "preview", "safe_e2e", "validation"],
    ],
    ["packages/lint/index.mjs", ["validation"]],
  ]) {
    assert.deepEqual(classifyChanges([path]), expected(enabled), path);
  }
});

test("classifies workflow and root build configuration conservatively", () => {
  for (const path of [
    ".github/workflows/ci.yml",
    ".github/scripts/ci-log.sh",
    "package.json",
    "pnpm-lock.yaml",
    "turbo.json",
  ]) {
    assert.deepEqual(
      classifyChanges([path]),
      expected(validationDomains),
      path,
    );
  }
});

test("explicitly classifies every tracked repository path", () => {
  const paths = execFileSync("git", ["ls-files"], {
    encoding: "utf8",
    cwd: fileURLToPath(new URL("..", import.meta.url)),
  })
    .trim()
    .split("\n")
    .filter(Boolean);

  assert.deepEqual(classifyChanges(paths).unknownPaths, []);
});

test("returns intentional no-code paths explicitly", () => {
  const paths = ["docs/storybook.md", ".changeset/calm-rules.md", "README.md"];

  assert.deepEqual(
    classifyChanges(paths),
    expected([], { noCodePaths: paths }),
  );
});

test("mixed known paths return an order-independent union", () => {
  const paths = ["apps/api/src/index.ts", "apps/scraper/src/index.ts"];
  const enabled = [
    "api",
    "scraper",
    "preview",
    "safe_e2e",
    "mutation_e2e",
    "validation",
  ];

  assert.deepEqual(classifyChanges(paths), expected(enabled));
  assert.deepEqual(classifyChanges([...paths].reverse()), expected(enabled));
});

test("returns every unknown path and enables every domain", () => {
  const unknownPaths = [
    "tools/new-config.toml",
    "new-root-file.json",
    "new-area/README.md",
  ];

  assert.deepEqual(
    classifyChanges(["apps/web/vite.config.ts", ...unknownPaths]),
    expected(validationDomains, { unknownPaths }),
  );
});

test("reports malformed input and diff failures conservatively", () => {
  for (const files of [null, [null], [""], "apps/web/src/index.ts"]) {
    assert.deepEqual(
      classifyChanges(files),
      expected(validationDomains, { error: "malformed-input" }),
    );
  }

  assert.deepEqual(
    classifyChanges([], { diffFailed: true }),
    expected(validationDomains, { error: "diff-failed" }),
  );
});

test("CLI fails open and exposes a stable error when the diff is unavailable", () => {
  const script = fileURLToPath(
    new URL("./classify-changes.mjs", import.meta.url),
  );
  const allRelevant = `${[
    ...Object.entries(expectedDomains(...validationDomains)).map(
      ([domain, relevant]) => `${domain}=${relevant}`,
    ),
    "unknown_paths=[]",
    "classification_error=diff-failed",
  ].join("\n")}\n`;

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

test("applies persistent label overrides additively", () => {
  assert.deepEqual(
    classifyChanges(["docs/storybook.md"], {
      action: "labeled",
      labels: ["test:storybook"],
    }),
    expected(["storybook"]),
  );
  assert.deepEqual(
    classifyChanges(["apps/api/src/index.ts"], {
      action: "synchronize",
      labels: ["test:storybook"],
    }),
    expected([
      "api",
      "storybook",
      "preview",
      "safe_e2e",
      "mutation_e2e",
      "validation",
    ]),
  );
  assert.deepEqual(
    classifyChanges(["apps/api/src/index.ts"], {
      action: "labeled",
      eventLabel: "triage",
      labels: ["test:storybook", "triage"],
    }),
    expected([]),
  );
  assert.deepEqual(
    classifyChanges(["docs/e2e-testing.md"], {
      action: "labeled",
      eventLabel: "test:e2e",
      labels: ["test:e2e"],
    }),
    expected(["preview", "safe_e2e", "mutation_e2e"]),
  );
  assert.deepEqual(
    classifyChanges(["apps/scraper/src/index.ts"], {
      action: "synchronize",
      labels: ["test:e2e"],
    }),
    expected(["scraper", "preview", "safe_e2e", "mutation_e2e", "validation"]),
  );
});

test("uses the same explicit rules for pushes to main", () => {
  assert.deepEqual(
    classifyChanges(["apps/scraper/src/index.ts"], { eventName: "push" }),
    expected(["scraper", "preview", "validation"]),
  );
  assert.deepEqual(
    classifyChanges(["unknown.config.js"], { eventName: "push" }),
    expected(validationDomains, { unknownPaths: ["unknown.config.js"] }),
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
    assert.deepEqual(jobs[job].needs, ["security", "classify-changes"]);
    assert.match(jobs[job].if, /needs\.security\.result == 'skipped'/);
    assert.match(jobs[job].if, new RegExp(`outputs\\.${output} == 'true'`));
  }
  assert.equal(jobs["classify-changes"].if, "github.event_name != 'schedule'");
  assert.match(jobs.security.if, /github\.event\.action != 'labeled'/);
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
  const githubSecrets = e2eSteps.find(
    (step) => step.name === "Fetch GitHub secrets from Infisical",
  );
  assert.equal(githubSecrets.if, undefined);
  const checkout = e2eSteps.find(
    (step) => step.name === "Check out pull request head",
  );
  assert.equal(checkout.with.ref, "${{ github.event.pull_request.head.sha }}");
  const resolveVercel = e2eSteps.find(
    (step) => step.name === "Resolve Vercel deployment URL",
  );
  assert.equal(
    resolveVercel.env.DEPLOYMENT_ID,
    "${{ needs.preview.outputs.deployment_id }}",
  );
  assert.match(resolveVercel.run, /deployment-url/u);
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
