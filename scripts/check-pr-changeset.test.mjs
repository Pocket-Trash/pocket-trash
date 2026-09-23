import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  getChangedFiles,
  parseChangesetEntries,
  validateChangesetEntries,
} from "./check-pr-changeset.mjs";

test("only returns files introduced by the PR branch", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "changeset-git-test-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
  context.after(() => rmSync(directory, { force: true, recursive: true }));

  git("init", "--initial-branch=main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test User");
  writeFileSync(join(directory, "README.md"), "test\n");
  git("add", "README.md");
  git("commit", "-m", "initial");
  git("checkout", "-b", "feature");
  git("checkout", "main");
  mkdirSync(join(directory, ".changeset"));
  writeFileSync(join(directory, ".changeset", "base-only.md"), "base\n");
  git("add", ".changeset/base-only.md");
  git("commit", "-m", "base change");
  const baseSha = git("rev-parse", "HEAD");
  git("checkout", "feature");
  mkdirSync(join(directory, ".changeset"));
  writeFileSync(join(directory, ".changeset", "pr-only.md"), "pr\n");
  git("add", ".changeset/pr-only.md");
  git("commit", "-m", "PR change");
  const headSha = git("rev-parse", "HEAD");

  assert.deepEqual(getChangedFiles({ baseSha, cwd: directory, headSha }), [
    ".changeset/pr-only.md",
  ]);
});

test("rejects Changesets that target unknown packages", () => {
  const directory = mkdtempSync(join(tmpdir(), "changeset-test-"));
  const changesetPath = join(directory, "change.md");

  writeFileSync(
    changesetPath,
    `---
"@pocket-trash/repo": patch
---

Change release automation.
`,
  );

  assert.throws(
    () =>
      validateChangesetEntries(
        changesetPath,
        parseChangesetEntries(changesetPath),
        new Set(["@app/web"]),
      ),
    /unknown workspace package @pocket-trash\/repo/,
  );
});
