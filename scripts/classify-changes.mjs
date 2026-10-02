import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Validation domains emitted for GitHub Actions jobs. */
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

/** Absolute repository root used by local and CI checks. */
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Creates a result with every validation domain set to the same value.
 *
 * @param {boolean} value - Relevance assigned to every domain.
 * @returns {Record<string, boolean>} Complete classifier result.
 */
function everyDomain(value) {
  return Object.fromEntries(domains.map((domain) => [domain, value]));
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
 * Classifies changed repository paths for CI, previews, Storybook, and E2E.
 *
 * @param {unknown[]} files - Changed repository-relative paths.
 * @param {object} options - GitHub event context.
 * @param {string} [options.action] - Pull-request event action.
 * @param {boolean} [options.diffFailed] - Whether Git could not produce a diff.
 * @param {string} [options.eventLabel] - Label changed by this event.
 * @param {string} [options.eventName] - GitHub event name.
 * @param {string[]} [options.labels] - Labels currently attached to the PR.
 * @returns {Record<string, boolean>} Complete classifier result.
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
  if (
    diffFailed ||
    !Array.isArray(files) ||
    files.some((file) => typeof file !== "string")
  ) {
    return everyDomain(true);
  }

  const labelEvent =
    eventName === "pull_request" && ["labeled", "unlabeled"].includes(action);
  const result = everyDomain(false);

  if (!labelEvent) {
    for (const file of files) {
      if (
        file.startsWith("docs/") ||
        file.startsWith(".changeset/") ||
        file.endsWith(".md")
      ) {
        continue;
      }

      if (
        [
          "package.json",
          "pnpm-lock.yaml",
          "pnpm-workspace.yaml",
          "turbo.json",
        ].includes(file) ||
        file.startsWith("packages/database/") ||
        file.startsWith("packages/services/") ||
        file.startsWith("packages/logger/") ||
        file.startsWith("packages/tsconfig/") ||
        file === "scripts/classify-changes.mjs" ||
        file === "scripts/change-classification.test.mjs" ||
        file === ".github/workflows/ci.yml"
      ) {
        enable(result, ...domains);
        continue;
      }

      if (file.startsWith("apps/api/")) {
        enable(result, "api", "safe_e2e", "mutation_e2e", "validation");
        continue;
      }

      if (file.startsWith("apps/scraper/")) {
        enable(result, "scraper", "validation");
        continue;
      }

      if (file.startsWith("apps/web/")) {
        enable(result, "web", "safe_e2e", "validation");
        if (!file.startsWith("apps/web/e2e/")) enable(result, "storybook");
        if (
          file.startsWith("apps/web/src/") ||
          (file.startsWith("apps/web/e2e/") &&
            !file.endsWith("public.spec.ts")) ||
          file === "apps/web/package.json" ||
          file === "apps/web/playwright.config.ts"
        ) {
          enable(result, "mutation_e2e");
        }
        continue;
      }

      if (
        file.startsWith("packages/feature-flags/") ||
        file.startsWith("packages/storage/")
      ) {
        enable(
          result,
          "api",
          "scraper",
          "web",
          "storybook",
          "safe_e2e",
          "mutation_e2e",
          "validation",
        );
        continue;
      }

      if (file.startsWith("packages/markdown/")) {
        enable(result, "scraper", "web", "storybook", "safe_e2e", "validation");
        continue;
      }

      if (
        file.startsWith("packages/figjam/") ||
        file.startsWith("packages/github-discord-notifier/") ||
        file.startsWith("packages/infisical-runner/") ||
        file.startsWith("packages/json-data/") ||
        file.startsWith("packages/lint/")
      ) {
        enable(result, "validation");
        continue;
      }

      return everyDomain(true);
    }
  }

  if (
    labels.includes("test:storybook") &&
    (!labelEvent ||
      (action === "labeled" && (eventLabel ?? labels[0]) === "test:storybook"))
  ) {
    enable(result, "storybook");
  }

  return result;
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
  let result;

  try {
    result = classifyChanges(
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
    result = everyDomain(true);
  }

  const output = `${Object.entries(result)
    .map(([domain, relevant]) => `${domain}=${relevant}`)
    .join("\n")}\n`;

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
