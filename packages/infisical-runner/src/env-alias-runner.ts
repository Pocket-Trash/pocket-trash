import { spawn } from "node:child_process";
import { applyDatabaseUrlOverride } from "./database-url-override.js";

type EnvironmentAlias = {
  from: string;
  to: string;
};

type EnvironmentRunnerOptions = {
  databaseUrlUserOverrideFilePaths?: string[];
  databaseUrlUserOverride?: boolean;
  envAliases?: EnvironmentAlias[];
};

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

function applyAliases(aliases: readonly EnvironmentAlias[]): void {
  for (const alias of aliases) {
    if (process.env[alias.to] || !process.env[alias.from]) {
      continue;
    }

    process.env[alias.to] = process.env[alias.from];
  }
}

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
