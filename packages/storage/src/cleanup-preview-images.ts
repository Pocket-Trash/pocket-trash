import { appendFileSync } from "node:fs";
import { deletePreviewImageFolder } from "./index.js";

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const prNumber = readPositiveIntegerEnv("PR_NUMBER");

  const result = await deletePreviewImageFolder({
    bunnyStorageAccessKey: readRequiredEnv("BUNNY_STORAGE_ACCESS_KEY"),
    bunnyStorageEndpoint: readRequiredEnv("BUNNY_STORAGE_ENDPOINT"),
    bunnyStorageZoneName: readRequiredEnv("BUNNY_STORAGE_ZONE_NAME"),
    cdnBaseUrl: readRequiredEnv("BUNNY_CDN_BASE_URL"),
    dryRun: readBooleanEnv("IMAGE_CLEANUP_DRY_RUN"),
    prNumber,
  });

  writeGithubOutput("folder_path", result.folderPath);
  writeGithubOutput("status", result.status);
  process.stdout.write(
    `${JSON.stringify({
      app: "ci",
      environment: process.env.GITHUB_ACTIONS ? "github-actions" : "local",
      level: "info",
      message: "ci.images.previewFolder.cleanup.completed",
      timestamp: new Date().toISOString(),
      attributes: {
        folderPath: result.folderPath,
        status: result.status,
      },
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
  const value = readRequiredEnv(name);
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function readBooleanEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  return value === "1" || value === "true";
}

function writeGithubOutput(key: string, value: string): void {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}
