import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertCleanStatus,
  assertKnownPaths,
  createValidationPlan,
  getValidationContext,
  parseArguments,
} from "./validate-pr.mjs";

test("defaults to origin/main and accepts one explicit comparison base", () => {
  assert.deepEqual(parseArguments([]), { baseRef: "origin/main" });
  assert.deepEqual(parseArguments(["origin/stack-parent"]), {
    baseRef: "origin/stack-parent",
  });
  assert.deepEqual(parseArguments(["--", "origin/stack-parent"]), {
    baseRef: "origin/stack-parent",
  });
  assert.throws(
    () => parseArguments(["main", "extra"]),
    /Usage: pnpm validate:pr/u,
  );
});

test("requires a clean committed worktree", () => {
  assert.doesNotThrow(() => assertCleanStatus(""));
  assert.throws(
    () => assertCleanStatus(" M scripts/validate-pr.mjs\n?? scratch.txt\n"),
    /Commit or remove these changes:[\s\S]*validate-pr\.mjs[\s\S]*scratch\.txt/u,
  );
});

test("reports classification failures and every unknown path", () => {
  assert.throws(
    () => assertKnownPaths({ error: "diff-failed", unknownPaths: [] }),
    /Verify the comparison base/u,
  );
  assert.throws(
    () =>
      assertKnownPaths({
        error: null,
        unknownPaths: ["future/a.ts", "future/b.ts"],
      }),
    /future\/a\.ts[\s\S]*future\/b\.ts[\s\S]*classify-changes\.mjs/u,
  );
});

test("selects validation, build, and Storybook checks by domain", () => {
  const plan = createValidationPlan({
    api: true,
    database: true,
    scraper: false,
    storybook: true,
    validation: true,
    web: true,
  });
  const selected = plan
    .filter((check) => check.selected)
    .map((check) => check.id);
  const skipped = plan
    .filter((check) => !check.selected)
    .map((check) => check.id);

  assert.deepEqual(selected, [
    "format",
    "changeset",
    "lint",
    "typecheck",
    "test",
    "database-chain",
    "api-build",
    "storybook-test",
    "storybook-build",
    "infisical-auth",
    "web-build",
    "database-personal",
  ]);
  assert.deepEqual(skipped, ["scraper-build"]);
});

test("runs credential-free checks before credential-dependent checks", () => {
  const selected = createValidationPlan({
    database: true,
    validation: true,
    web: true,
  }).filter((check) => check.selected);
  const firstCredentialIndex = selected.findIndex(
    (check) => check.requiresCredentials,
  );

  assert.ok(firstCredentialIndex > 0);
  assert.ok(
    selected
      .slice(0, firstCredentialIndex)
      .every((check) => !check.requiresCredentials),
  );
  assert.ok(
    selected
      .slice(firstCredentialIndex)
      .every((check) => check.requiresCredentials),
  );
});

test("documentation-only validation still verifies formatting and Changesets", () => {
  const selected = createValidationPlan({})
    .filter((check) => check.selected)
    .map((check) => check.id);

  assert.deepEqual(selected, ["format", "changeset"]);
});

test("resolves changed paths from the merge-base", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "validate-pr-git-test-"));
  /**
   * Runs Git in the validation fixture.
   *
   * @param {string[]} args - Git arguments.
   * @returns {string} Trimmed standard output.
   * @throws When Git exits unsuccessfully.
   */
  const git = (...args) =>
    execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
  context.after(() => rmSync(directory, { force: true, recursive: true }));

  git("init", "--initial-branch=main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test User");
  writeFileSync(join(directory, "README.md"), "base\n");
  git("add", "README.md");
  git("commit", "-m", "base");
  const mergeBase = git("rev-parse", "HEAD");
  git("checkout", "-b", "feature");
  writeFileSync(join(directory, "feature.ts"), "export {};\n");
  git("add", "feature.ts");
  git("commit", "-m", "feature");

  assert.deepEqual(getValidationContext({ baseRef: "main", cwd: directory }), {
    baseRef: "main",
    files: ["feature.ts"],
    headSha: git("rev-parse", "HEAD"),
    mergeBase,
  });
});
