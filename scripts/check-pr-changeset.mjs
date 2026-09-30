import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getWorkspacePackages } from "./workspace-packages.mjs";

const changesetDirectory = ".changeset";
const allowedBumps = new Set(["major", "minor", "patch"]);
const bumpPriority = ["patch", "minor", "major"];
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function git(args, cwd = repoRoot) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

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

function parseChangesetEntries(filePath) {
  return parseChangesetContent(readFileSync(filePath, "utf8"));
}

function getHighestChangesetBump(files, workspacePackageNames) {
  let bump = null;

  for (const file of files) {
    for (const entry of parseChangesetContent(file.content ?? "")) {
      if (
        workspacePackageNames.has(entry.packageName) &&
        (!bump || bumpPriority.indexOf(entry.bump) > bumpPriority.indexOf(bump))
      ) {
        bump = entry.bump;
      }
    }
  }

  return bump;
}

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

async function main() {
  const workspacePackageNames = new Set(
    getWorkspacePackages(repoRoot).map(({ manifest }) => manifest.name),
  );

  if (process.env.PR_NUMBER) {
    const files = await getPullRequestChangesetFiles();
    const bump = getHighestChangesetBump(files, workspacePackageNames);

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

async function getPullRequestChangesetFiles() {
  const token = requiredEnv("GITHUB_TOKEN");
  const repository = requiredEnv("GITHUB_REPOSITORY");
  const pullNumber = requiredEnv("PR_NUMBER");
  const [owner, repo] = repository.split("/");
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const files = [];

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
      if (
        file.filename.startsWith(`${changesetDirectory}/`) &&
        file.filename.endsWith(".md") &&
        file.filename !== `${changesetDirectory}/README.md` &&
        file.status !== "removed"
      ) {
        files.push({
          filename: file.filename,
          content: await fetchRaw(file.contents_url, headers),
        });
      }
    }
  }

  return files;
}

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

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

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
