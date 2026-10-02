import {
  ensureScraperRedisContainer,
  getScraperRedisUrl,
  printScriptError,
  runCommand,
} from "./scraper-redis.mjs";

/** Reports scraper startup and command failures at the CLI boundary. */
try {
  const [command, ...commandArgs] = process.argv.slice(2);

  if (!command) {
    throw new Error(
      "Expected scraper command. Use cron:run, scrape, process:queue, or process:dead-letter.",
    );
  }

  await ensureScraperRedisContainer();

  const runnerCommand = getRunnerCommand(command, commandArgs);
  await runCommand(runnerCommand.command, runnerCommand.args, {
    ...process.env,
    REDIS_URL: getScraperRedisUrl(),
  });
} catch (error) {
  printScriptError(error);
  process.exitCode = 1;
}

/**
 * Builds the Infisical runner invocation for a scraper command.
 *
 * @param command - The supported scraper command name.
 * @param commandArgs - Extra arguments forwarded to scrape commands.
 * @returns The executable and arguments to run.
 * @throws When the command is unsupported.
 */
function getRunnerCommand(command, commandArgs) {
  if (command === "cron:run") {
    return {
      args: [
        "packages/infisical-runner/src/cli.ts",
        "scraper",
        "cron:run",
        "--",
        "tsx",
        "apps/scraper/src/cli.ts",
        "cron:run",
      ],
      command: "tsx",
    };
  }

  if (command === "scrape") {
    return {
      args: [
        "packages/infisical-runner/src/cli.ts",
        "scraper",
        command,
        "--",
        "tsx",
        "apps/scraper/src/cli.ts",
        command,
        ...commandArgs,
      ],
      command: "tsx",
    };
  }

  if (command === "process:queue") {
    return {
      args: [
        "packages/infisical-runner/src/cli.ts",
        "scraper",
        "process:queue",
        "--",
        "tsx",
        "apps/scraper/src/cli.ts",
        "process:queue",
      ],
      command: "tsx",
    };
  }

  if (command === "process:dead-letter") {
    return {
      args: [
        "packages/infisical-runner/src/cli.ts",
        "scraper",
        "process:dead-letter",
        "--",
        "tsx",
        "apps/scraper/src/cli.ts",
        "process:dead-letter",
      ],
      command: "tsx",
    };
  }

  throw new Error(`Unknown scraper command "${command}".`);
}
