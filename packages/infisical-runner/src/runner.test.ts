import { describe, expect, it } from "vitest";
import { commandSecrets } from "./config.js";
import {
  buildInfisicalRunArgs,
  getInfisicalAuthCheckError,
  getSecretPaths,
  parseCliArguments,
  RunnerError,
  validateSecretPaths,
} from "./runner.js";

function getEnvAliasRunnerOptions(args: readonly string[]) {
  const runnerIndex = args.findIndex((arg) =>
    arg.endsWith("/packages/infisical-runner/src/env-alias-runner.ts"),
  );

  if (runnerIndex === -1) {
    throw new Error("env-alias-runner was not included in args.");
  }

  return JSON.parse(args[runnerIndex + 1] ?? "{}") as {
    databaseUrlUserOverride?: boolean;
    databaseUrlUserOverrideFilePaths?: string[];
  };
}

describe("parseCliArguments", () => {
  it("parses the app, command, and wrapped command", () => {
    expect(parseCliArguments(["web", "dev", "--", "vite", "dev"])).toEqual({
      app: "web",
      command: "dev",
      commandArgs: ["vite", "dev"],
    });
  });

  it("requires a separator before the wrapped command", () => {
    expect(() => parseCliArguments(["web", "dev", "vite", "dev"])).toThrow(
      RunnerError,
    );
  });
});

describe("buildInfisicalRunArgs", () => {
  const quietArgs = ["--silent", "--log-level=error"];
  const quietRunArgs = (path: string) => [
    "run",
    ...quietArgs,
    "--project-config-dir=/repo",
    "--env=dev",
    `--path=${path}`,
    "--",
  ];

  it("builds API dev args with API and personal database secrets", () => {
    const args = buildInfisicalRunArgs({
      app: "api",
      command: "dev",
      commandArgs: ["wrangler", "dev", "--port", "4006"],
      repoRoot: "/repo",
    });

    expect(getEnvAliasRunnerOptions(args)).toMatchObject({
      databaseUrlUserOverride: true,
      databaseUrlUserOverrideFilePaths: ["/repo/.env.local", "/repo/.env"],
    });
    expect(args).toContain("--path=/apps/api");
    expect(args).toContain("--path=/local/database");
    expect(args).not.toContain("--path=/apps/web");
  });

  it.each([
    ["deploy", "prod", ""],
    ["deploy:preview", "preview", "preview"],
  ])("builds API %s args with Cloudflare secrets", (command, env, workerEnv) => {
    expect(
      buildInfisicalRunArgs({
        app: "api",
        command,
        commandArgs: ["wrangler", "deploy", `--env=${workerEnv}`],
        repoRoot: "/repo",
      }),
    ).toEqual([
      "run",
      ...quietArgs,
      "--project-config-dir=/repo",
      `--env=${env}`,
      "--path=/tools/cloudflare",
      "--",
      "wrangler",
      "deploy",
      `--env=${workerEnv}`,
    ]);
  });

  it.each([
    ["cron:run"],
    ["process:dead-letter"],
    ["process:queue"],
    ["scrape"],
    ["scrape:autmog"],
    ["scrape:grimsmo-fjell"],
    ["scrape:grimsmo-norseman"],
    ["scrape:grimsmo-rask"],
    ["scrape:grimsmo-saga"],
  ])("maps the scraper %s command to scraper app secrets", (command) => {
    expect(commandSecrets.scraper).toHaveProperty(command);

    const args = buildInfisicalRunArgs({
      app: "scraper",
      command,
      commandArgs: ["tsx", "apps/scraper/src/cli.ts", command],
      repoRoot: "/repo",
    });

    expect(args).toContain("--path=/apps/scraper");
    expect(getEnvAliasRunnerOptions(args)).toMatchObject({
      databaseUrlUserOverride: true,
      databaseUrlUserOverrideFilePaths: ["/repo/.env.local", "/repo/.env"],
    });
  });

  it("rejects unknown app commands", () => {
    expect(() =>
      buildInfisicalRunArgs({
        app: "web",
        command: "deploy",
        commandArgs: ["vite", "build"],
        repoRoot: "/repo",
      }),
    ).toThrow(RunnerError);
  });

  it("builds Bunny audit args from the local Bunny target path", () => {
    expect(
      buildInfisicalRunArgs({
        app: "bunny",
        command: "audit",
        commandArgs: ["node", "scripts/audit-bunny-services.mjs"],
        repoRoot: "/repo",
      }),
    ).toEqual([
      "run",
      ...quietArgs,
      "--project-config-dir=/repo",
      "--env=dev",
      "--path=/local/bunny",
      "--",
      "node",
      "scripts/audit-bunny-services.mjs",
    ]);
  });

  it("builds web commands from the web target path", () => {
    expect(
      buildInfisicalRunArgs({
        app: "web",
        command: "build",
        commandArgs: ["vite", "build"],
        repoRoot: "/repo",
      }),
    ).toEqual([
      ...quietRunArgs("/apps/web"),
      "infisical",
      ...quietRunArgs("/local/database"),
      "tsx",
      "/repo/packages/infisical-runner/src/env-alias-runner.ts",
      expect.stringContaining("databaseUrlUserOverride"),
      "--",
      "vite",
      "build",
    ]);
  });

  it("loads local Clerk IDs for the webhook listener", () => {
    expect(
      buildInfisicalRunArgs({
        app: "webhooks",
        command: "listen",
        commandArgs: ["node", "scripts/dev-webhooks.mjs"],
        repoRoot: "/repo",
      }),
    ).toEqual([
      "run",
      ...quietArgs,
      "--project-config-dir=/repo",
      "--env=dev",
      "--path=/local/clerk",
      "--",
      "node",
      "scripts/dev-webhooks.mjs",
    ]);
  });

  it("builds scraper source commands from the scraper target path", () => {
    expect(
      buildInfisicalRunArgs({
        app: "scraper",
        command: "scrape",
        commandArgs: ["tsx", "apps/scraper/src/cli.ts", "scrape", "autmog"],
        repoRoot: "/repo",
      }),
    ).toEqual([
      ...quietRunArgs("/apps/scraper"),
      "infisical",
      ...quietRunArgs("/local/database"),
      "tsx",
      "/repo/packages/infisical-runner/src/env-alias-runner.ts",
      expect.stringContaining("databaseUrlUserOverride"),
      "--",
      "tsx",
      "apps/scraper/src/cli.ts",
      "scrape",
      "autmog",
    ]);
  });

  it("builds scraper dead-letter processor commands from the scraper target path", () => {
    expect(
      buildInfisicalRunArgs({
        app: "scraper",
        command: "process:dead-letter",
        commandArgs: ["tsx", "apps/scraper/src/cli.ts", "process:dead-letter"],
        repoRoot: "/repo",
      }),
    ).toEqual([
      ...quietRunArgs("/apps/scraper"),
      "infisical",
      ...quietRunArgs("/local/database"),
      "tsx",
      "/repo/packages/infisical-runner/src/env-alias-runner.ts",
      expect.stringContaining("databaseUrlUserOverride"),
      "--",
      "tsx",
      "apps/scraper/src/cli.ts",
      "process:dead-letter",
    ]);
  });

  it("builds logger live test args with automated Axiom and logging paths", () => {
    expect(
      buildInfisicalRunArgs({
        app: "logger",
        command: "test:axiom",
        commandArgs: ["tsx", "packages/logger/integration/axiom-live.ts"],
        infisicalProjectId: "project-1",
        repoRoot: "/repo",
      }),
    ).toEqual([
      "run",
      ...quietArgs,
      "--projectId=project-1",
      "--project-config-dir=/repo",
      "--env=dev",
      "--path=/tools/logger-axiom-test",
      "--",
      "tsx",
      "packages/logger/integration/axiom-live.ts",
    ]);
  });

  it("builds GitHub Discord notification args", () => {
    expect(
      buildInfisicalRunArgs({
        app: "github",
        command: "discord-notify",
        commandArgs: [
          "pnpm",
          "--filter",
          "@package/github-discord-notifier",
          "notify",
        ],
        repoRoot: "/repo",
      }),
    ).toEqual([
      "run",
      ...quietArgs,
      "--project-config-dir=/repo",
      "--env=dev",
      "--path=tools/github/secrets",
      "--",
      "pnpm",
      "--filter",
      "@package/github-discord-notifier",
      "notify",
    ]);
  });

  it("builds database migrate args with the database URL user override", () => {
    const args = buildInfisicalRunArgs({
      app: "database",
      command: "db:migrate",
      commandArgs: ["drizzle-kit", "migrate", "--config=drizzle.config.ts"],
      repoRoot: "/repo",
    });

    expect(args).toEqual([
      ...quietRunArgs("/apps/web"),
      "infisical",
      ...quietRunArgs("/local/database"),
      "tsx",
      "/repo/packages/infisical-runner/src/env-alias-runner.ts",
      expect.stringContaining("databaseUrlUserOverride"),
      "--",
      "drizzle-kit",
      "migrate",
      "--config=drizzle.config.ts",
    ]);
    expect(getEnvAliasRunnerOptions(args)).toMatchObject({
      databaseUrlUserOverride: true,
      databaseUrlUserOverrideFilePaths: ["/repo/.env.local", "/repo/.env"],
    });
  });

  it("builds database seed args with the database URL user override", () => {
    const args = buildInfisicalRunArgs({
      app: "database",
      command: "db:seed",
      commandArgs: ["tsx", "scripts/seed.ts"],
      repoRoot: "/repo",
    });

    expect(args).toEqual([
      "run",
      ...quietArgs,
      "--project-config-dir=/repo",
      "--env=dev",
      "--path=/apps/web",
      "--",
      "tsx",
      "/repo/packages/infisical-runner/src/env-alias-runner.ts",
      expect.stringContaining("databaseUrlUserOverride"),
      "--",
      "tsx",
      "scripts/seed.ts",
    ]);
    expect(getEnvAliasRunnerOptions(args)).toMatchObject({
      databaseUrlUserOverride: true,
      databaseUrlUserOverrideFilePaths: ["/repo/.env.local", "/repo/.env"],
    });
  });

  it("builds database studio args with the database URL user override", () => {
    const args = buildInfisicalRunArgs({
      app: "database",
      command: "db:studio",
      commandArgs: [
        "drizzle-kit",
        "studio",
        "--config=drizzle.config.ts",
        "--host=127.0.0.1",
        "--port=4009",
      ],
      repoRoot: "/repo",
    });

    expect(args).toEqual([
      ...quietRunArgs("/apps/web"),
      "infisical",
      ...quietRunArgs("/local/database"),
      "tsx",
      "/repo/packages/infisical-runner/src/env-alias-runner.ts",
      expect.stringContaining("databaseUrlUserOverride"),
      "--",
      "drizzle-kit",
      "studio",
      "--config=drizzle.config.ts",
      "--host=127.0.0.1",
      "--port=4009",
    ]);
    expect(getEnvAliasRunnerOptions(args)).toMatchObject({
      databaseUrlUserOverride: true,
      databaseUrlUserOverrideFilePaths: ["/repo/.env.local", "/repo/.env"],
    });
  });

  it("shows provider information without enabling secret-dumping trace logs", () => {
    const args = buildInfisicalRunArgs({
      app: "web",
      command: "dev",
      commandArgs: ["vite", "dev"],
      repoRoot: "/repo",
      verbose: true,
    });

    expect(args).toContain("--log-level=info");
    expect(args).not.toContain("--silent");
    expect(args).not.toContain("--log-level=trace");
  });
});

describe("infisical auth checks", () => {
  it("surfaces signed-out CLI errors with login instructions", () => {
    const error = getInfisicalAuthCheckError(
      "error: we couldn't find your logged in details, try running [infisical login] then try again",
    );

    expect(error).toBeInstanceOf(RunnerError);
    expect(error.message).toContain("Infisical CLI is not signed in.");
    expect(error.message).toContain("infisical login");
  });
});

describe("secret path policy", () => {
  it("deduplicates configured paths in order", () => {
    expect(
      getSecretPaths({
        allowServerSecrets: false,
        paths: ["/apps/web", "/shared", "/apps/web"],
      }),
    ).toEqual(["/apps/web", "/shared"]);
  });

  it("rejects server-only paths for client commands", () => {
    expect(() =>
      validateSecretPaths("web", "dev", {
        allowServerSecrets: false,
        paths: ["/apps/server/only"],
      }),
    ).toThrow(RunnerError);
  });
});
