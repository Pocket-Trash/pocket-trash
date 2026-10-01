import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/**
 * Loads and sorts package manifests from the monorepo workspaces.
 *
 * @param repoRoot - The absolute repository root.
 * @returns Workspace package directories, manifests, and manifest paths.
 * @throws When workspace directories or package manifests cannot be read.
 */
export function getWorkspacePackages(repoRoot) {
  return ["apps", "packages"]
    .flatMap((workspaceDirectory) => {
      const directory = join(repoRoot, workspaceDirectory);

      return readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(directory, entry.name, "package.json"));
    })
    .filter(existsSync)
    .map((manifestPath) => ({
      directory: relative(repoRoot, dirname(manifestPath)),
      manifest: JSON.parse(readFileSync(manifestPath, "utf8")),
      manifestPath,
    }))
    .sort((left, right) => left.directory.localeCompare(right.directory));
}
