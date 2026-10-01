import { spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getWorkspacePackages } from "./workspace-packages.mjs";

/** Absolute repository root used by release operations. */
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
/** Directory containing pending Changesets. */
const changesetDirectory = join(repoRoot, ".changeset");
/** Repository changelog updated by each release. */
const changelogPath = join(repoRoot, "CHANGELOG.md");
/** Root and workspace package manifests that share the release version. */
const versionPackagePaths = [
  join(repoRoot, "package.json"),
  ...getWorkspacePackages(repoRoot).map(({ manifestPath }) => manifestPath),
];
/** Semantic bumps ordered from lowest to highest impact. */
const bumpOrder = ["patch", "minor", "major"];
/** Version used to establish the first release baseline. */
const initialVersion = "0.0.1";

/**
 * Runs a required release command synchronously.
 *
 * @param command - Executable name or path.
 * @param args - Command arguments.
 * @param options - Execution options.
 * @param options.capture - Whether to capture instead of inherit output.
 * @returns Trimmed captured output, or an empty string.
 * @throws When the command exits unsuccessfully.
 */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }

  return result.stdout?.trim() ?? "";
}

/**
 * Runs a required Git command.
 *
 * @param args - Git arguments.
 * @param options - Execution options forwarded to the command runner.
 * @returns Trimmed captured output, or an empty string.
 * @throws When Git exits unsuccessfully.
 */
function git(args, options = {}) {
  return run("git", args, options);
}

/**
 * Verifies that the release worktree has no changes.
 *
 * @throws When tracked or untracked changes exist.
 */
function assertCleanWorktree() {
  const status = git(["status", "--porcelain"], { capture: true });

  if (status) {
    throw new Error("Release requires a clean worktree.");
  }
}

/**
 * Verifies that local `main` exactly matches the fetched remote branch.
 *
 * @returns The validated `main` branch name.
 * @throws When the branch differs, Git fails, or commits do not match.
 */
function assertMainMatchesOrigin() {
  const branch = git(["branch", "--show-current"], { capture: true });

  if (branch !== "main") {
    throw new Error("Release must be run from main.");
  }

  git(["fetch", "origin", "main", "--tags"]);

  const headSha = git(["rev-parse", "HEAD"], { capture: true });
  const originMainSha = git(["rev-parse", "origin/main"], { capture: true });

  if (headSha !== originMainSha) {
    throw new Error("Release requires HEAD to match origin/main.");
  }

  return branch;
}

/**
 * Reads and parses a JSON file synchronously.
 *
 * @param path - JSON file path.
 * @returns The parsed value.
 * @throws When the file cannot be read or parsed.
 */
function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Serializes a value as formatted JSON with a trailing newline.
 *
 * @param path - Destination file path.
 * @param value - Value to serialize.
 * @throws When serialization or writing fails.
 */
function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Parses release metadata and notes from a Changeset file.
 *
 * @param filePath - Changeset Markdown file path.
 * @returns Its highest bump, description, path, and package names.
 * @throws When the file is unreadable or lacks a valid bump entry.
 */
function parseChangeset(filePath) {
  const content = readFileSync(filePath, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    throw new Error(`${filePath} is missing Changeset frontmatter.`);
  }

  const packages = [];
  const bumps = match[1].split("\n").flatMap((line) => {
    const lineMatch = line.match(/^["']?(.+?)["']?:\s*(major|minor|patch)\s*$/);

    if (!lineMatch) {
      return [];
    }

    packages.push(lineMatch[1]);
    return [lineMatch[2]];
  });

  if (bumps.length === 0) {
    throw new Error(`${filePath} must include major, minor, or patch.`);
  }

  return {
    bump: bumps.reduce((highest, bump) => {
      return bumpOrder.indexOf(bump) > bumpOrder.indexOf(highest)
        ? bump
        : highest;
    }, "patch"),
    description: match[2].trim(),
    filePath,
    packages,
  };
}

/**
 * Reads every pending Changeset in deterministic directory order.
 *
 * @returns Parsed Changesets, or an empty array when the directory is absent.
 * @throws When directory or Changeset access fails.
 */
function readChangesets() {
  if (!existsSync(changesetDirectory)) {
    return [];
  }

  return readdirSync(changesetDirectory)
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .map((file) => parseChangeset(join(changesetDirectory, file)));
}

/**
 * Finds the highest requested bump across Changesets.
 *
 * @param changesets - Parsed Changesets.
 * @returns The highest bump, defaulting to `patch`.
 */
function getHighestBump(changesets) {
  return changesets.reduce((highest, changeset) => {
    return bumpOrder.indexOf(changeset.bump) > bumpOrder.indexOf(highest)
      ? changeset.bump
      : highest;
  }, "patch");
}

/**
 * Applies a semantic bump to a version string.
 *
 * @param version - Current semantic version.
 * @param bump - Requested `major`, `minor`, or patch bump.
 * @returns The next semantic version.
 */
function bumpVersion(version, bump) {
  const [major = 0, minor = 0, patch = 0] = version
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);

  if (bump === "major") {
    return `${major + 1}.0.0`;
  }

  if (bump === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Reads the most recent semantic version tag.
 *
 * @returns The latest version without its `v` prefix.
 * @throws When Git fails or no release tag exists.
 */
function getLatestReleaseVersion() {
  const tags = git(
    ["tag", "--list", "v[0-9]*.[0-9]*.[0-9]*", "--sort=-v:refname"],
    {
      capture: true,
    },
  )
    .split("\n")
    .filter(Boolean);

  const latestTag = tags[0];

  if (!latestTag) {
    throw new Error(
      "No v* release tags found. Run pnpm release --initial first.",
    );
  }

  return latestTag.replace(/^v/, "");
}

/**
 * Writes one version to the root and every workspace package manifest.
 *
 * @param version - Release version to apply.
 * @throws When a manifest cannot be read, parsed, serialized, or written.
 */
function updatePackageVersions(version) {
  for (const path of versionPackagePaths) {
    const packageJson = readJson(path);
    packageJson.version = version;
    writeJson(path, packageJson);
  }
}

/**
 * Builds one release section for the changelog.
 *
 * @param version - Release version.
 * @param changesets - Parsed Changesets included in the release.
 * @returns The Markdown changelog entry.
 */
function createChangelogEntry(version, changesets) {
  const sections =
    changesets.length > 0
      ? ["major", "minor", "patch"]
          .map((bump) => formatBullets(changesets, bump))
          .filter(Boolean)
          .join("\n\n")
      : "### Patch Changes\n\n- Establish the initial release baseline.";

  return `## ${version}\n\n${sections}`;
}

/**
 * Formats Changesets of one bump level as a Markdown section.
 *
 * @param changesets - Parsed Changesets.
 * @param bump - Bump level to include.
 * @returns The section, or an empty string when none match.
 */
function formatBullets(changesets, bump) {
  const entries = changesets.filter((changeset) => changeset.bump === bump);

  if (entries.length === 0) {
    return "";
  }

  const title = `${bump[0].toUpperCase()}${bump.slice(1)} Changes`;
  const bullets = entries
    .map((entry) => {
      const description = entry.description || "No description provided.";
      const lines = description.split("\n").filter(Boolean);
      const packageSuffix =
        entry.packages?.length > 0 ? ` (${entry.packages.join(", ")})` : "";

      return lines
        .map(
          (line, index) =>
            `${index === 0 ? "* " : "  "}${line}${
              index === lines.length - 1 ? packageSuffix : ""
            }`,
        )
        .join("\n");
    })
    .join("\n");

  return `### ${title}\n\n${bullets}`;
}

/**
 * Inserts a release entry at the top of the repository changelog.
 *
 * @param version - Release version.
 * @param changesets - Parsed Changesets included in the release.
 * @throws When the changelog cannot be read or written.
 */
function updateChangelog(version, changesets) {
  const existing = existsSync(changelogPath)
    ? readFileSync(changelogPath, "utf8").trim()
    : "# pocket-trash.app";
  const entry = createChangelogEntry(version, changesets);
  const nextChangelog = existing.includes("\n## ")
    ? existing.replace(/\n## /, `\n\n${entry}\n\n## `)
    : `${existing}\n\n${entry}`;

  writeFileSync(changelogPath, `${nextChangelog.trim()}\n`);
}

/**
 * Extracts one version's release notes from the changelog.
 *
 * @param version - Release version to extract.
 * @returns Markdown release notes, with an empty body when absent.
 * @throws When the changelog cannot be read.
 */
function createReleaseNotes(version) {
  const changelog = readFileSync(changelogPath, "utf8");
  const match = changelog.match(
    new RegExp(
      `## ${version.replaceAll(".", "\\.")}\\n([\\s\\S]*?)(?=\\n## |$)`,
    ),
  );

  return `## ${version}\n${match?.[1]?.trim() ?? ""}\n`;
}

/**
 * Tests whether a local Git tag exists.
 *
 * @param tagName - Full tag name.
 * @returns Whether Git resolved the tag.
 */
function tagExists(tagName) {
  const result = spawnSync(
    "git",
    ["rev-parse", "-q", "--verify", `refs/tags/${tagName}`],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    },
  );

  return result.status === 0;
}

/**
 * Finds the deployment workflow run associated with a release tag.
 *
 * @param output - JSON output from `gh run list`.
 * @param tagName - Release tag used as the workflow branch.
 * @returns The workflow database identifier, when present.
 * @throws When the CLI output is invalid JSON.
 */
function findTagRunId(output, tagName) {
  return JSON.parse(output || "[]").find(
    (workflowRun) => workflowRun.headBranch === tagName,
  )?.databaseId;
}

/**
 * Waits for the tag deployment and verifies its GitHub release.
 *
 * @param tagName - Pushed release tag.
 * @throws When the workflow is not found, fails, or lacks a release.
 */
function waitForGitHubRelease(tagName) {
  let runId;

  // ponytail: one-minute lookup window; raise it if tag-run creation exceeds this.
  for (let attempt = 0; attempt < 20 && !runId; attempt += 1) {
    runId = findTagRunId(
      run(
        "gh",
        [
          "run",
          "list",
          "--workflow",
          "deploy.yml",
          "--event",
          "push",
          "--branch",
          tagName,
          "--json",
          "databaseId,headBranch",
          "--limit",
          "1",
        ],
        { capture: true },
      ),
      tagName,
    );

    if (!runId && attempt < 19) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3_000);
    }
  }

  if (!runId) {
    throw new Error(`No Deploy workflow run found for ${tagName}.`);
  }

  run("gh", ["run", "watch", String(runId), "--compact", "--exit-status"]);
  run("gh", ["release", "view", tagName], { capture: true });
}

/**
 * Atomically pushes a release branch and tag, then verifies deployment.
 *
 * @param releaseBranch - Branch containing the release commit.
 * @param tagName - Annotated release tag.
 * @throws When the push or deployment verification fails.
 */
function pushRelease(releaseBranch, tagName) {
  git(["push", "--atomic", "origin", releaseBranch, tagName]);
  waitForGitHubRelease(tagName);
}

/**
 * Creates, commits, tags, pushes, and verifies the initial release.
 *
 * @param changesets - Pending Changesets consumed by the release.
 * @param releaseBranch - Validated branch pushed with the release tag.
 * @throws When release preparation, Git, or deployment verification fails.
 */
function createInitialRelease(changesets, releaseBranch) {
  const tagName = `v${initialVersion}`;

  if (tagExists(tagName)) {
    throw new Error(`${tagName} already exists.`);
  }

  updatePackageVersions(initialVersion);
  writeFileSync(
    changelogPath,
    `# pocket-trash.app\n\n${createChangelogEntry(initialVersion, changesets)}\n`,
  );

  for (const changeset of changesets) {
    rmSync(changeset.filePath);
  }

  git([
    "add",
    "CHANGELOG.md",
    ".changeset",
    ...versionPackagePaths.map((path) => path.replace(`${repoRoot}/`, "")),
  ]);

  if (git(["status", "--porcelain"], { capture: true })) {
    git(["commit", "-m", `chore(release): ${tagName}`]);
  }

  git(["tag", "-a", tagName, "-m", tagName]);
  pushRelease(releaseBranch, tagName);
}

/**
 * Creates, commits, tags, pushes, and verifies a Changeset release.
 *
 * @param changesets - Pending Changesets consumed by the release.
 * @param releaseBranch - Validated branch pushed with the release tag.
 * @throws When release preparation, Git, or deployment verification fails.
 */
function createChangesetRelease(changesets, releaseBranch) {
  const nextVersion = bumpVersion(
    getLatestReleaseVersion(),
    getHighestBump(changesets),
  );
  const tagName = `v${nextVersion}`;

  if (tagExists(tagName)) {
    throw new Error(`${tagName} already exists.`);
  }

  updatePackageVersions(nextVersion);
  updateChangelog(nextVersion, changesets);

  for (const changeset of changesets) {
    rmSync(changeset.filePath);
  }

  git([
    "add",
    "CHANGELOG.md",
    ".changeset",
    "package.json",
    ...versionPackagePaths
      .map((path) => path.replace(`${repoRoot}/`, ""))
      .filter((path) => path !== "package.json"),
  ]);
  git(["commit", "-m", `chore(release): ${tagName}`]);
  git(["tag", "-a", tagName, "-m", tagName]);
  pushRelease(releaseBranch, tagName);
}

/**
 * Runs validated release preparation and publishing from `main`.
 *
 * @throws When prerequisites, validation, or release publishing fails.
 */
function main() {
  const initial = process.argv.includes("--initial");

  assertCleanWorktree();
  const releaseBranch = assertMainMatchesOrigin();

  run("gh", ["auth", "status"]);
  run("pnpm", ["install", "--frozen-lockfile"]);
  run("pnpm", ["format"]);
  run("pnpm", ["test"]);
  run("pnpm", ["lint"]);
  run("pnpm", ["typecheck"]);

  assertCleanWorktree();

  const changesets = readChangesets();

  if (initial) {
    createInitialRelease(changesets, releaseBranch);
    return;
  }

  if (changesets.length === 0) {
    throw new Error(
      "No Changesets found. Add a major, minor, or patch Changeset first.",
    );
  }

  createChangesetRelease(changesets, releaseBranch);
}

export {
  createChangelogEntry,
  createReleaseNotes,
  findTagRunId,
  parseChangeset,
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  /** Converts release CLI failures into a concise terminal error. */
  try {
    const releaseNotesIndex = process.argv.indexOf("--release-notes");

    if (releaseNotesIndex === -1) {
      main();
    } else {
      const version = process.argv[releaseNotesIndex + 1];

      if (!version) {
        throw new Error("--release-notes requires a version.");
      }

      process.stdout.write(createReleaseNotes(version));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
