import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

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
