import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type CommandSecretConfig,
  commandSecrets,
  defaultEnvironmentSlug,
} from "./config.js";

/** An actionable configuration or prerequisite failure from the runner. */
export class RunnerError extends Error {
  /** The stable error name exposed to callers. */
  override name = "RunnerError";
}

/** Parsed runner arguments preceding and following the `--` separator. */
export type ParsedCliArguments = {
  /** The application whose secret policy is requested. */
  app: string;
  /** The application command whose secret policy is requested. */
  command: string;
  /** The executable and arguments run with injected secrets. */
  commandArgs: string[];
};

/** Inputs required to execute a command through Infisical. */
export type InfisicalRunRequest = ParsedCliArguments & {
  /** An explicit Infisical project identifier, when configured. */
  infisicalProjectId?: string;
  /** The absolute monorepo root used for configuration and helper paths. */
  repoRoot: string;
  /** Whether to expose informational provider logs. */
  verbose?: boolean;
};

/**
 * Resolves the monorepo root relative to this package.
 *
 * @returns The absolute monorepo root path.
 */
export function getRepoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
}

/**
 * Splits runner arguments from the wrapped command.
 *
 * @param argv - Arguments after the runner executable and script path.
 * @returns The application, policy command, and wrapped command arguments.
 * @throws When the arguments do not match `<app> <command> -- <command...>`.
 */
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

/**
 * Looks up the secret policy for an application command.
 *
 * @param app - The configured application name.
 * @param command - The configured application command.
 * @returns The command's secret-injection policy.
 * @throws When the application command has no configured policy.
 */
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

/**
 * Resolves the Infisical environment for an application command.
 *
 * @param app - The configured application name.
 * @param command - The configured application command.
 * @returns The command-specific or default environment slug.
 * @throws When the application command has no configured policy.
 */
export function getCommandEnvironmentSlug(
  app: string,
  command: string,
): string {
  return (
    getCommandSecretConfig(app, command).environmentSlug ??
    defaultEnvironmentSlug
  );
}

/**
 * Tests whether an Infisical path contains a server-only segment.
 *
 * @param secretPath - The Infisical secret path to inspect.
 * @returns Whether the path targets `server` secrets.
 */
export function isServerSecretPath(secretPath: string): boolean {
  return secretPath.endsWith("/server") || secretPath.includes("/server/");
}

/**
 * Returns configured secret paths once each while preserving order.
 *
 * @param config - The command's secret-injection policy.
 * @returns A non-empty list of unique Infisical paths.
 */
export function getSecretPaths(
  config: CommandSecretConfig,
): [string, ...string[]] {
  const [firstPath, ...remainingPaths] = config.paths;
  return [
    firstPath,
    ...new Set(remainingPaths.filter((path) => path !== firstPath)),
  ];
}

/**
 * Enforces the command's server-secret injection policy.
 *
 * @param app - The configured application name.
 * @param command - The configured application command.
 * @param config - The command's secret-injection policy.
 * @throws When a client command requests a server-only path.
 */
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

/**
 * Builds the nested Infisical CLI arguments for a wrapped command.
 *
 * @param request - The command and secret-injection request.
 * @returns Arguments for the `infisical` executable.
 * @throws When the command policy is absent or violates path restrictions.
 */
export function buildInfisicalRunArgs(request: InfisicalRunRequest): string[] {
  const config = getCommandSecretConfig(request.app, request.command);
  validateSecretPaths(request.app, request.command, config);
  const environmentSlug = getCommandEnvironmentSlug(
    request.app,
    request.command,
  );

  /**
   * Builds one Infisical `run` layer for a secret path.
   *
   * @param secretPath - The Infisical path injected by this layer.
   * @returns Arguments ending at the wrapped-command separator.
   */
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
          join(request.repoRoot, ".env"),
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

/**
 * Tests whether the repository contains supported Infisical project metadata.
 *
 * @param repoRoot - The absolute monorepo root.
 * @returns Whether an Infisical project config file exists.
 */
export function hasInfisicalProjectConfig(repoRoot: string): boolean {
  return (
    existsSync(join(repoRoot, "infisical.json")) ||
    existsSync(join(repoRoot, ".infisical.json"))
  );
}

/**
 * Verifies that the Infisical CLI can be started.
 *
 * @throws When the Infisical executable is unavailable.
 */
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

/**
 * Verifies that the repository contains Infisical project metadata.
 *
 * @param repoRoot - The absolute monorepo root.
 * @throws When no supported project config file exists.
 */
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

/**
 * Converts Infisical authentication output into an actionable runner error.
 *
 * @param output - Combined standard output and error from the CLI.
 * @returns A sign-in-specific or generic authentication error.
 */
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

/**
 * Verifies that Infisical can read the requested environment.
 *
 * @param repoRoot - The absolute monorepo root used as the CLI working directory.
 * @param environmentSlug - The Infisical environment to check.
 * @throws When the authentication check exits unsuccessfully.
 */
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

/**
 * Runs a command with its configured Infisical secrets and inherited terminal I/O.
 *
 * @param request - The command and secret-injection request.
 * @returns The wrapped process exit code, or one when it exits by signal.
 * @rejects When prerequisites fail or the Infisical child process cannot start.
 */
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
