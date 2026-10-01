import {
  assertInfisicalAuthenticated,
  assertInfisicalCliAvailable,
  assertInfisicalProjectConfig,
  getRepoRoot,
  RunnerError,
} from "./runner.js";

/** Reports actionable Infisical prerequisite failures to the caller. */
try {
  const repoRoot = getRepoRoot();

  assertInfisicalCliAvailable();
  assertInfisicalProjectConfig(repoRoot);
  assertInfisicalAuthenticated(repoRoot);
} catch (error) {
  if (error instanceof RunnerError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
