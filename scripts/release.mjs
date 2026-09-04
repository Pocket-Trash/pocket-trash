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

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const changesetDirectory = join(repoRoot, ".changeset");
const changelogPath = join(repoRoot, "CHANGELOG.md");
const versionPackagePaths = [
  "package.json",
  "packages/repo/package.json",
  "apps/web/package.json",
  "packages/database/package.json",
  "packages/eslint/package.json",
  "packages/figjam/package.json",
  "packages/github-discord-notifier/package.json",
  "packages/infisical-runner/package.json",
  "packages/json-data/package.json",
  "packages/logger/package.json",
  "packages/services/package.json",
  "packages/tsconfig/package.json",
].map((path) => join(repoRoot, path));
const bumpOrder = ["patch", "minor", "major"];
const initialVersion = "0.0.1";

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

function git(args, options = {}) {
  return run("git", args, options);
}

function assertCleanWorktree() {
  const status = git(["status", "--porcelain"], { capture: true });

  if (status) {
    throw new Error("Release requires a clean worktree.");
  }
}

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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

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

function readChangesets() {
  if (!existsSync(changesetDirectory)) {
    return [];
  }

  return readdirSync(changesetDirectory)
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .map((file) => parseChangeset(join(changesetDirectory, file)));
}

function getHighestBump(changesets) {
  return changesets.reduce((highest, changeset) => {
    return bumpOrder.indexOf(changeset.bump) > bumpOrder.indexOf(highest)
      ? changeset.bump
      : highest;
  }, "patch");
}

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

function updatePackageVersions(version) {
  for (const path of versionPackagePaths) {
    const packageJson = readJson(path);
    packageJson.version = version;
    writeJson(path, packageJson);
  }
}

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

function formatBullets(changesets, bump) {
  const entries = changesets.filter((changeset) => changeset.bump === bump);

  if (entries.length === 0) {
    return "";
  }

  const title = `${bump[0].toUpperCase()}${bump.slice(1)} Changes`;
  const bullets = entries
    .map((entry) => {
      const description = entry.description || "No description provided.";
      const packagePrefix =
        entry.packages?.length > 0 ? `**${entry.packages.join(", ")}**: ` : "";

      return description
        .split("\n")
        .filter(Boolean)
        .map((line, index) =>
          index === 0 ? `- ${packagePrefix}${line}` : `  ${line}`,
        )
        .join("\n");
    })
    .join("\n");

  return `### ${title}\n\n${bullets}`;
}

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

function createReleaseNotes(version) {
  const changelog = readFileSync(changelogPath, "utf8");
  const match = changelog.match(
    new RegExp(
      `## ${version.replaceAll(".", "\\.")}\\n([\\s\\S]*?)(?=\\n## |$)`,
    ),
  );

  return `## ${version}\n${match?.[1]?.trim() ?? ""}\n`;
}

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

function createGitHubRelease(tagName, notes) {
  const notesPath = join(repoRoot, ".release-notes.md");

  writeFileSync(notesPath, notes);

  try {
    run("gh", [
      "release",
      "create",
      tagName,
      "--title",
      tagName,
      "--notes-file",
      notesPath,
    ]);
  } finally {
    rmSync(notesPath, { force: true });
  }
}

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
    git(["push", "origin", releaseBranch]);
  }

  git(["tag", "-a", tagName, "-m", tagName]);
  git(["push", "origin", tagName]);
  createGitHubRelease(tagName, createReleaseNotes(initialVersion));
}

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
  git(["push", "origin", releaseBranch]);
  git(["tag", "-a", tagName, "-m", tagName]);
  git(["push", "origin", tagName]);
  createGitHubRelease(tagName, createReleaseNotes(nextVersion));
}

function main() {
  const initial = process.argv.includes("--initial");

  assertCleanWorktree();
  const releaseBranch = assertMainMatchesOrigin();

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

export { createChangelogEntry, parseChangeset };

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
