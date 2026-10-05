import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";

/** Required metadata for every temporary audit exception. */
const requiredFields = [
  "advisory",
  "owner",
  "followUpIssue",
  "approvedAt",
  "expiresAt",
  "reason",
];

/** Maximum approved lifetime for a vulnerability exception. */
const maximumExceptionDuration = 7 * 24 * 60 * 60 * 1_000;

/** Default repository audit exception manifest. */
const defaultExceptionsFile = new URL(
  "../security-audit-exceptions.json",
  import.meta.url,
);

/** Repository pnpm workspace configuration. */
const workspaceFile = new URL("../pnpm-workspace.yaml", import.meta.url);

const { values } = parseArgs({
  options: {
    "exceptions-file": { type: "string" },
  },
});

try {
  const exceptionsFile = values["exceptions-file"] ?? defaultExceptionsFile;
  const exceptions = JSON.parse(await readFile(exceptionsFile, "utf8"));
  validateExceptions(exceptions);
  const workspace = parseYaml(await readFile(workspaceFile, "utf8"));
  validateConfiguration(exceptions, workspace.auditConfig?.ignoreGhsas ?? []);

  const result = spawnSync("pnpm", ["audit", "--audit-level", "high"], {
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(`[security:audit] ${error.message}`);
  process.exitCode = 1;
}

/**
 * Validates the required metadata for temporary vulnerability exceptions.
 *
 * @param exceptions - Parsed exception manifest.
 * @throws When the manifest or an exception is incomplete.
 */
function validateExceptions(exceptions) {
  if (!Array.isArray(exceptions)) {
    throw new TypeError("exception manifest must be an array");
  }

  for (const [index, exception] of exceptions.entries()) {
    for (const field of requiredFields) {
      if (typeof exception?.[field] !== "string" || !exception[field].trim()) {
        throw new TypeError(`exception ${index + 1} requires ${field}`);
      }
    }

    const approvedAt = Date.parse(exception.approvedAt);
    const expiresAt = Date.parse(exception.expiresAt);
    if (!Number.isFinite(approvedAt)) {
      throw new TypeError(`exception ${index + 1} has an invalid approvedAt`);
    }
    if (!Number.isFinite(expiresAt)) {
      throw new TypeError(`exception ${index + 1} has an invalid expiresAt`);
    }
    if (
      expiresAt <= approvedAt ||
      expiresAt - approvedAt > maximumExceptionDuration
    ) {
      throw new Error(
        `exception ${exception.advisory} must expire within seven days`,
      );
    }
    if (Date.now() >= expiresAt) {
      throw new Error(`exception ${exception.advisory} expired`);
    }
  }
}

/**
 * Ensures pnpm ignores exactly the advisories with reviewed metadata.
 *
 * @param exceptions - Validated exception metadata.
 * @param configuredGhsas - Advisory IDs ignored by pnpm.
 * @throws When the configured and reviewed advisory sets differ.
 */
function validateConfiguration(exceptions, configuredGhsas) {
  const reviewed = exceptions.map(({ advisory }) => advisory).sort();
  const configured = [...configuredGhsas].sort();

  if (
    reviewed.length !== configured.length ||
    reviewed.some((advisory, index) => advisory !== configured[index])
  ) {
    throw new Error(
      "pnpm audit configuration does not match reviewed exception metadata",
    );
  }
}
