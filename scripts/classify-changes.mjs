import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Validation domains emitted for local checks and GitHub Actions jobs. */
export const validationDomains = [
  "api",
  "scraper",
  "web",
  "database_validation",
  "storybook",
  "preview",
  "safe_e2e",
  "mutation_e2e",
  "validation",
];

/** Mutation Playwright specifications grouped by the product area they change. */
export const mutationE2eSpecs = {
  collections: [
    "e2e/collection-covers.spec.ts",
    "e2e/collection-lifecycle.spec.ts",
    "e2e/collection-selection.spec.ts",
    "e2e/public-collections.spec.ts",
  ],
  infrastructure: ["e2e/mutation.spec.ts"],
  makers: ["e2e/makers.spec.ts"],
  settings: ["e2e/authenticated.spec.ts"],
};

/** Every mutation domain used for conservative or explicit full-suite runs. */
const allMutationDomains = Object.keys(mutationE2eSpecs);

/** Every mutation specification in stable domain order. */
export const allMutationE2eSpecs = allMutationDomains.flatMap(
  (domain) => mutationE2eSpecs[domain],
);

/** Absolute repository root used by local and CI checks. */
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/** Every validation domain for conservative rules and failures. */
const allDomains = [...validationDomains];

/**
 * Ordered path-to-domain rules shared by local and CI validation.
 *
 * Empty `domains` intentionally classify a path as no-code. More specific
 * rules must precede broader prefixes.
 */
const changeClassificationRules = [
  {
    category: "documentation",
    paths: [
      ".github/pull_request_template.md",
      "AGENTS.md",
      "CHANGELOG.md",
      "CLAUDE.md",
      "README.md",
      "scrapers/README.md",
    ],
    prefixes: [".agents/", ".changeset/", ".claude/", "docs/"],
    domains: [],
  },
  {
    category: "web-public-e2e",
    paths: ["apps/web/e2e/public.spec.ts"],
    domains: ["web", "preview", "safe_e2e", "validation"],
  },
  {
    category: "web-local-e2e",
    paths: [
      "apps/web/playwright.local.config.ts",
      "apps/web/vite.local-e2e.config.ts",
    ],
    prefixes: ["apps/web/e2e/local/"],
    domains: ["web", "safe_e2e", "validation"],
  },
  {
    category: "web-mutation-settings-e2e",
    paths: ["apps/web/e2e/authenticated.spec.ts"],
    domains: ["web", "preview", "safe_e2e", "validation"],
    mutationDomains: ["settings"],
  },
  {
    category: "web-mutation-settings-source",
    patterns: [/^apps\/web\/src\/.*(?:settings|theme).*$/u],
    domains: ["web", "storybook", "preview", "safe_e2e", "validation"],
    mutationDomains: ["settings"],
  },
  {
    category: "web-mutation-catalog-source",
    paths: [
      "apps/web/src/lib/catalog-api.test.ts",
      "apps/web/src/lib/catalog-api.ts",
      "apps/web/src/pages/catalog-form-pages.test.tsx",
      "apps/web/src/pages/catalog-form-pages.tsx",
    ],
    domains: ["web", "storybook", "preview", "safe_e2e", "validation"],
    mutationDomains: ["collections", "makers"],
  },
  {
    category: "web-mutation-makers-e2e",
    paths: ["apps/web/e2e/makers.spec.ts"],
    domains: ["web", "preview", "safe_e2e", "validation"],
    mutationDomains: ["makers"],
  },
  {
    category: "web-mutation-makers-source",
    patterns: [/^apps\/web\/src\/.*maker.*$/u],
    domains: ["web", "storybook", "preview", "safe_e2e", "validation"],
    mutationDomains: ["makers"],
  },
  {
    category: "web-mutation-collections-e2e",
    patterns: [/^apps\/web\/e2e\/.*collection.*\.spec\.ts$/u],
    domains: ["web", "preview", "safe_e2e", "validation"],
    mutationDomains: ["collections"],
  },
  {
    category: "web-mutation-collections-source",
    paths: [
      "apps/web/src/lib/upload-sessions.test.ts",
      "apps/web/src/lib/upload-sessions.ts",
      "apps/web/src/pages/catalog-pages.test.tsx",
      "apps/web/src/pages/catalog-pages.tsx",
    ],
    patterns: [/^apps\/web\/src\/.*collection.*$/u],
    domains: ["web", "storybook", "preview", "safe_e2e", "validation"],
    mutationDomains: ["collections"],
  },
  {
    category: "web-mutation-infrastructure",
    paths: [
      "apps/web/e2e/auth.ts",
      "apps/web/e2e/global.setup.ts",
      "apps/web/e2e/mutation-fixture.ts",
      "apps/web/e2e/mutation-guard.test.ts",
      "apps/web/e2e/mutation-guard.ts",
      "apps/web/e2e/mutation.spec.ts",
      "apps/web/package.json",
      "apps/web/playwright.config.ts",
    ],
    domains: ["web", "preview", "safe_e2e", "validation"],
    mutationDomains: allMutationDomains,
  },
  {
    category: "web-mutation-e2e",
    prefixes: ["apps/web/e2e/"],
    domains: ["web", "preview", "safe_e2e", "validation"],
  },
  {
    category: "web-mutation-capable",
    prefixes: ["apps/web/src/"],
    domains: ["web", "storybook", "preview", "safe_e2e", "validation"],
  },
  {
    category: "web",
    prefixes: ["apps/web/"],
    domains: ["web", "storybook", "preview", "safe_e2e", "validation"],
  },
  {
    category: "api",
    prefixes: ["apps/api/"],
    domains: ["api", "preview", "safe_e2e", "validation"],
    mutationDomains: allMutationDomains,
  },
  {
    category: "scraper",
    prefixes: ["apps/scraper/"],
    domains: ["scraper", "preview", "validation"],
  },
  {
    category: "shared-runtime",
    prefixes: ["packages/feature-flags/", "packages/storage/"],
    domains: [
      "api",
      "scraper",
      "web",
      "storybook",
      "preview",
      "safe_e2e",
      "mutation_e2e",
      "validation",
    ],
    mutationDomains: allMutationDomains,
  },
  {
    category: "shared-markdown",
    prefixes: ["packages/markdown/"],
    domains: [
      "scraper",
      "web",
      "storybook",
      "preview",
      "safe_e2e",
      "validation",
    ],
  },
  {
    category: "validation-tooling",
    prefixes: [
      "packages/github-discord-notifier/",
      "packages/infisical-runner/",
      "packages/json-data/",
      "packages/lint/",
    ],
    domains: ["validation"],
  },
  {
    category: "shared-foundation",
    prefixes: [
      "packages/database/",
      "packages/logger/",
      "packages/services/",
      "packages/tsconfig/",
    ],
    domains: allDomains,
    mutationDomains: allMutationDomains,
  },
  {
    category: "dependency-policy",
    paths: ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"],
    prefixes: ["patches/"],
    domains: ["validation"],
  },
  {
    category: "lint-policy",
    paths: [
      "biome.json",
      "commitlint.config.cjs",
      "eslint.config.mjs",
      "security-audit-exceptions.json",
      "skills-lock.json",
    ],
    prefixes: [".githooks/"],
    domains: ["validation"],
  },
  {
    category: "root-build",
    paths: ["tsconfig.json", "turbo.json"],
    domains: [
      "api",
      "scraper",
      "web",
      "storybook",
      "preview",
      "safe_e2e",
      "validation",
    ],
  },
  {
    category: "railway",
    paths: ["railway.json", ".railwayignore"],
    domains: ["scraper", "preview", "validation"],
  },
  {
    category: "local-scraper-tooling",
    paths: [
      "scripts/dev-scraper.mjs",
      "scripts/scraper-command.mjs",
      "scripts/scraper-redis.mjs",
      "scripts/check-railway-context.mjs",
      "scripts/workspace-packages.mjs",
    ],
    domains: ["scraper", "validation"],
  },
  {
    category: "local-webhook-tooling",
    paths: ["scripts/dev-webhooks.mjs"],
    domains: ["api", "preview", "safe_e2e", "validation"],
    mutationDomains: allMutationDomains,
  },
  {
    category: "standalone-validation-scripts",
    paths: [
      "scripts/audit-bunny-services.mjs",
      "scripts/change-classification.test.mjs",
      "scripts/check-changelog-reminder.mjs",
      "scripts/check-changelog-reminder.test.mjs",
      "scripts/check-jsdoc.mjs",
      "scripts/check-jsdoc.test.mjs",
      "scripts/check-pr-changeset.mjs",
      "scripts/check-pr-changeset.test.mjs",
      "scripts/classify-changes.mjs",
      "scripts/database-change-detection.test.mjs",
      "scripts/dependency-changes.mjs",
      "scripts/developer-commands.test.mjs",
      "scripts/drizzle-view.mjs",
      "scripts/e2e-local-contract.test.mjs",
      "scripts/generate-infrastructure-diagram.mjs",
      "scripts/release.mjs",
      "scripts/release.test.mjs",
      "scripts/security-audit.mjs",
      "scripts/security-policy.test.mjs",
      "scripts/validate-pr.mjs",
      "scripts/validate-pr.test.mjs",
      "scripts/generate-database-schema-diagram.mjs",
      "scripts/database-schema-diagram.template.html",
    ],
    domains: ["validation"],
  },
  {
    category: "repository-validation",
    paths: [
      ".gitignore",
      ".infisical.json",
      ".railwayignore",
      "biome.json",
      "commitlint.config.cjs",
      "eslint.config.mjs",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "railway.json",
      "security-audit-exceptions.json",
      "skills-lock.json",
      "tsconfig.json",
      "turbo.json",
    ],
    prefixes: [
      ".github/scripts/",
      ".github/workflows/",
      ".githooks/",
      "patches/",
      "scrapers/",
      "scripts/",
    ],
    domains: allDomains,
    mutationDomains: allMutationDomains,
  },
];

/**
 * Identifies manifests and dependency policies requiring committed graph comparison.
 * @param {string} file - Repository-relative changed path.
 * @returns {boolean} Whether dependency consumers must be compared.
 */
export function requiresDependencyComparison(file) {
  return (
    file === "package.json" ||
    file.endsWith("/package.json") ||
    ["pnpm-lock.yaml", "pnpm-workspace.yaml"].includes(file) ||
    file.startsWith("patches/")
  );
}

/**
 * Creates a result with every validation domain set to the same value.
 *
 * @param {boolean} value - Relevance assigned to every domain.
 * @returns {Record<string, boolean>} Complete domain result.
 */
function everyDomain(value) {
  return Object.fromEntries(validationDomains.map((domain) => [domain, value]));
}

/**
 * Enables validation domains on an existing result.
 *
 * @param {Record<string, boolean>} result - Result to update.
 * @param {string[]} enabled - Domains to enable.
 */
function enable(result, ...enabled) {
  for (const domain of enabled) result[domain] = true;
}

/**
 * Finds the first explicit classification rule for a repository path.
 *
 * @param {string} file - Repository-relative path.
 * @returns {(typeof changeClassificationRules)[number] | undefined} Rule, if known.
 */
function findRule(file) {
  return changeClassificationRules.find(
    (rule) =>
      rule.paths?.includes(file) ||
      rule.prefixes?.some((prefix) => file.startsWith(prefix)) ||
      rule.patterns?.some((pattern) => pattern.test(file)),
  );
}

/**
 * Resolves mutation domains to a stable de-duplicated Playwright spec list.
 *
 * @param {Set<string>} domains - Mutation product areas selected by changes.
 * @returns {string[]} Playwright spec paths for the selected areas.
 */
function selectMutationSpecs(domains) {
  return allMutationDomains.flatMap((domain) =>
    domains.has(domain) ? mutationE2eSpecs[domain] : [],
  );
}

/**
 * Builds a complete classification response.
 *
 * @param {Record<string, boolean>} domains - Selected validation domains.
 * @param {object} [details] - Classification metadata.
 * @param {"diff-failed" | "malformed-input" | null} [details.error] - Failure type.
 * @param {string[]} [details.noCodePaths] - Intentionally non-code paths.
 * @param {string[]} [details.unknownPaths] - Paths missing an explicit rule.
 * @param {string[]} [details.mutationSpecs] - Selected mutation Playwright specs.
 * @returns {{domains: Record<string, boolean>, error: "diff-failed" | "malformed-input" | null, mutationSpecs: string[], noCodePaths: string[], unknownPaths: string[]}} Classification response.
 */
function response(
  domains,
  {
    error = null,
    mutationSpecs = [],
    noCodePaths = [],
    unknownPaths = [],
  } = {},
) {
  return { domains, error, mutationSpecs, noCodePaths, unknownPaths };
}

/**
 * Classifies changed repository paths for CI, previews, Storybook, and E2E.
 *
 * @param {unknown[]} files - Changed repository-relative paths.
 * @param {object} options - GitHub event context.
 * @param {string} [options.action] - Pull-request event action.
 * @param {Array<{path: string, runtime: boolean}>} [options.dependencyChanges] - Lockfile consumers affected by dependency graph changes; absent means unknown.
 * @param {boolean} [options.diffFailed] - Whether Git could not produce a diff.
 * @param {string} [options.eventLabel] - Label changed by this event.
 * @param {string} [options.eventName] - GitHub event name.
 * @param {string[]} [options.labels] - Labels currently attached to the PR.
 * @returns {{domains: Record<string, boolean>, error: "diff-failed" | "malformed-input" | null, mutationSpecs: string[], noCodePaths: string[], unknownPaths: string[]}} Classification response.
 */
export function classifyChanges(
  files,
  {
    action = "synchronize",
    diffFailed = false,
    dependencyChanges,
    eventLabel,
    eventName = "pull_request",
    labels = [],
  } = {},
) {
  if (diffFailed) {
    return response(everyDomain(true), {
      error: "diff-failed",
      mutationSpecs: allMutationE2eSpecs,
    });
  }

  if (
    !Array.isArray(files) ||
    files.some((file) => typeof file !== "string" || file.length === 0)
  ) {
    return response(everyDomain(true), {
      error: "malformed-input",
      mutationSpecs: allMutationE2eSpecs,
    });
  }

  const labelEvent =
    eventName === "pull_request" &&
    ["labeled", "unlabeled"].includes(action) &&
    !(action === "labeled" && eventLabel === "preview:webhooks");
  const domains = everyDomain(false);
  const mutationDomains = new Set();
  const noCodePaths = [];
  const unknownPaths = [];

  for (const file of files) {
    const rule = findRule(file);

    if (!rule) {
      unknownPaths.push(file);
      continue;
    }

    if (rule.domains.length === 0) noCodePaths.push(file);
    else if (!labelEvent) {
      if (requiresDependencyComparison(file)) {
        enable(domains, "validation");
        if (dependencyChanges === undefined) {
          enable(domains, ...validationDomains);
          for (const domain of allMutationDomains) mutationDomains.add(domain);
        }
      } else {
        enable(domains, ...rule.domains);
        for (const domain of rule.mutationDomains ?? [])
          mutationDomains.add(domain);
      }
    }
  }

  if (!labelEvent && dependencyChanges) {
    for (const { path, runtime } of dependencyChanges) {
      const rule = findRule(path);
      if (!rule || path === "package.json") {
        enable(
          domains,
          ...validationDomains.filter(
            (domain) =>
              runtime ||
              !["database_validation", "mutation_e2e"].includes(domain),
          ),
        );
        if (runtime)
          for (const domain of allMutationDomains) mutationDomains.add(domain);
      } else {
        enable(
          domains,
          ...rule.domains.filter(
            (domain) =>
              runtime ||
              !["database_validation", "mutation_e2e"].includes(domain),
          ),
        );
        if (runtime)
          for (const domain of rule.mutationDomains ?? [])
            mutationDomains.add(domain);
      }
    }
  }

  if (unknownPaths.length > 0) {
    enable(domains, ...validationDomains);
    for (const domain of allMutationDomains) mutationDomains.add(domain);
  }

  if (
    labels.includes("test:storybook") &&
    (!labelEvent ||
      (action === "labeled" && (eventLabel ?? labels[0]) === "test:storybook"))
  ) {
    enable(domains, "storybook");
  }

  if (
    labels.includes("test:e2e") &&
    (!labelEvent ||
      (action === "labeled" && (eventLabel ?? labels[0]) === "test:e2e"))
  ) {
    enable(domains, "preview", "safe_e2e", "mutation_e2e");
    for (const domain of allMutationDomains) mutationDomains.add(domain);
  }

  const mutationSpecs = selectMutationSpecs(mutationDomains);
  domains.mutation_e2e = mutationSpecs.length > 0;
  return response(domains, { mutationSpecs, noCodePaths, unknownPaths });
}

/**
 * Lists files changed between two commits.
 *
 * @param {object} options - Git comparison inputs.
 * @param {string} options.baseSha - Base commit SHA.
 * @param {string} options.headSha - Head commit SHA.
 * @param {string} [options.cwd] - Repository working directory.
 * @returns {string[]} Changed repository-relative paths.
 * @throws When either commit is missing or Git cannot compare them.
 */
export function getChangedFiles({ baseSha, headSha, cwd = repoRoot }) {
  if (!baseSha || !headSha)
    throw new Error("BASE_SHA and HEAD_SHA are required.");

  return execFileSync(
    "git",
    ["diff", "--name-only", `${baseSha}...${headSha}`],
    {
      cwd,
      encoding: "utf8",
    },
  )
    .trim()
    .split("\n")
    .filter(Boolean);
}

/** Writes classifier outputs for GitHub Actions, failing open on diff errors. */
async function main() {
  let classification;

  try {
    const options = {
      baseSha: process.env.BASE_SHA,
      headSha: process.env.HEAD_SHA,
      cwd: repoRoot,
    };
    const files = getChangedFiles(options);
    let dependencyChanges;
    if (files.some(requiresDependencyComparison)) {
      try {
        const { getDependencyChanges } = await import(
          "./dependency-changes.mjs"
        );
        dependencyChanges = getDependencyChanges(options);
      } catch {
        /* Unknown dependency graphs retain full validation and isolation. */
      }
    }
    classification = classifyChanges(files, {
      dependencyChanges,
      action: process.env.EVENT_ACTION,
      eventLabel: process.env.EVENT_LABEL,
      eventName: process.env.EVENT_NAME,
      labels: JSON.parse(process.env.PR_LABELS || "[]") ?? [],
    });
  } catch {
    classification = response(everyDomain(true), {
      error: "diff-failed",
      mutationSpecs: allMutationE2eSpecs,
    });
  }

  const output = `${[
    ...Object.entries(classification.domains).map(
      ([domain, relevant]) => `${domain}=${relevant}`,
    ),
    `mutation_e2e_specs=${JSON.stringify(classification.mutationSpecs)}`,
    `unknown_paths=${JSON.stringify(classification.unknownPaths)}`,
    `classification_error=${classification.error ?? ""}`,
  ].join("\n")}\n`;

  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, output);
  else process.stdout.write(output);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
