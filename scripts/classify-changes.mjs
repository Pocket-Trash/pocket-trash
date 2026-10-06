import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Validation domains emitted for local checks and GitHub Actions jobs. */
export const validationDomains = [
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
    category: "web-mutation-e2e",
    prefixes: ["apps/web/e2e/"],
    domains: ["web", "preview", "safe_e2e", "mutation_e2e", "validation"],
  },
  {
    category: "web-mutation-capable",
    paths: ["apps/web/package.json", "apps/web/playwright.config.ts"],
    prefixes: ["apps/web/src/"],
    domains: [
      "web",
      "storybook",
      "preview",
      "safe_e2e",
      "mutation_e2e",
      "validation",
    ],
  },
  {
    category: "web",
    prefixes: ["apps/web/"],
    domains: ["web", "storybook", "preview", "safe_e2e", "validation"],
  },
  {
    category: "api",
    prefixes: ["apps/api/"],
    domains: ["api", "preview", "safe_e2e", "mutation_e2e", "validation"],
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
  },
];

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
      rule.prefixes?.some((prefix) => file.startsWith(prefix)),
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
 * @returns {{domains: Record<string, boolean>, error: "diff-failed" | "malformed-input" | null, noCodePaths: string[], unknownPaths: string[]}} Classification response.
 */
function response(
  domains,
  { error = null, noCodePaths = [], unknownPaths = [] } = {},
) {
  return { domains, error, noCodePaths, unknownPaths };
}

/**
 * Classifies changed repository paths for CI, previews, Storybook, and E2E.
 *
 * @param {unknown[]} files - Changed repository-relative paths.
 * @param {object} options - GitHub event context.
 * @param {string} [options.action] - Pull-request event action.
 * @param {boolean} [options.diffFailed] - Whether Git could not produce a diff.
 * @param {string} [options.eventLabel] - Label changed by this event.
 * @param {string} [options.eventName] - GitHub event name.
 * @param {string[]} [options.labels] - Labels currently attached to the PR.
 * @returns {{domains: Record<string, boolean>, error: "diff-failed" | "malformed-input" | null, noCodePaths: string[], unknownPaths: string[]}} Classification response.
 */
export function classifyChanges(
  files,
  {
    action = "synchronize",
    diffFailed = false,
    eventLabel,
    eventName = "pull_request",
    labels = [],
  } = {},
) {
  if (diffFailed) {
    return response(everyDomain(true), { error: "diff-failed" });
  }

  if (
    !Array.isArray(files) ||
    files.some((file) => typeof file !== "string" || file.length === 0)
  ) {
    return response(everyDomain(true), { error: "malformed-input" });
  }

  const labelEvent =
    eventName === "pull_request" && ["labeled", "unlabeled"].includes(action);
  const domains = everyDomain(false);
  const noCodePaths = [];
  const unknownPaths = [];

  for (const file of files) {
    const rule = findRule(file);

    if (!rule) {
      unknownPaths.push(file);
      continue;
    }

    if (rule.domains.length === 0) noCodePaths.push(file);
    else if (!labelEvent) enable(domains, ...rule.domains);
  }

  if (unknownPaths.length > 0) enable(domains, ...validationDomains);

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
  }

  return response(domains, { noCodePaths, unknownPaths });
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
function main() {
  let classification;

  try {
    classification = classifyChanges(
      getChangedFiles({
        baseSha: process.env.BASE_SHA,
        headSha: process.env.HEAD_SHA,
      }),
      {
        action: process.env.EVENT_ACTION,
        eventLabel: process.env.EVENT_LABEL,
        eventName: process.env.EVENT_NAME,
        labels: JSON.parse(process.env.PR_LABELS || "[]") ?? [],
      },
    );
  } catch {
    classification = response(everyDomain(true), { error: "diff-failed" });
  }

  const output = `${[
    ...Object.entries(classification.domains).map(
      ([domain, relevant]) => `${domain}=${relevant}`,
    ),
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
  main();
}
