import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getWorkspacePackages } from "./workspace-packages.mjs";

/** Repository directory containing Changeset files. */
const changesetDirectory = ".changeset";
/** Supported semantic release bump names. */
const allowedBumps = new Set(["major", "minor", "patch"]);
/** Release bumps ordered from lowest to highest impact. */
const bumpPriority = ["patch", "minor", "major"];
/** Absolute repository root used by local and CI checks. */
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Runs Git and returns trimmed standard output.
 *
 * @param args - Git arguments.
 * @param cwd - Working directory for Git.
 * @returns Trimmed standard output.
 * @throws When Git exits unsuccessfully.
 */
function git(args, cwd = repoRoot) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/**
 * Lists files introduced or changed by a pull-request branch.
 *
 * @param options - Comparison inputs.
 * @param options.baseSha - Base branch commit SHA.
 * @param options.headSha - Pull-request head commit SHA.
 * @param options.cwd - Repository directory for Git.
 * @returns Changed repository-relative paths.
 * @throws When SHAs are absent or Git fails.
 */
function getChangedFiles({
  baseSha = process.env.BASE_SHA,
  headSha = process.env.HEAD_SHA,
  cwd = repoRoot,
} = {}) {
  if (!baseSha || !headSha) {
    throw new Error("BASE_SHA and HEAD_SHA are required.");
  }

  return git(["diff", "--name-only", `${baseSha}...${headSha}`], cwd)
    .split("\n")
    .filter(Boolean);
}

/**
 * Parses package bump entries from Changeset frontmatter.
 *
 * @param content - Complete Changeset Markdown content.
 * @returns Parsed package names and bump levels.
 */
function parseChangesetContent(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);

  if (!match) {
    return [];
  }

  return match[1]
    .split("\n")
    .map((line) => line.match(/^["']?(.+?)["']?:\s*(major|minor|patch)\s*$/))
    .filter(Boolean)
    .map(([, packageName, bump]) => ({ bump, packageName }))
    .filter(Boolean);
}

/**
 * Reads and parses a Changeset file.
 *
 * @param filePath - Changeset file path.
 * @returns Parsed package names and bump levels.
 * @throws When the file cannot be read.
 */
function parseChangesetEntries(filePath) {
  return parseChangesetContent(readFileSync(filePath, "utf8"));
}

/**
 * Selects the highest valid bump for base or PR-added workspace packages.
 *
 * @param files - Changed Changeset files and their contents.
 * @param workspacePackageNames - Package names present on the base branch.
 * @param pullRequestPackageNames - Package names introduced by the PR.
 * @returns The highest bump, or `null` when no valid entry exists.
 */
function getHighestChangesetBump(
  files,
  workspacePackageNames,
  pullRequestPackageNames = new Set(),
) {
  let bump = null;
  const knownPackageNames = new Set([
    ...workspacePackageNames,
    ...pullRequestPackageNames,
  ]);

  for (const file of files) {
    for (const entry of parseChangesetContent(file.content ?? "")) {
      if (
        knownPackageNames.has(entry.packageName) &&
        (!bump || bumpPriority.indexOf(entry.bump) > bumpPriority.indexOf(bump))
      ) {
        bump = entry.bump;
      }
    }
  }

  return bump;
}

/**
 * Validates parsed entries from one Changeset.
 *
 * @param file - Repository-relative Changeset path used in errors.
 * @param entries - Parsed package bump entries.
 * @param workspacePackageNames - Known workspace package names.
 * @throws When entries are absent, invalid, or target an unknown package.
 */
function validateChangesetEntries(file, entries, workspacePackageNames) {
  if (entries.length === 0) {
    throw new Error(`${file} must mark a package as major, minor, or patch.`);
  }

  for (const { bump, packageName } of entries) {
    if (!allowedBumps.has(bump)) {
      throw new Error(`${file} has an invalid release bump: ${bump}.`);
    }

    if (!workspacePackageNames.has(packageName)) {
      throw new Error(
        `${file} targets unknown workspace package ${packageName}.`,
      );
    }
  }
}

/**
 * Validates the PR or local diff and reports its Changeset bump.
 *
 * @returns A promise that settles after a valid Changeset is found.
 * @rejects When GitHub, Git, file access, or Changeset validation fails.
 */
async function main() {
  const workspacePackageNames = new Set(
    getWorkspacePackages(repoRoot).map(({ manifest }) => manifest.name),
  );

  if (process.env.PR_NUMBER) {
    const { changesets, packageNames } = await getPullRequestFiles();
    const bump = getHighestChangesetBump(
      changesets,
      workspacePackageNames,
      packageNames,
    );

    if (process.env.GITHUB_OUTPUT) {
      await appendFile(
        process.env.GITHUB_OUTPUT,
        `checked=true\nbump=${bump ?? ""}\n`,
      );
    }

    if (!bump) {
      throw new Error(
        "Every PR must include a Changeset marked major, minor, or patch.",
      );
    }

    console.log(`Found ${bump} Changeset marker.`);
    return;
  }

  const changedFiles = getChangedFiles();
  const changedChangesets = changedFiles.filter((file) => {
    return (
      file.startsWith(`${changesetDirectory}/`) &&
      file.endsWith(".md") &&
      basename(file) !== "README.md"
    );
  });

  if (changedChangesets.length === 0) {
    throw new Error(
      "Every PR must include a Changeset marked major, minor, or patch.",
    );
  }

  const validChangesets = [];

  for (const file of changedChangesets) {
    const changesetPath = join(repoRoot, file);

    if (!existsSync(changesetPath)) {
      continue;
    }

    const entries = parseChangesetEntries(changesetPath);
    validateChangesetEntries(file, entries, workspacePackageNames);
    validChangesets.push(file);
  }

  if (validChangesets.length === 0) {
    throw new Error(
      "Every PR must include a Changeset marked major, minor, or patch.",
    );
  }

  console.log(`Found valid Changeset marker: ${validChangesets.join(", ")}`);
}

/**
 * Fetches changed Changesets and workspace package names from the PR API.
 *
 * @returns Changed Changesets and package names introduced by the PR.
 * @rejects When required environment values or GitHub responses are invalid.
 */
async function getPullRequestFiles() {
  const token = requiredEnv("GITHUB_TOKEN");
  const repository = requiredEnv("GITHUB_REPOSITORY");
  const pullNumber = requiredEnv("PR_NUMBER");
  const [owner, repo] = repository.split("/");
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const changesets = [];
  const packageNames = new Set();

  for (let page = 1; ; page += 1) {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100&page=${page}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(
        `GitHub files API failed: ${response.status} ${await response.text()}`,
      );
    }

    const pageFiles = await response.json();
    if (!pageFiles.length) break;

    for (const file of pageFiles) {
      const isChangeset =
        file.filename.startsWith(`${changesetDirectory}/`) &&
        file.filename.endsWith(".md") &&
        file.filename !== `${changesetDirectory}/README.md` &&
        file.status !== "removed";
      const isWorkspaceManifest =
        /^(?:apps|packages)\/[^/]+\/package\.json$/.test(file.filename) &&
        file.status !== "removed";

      if (isChangeset || isWorkspaceManifest) {
        const content = await fetchRaw(file.contents_url, headers);

        if (isChangeset) {
          changesets.push({
            content,
            filename: file.filename,
          });
        }

        if (isWorkspaceManifest) {
          const packageName = JSON.parse(content).name;
          if (typeof packageName === "string") packageNames.add(packageName);
        }
      }
    }
  }

  return { changesets, packageNames };
}

/**
 * Fetches a GitHub file as raw text.
 *
 * @param url - GitHub contents API URL.
 * @param headers - Authenticated GitHub request headers.
 * @returns The raw response body.
 * @rejects When the GitHub request fails.
 */
async function fetchRaw(url, headers) {
  const response = await fetch(url, {
    headers: { ...headers, Accept: "application/vnd.github.raw" },
  });
  if (!response.ok) {
    throw new Error(
      `GitHub raw file API failed: ${response.status} ${await response.text()}`,
    );
  }
  return response.text();
}

/**
 * Reads a required environment variable.
 *
 * @param name - Environment variable name.
 * @returns The configured value.
 * @throws When the variable is absent or empty.
 */
function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

/**
 * Appends content to a file without loading the promise API eagerly.
 *
 * @param path - Destination file path.
 * @param content - Text to append.
 * @returns A promise that settles after the write.
 * @rejects When the file cannot be opened or written.
 */
async function appendFile(path, content) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(path, content);
}

export {
  getChangedFiles,
  getHighestChangesetBump,
  parseChangesetEntries,
  validateChangesetEntries,
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
