import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getWorkspacePackages } from "./workspace-packages.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspacePackages = getWorkspacePackages(repoRoot);
const packagesByName = new Map(
  workspacePackages.map((workspacePackage) => [
    workspacePackage.manifest.name,
    workspacePackage,
  ]),
);
const requiredPackageDirectories = new Set();
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

const requiredRootFiles = [
  ".railwayignore",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "railway.json",
  "tsconfig.json",
  "turbo.json",
];
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
