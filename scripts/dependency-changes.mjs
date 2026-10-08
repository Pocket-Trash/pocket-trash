import { execFileSync } from "node:child_process";
import { posix } from "node:path";
import { parse } from "yaml";

/** Build entrypoints that never execute in deployed application request paths. */
const buildEntrypoints = new Set([
  "vite",
  "typescript",
  "@tailwindcss/vite",
  "@tanstack/router-plugin",
  "@tanstack/start-plugin-core",
]);

/**
 * Finds workspace consumers whose resolved runtime or build dependency graph changed.
 * @param {string} base - Base pnpm lockfile YAML.
 * @param {string} head - Head pnpm lockfile YAML.
 * @returns {Array<{path: string, runtime: boolean}>} Affected manifest paths, with runtime changes taking precedence.
 * @throws When either lockfile lacks the supported importer/snapshot format.
 */
export function findDependencyChanges(base, head) {
  const before = parse(base);
  const after = parse(head);
  for (const lock of [before, after]) {
    if (
      !lock?.importers ||
      !lock.snapshots ||
      !lock.packages ||
      String(lock.lockfileVersion) !== "9.0"
    ) {
      throw new Error(
        "Unsupported dependency graph; use conservative classification.",
      );
    }
  }
  const changes = [];
  for (const importer of new Set([
    ...Object.keys(before.importers),
    ...Object.keys(after.importers),
  ])) {
    const runtime =
      dependencyGraph(
        before,
        importer,
        ["dependencies", "optionalDependencies"],
        true,
      ) !==
      dependencyGraph(
        after,
        importer,
        ["dependencies", "optionalDependencies"],
        true,
      );
    const build =
      dependencyGraph(before, importer, [
        "dependencies",
        "optionalDependencies",
        "devDependencies",
      ]) !==
      dependencyGraph(after, importer, [
        "dependencies",
        "optionalDependencies",
        "devDependencies",
      ]);
    if (runtime || build)
      changes.push({
        path: importer === "." ? "package.json" : `${importer}/package.json`,
        runtime,
      });
  }
  return changes;
}

/**
 * Serializes the reachable lockfile graph, including workspace links and package integrity.
 * @param {object} lock - Parsed pnpm lockfile.
 * @param {string} importer - Workspace importer path.
 * @param {string[]} sections - Dependency sections to traverse at the root.
 * @param {boolean} [runtimeOnly] - Exclude known build entrypoints even when declared as dependencies.
 * @returns {string} Stable dependency graph signature.
 * @throws When a dependency reference cannot be resolved safely.
 */
function dependencyGraph(lock, importer, sections, runtimeOnly = false) {
  const entries = new Map();
  /**
   * Filters build entrypoint edges out of runtime graph signatures.
   * @param {object} dependencies - Lockfile dependency map.
   * @returns {object} Dependency edges relevant to this traversal.
   */
  const relevant = (dependencies) =>
    Object.fromEntries(
      Object.entries(dependencies ?? {}).filter(
        ([name]) => !runtimeOnly || !buildEntrypoints.has(name),
      ),
    );
  /**
   * Visits runtime dependencies of a linked workspace without following its dev tools.
   * @param {string} path - Linked workspace importer path.
   * @param {string[]} fields - Sections contributing to this traversal.
   */
  function visitImporter(path, fields) {
    const key = `importer:${path}:${fields.join(",")}`;
    if (entries.has(key)) return;
    const entry = lock.importers[path];
    entries.set(
      key,
      fields.map((field) => relevant(entry?.[field])),
    );
    for (const field of fields) {
      for (const [name, reference] of Object.entries(
        relevant(entry?.[field]),
      )) {
        visit(name, reference.version, path);
      }
    }
  }
  /**
   * Visits a resolved package and all its runtime or optional dependencies.
   * @param {string} name - Dependency package name.
   * @param {string} version - Resolved lockfile reference.
   * @param {string} from - Importer containing a workspace link.
   * @throws When a dependency reference is malformed or unresolved.
   */
  function visit(name, version, from) {
    if (typeof version !== "string")
      throw new Error("Invalid lockfile dependency reference.");
    if (version.startsWith("link:")) {
      visitImporter(posix.normalize(posix.join(from, version.slice(5))), [
        "dependencies",
        "optionalDependencies",
      ]);
      return;
    }
    const key = version.startsWith("npm:")
      ? version.slice(4)
      : lock.snapshots[version]
        ? version
        : `${name}@${version}`;
    if (entries.has(key)) return;
    const snapshot = lock.snapshots[key];
    const metadata =
      lock.packages[key] ?? lock.packages[key.replace(/\(.*$/u, "")];
    if (!snapshot || !metadata)
      throw new Error(`Unresolved lockfile dependency: ${key}`);
    entries.set(key, {
      snapshot: {
        ...snapshot,
        dependencies: relevant(snapshot.dependencies),
        optionalDependencies: relevant(snapshot.optionalDependencies),
      },
      metadata,
    });
    for (const [dependency, resolved] of Object.entries({
      ...relevant(snapshot.dependencies),
      ...relevant(snapshot.optionalDependencies),
    })) {
      visit(dependency, resolved, from);
    }
  }
  visitImporter(importer, sections);
  return JSON.stringify(
    [...entries].sort(([left], [right]) => left.localeCompare(right)),
  );
}

/**
 * Reads resolved dependency changes between the merge base and committed head.
 * @param {object} options - Git comparison inputs.
 * @param {string} options.baseSha - Base revision.
 * @param {string} options.headSha - Head revision.
 * @param {string} options.cwd - Repository directory.
 * @returns {Array<{path: string, runtime: boolean}>} Affected dependency consumers.
 * @throws When Git or dependency graph parsing fails.
 */
export function getDependencyChanges({ baseSha, headSha, cwd }) {
  const mergeBase = execFileSync("git", ["merge-base", baseSha, headSha], {
    cwd,
    encoding: "utf8",
  }).trim();
  /**
   * Reads one revision's lockfile without checking out that revision.
   * @param {string} ref - Git revision to read.
   * @param {string} [path] - Repository file to read.
   * @returns {string} Committed file content.
   * @throws When the lockfile cannot be read.
   */
  const read = (ref, path = "pnpm-lock.yaml") =>
    execFileSync("git", ["show", `${ref}:${path}`], {
      cwd,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
  const changes = findDependencyChanges(read(mergeBase), read(headSha));
  const beforePolicy = parse(read(mergeBase, "pnpm-workspace.yaml"));
  const afterPolicy = parse(read(headSha, "pnpm-workspace.yaml"));
  for (const policy of [beforePolicy, afterPolicy]) {
    delete policy.minimumReleaseAge;
    delete policy.minimumReleaseAgeExclude;
    delete policy.overrides;
    delete policy.patchedDependencies;
  }
  if (JSON.stringify(beforePolicy) !== JSON.stringify(afterPolicy)) {
    changes.push({ path: "package.json", runtime: true });
  }
  const beforeRoot = JSON.parse(read(mergeBase, "package.json"));
  const afterRoot = JSON.parse(read(headSha, "package.json"));
  for (const root of [beforeRoot, afterRoot]) {
    delete root.dependencies;
    delete root.devDependencies;
    delete root.name;
    delete root.version;
  }
  if (JSON.stringify(beforeRoot) !== JSON.stringify(afterRoot)) {
    changes.push({ path: "package.json", runtime: false });
  }
  return changes;
}
