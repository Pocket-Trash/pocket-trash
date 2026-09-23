import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type CommandSecretConfig,
  commandSecrets,
  defaultEnvironmentSlug,
} from "./config.js";

export class RunnerError extends Error {
  override name = "RunnerError";
}

export type ParsedCliArguments = {
  app: string;
  command: string;
  commandArgs: string[];
};

export type InfisicalRunRequest = ParsedCliArguments & {
  infisicalProjectId?: string;
  repoRoot: string;
  verbose?: boolean;
};

export function getRepoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
}

export function parseCliArguments(argv: readonly string[]): ParsedCliArguments {
  const separatorIndex = argv.indexOf("--");

  if (separatorIndex === -1) {
    throw new RunnerError("Expected `--` before the command to run.");
  }

  const runnerArgs = argv.slice(0, separatorIndex);
  const commandArgs = argv.slice(separatorIndex + 1);
  const [app, command, ...extraRunnerArgs] = runnerArgs;

  if (!app || !command || extraRunnerArgs.length > 0) {
    throw new RunnerError(
      "Usage: tsx ../../packages/infisical-runner/src/cli.ts <app> <command> -- <command...>",
    );
  }

  if (commandArgs.length === 0) {
    throw new RunnerError("Expected a command after `--`.");
  }

  return {
    app,
    command,
    commandArgs,
  };
}

export function getCommandSecretConfig(
  app: string,
  command: string,
): CommandSecretConfig {
  const appConfig = commandSecrets[app as keyof typeof commandSecrets];
  const commandConfig = appConfig?.[command as keyof typeof appConfig];

  if (!commandConfig) {
    throw new RunnerError(
      `No Infisical secret mapping exists for app "${app}" command "${command}".`,
    );
  }

  return commandConfig;
}

export function getCommandEnvironmentSlug(
  app: string,
  command: string,
): string {
  return (
    getCommandSecretConfig(app, command).environmentSlug ??
    defaultEnvironmentSlug
  );
}

export function isServerSecretPath(secretPath: string): boolean {
  return secretPath.endsWith("/server") || secretPath.includes("/server/");
}

export function getSecretPaths(
  config: CommandSecretConfig,
): [string, ...string[]] {
  const [firstPath, ...remainingPaths] = config.paths;
  return [
    firstPath,
    ...new Set(remainingPaths.filter((path) => path !== firstPath)),
  ];
}

export function validateSecretPaths(
  app: string,
  command: string,
  config: CommandSecretConfig,
): void {
  if (config.allowServerSecrets) {
    return;
  }

  if (getSecretPaths(config).some(isServerSecretPath)) {
    throw new RunnerError(
      `Refusing to inject server-only secrets into client command "${app}:${command}".`,
    );
  }
}

export function buildInfisicalRunArgs(request: InfisicalRunRequest): string[] {
  const config = getCommandSecretConfig(request.app, request.command);
  validateSecretPaths(request.app, request.command, config);
  const environmentSlug = getCommandEnvironmentSlug(
    request.app,
    request.command,
  );

  const runArgsForPath = (secretPath: string): string[] => [
    "run",
    ...(request.verbose
      ? ["--log-level=info"]
      : ["--silent", "--log-level=error"]),
    ...(request.infisicalProjectId
      ? [`--projectId=${request.infisicalProjectId}`]
      : []),
    `--project-config-dir=${request.repoRoot}`,
    `--env=${environmentSlug}`,
    `--path=${secretPath}`,
    "--",
  ];

  const paths = getSecretPaths(config);
  const innerCommand: string[] = [];

  if (config.envAliases?.length || config.databaseUrlUserOverride) {
    innerCommand.push(
      "tsx",
      join(
        request.repoRoot,
        "packages/infisical-runner/src/env-alias-runner.ts",
      ),
      JSON.stringify({
        databaseUrlUserOverrideFilePaths: [
          join(request.repoRoot, ".env.local"),
          join(request.repoRoot, "packages/database/.env.local"),
        ],
        databaseUrlUserOverride: config.databaseUrlUserOverride ?? false,
        envAliases: config.envAliases ?? [],
      }),
      "--",
    );
  }

  innerCommand.push(...request.commandArgs);

  // Infisical accepts a single secret path per `run`, so nest runs to
  // accumulate each path's secrets before the wrapped command executes.
  const [outermostPath, ...remainingPaths] = paths;
  const args = runArgsForPath(outermostPath);
  for (const secretPath of remainingPaths) {
    args.push("infisical", ...runArgsForPath(secretPath));
  }

  return [...args, ...innerCommand];
}

export function hasInfisicalProjectConfig(repoRoot: string): boolean {
  return (
    existsSync(join(repoRoot, "infisical.json")) ||
    existsSync(join(repoRoot, ".infisical.json"))
  );
}

export function assertInfisicalCliAvailable(): void {
  const result = spawnSync("infisical", ["--version"], {
    stdio: "ignore",
  });

  if (result.error) {
    throw new RunnerError(
      [
        "Infisical CLI is required for this command.",
        "",
        "Install it from https://infisical.com/docs/cli/overview, then run:",
        "  infisical login",
        "  infisical init",
        "",
        "Choose the Pocket Trash project (`pocket-trash` slug) when initializing the repo.",
      ].join("\n"),
    );
  }
}

export function assertInfisicalProjectConfig(repoRoot: string): void {
  if (hasInfisicalProjectConfig(repoRoot)) {
    return;
  }

  throw new RunnerError(
    [
      "Infisical project config was not found at the repo root.",
      "",
      "Run this from the monorepo root:",
      "  infisical init",
      "",
      "Choose the Pocket Trash project (`pocket-trash` slug). Commit infisical.json only if it contains non-secret project metadata.",
    ].join("\n"),
  );
}

export function getInfisicalAuthCheckError(output: string): RunnerError {
  if (
    output.includes("couldn't find your logged in details") ||
    output.includes("infisical login")
  ) {
    return new RunnerError(
      [
        "Infisical CLI is not signed in.",
        "",
        "Run this from the monorepo root, then retry the command:",
        "  infisical login",
      ].join("\n"),
    );
  }

  return new RunnerError(
    [
      "Infisical CLI authentication check failed.",
      "",
      output.trim() || "No output was returned by the Infisical CLI.",
    ].join("\n"),
  );
}

export function assertInfisicalAuthenticated(
  repoRoot: string,
  environmentSlug = defaultEnvironmentSlug,
): void {
  const result = spawnSync(
    "infisical",
    [
      "secrets",
      "folders",
      "get",
      "--silent",
      "--log-level=error",
      `--env=${environmentSlug}`,
      "--path=/",
      "--output=json",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  if (result.status === 0) {
    return;
  }

  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();

  throw getInfisicalAuthCheckError(output);
}

export async function runInfisicalCommand(
  request: InfisicalRunRequest,
): Promise<number> {
  assertInfisicalCliAvailable();
  assertInfisicalProjectConfig(request.repoRoot);
  assertInfisicalAuthenticated(
    request.repoRoot,
    getCommandEnvironmentSlug(request.app, request.command),
  );

  const args = buildInfisicalRunArgs(request);
  const child = spawn("infisical", args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  return new Promise((resolvePromise, reject) => {
    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code, signal) => {
      if (typeof code === "number") {
        resolvePromise(code);
        return;
      }

      console.error(
        `Infisical command exited after signal ${signal ?? "unknown"}.`,
      );
      resolvePromise(1);
    });
  });
}
