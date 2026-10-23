import { printScriptError, runCommand } from "./scraper-redis.mjs";

/** Reports local Redis or scraper development failures at the CLI boundary. */
try {
  await runCommand("pnpm", ["--filter", "@app/scraper", "dev"]);
} catch (error) {
  printScriptError(error);
  process.exitCode = 1;
}
