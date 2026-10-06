import { execFileSync, spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { classifyChanges, getChangedFiles } from "./classify-changes.mjs";

/** Absolute repository root used by pull-request validation. */
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/** Default comparison ref for pull requests targeting the main branch. */
const defaultBaseRef = "origin/main";

/**
 * Parses the optional comparison base.
 *
 * @param {string[]} args - Command-line arguments after the script name.
 * @returns {{baseRef: string}} Parsed validation options.
 * @throws When more than one comparison base is provided.
 */
export function parseArguments(args) {
  const positionalArgs = args[0] === "--" ? args.slice(1) : args;

  if (positionalArgs.length > 1) {
    throw new Error("Usage: pnpm validate:pr -- [comparison-base]");
  }

  return { baseRef: positionalArgs[0] || defaultBaseRef };
}

/**
 * Requires the validation target to match the committed worktree state.
 *
 * @param {string} status - Porcelain Git status output.
 * @throws When tracked or untracked changes are present.
 */
export function assertCleanStatus(status) {
  if (status.trim()) {
    throw new Error(
      `The worktree must be clean before final validation. Commit or remove these changes:\n${status.trim()}`,
    );
  }
}

/**
 * Reads tracked and untracked worktree changes for validation preconditions.
 *
 * @param {string} [cwd] - Repository working directory.
 * @returns {string} Porcelain Git status output.
 * @throws When Git cannot inspect the worktree.
 */
function getWorktreeStatus(cwd = repoRoot) {
  return execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    {
      cwd,
      encoding: "utf8",
    },
  );
}

/**
 * Rejects failed or incomplete path classification.
 *
 * @param {{error: string | null, unknownPaths: string[]}} classification - Classification metadata.
 * @throws When Git comparison failed or paths lack explicit rules.
 */
export function assertKnownPaths(classification) {
  if (classification.error) {
    throw new Error(
      `Change classification failed (${classification.error}). Verify the comparison base and rerun validation.`,
    );
  }

  if (classification.unknownPaths.length > 0) {
    throw new Error(
      [
        "Unclassified repository paths:",
        ...classification.unknownPaths.map((path) => `- ${path}`),
        "Add explicit coverage in scripts/classify-changes.mjs and scripts/change-classification.test.mjs, commit it, then rerun validation.",
      ].join("\n"),
    );
  }
}

/**
 * Builds the ordered local validation plan for selected domains.
 *
 * @param {Record<string, boolean>} domains - Selected validation domains.
 * @returns {Array<{args: string[], command: string, id: string, label: string, reason: string, requiresCredentials: boolean, selected: boolean}>} Validation checks.
 */
export function createValidationPlan(domains) {
  return [
    {
      id: "format",
      label: "Formatting verification",
      command: "pnpm",
      args: ["exec", "biome", "check", "--linter-enabled=false", "."],
      selected: true,
      requiresCredentials: false,
      reason: "required for every pull request",
    },
    {
      id: "changeset",
      label: "Committed Changeset",
      command: process.execPath,
      args: ["scripts/check-pr-changeset.mjs"],
      selected: true,
      requiresCredentials: false,
      reason: "required for every pull request",
    },
    {
      id: "lint",
      label: "Lint",
      command: "pnpm",
      args: ["lint"],
      selected: domains.validation,
      requiresCredentials: false,
      reason: "no validation-domain changes",
    },
    {
      id: "typecheck",
      label: "Typecheck",
      command: "pnpm",
      args: ["typecheck"],
      selected: domains.validation,
      requiresCredentials: false,
      reason: "no validation-domain changes",
    },
    {
      id: "test",
      label: "Unit and workflow tests",
      command: "pnpm",
      args: ["test:ci"],
      selected: domains.validation,
      requiresCredentials: false,
      reason: "no validation-domain changes",
    },
    {
      id: "database-chain",
      label: "Disposable database migration chain",
      command: "pnpm",
      args: ["db:validate:chain"],
      selected: domains.database,
      requiresCredentials: false,
      reason: "no database-domain changes",
    },
    {
      id: "api-build",
      label: "API build",
      command: "pnpm",
      args: ["exec", "turbo", "run", "build", "--filter=@app/api"],
      selected: domains.api,
      requiresCredentials: false,
      reason: "no API-domain changes",
    },
    {
      id: "scraper-build",
      label: "Scraper build",
      command: "pnpm",
      args: ["exec", "turbo", "run", "build", "--filter=@app/scraper"],
      selected: domains.scraper,
      requiresCredentials: false,
      reason: "no scraper-domain changes",
    },
    {
      id: "local-e2e",
      label: "Local browser regressions",
      command: "pnpm",
      args: ["e2e:local"],
      selected: domains.web && domains.safe_e2e,
      requiresCredentials: false,
      reason: "no local web-regression domains changed",
    },
    {
      id: "storybook-test",
      label: "Storybook tests",
      command: "pnpm",
      args: ["--filter", "@app/web", "test-storybook"],
      selected: domains.storybook,
      requiresCredentials: false,
      reason: "no Storybook-domain changes",
    },
    {
      id: "storybook-build",
      label: "Storybook build",
      command: "pnpm",
      args: ["--filter", "@app/web", "build-storybook"],
      selected: domains.storybook,
      requiresCredentials: false,
      reason: "no Storybook-domain changes",
    },
    {
      id: "infisical-auth",
      label: "Infisical authentication",
      command: "pnpm",
      args: ["infisical:check"],
      selected: domains.validation,
      requiresCredentials: true,
      reason: "no validation-domain changes",
    },
    {
      id: "web-build",
      label: "Web build",
      command: "pnpm",
      args: ["exec", "turbo", "run", "build", "--filter=@app/web"],
      selected: domains.web,
      requiresCredentials: true,
      reason: "no web-domain changes",
    },
    {
      id: "database-personal",
      label: "Personal Neon migration history",
      command: "pnpm",
      args: ["db:validate:personal"],
      selected: domains.database,
      requiresCredentials: true,
      reason: "no database-domain changes",
    },
  ];
}

/**
 * Resolves the committed comparison range and changed files.
 *
 * @param {object} options - Git comparison options.
 * @param {string} options.baseRef - Branch, tag, or commit to compare.
 * @param {string} [options.cwd] - Repository working directory.
 * @returns {{baseRef: string, files: string[], headSha: string, mergeBase: string}} Comparison context.
 * @throws When Git cannot resolve the base, head, or merge-base.
 */
export function getValidationContext({ baseRef, cwd = repoRoot }) {
  /**
   * Runs Git in the repository used for this comparison.
   *
   * @param {...string} args - Git arguments.
   * @returns {string} Trimmed standard output.
   * @throws When Git exits unsuccessfully.
   */
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  const headSha = git("rev-parse", "HEAD");
  let mergeBase;

  try {
    mergeBase = git("merge-base", baseRef, headSha);
  } catch {
    throw new Error(
      `Cannot compare with ${baseRef}. Fetch the ref or pass the pull request base explicitly: pnpm validate:pr -- <base-ref>`,
    );
  }

  return {
    baseRef,
    files: getChangedFiles({ baseSha: mergeBase, cwd, headSha }),
    headSha,
    mergeBase,
  };
}

/**
 * Formats elapsed milliseconds for validation output.
 *
 * @param {number} milliseconds - Elapsed milliseconds.
 * @returns {string} Human-readable seconds.
 */
function formatDuration(milliseconds) {
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

/**
 * Runs one validation check with inherited output.
 *
 * @param {{args: string[], command: string, label: string}} check - Check command.
 * @param {object} options - Execution options.
 * @param {string} options.baseSha - Merge-base commit SHA.
 * @param {string} options.cwd - Repository working directory.
 * @param {string} options.headSha - Validated head commit SHA.
 * @returns {number} Elapsed milliseconds.
 * @throws When the check exits unsuccessfully.
 */
function runCheck(check, { baseSha, cwd, headSha }) {
  const startedAt = performance.now();
  const result = spawnSync(check.command, check.args, {
    cwd,
    env: { ...process.env, BASE_SHA: baseSha, HEAD_SHA: headSha },
    stdio: "inherit",
  });
  const elapsed = performance.now() - startedAt;

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${check.label} failed after ${formatDuration(elapsed)}. Fix the output above, commit the result, and rerun validate:pr.`,
    );
  }

  return elapsed;
}

/**
 * Validates the clean, committed pull-request state.
 *
 * @returns {void}
 * @throws When preconditions, classification, or a selected check fails.
 */
function main() {
  const { baseRef } = parseArguments(process.argv.slice(2));
  assertCleanStatus(getWorktreeStatus());

  const context = getValidationContext({ baseRef });
  const classification = classifyChanges(context.files);
  assertKnownPaths(classification);
  const plan = createValidationPlan(classification.domains);
  const selected = plan
    .filter((check) => check.selected)
    .toSorted(
      (left, right) =>
        Number(left.requiresCredentials) - Number(right.requiresCredentials),
    );
  const skipped = plan.filter((check) => !check.selected);

  console.log(
    `Comparison base: ${baseRef} (${context.mergeBase.slice(0, 12)})`,
  );
  console.log(`Committed head: ${context.headSha.slice(0, 12)}`);
  console.log(`Changed paths: ${context.files.length}`);
  console.log(
    `Selected domains: ${
      Object.entries(classification.domains)
        .filter(([, relevant]) => relevant)
        .map(([domain]) => domain)
        .join(", ") || "none"
    }`,
  );
  console.log("Selected checks:");
  for (const check of selected) console.log(`- ${check.label}`);
  console.log("Skipped checks:");
  for (const check of skipped) console.log(`- ${check.label}: ${check.reason}`);

  const startedAt = performance.now();
  for (const [index, check] of selected.entries()) {
    console.log(`\n[${index + 1}/${selected.length}] ${check.label}`);
    const elapsed = runCheck(check, {
      baseSha: context.mergeBase,
      cwd: repoRoot,
      headSha: context.headSha,
    });
    console.log(`Passed ${check.label} (${formatDuration(elapsed)})`);
  }

  assertCleanStatus(getWorktreeStatus());

  console.log(
    `\nPull-request validation passed (${formatDuration(performance.now() - startedAt)}).`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `validate:pr failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
