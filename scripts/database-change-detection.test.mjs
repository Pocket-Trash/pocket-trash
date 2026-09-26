import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { parse } from "yaml";

test("database detection ignores base-only and package changes", (context) => {
  const workflow = parse(
    readFileSync(
      new URL("../.github/workflows/deploy.yml", import.meta.url),
      "utf8",
    ),
  );
  const script = workflow.jobs.preview.steps
    .find((step) => step.id === "db_changes")
    .run.split("source .github/scripts/ci-log.sh")[0];
  const directory = mkdtempSync(join(tmpdir(), "database-detection-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const commit = (path, content) => {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), content);
    git("add", path);
    git("commit", "-m", path);
    return git("rev-parse", "HEAD");
  };
  git("init", "--initial-branch=main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test User");
  const ancestor = commit("README.md", "initial\n");
  const base = commit("packages/database/src/schema/base.ts", "base-only\n");

  for (const [path, expected] of [
    ["apps/web/content/help/en-US/guide.mdx", false],
    ["packages/database/package.json", false],
    ["pnpm-lock.yaml", false],
    ["packages/database/src/schema/topic.ts", true],
    ["packages/database/drizzle/0001_topic.sql", true],
    ["packages/database/drizzle.config.ts", true],
  ]) {
    git("checkout", "--detach", ancestor);
    const head = commit(path, "PR change\n");
    const output = join(directory, "output");
    writeFileSync(output, "");
    execFileSync("bash", ["-c", script], {
      cwd: directory,
      env: {
        ...process.env,
        BASE_SHA: base,
        HEAD_SHA: head,
        GITHUB_OUTPUT: output,
      },
    });
    assert.equal(
      readFileSync(output, "utf8"),
      `database=${expected}\nchanged_files<<EOF\n${path}\nEOF\n`,
      path,
    );
  }
});
