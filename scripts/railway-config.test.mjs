import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { createRailwayContext, project } from "railway/iac";
import { parse } from "yaml";
import railway from "../.railway/railway.ts";
import { classifyChanges } from "./classify-changes.mjs";

for (const environment of ["production", "preview"]) {
  test(`preserves the scraper contract in ${environment}`, async () => {
    const definition = await railway(
      createRailwayContext({ projectName: "Pocket Trash", environment }),
      project,
    );
    const scraper = definition.resources.find(
      (resource) => resource.type === "service",
    );
    assert.equal(definition.name, "Pocket Trash");
    assert.equal(
      scraper.name,
      environment === "production" ? "pocket-trash" : "pocket-trash (preview)",
    );
    assert.equal(scraper.source.repo, "Pocket-Trash/pocket-trash");
    assert.equal(scraper.source.branch, "main");
    assert.equal(scraper.build.builder, "RAILPACK");
    assert.equal(
      scraper.build.buildCommand,
      "pnpm security:audit && pnpm --filter @app/scraper... build",
    );
    assert.equal(
      scraper.deploy.startCommand,
      "pnpm --filter @app/scraper run cron:run",
    );
    assert.equal(scraper.deploy.cronSchedule, "*/5 * * * *");
    assert.equal(scraper.deploy.restartPolicyType, "NEVER");
    assert.equal(scraper.deploy.preDeployCommand, undefined);
    assert.equal(scraper.deploy.healthcheckPath, undefined);
    assert.deepEqual(scraper.build.watchPatterns, [
      "apps/scraper/**",
      "packages/**",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "patches/**",
      ".railway/**",
      ".railwayignore",
      "scripts/security-audit.mjs",
      "security-audit-exceptions.json",
      "turbo.json",
    ]);
    assert.equal(Object.keys(scraper.variables).length, 24);
    for (const value of Object.values(scraper.variables)) {
      assert.deepEqual(value, { type: "preserve" });
    }
    assert.ok(scraper.variables.DATABASE_URL);
    assert.ok(scraper.variables.REDIS_URL);
    assert.ok(scraper.variables.SCRAPER_CRON_ENABLED);
    assert.ok(scraper.variables.LOG_DEPLOYMENT_ID);
    assert.ok(scraper.variables.IMAGE_KIT_FOLDER_PREFIX);
    assert.deepEqual(
      definition.resources.map((resource) => resource.address).sort(),
      [
        "database.scraper-queue",
        `service.${scraper.name}`,
        "volume.redis-volume",
      ],
    );
    const volume = definition.resources.find(
      (resource) => resource.type === "volume",
    );
    assert.equal(volume.config.sizeMB, 5000);
    assert.equal(volume.config.region, "us-east4-eqdc4a");
  });
}

test("rejects unrelated projects and unknown environments", () => {
  for (const context of [
    { projectName: "Other", environment: "production" },
    { projectName: "Pocket Trash", environment: "staging" },
    { projectName: "Pocket Trash", environment: "pocket-trash-pr-123" },
    { projectName: "Pocket Trash", environment: "pocket-trash-pr-typo" },
  ]) {
    assert.throws(
      () => railway(createRailwayContext(context), project),
      /Link/,
    );
  }
});

test("keeps one authoring file without secrets or Railway identities", () => {
  assert.equal(existsSync("railway.json"), false);
  assert.equal(existsSync("railway.toml"), false);
  assert.deepEqual(
    readdirSync(".railway").filter((file) =>
      /^railway\.(ts|py|go)$/.test(file),
    ),
    ["railway.ts"],
  );
  assert.doesNotMatch(
    readFileSync(".railway/railway.ts", "utf8"),
    /[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|\.railway\.app/,
  );
});

test("checks both templates without applying changes or exposing secrets to forks", () => {
  const workflow = parse(
    readFileSync(".github/workflows/railway-config.yml", "utf8"),
  );
  const job = workflow.jobs.drift;
  assert.deepEqual(job.strategy.matrix.environment, ["production", "preview"]);
  assert.match(job.if, /head.repo.full_name == github.repository/);
  const run = job.steps.find((step) => step.name === "Check Railway drift").run;
  assert.match(run, /config plan --detailed-exit-code/);
  assert.doesNotMatch(run, /config apply|show-values|include-variables/);
  assert.match(run, /railway link --project/);
  assert.match(run, /--environment/);
});

test("classifies IaC as scraper infrastructure and its guide as documentation", () => {
  for (const path of [
    ".railway/railway.ts",
    ".github/workflows/railway-config.yml",
  ]) {
    const result = classifyChanges([path]);
    assert.deepEqual(result.unknownPaths, []);
    assert.equal(result.domains.scraper, true);
    assert.equal(result.domains.preview, true);
    assert.equal(result.domains.safe_e2e, false);
    assert.equal(result.domains.database_validation, false);
  }
  assert.deepEqual(classifyChanges([".railway/README.md"]).noCodePaths, [
    ".railway/README.md",
  ]);
});
