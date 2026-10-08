import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

/** Repository root supplying the real checker and installed dependencies. */
const repoRoot = fileURLToPath(new URL("../", import.meta.url));

/**
 * Creates a tracked scraper build fixture with a complete upload allowlist.
 *
 * @param context - Test context owning temporary directory cleanup.
 * @returns Fixture directory.
 * @throws When fixture files or Git cannot be initialized.
 */
function createFixture(context) {
  const directory = mkdtempSync(join(tmpdir(), "railway-context-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const files = {
    ".railwayignore":
      "*\n!.railwayignore\n!package.json\n!pnpm-lock.yaml\n!pnpm-workspace.yaml\n!railway.json\n!tsconfig.json\n!turbo.json\n!security-audit-exceptions.json\n!scripts/\n!scripts/security-audit.mjs\n!patches/\n!patches/**\n!apps/\n!apps/scraper/\n!apps/scraper/**\n!packages/\n!packages/database/\n!packages/database/**\n!packages/lint/\n!packages/lint/**\n",
    "package.json": JSON.stringify({
      name: "pocket-trash.app",
      type: "module",
      devDependencies: { "@package/lint": "workspace:*" },
    }),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    "pnpm-workspace.yaml":
      "packages: ['apps/*', 'packages/*']\npatchedDependencies:\n  other-package@1.0.0: patches/different-package.patch\n",
    "railway.json": "{}\n",
    "tsconfig.json": "{}\n",
    "turbo.json": "{}\n",
    "security-audit-exceptions.json": "[]\n",
    "scripts/security-audit.mjs": "// Fixture audit input.\n",
    "patches/different-package.patch": "fixture patch\n",
    "apps/scraper/package.json": JSON.stringify({
      name: "@app/scraper",
      dependencies: { "@package/database": "workspace:*" },
    }),
    "apps/scraper/src/index.ts": "export {};\n",
    "packages/database/package.json": '{"name":"@package/database"}\n',
    "packages/lint/package.json": '{"name":"@package/lint"}\n',
    "packages/lint/index.mjs": "export {};\n",
  };
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), content);
  }
  for (const script of [
    "check-railway-context.mjs",
    "workspace-packages.mjs",
  ]) {
    copyFileSync(
      join(repoRoot, "scripts", script),
      join(directory, "scripts", script),
    );
  }
  symlinkSync(join(repoRoot, "node_modules"), join(directory, "node_modules"));
  execFileSync("git", ["init", "--quiet"], { cwd: directory });
  execFileSync("git", ["add", "--", ...Object.keys(files)], { cwd: directory });
  return directory;
}

/**
 * Runs the actual upload checker in a fixture repository.
 *
 * @param directory - Fixture repository root.
 * @returns Checker exit status and combined output.
 */
function runChecker(directory) {
  const result = spawnSync(
    process.execPath,
    ["scripts/check-railway-context.mjs"],
    {
      cwd: directory,
      encoding: "utf8",
    },
  );
  return { status: result.status, output: result.stdout + result.stderr };
}

test("rejects an excluded pnpm patch discovered from workspace metadata", (context) => {
  const directory = createFixture(context);
  writeFileSync(join(directory, ".railwayignore"), "\npatches/\n", {
    flag: "a",
  });
  const result = runChecker(directory);
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /patches\/different-package\.patch/);
});

test("rejects missing and untracked pnpm patch inputs", (context) => {
  const directory = createFixture(context);
  const patch = "patches/different-package.patch";
  rmSync(join(directory, patch));
  let result = runChecker(directory);
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /patches\/different-package\.patch/);

  writeFileSync(join(directory, patch), "fixture patch\n");
  execFileSync("git", ["rm", "--cached", "--", patch], { cwd: directory });
  result = runChecker(directory);
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /patches\/different-package\.patch/);
});

test("rejects excluded security audit inputs", (context) => {
  const directory = createFixture(context);
  writeFileSync(
    join(directory, ".railwayignore"),
    "\nscripts/\nsecurity-audit-exceptions.json\n",
    { flag: "a" },
  );
  const result = runChecker(directory);
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /scripts\/security-audit\.mjs/);
  assert.match(result.output, /security-audit-exceptions\.json/);
});

test("rejects an excluded root workspace dependency", (context) => {
  const directory = createFixture(context);
  writeFileSync(join(directory, ".railwayignore"), "\npackages/lint/\n", {
    flag: "a",
  });
  const result = runChecker(directory);
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /packages\/lint\/package\.json/);
  assert.match(result.output, /packages\/lint\/index\.mjs/);
});

test("accepts a complete tracked upload context", (context) => {
  const result = runChecker(createFixture(context));
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /15 tracked files across 3 workspace packages/);
});

test("rejects missing audit and tracked scraper source files", (context) => {
  const directory = createFixture(context);
  for (const path of [
    "scripts/security-audit.mjs",
    "security-audit-exceptions.json",
    "apps/scraper/src/index.ts",
  ]) {
    rmSync(join(directory, path));
  }
  const result = runChecker(directory);
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /scripts\/security-audit\.mjs/);
  assert.match(result.output, /security-audit-exceptions\.json/);
  assert.match(result.output, /apps\/scraper\/src\/index\.ts/);
});

test("rejects an unresolved root workspace dependency", (context) => {
  const directory = createFixture(context);
  rmSync(join(directory, "packages/lint/package.json"));
  const result = runChecker(directory);
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /Unknown workspace package: @package\/lint/);
});

test("checks the production upload context before deploying", () => {
  const workflow = parse(
    readFileSync(join(repoRoot, ".github/workflows/deploy.yml"), "utf8"),
  );
  const steps = workflow.jobs["railway-production"].steps;
  const checkIndex = steps.findIndex(
    (step) => step.run === "node scripts/check-railway-context.mjs",
  );
  const deployIndex = steps.findIndex((step) =>
    step.run?.includes("pnpm exec railway up"),
  );
  assert.ok(checkIndex >= 0 && deployIndex > checkIndex);
});
