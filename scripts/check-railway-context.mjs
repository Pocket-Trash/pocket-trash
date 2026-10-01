import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getWorkspacePackages } from "./workspace-packages.mjs";

/** Absolute repository root used for Git and manifest discovery. */
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
/** Workspace package metadata loaded from the repository. */
const workspacePackages = getWorkspacePackages(repoRoot);
/** Workspace package metadata indexed by package name. */
const packagesByName = new Map(
  workspacePackages.map((workspacePackage) => [
    workspacePackage.manifest.name,
    workspacePackage,
  ]),
);
/** Directories required by the scraper and its workspace dependencies. */
const requiredPackageDirectories = new Set();
/** Workspace package names pending dependency traversal. */
const pendingPackageNames = ["@app/scraper"];

while (pendingPackageNames.length > 0) {
  const packageName = pendingPackageNames.pop();
  const workspacePackage = packagesByName.get(packageName);

  if (!workspacePackage) {
    throw new Error(`Unknown workspace package: ${packageName}.`);
  }

  if (requiredPackageDirectories.has(workspacePackage.directory)) {
    continue;
  }

  requiredPackageDirectories.add(workspacePackage.directory);

  for (const dependencies of [
    workspacePackage.manifest.dependencies,
    workspacePackage.manifest.devDependencies,
    workspacePackage.manifest.optionalDependencies,
  ]) {
    for (const dependencyName of Object.keys(dependencies ?? {})) {
      if (packagesByName.has(dependencyName)) {
        pendingPackageNames.push(dependencyName);
      }
    }
  }
}

/** Root configuration files required by Railway builds. */
const requiredRootFiles = [
  ".railwayignore",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "railway.json",
  "tsconfig.json",
  "turbo.json",
];
/** Tracked files required to build the scraper service. */
const requiredFiles = execFileSync(
  "git",
  [
    "ls-files",
    "--",
    ...requiredRootFiles,
    ...[...requiredPackageDirectories].sort(),
  ],
  { cwd: repoRoot, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
/** Result of checking required files against `.railwayignore`. */
const ignored = spawnSync(
  "git",
  [
    "-c",
    `core.excludesFile=${join(repoRoot, ".railwayignore")}`,
    "check-ignore",
    "--no-index",
    "--stdin",
  ],
  {
    cwd: repoRoot,
    encoding: "utf8",
    input: `${requiredFiles.join("\n")}\n`,
  },
);

if (![0, 1].includes(ignored.status)) {
  process.stderr.write(ignored.stderr);
  process.exit(ignored.status ?? 1);
}

if (ignored.status === 0) {
  throw new Error(
    `Railway excludes required scraper files:\n${ignored.stdout.trim()}`,
  );
}

console.log(
  `Railway includes ${requiredFiles.length} tracked files across ${requiredPackageDirectories.size} workspace packages.`,
);
