import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Changelog source registry that proves a customer-facing update was considered. */
const changelogRegistry = "apps/web/src/lib/changelog-content.ts";
/** Absolute repository root used by local and CI checks. */
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Decides whether changed files need a non-blocking changelog reminder.
 *
 * @param files - Changed repository-relative paths.
 * @returns Whether customer-facing web files changed without the registry.
 */
export function needsChangelogReminder(files) {
  if (files.includes(changelogRegistry)) return false;

  return files.some(
    (file) =>
      file.startsWith("apps/web/src/components/") ||
      file.startsWith("apps/web/src/pages/") ||
      file.startsWith("apps/web/src/routes/") ||
      file === "apps/web/src/styles.css",
  );
}

/**
 * Lists files changed by a pull request.
 *
 * @param options - Git comparison inputs.
 * @param options.baseSha - Base branch commit SHA.
 * @param options.headSha - Pull-request head commit SHA.
 * @param options.cwd - Repository working directory.
 * @returns Changed repository-relative paths.
 * @throws When either commit SHA is absent or Git cannot compare them.
 */
export function getChangedFiles({
  baseSha = process.env.BASE_SHA,
  headSha = process.env.HEAD_SHA,
  cwd = repoRoot,
} = {}) {
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

/** Emits a GitHub annotation without failing the workflow. */
function main() {
  try {
    if (needsChangelogReminder(getChangedFiles())) {
      console.log(
        "::warning title=Changelog reminder::Customer-facing web files changed without updating apps/web/src/lib/changelog-content.ts. Add a changelog entry when this change should be announced.",
      );
    }
  } catch (error) {
    console.log(
      `::warning title=Changelog reminder unavailable::${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
