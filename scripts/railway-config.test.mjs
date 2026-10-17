import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
      (resource) =>
        resource.name ===
        (environment === "production"
          ? "pocket-trash"
          : "pocket-trash (preview)"),
    );
    const discordBot = definition.resources.find(
      (resource) => resource.name === "discord-bot",
    );
    const queue = definition.resources.find(
      (resource) => resource.address === "database.pocket-trash-queue",
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
      "railpack.json",
      "scripts/pnpm-install.sh",
      "scripts/security-audit.mjs",
      "security-audit-exceptions.json",
      "turbo.json",
    ]);
    assert.deepEqual(Object.keys(scraper.variables).sort(), [
      "APP_ENV",
      "AXIOM_DATASET",
      "AXIOM_TOKEN",
      "BUNNY_CDN_BASE_URL",
      "BUNNY_IMAGE_FOLDER_PREFIX",
      "BUNNY_STORAGE_ACCESS_KEY",
      "BUNNY_STORAGE_ENDPOINT",
      "BUNNY_STORAGE_ZONE_NAME",
      "DATABASE_URL",
      "FONTAWESOME_PACKAGE_TOKEN",
      "LOG_DEPLOYMENT_ID",
      "LOG_DEPLOYMENT_TARGET",
      "LOG_LEVEL",
      "RAILPACK_INSTALL_CMD",
      "REDIS_URL",
      "SCRAPER_CRON_ENABLED",
      "SCRAPER_IMAGE_BATCH_SIZE",
      "SCRAPER_ITEM_BATCH_SIZE",
      "SCRAPER_QUEUE_CONCURRENCY",
    ]);
    assert.deepEqual(scraper.variables.RAILPACK_INSTALL_CMD, {
      type: "literal",
      value: "./scripts/pnpm-install.sh --frozen-lockfile --prefer-offline",
    });
    for (const [name, value] of Object.entries(scraper.variables)) {
      if (name === "RAILPACK_INSTALL_CMD") continue;
      assert.deepEqual(value, { type: "preserve" });
    }
    const expectedAddresses = [
      "database.pocket-trash-queue",
      "database.scraper-queue",
      `service.${scraper.name}`,
      "volume.redis-volume",
    ];
    if (environment === "production")
      expectedAddresses.push("service.discord-bot");
    assert.deepEqual(
      definition.resources.map((resource) => resource.address).sort(),
      expectedAddresses.sort(),
    );
    if (environment === "production") {
      assert.equal(discordBot.deploy.healthcheckPath, "/health");
      assert.equal(discordBot.deploy.overlapSeconds, 0);
      assert.equal(
        discordBot.variables.REDIS_URL.resource,
        "database.pocket-trash-queue",
      );
      assert.deepEqual(discordBot.variables.LINEAR_API_KEY, {
        type: "preserve",
      });
      assert.equal(discordBot.source.repo, "Pocket-Trash/pocket-trash");
      for (const variable of [
        "DISCORD_AXIOM_INTAKE_CHANNEL_ID",
        "DISCORD_AXIOM_INTAKE_WEBHOOK_ID",
        "DISCORD_BUG_TAG_ID",
        "DISCORD_FEATURE_REQUEST_TAG_ID",
        "DISCORD_GITHUB_CHANNEL_ID",
        "DISCORD_GITHUB_ERRORS_CHANNEL_ID",
        "DISCORD_LOGGER_CHANNEL_ID",
        "DISCORD_SUPPORT_FORUM_ID",
      ]) {
        assert.deepEqual(discordBot.variables[variable], { type: "preserve" });
      }
    } else {
      assert.equal(discordBot, undefined);
    }
    assert.equal(queue.name, "pocket-trash-queue");
    assert.match(queue.deploy.startCommand, /--save 60 1/);
    assert.match(queue.deploy.startCommand, /--appendonly yes/);
    assert.match(queue.deploy.startCommand, /--appendfsync everysec/);
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

test("authenticates native Railpack installs from source", () => {
  const config = JSON.parse(
    readFileSync(new URL("../railpack.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(config.steps.install.commands, [
    "./scripts/pnpm-install.sh --frozen-lockfile --prefer-offline",
  ]);
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
  assert.match(run, /GITHUB_EVENT_NAME.*pull_request/);
  assert.doesNotMatch(run, /config apply|show-values|include-variables/);
  assert.match(run, /railway link --project/);
  assert.match(run, /--environment/);
  /**
   * Execute the workflow step with a simulated Railway plan result.
   *
   * @param {{ environment: string; eventName: string; planExitCode: number }} root0 - Simulation inputs.
   * @param {string} root0.environment - Railway environment name.
   * @param {string} root0.eventName - GitHub event name.
   * @param {number} root0.planExitCode - Simulated Railway plan exit code.
   * @returns {Buffer} Command output.
   */
  const runWorkflow = ({ environment, eventName, planExitCode }) =>
    execFileSync(
      "bash",
      [
        "-c",
        `
      pnpm() {
        case "$3" in
          link) test "$5" = expected-project && test "$7" = "$RAILWAY_ENVIRONMENT" ;;
          config) test -z "\${RAILWAY_PROJECT_ID+x}" && return "$PLAN_EXIT_CODE" ;;
          *) return 1 ;;
        esac
      }
      ${run}
    `,
      ],
      {
        env: {
          ...process.env,
          RAILWAY_API_TOKEN: "test-token",
          RAILWAY_PROJECT_ID: "expected-project",
          RAILWAY_ENVIRONMENT: environment,
          GITHUB_EVENT_NAME: eventName,
          PLAN_EXIT_CODE: String(planExitCode),
        },
      },
    );

  for (const environment of job.strategy.matrix.environment) {
    runWorkflow({ environment, eventName: "schedule", planExitCode: 0 });
    runWorkflow({ environment, eventName: "pull_request", planExitCode: 2 });
  }

  assert.throws(
    () =>
      runWorkflow({
        environment: "production",
        eventName: "schedule",
        planExitCode: 2,
      }),
    (error) => error.status === 2,
  );
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
