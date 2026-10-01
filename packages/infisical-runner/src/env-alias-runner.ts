import { spawn } from "node:child_process";
import { applyDatabaseUrlOverride } from "./database-url-override.js";

/** A source and destination pair for an environment variable alias. */
type EnvironmentAlias = {
  /** The existing environment variable name. */
  from: string;
  /** The destination environment variable name. */
  to: string;
};

/** Options passed from the Infisical runner to its environment helper. */
type EnvironmentRunnerOptions = {
  /** Environment files searched for a user database selector. */
  databaseUrlUserOverrideFilePaths?: string[];
  /** Whether to apply a user-specific database URL. */
  databaseUrlUserOverride?: boolean;
  /** Environment variables copied under alternate names. */
  envAliases?: EnvironmentAlias[];
};

/**
 * Parses current options or the legacy aliases-only array.
 *
 * @param value - Serialized helper options.
 * @returns Normalized environment runner options.
 * @throws When the value is not valid JSON.
 */
function parseOptions(value: string): EnvironmentRunnerOptions {
  const parsed = JSON.parse(value) as
    | EnvironmentAlias[]
    | EnvironmentRunnerOptions;

  if (!Array.isArray(parsed)) {
    return parsed;
  }

  return {
    envAliases: parsed,
  };
}

/**
 * Copies available source variables into absent destination variables.
 *
 * @param aliases - Environment variable mappings to apply to `process.env`.
 */
function applyAliases(aliases: readonly EnvironmentAlias[]): void {
  for (const alias of aliases) {
    if (process.env[alias.to] || !process.env[alias.from]) {
      continue;
    }

    process.env[alias.to] = process.env[alias.from];
  }
}

/**
 * Applies a configured user database URL and reports the selection.
 *
 * @param filePaths - Environment files searched in precedence order.
 * @throws When the database selector or selected secret is invalid.
 */
function applyDatabaseUrlUserOverride(filePaths: string[] | undefined): void {
  if (!filePaths) {
    return;
  }

  const override = applyDatabaseUrlOverride(filePaths);

  if (!override) {
    process.stderr.write(
      `Infisical runner: no URL_INITIALS found; using DATABASE_URL.\n`,
    );
    return;
  }

  process.stderr.write(
    `Infisical runner: using ${override.name} from Infisical /local/database instead of DATABASE_URL.\n`,
  );
}

const [optionsJson, separator, command, ...commandArgs] = process.argv.slice(2);

if (!optionsJson || separator !== "--" || !command) {
  console.error(
    "Usage: tsx env-alias-runner.ts <options-json> -- <command...>",
  );
  process.exitCode = 1;
} else {
  const options = parseOptions(optionsJson);

  applyAliases(options.envAliases ?? []);

  if (options.databaseUrlUserOverride) {
    applyDatabaseUrlUserOverride(options.databaseUrlUserOverrideFilePaths);
  }

  const child = spawn(command, commandArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  child.on("error", (error) => {
    throw error;
  });

  child.on("exit", (code, signal) => {
    if (typeof code === "number") {
      process.exitCode = code;
      return;
    }

    console.error(`Command exited after signal ${signal ?? "unknown"}.`);
    process.exitCode = 1;
  });
}
