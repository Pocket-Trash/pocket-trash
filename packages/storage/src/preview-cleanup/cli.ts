import { appendFileSync } from "node:fs";
import { deletePreviewFolders } from "./delete-preview-folders.js";

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
}

/**
 * Deletes preview storage folders and writes workflow outputs and a summary event.
 *
 * @returns Completion after both preview namespaces are processed.
 * @rejects When configuration, deletion, or output writing fails.
 */
async function main(): Promise<void> {
  const result = await deletePreviewFolders({
    accessKey: readRequiredEnv("BUNNY_STORAGE_ACCESS_KEY"),
    cdnBaseUrl: readRequiredEnv("BUNNY_CDN_BASE_URL"),
    endpoint: readRequiredEnv("BUNNY_STORAGE_ENDPOINT"),
    prNumber: readPositiveIntegerEnv("PR_NUMBER"),
    zoneName: readRequiredEnv("BUNNY_STORAGE_ZONE_NAME"),
  });

  writeGithubOutput("image_folder_path", result.images.folderPath);
  writeGithubOutput("image_status", result.images.status);
  writeGithubOutput("resource_folder_path", result.resources.folderPath);
  writeGithubOutput("resource_status", result.resources.status);
  process.stdout.write(
    `${JSON.stringify({
      app: "ci",
      environment: process.env.GITHUB_ACTIONS ? "github-actions" : "local",
      level: "info",
      message: "ci.storage.previewFolders.cleanup.completed",
      timestamp: new Date().toISOString(),
      attributes: result,
    })}\n`,
  );
}

/**
 * Reads a required trimmed environment variable.
 *
 * @param name - Environment variable name.
 * @returns The non-empty trimmed value.
 * @throws When the variable is absent or blank.
 */
function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

/**
 * Reads a required positive integer environment variable.
 *
 * @param name - Environment variable name.
 * @returns The positive integer value.
 * @throws When the variable is missing or not a positive integer.
 */
function readPositiveIntegerEnv(name: string): number {
  const parsed = Number(readRequiredEnv(name));

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

/**
 * Appends a key-value pair to the GitHub Actions output file when configured.
 *
 * @param key - Workflow output name.
 * @param value - Workflow output value.
 * @throws When appending to the configured output file fails.
 */
function writeGithubOutput(key: string, value: string): void {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}
