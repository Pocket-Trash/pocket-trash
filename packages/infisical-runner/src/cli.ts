import {
  getRepoRoot,
  parseCliArguments,
  RunnerError,
  runInfisicalCommand,
} from "./runner.js";

function printHelp(): void {
  console.log(
    [
      "Usage:",
      "  tsx ../../packages/infisical-runner/src/cli.ts <app> <command> -- <command...>",
      "",
      "Examples:",
      "  tsx ../../packages/infisical-runner/src/cli.ts web dev -- vite dev",
      "  tsx ../../packages/infisical-runner/src/cli.ts scraper scrape -- tsx apps/scraper/src/cli.ts scrape",
    ].join("\n"),
  );
}

async function main(argv: readonly string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return 0;
  }

  const parsedArguments = parseCliArguments(argv);

  return runInfisicalCommand({
    ...parsedArguments,
    infisicalProjectId: process.env.INFISICAL_PROJECT_ID,
    repoRoot: getRepoRoot(),
    verbose: process.env.INFISICAL_RUNNER_VERBOSE === "1",
  });
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof RunnerError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
