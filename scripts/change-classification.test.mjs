import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

import {
  allMutationE2eSpecs,
  classifyChanges,
  mutationE2eSpecs,
  validationDomains,
} from "./classify-changes.mjs";

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
 * @param {string[]} [details.mutationSpecs] - Selected mutation Playwright specs.
 * @param {string[]} [details.noCodePaths] - Intentionally non-code paths.
 * @param {string[]} [details.unknownPaths] - Unclassified paths.
 * @returns {{domains: Record<string, boolean>, error: "diff-failed" | "malformed-input" | null, mutationSpecs: string[], noCodePaths: string[], unknownPaths: string[]}} Expected response.
 */
function expected(
  enabled,
  {
    error = null,
    mutationSpecs = enabled.includes("mutation_e2e") ? allMutationE2eSpecs : [],
    noCodePaths = [],
    unknownPaths = [],
  } = {},
) {
  return {
    domains: expectedDomains(...enabled),
    error,
    mutationSpecs,
    noCodePaths,
    unknownPaths,
  };
}

test("classifies representative application paths", () => {
  for (const [path, enabled, details] of [
    [
      "apps/api/src/index.ts",
      ["api", "preview", "safe_e2e", "mutation_e2e", "validation"],
    ],
    ["apps/scraper/src/index.ts", ["scraper", "preview", "validation"]],
    [
      "apps/web/src/components/product-card.tsx",
      ["web", "storybook", "preview", "safe_e2e", "validation"],
    ],
    [
      "apps/web/e2e/collection-covers.spec.ts",
      ["web", "preview", "safe_e2e", "mutation_e2e", "validation"],
      { mutationSpecs: mutationE2eSpecs.collections },
    ],
    [
      "apps/web/e2e/local/maker-pagination.spec.ts",
      ["web", "safe_e2e", "validation"],
    ],
    [
      "apps/web/e2e/public.spec.ts",
      ["web", "preview", "safe_e2e", "validation"],
    ],
  ]) {
    assert.deepEqual(classifyChanges([path]), expected(enabled, details), path);
  }
});

test("selects the union of mutation specs for explicit changed domains", () => {
  const paths = [
    "apps/web/src/components/theme-toggle.tsx",
    "apps/web/src/pages/maker-detail-page.tsx",
  ];
  const mutationSpecs = [
    ...mutationE2eSpecs.makers,
    ...mutationE2eSpecs.settings,
  ];

  assert.deepEqual(
    classifyChanges(paths),
    expected(
      ["web", "storybook", "preview", "safe_e2e", "mutation_e2e", "validation"],
      { mutationSpecs },
    ),
  );
});

test("classifies shared mutation surfaces by every affected product domain", () => {
  const catalogMutationSpecs = [
    ...mutationE2eSpecs.collections,
    ...mutationE2eSpecs.makers,
  ];
  const enabled = [
    "web",
    "storybook",
    "preview",
    "safe_e2e",
    "mutation_e2e",
    "validation",
  ];

  for (const path of [
    "apps/web/src/lib/catalog-api.ts",
    "apps/web/src/pages/catalog-form-pages.tsx",
  ]) {
    assert.deepEqual(
      classifyChanges([path]),
      expected(enabled, { mutationSpecs: catalogMutationSpecs }),
      path,
    );
  }

  for (const path of [
    "apps/web/src/lib/upload-sessions.ts",
    "apps/web/src/pages/catalog-pages.tsx",
  ]) {
    assert.deepEqual(
      classifyChanges([path]),
      expected(enabled, { mutationSpecs: mutationE2eSpecs.collections }),
      path,
    );
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

test("assigns every mutation specification to an explicit domain", () => {
  const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
  const specs = execFileSync("git", ["ls-files", "apps/web/e2e/*.spec.ts"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(
      (path) =>
        path &&
        readFileSync(new URL(`../${path}`, import.meta.url), "utf8").includes(
          "@mutation",
        ),
    )
    .map((path) => path.replace(/^apps\/web\//u, ""))
    .sort();

  assert.deepEqual([...allMutationE2eSpecs].sort(), specs);
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
    `mutation_e2e_specs=${JSON.stringify(allMutationE2eSpecs)}`,
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
    expected(["storybook"], { noCodePaths: ["docs/storybook.md"] }),
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
    expected(["preview", "safe_e2e", "mutation_e2e"], {
      noCodePaths: ["docs/e2e-testing.md"],
    }),
  );
  assert.deepEqual(
    classifyChanges(["apps/scraper/src/index.ts"], {
      action: "synchronize",
      labels: ["test:e2e"],
    }),
    expected(["scraper", "preview", "safe_e2e", "mutation_e2e", "validation"]),
  );
  assert.deepEqual(
    classifyChanges(["future/new-path.ts"], {
      action: "labeled",
      eventLabel: "test:storybook",
      labels: ["test:storybook"],
    }),
    expected(validationDomains, { unknownPaths: ["future/new-path.ts"] }),
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
  assert.match(jobs["classify-changes"].if, /action != 'edited'/u);
  assert.match(jobs["classify-changes"].if, /changes\.base != null/u);
  assert.equal(
    jobs["classify-changes"].outputs.unknown_paths,
    "${{ steps.classify.outputs.unknown_paths }}",
  );
  assert.equal(
    jobs["classify-changes"].outputs.mutation_e2e_specs,
    "${{ steps.classify.outputs.mutation_e2e_specs }}",
  );

  assert.equal(jobs.classification.name, "Classification");
  assert.equal(jobs.classification.needs, "classify-changes");
  assert.match(jobs.classification.if, /action != 'edited'/u);
  assert.match(jobs.classification.if, /changes\.base != null/u);
  const requireClassification = jobs.classification.steps.find(
    (step) => step.name === "Require explicit path classification",
  );
  assert.match(requireClassification.run, /Unclassified repository paths:/u);
  assert.match(requireClassification.run, /jq -r/u);

  assert.equal(jobs.metadata.name, "Metadata");
  assert.match(jobs.metadata.if, /github\.event\.action != 'labeled'/u);
  assert.match(jobs.metadata.if, /github\.event\.action != 'unlabeled'/u);
  assert.ok(jobs.metadata.steps.some((step) => step.name === "Lint PR title"));

  for (const [job, name, output] of [
    ["scraper-artifact", "Scraper Artifact", "scraper"],
    ["api-artifact", "API Artifact", "api"],
    ["web-artifact", "Web Artifact", "web"],
    ["lint", "Lint and Typecheck", "validation"],
    ["test", "Test", "validation"],
    ["storybook-test", "Storybook Tests", "storybook"],
    ["drizzle-check", "Drizzle Migration Check", "database_validation"],
  ]) {
    assert.equal(jobs[job].name, name);
    assert.deepEqual(jobs[job].needs, ["security", "classify-changes"]);
    assert.match(jobs[job].if, /needs\.security\.result == 'skipped'/);
    assert.match(jobs[job].if, new RegExp(`outputs\\.${output} == 'true'`));
  }
  assert.match(jobs.security.if, /github\.event\.action != 'edited'/u);
  assert.match(jobs.security.if, /github\.event\.changes\.base != null/u);
  assert.match(jobs.security.if, /github\.event\.action != 'labeled'/);
  assert.equal(jobs.changeset.name, "Changeset");
  assert.match(jobs.changeset.if, /github\.event\.action != 'edited'/u);
  assert.match(jobs.changeset.if, /github\.event\.changes\.base != null/u);
  assert.equal(
    jobs.lint.steps.some((step) => step.name === "Lint PR title"),
    false,
  );
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
  const mutationStep = e2eSteps.find(
    (step) => step.name === "Run isolated E2E mutation fixtures",
  );
  assert.equal(
    mutationStep.env.E2E_MUTATION_SPECS,
    "${{ needs.classify-changes.outputs.mutation_e2e_specs }}",
  );
  assert.match(mutationStep.run, /readarray -t mutation_specs/u);
  assert.match(
    mutationStep.run,
    /"\$\{mutation_specs\[@\]\}" --grep @mutation/u,
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

test("dependency-only tooling does not request mutation isolation", () => {
  const result = classifyChanges(["pnpm-lock.yaml", "pnpm-workspace.yaml"], {
    dependencyChanges: [],
  });
  assert.equal(result.domains.mutation_e2e, false);
  assert.equal(result.domains.database_validation, false);
  assert.equal(result.domains.validation, true);
});

test("lockfile classification follows runtime consumers instead of build tools", async () => {
  const { findDependencyChanges } = await import("./dependency-changes.mjs");
  const base = `lockfileVersion: '9.0'
importers:
  apps/web:
    dependencies:
      react:
        version: 1.0.0
    devDependencies:
      vite:
        version: 1.0.0
snapshots:
  react@1.0.0: {}
  vite@1.0.0:
    dependencies:
      source-map-js: 1.0.0
  source-map-js@1.0.0: {}
packages:
  react@1.0.0: {}
  vite@1.0.0: {}
  source-map-js@1.0.0:
    resolution: {integrity: old}
`;
  const head = base.replace("integrity: old", "integrity: patched");
  const changes = findDependencyChanges(base, head);
  assert.deepEqual(changes, [
    { path: "apps/web/package.json", runtime: false },
  ]);
  const tooling = classifyChanges(["pnpm-lock.yaml"], {
    dependencyChanges: changes,
  });
  assert.equal(tooling.domains.web, true);
  assert.equal(tooling.domains.safe_e2e, true);
  assert.equal(tooling.domains.mutation_e2e, false);
  const runtime = classifyChanges(["pnpm-lock.yaml"], {
    dependencyChanges: findDependencyChanges(
      base,
      base.replace(
        "react@1.0.0: {}",
        "react@1.0.0: {dependencies: {source-map-js: 1.0.0}}",
      ),
    ),
  });
  assert.equal(runtime.domains.mutation_e2e, true);
});

test("root build and lint policy select safe checks without mutation isolation", () => {
  assert.deepEqual(
    classifyChanges(["turbo.json"]),
    expected([
      "api",
      "scraper",
      "web",
      "storybook",
      "preview",
      "safe_e2e",
      "validation",
    ]),
  );
  assert.deepEqual(
    classifyChanges(["biome.json", "skills-lock.json"]),
    expected(["validation"]),
  );
  const lock = readFileSync(
    new URL("../pnpm-lock.yaml", import.meta.url),
    "utf8",
  );
  return import("./dependency-changes.mjs").then(
    ({ findDependencyChanges }) => {
      assert.deepEqual(findDependencyChanges(lock, lock), []);
      const before = lock
        .replaceAll("source-map-js@1.2.2", "source-map-js@1.2.1")
        .replaceAll("source-map-js: 1.2.2", "source-map-js: 1.2.1");
      const result = classifyChanges(["pnpm-lock.yaml"], {
        dependencyChanges: findDependencyChanges(before, lock),
      });
      assert.equal(result.domains.mutation_e2e, false);
      assert.equal(result.domains.database_validation, false);
      assert.equal(result.domains.preview, true);
    },
  );
});

test("unknown graphs stay conservative and explicit E2E overrides tooling-only isolation", () => {
  assert.equal(classifyChanges(["pnpm-lock.yaml"]).domains.mutation_e2e, true);
  assert.equal(
    classifyChanges(["pnpm-lock.yaml"], {
      dependencyChanges: [],
      labels: ["test:e2e"],
    }).domains.mutation_e2e,
    true,
  );
});

test("unresolved workspace links reject dependency classification", async () => {
  const { findDependencyChanges } = await import("./dependency-changes.mjs");
  const lock = `lockfileVersion: '9.0'
importers:
  apps/web:
    dependencies:
      '@package/storage':
        version: link:../../packages/storage
snapshots: {}
packages: {}
`;
  assert.throws(
    () => findDependencyChanges(lock, lock),
    /Unresolved workspace importer/,
  );
});

test("webhook preview label retains schema and runtime mutation isolation", () => {
  for (const file of [
    "packages/database/src/schema/products.ts",
    "apps/api/src/index.ts",
    "apps/web/src/components/collection-form.tsx",
  ]) {
    const regular = classifyChanges([file]);
    const webhook = classifyChanges([file], {
      action: "labeled",
      eventLabel: "preview:webhooks",
      labels: ["preview:webhooks"],
    });
    assert.equal(webhook.domains.mutation_e2e, true, file);
    assert.deepEqual(webhook, regular);
  }
});
