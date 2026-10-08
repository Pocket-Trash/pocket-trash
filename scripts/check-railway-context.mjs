import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

import { getWorkspacePackages } from "./workspace-packages.mjs";

/** Absolute repository root used for Git and manifest discovery. */
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
/** Workspace configuration supplying pnpm patch inputs. */
const workspace = parse(
  readFileSync(join(repoRoot, "pnpm-workspace.yaml"), "utf8"),
);
/** Workspace package metadata loaded from the repository. */
const workspacePackages = getWorkspacePackages(repoRoot);
/** Workspace package metadata indexed by package name. */
const packagesByName = new Map(
  workspacePackages.map((workspacePackage) => [
    workspacePackage.manifest.name,
    workspacePackage,
  ]),
);
/** Root manifest whose workspace tooling must be available during installation. */
const rootManifest = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
);
/** Directories required by the root manifest, scraper, and workspace dependencies. */
const requiredPackageDirectories = new Set();
/** Workspace package names pending dependency traversal. */
const pendingPackageNames = [
  "@app/scraper",
  ...getWorkspaceDependencyNames(rootManifest),
];

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

  pendingPackageNames.push(
    ...getWorkspaceDependencyNames(workspacePackage.manifest),
  );
}

/** Install and build entry points required in the tracked upload context. */
const requiredBuildFiles = [
  ".railwayignore",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "railway.json",
  "scripts/security-audit.mjs",
  "security-audit-exceptions.json",
  "tsconfig.json",
  "turbo.json",
  ...Object.values(workspace.patchedDependencies ?? {}),
  ...[...requiredPackageDirectories].map(
    (directory) => `${directory}/package.json`,
  ),
];
/** Tracked files required to build the scraper service. */
const requiredFiles = execFileSync(
  "git",
  [
    "ls-files",
    "--",
    ...requiredBuildFiles,
    ...[...requiredPackageDirectories].sort(),
  ],
  { cwd: repoRoot, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
/** Tracked inputs used to detect silently omitted required files. */
const trackedFiles = new Set(requiredFiles);
/** Missing or untracked inputs that cannot reach the source upload. */
const missingFiles = [
  ...new Set([...requiredBuildFiles, ...requiredFiles]),
].filter(
  (file) => !trackedFiles.has(file) || !existsSync(join(repoRoot, file)),
);

if (missingFiles.length > 0) {
  throw new Error(
    `Railway requires existing tracked build files:\n${missingFiles.join("\n")}`,
  );
}

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

/**
 * Finds workspace dependencies, including references to missing local packages.
 *
 * @param manifest - Package manifest whose install dependencies are required.
 * @returns Workspace package names to traverse.
 */
function getWorkspaceDependencyNames(manifest) {
  return Object.entries({
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
  })
    .filter(
      ([name, version]) =>
        packagesByName.has(name) || version.startsWith("workspace:"),
    )
    .map(([name]) => name);
}
