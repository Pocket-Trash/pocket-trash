import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getWorkspacePackages } from "./workspace-packages.mjs";

const changesetDirectory = ".changeset";
const allowedBumps = new Set(["major", "minor", "patch"]);
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function getChangedFiles() {
  const baseSha = process.env.BASE_SHA;
  const headSha = process.env.HEAD_SHA;

  if (!baseSha || !headSha) {
    throw new Error("BASE_SHA and HEAD_SHA are required.");
  }

  return git(["diff", "--name-only", baseSha, headSha])
    .split("\n")
    .filter(Boolean);
}

function parseChangesetEntries(filePath) {
  const content = readFileSync(filePath, "utf8");
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

function main() {
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

  const workspacePackageNames = new Set(
    getWorkspacePackages(repoRoot).map(({ manifest }) => manifest.name),
  );
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

export { parseChangesetEntries, validateChangesetEntries };

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
