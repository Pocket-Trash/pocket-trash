import { appendFileSync } from "node:fs";
import { deletePreviewFolders } from "./delete-preview-folders.js";

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
}

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

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function readPositiveIntegerEnv(name: string): number {
  const parsed = Number(readRequiredEnv(name));

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function writeGithubOutput(key: string, value: string): void {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}
