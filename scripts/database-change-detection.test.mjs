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

/** Parsed deployment workflow under test. */
const deployWorkflow = parse(
  readFileSync(
    new URL("../.github/workflows/deploy.yml", import.meta.url),
    "utf8",
  ),
);
/** Parsed reusable preview-refresh workflow under test. */
const refreshWorkflow = parse(
  readFileSync(
    new URL("../.github/workflows/preview-refresh.yml", import.meta.url),
    "utf8",
  ),
);
/** Raw production and preview deployment workflow sources. */
const deploymentSources = [
  readFileSync(
    new URL("../.github/workflows/deploy.yml", import.meta.url),
    "utf8",
  ),
  readFileSync(
    new URL("../.github/workflows/preview-refresh.yml", import.meta.url),
    "utf8",
  ),
];

test("database detection includes schema and seed changes", (context) => {
  const script = readFileSync(
    new URL("../.github/scripts/detect-database-changes.sh", import.meta.url),
    "utf8",
  ).split("source .github/scripts/ci-log.sh")[0];
  const directory = mkdtempSync(join(tmpdir(), "database-detection-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  /**
   * Runs Git inside the temporary fixture repository.
   *
   * @param args - Git arguments.
   * @returns Trimmed standard output.
   * @throws When Git exits unsuccessfully.
   */
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  /**
   * Writes and commits a fixture file.
   *
   * @param path - Repository-relative fixture path.
   * @param content - File contents to commit.
   * @returns The new commit SHA.
   * @throws When file or Git operations fail.
   */
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
    ["packages/database/scripts/seed.ts", true],
    ["packages/database/seed-data/catalog.json", true],
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
      `database_content_changed=${expected}\nchanged_files<<EOF\n${path}\nEOF\n`,
      path,
    );
  }
});

test("schema-changing main deploys refresh preview after development", () => {
  const development = deployWorkflow.jobs["development-api"];
  const refresh = deployWorkflow.jobs["refresh-preview"];

  assert.equal(
    development.outputs.database_content_changed,
    "${{ steps.db_changes.outputs.database_content_changed }}",
  );
  assert.equal(refresh.needs, "development-api");
  assert.match(
    refresh.if,
    /needs\.development-api\.outputs\.database_content_changed == 'true'/,
  );
  assert.equal(refresh.uses, "./.github/workflows/preview-refresh.yml");
  assert.ok(Object.hasOwn(refreshWorkflow.on, "workflow_call"));
});

test("PR mutation isolation is independent of migration detection", () => {
  const preview = deployWorkflow.jobs.preview;
  const prepareDatabase = preview.steps.find(
    (step) => step.name === "Prepare Neon preview database",
  );
  const readyComment = preview.steps.find(
    (step) => step.name === "Comment on ready DB preview",
  );

  assert.match(
    prepareDatabase.env.ISOLATION_REQUIRED,
    /outputs\.mutation_e2e/u,
  );
  assert.equal(
    readyComment.env.DB_CHANGING,
    "${{ steps.db_changes.outputs.database_content_changed }}",
  );
});

test("real Neon deploy workflows use the repair-aware migration runner", () => {
  for (const source of deploymentSources) {
    assert.match(source, /db:migrate:direct/u);
  }
});

test("preview database compatibility and preflight gate deployment", () => {
  const steps = deployWorkflow.jobs.preview.steps;
  const prepareIndex = steps.findIndex(
    (step) => step.name === "Prepare Neon preview database",
  );
  const preflightIndex = steps.findIndex(
    (step) => step.name === "Preflight migrations and seed on Neon PR branch",
  );
  const apiDeployIndex = steps.findIndex(
    (step) => step.name === "Deploy API preview",
  );
  const vercelIndex = steps.findIndex(
    (step) => step.name === "Configure Vercel branch database override",
  );
  const scraperDeployIndex = steps.findIndex(
    (step) => step.name === "Deploy Railway scraper queue preview",
  );
  const cleanup = steps.find(
    (step) => step.name === "Cleanup failed DB preview resources",
  );

  assert.ok(prepareIndex >= 0);
  assert.ok(preflightIndex > prepareIndex);
  assert.ok(apiDeployIndex > preflightIndex);
  assert.ok(vercelIndex > preflightIndex);
  assert.ok(scraperDeployIndex > preflightIndex);
  assert.equal(
    steps[prepareIndex].env.PREVIEW_BASE_SHA,
    "${{ github.event.pull_request.base.sha }}",
  );
  assert.equal(
    steps[preflightIndex].run,
    "bash .github/scripts/neon-database-branch.sh preflight-preview",
  );
  assert.equal(
    steps[apiDeployIndex].if,
    "steps.db.outputs.can_deploy == 'true'",
  );
  assert.match(cleanup.if, /always\(\)/u);
  assert.match(cleanup.if, /mutation_e2e/u);
  assert.match(cleanup.if, /cancelled\(\)/u);
  assert.doesNotMatch(cleanup.if, /branch_created/u);
});

test("preview lifecycle handles stale state and preflight failures", () => {
  execFileSync("bash", [".github/scripts/neon-database-branch.test.sh"], {
    cwd: new URL("..", import.meta.url),
    stdio: ["ignore", "pipe", "pipe"],
  });
});

test("database content detection alone controls labeling, while mutations control isolation", () => {
  const steps = deployWorkflow.jobs.preview.steps;
  const label = steps.find((step) => step.name === "Sync db-change label");
  assert.equal(
    label.env.DATABASE_CONTENT_CHANGED,
    "${{ steps.db_changes.outputs.database_content_changed }}",
  );
  assert.match(
    label.with.script,
    /process.env.DATABASE_CONTENT_CHANGED === "true"/u,
  );
  assert.doesNotMatch(label.with.script, /mutation_e2e/u);
  const summary = steps.find(
    (step) => step.name === "Report preview database decisions",
  );
  assert.match(
    summary.env.MUTATION_ISOLATION_REQUIRED,
    /outputs.mutation_e2e/u,
  );
  assert.match(summary.env.MUTATION_ISOLATION_REQUIRED, /test:e2e/u);
});
