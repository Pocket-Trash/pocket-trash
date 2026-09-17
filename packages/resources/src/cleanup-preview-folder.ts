import { appendFileSync } from "node:fs";
import { deletePreviewResourceFolder } from "./index.js";

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const result = await deletePreviewResourceFolder({
    accessKey: readRequiredEnv("RESOURCE_STORAGE_ACCESS_KEY"),
    cdnBaseUrl: readRequiredEnv("RESOURCE_CDN_BASE_URL"),
    endpoint: readRequiredEnv("RESOURCE_STORAGE_ENDPOINT"),
    prNumber: readPositiveIntegerEnv("PR_NUMBER"),
    zoneName: readRequiredEnv("RESOURCE_STORAGE_ZONE_NAME"),
  });

  writeGithubOutput("folder_path", result.folderPath);
  writeGithubOutput("status", result.status);
  process.stdout.write(
    `${JSON.stringify({
      app: "ci",
      environment: process.env.GITHUB_ACTIONS ? "github-actions" : "local",
      level: "info",
      message: "ci.resources.previewFolder.cleanup.completed",
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
