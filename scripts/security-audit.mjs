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

/** GitHub security advisory identifier format. */
const ghsaPattern =
  /^GHSA-[23456789cfghjmpqrvwx]{4}(?:-[23456789cfghjmpqrvwx]{4}){2}$/;

/** Linear issue identifier format. */
const linearIssuePattern = /^[A-Z][A-Z0-9]*-\d+$/;

/** Explicit UTC timestamp format accepted by the audit policy. */
const utcTimestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

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
 * @throws When metadata is incomplete, malformed, not yet approved, overlong,
 * or expired.
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

    validateExceptionIdentifiers(exception, index);
    const approvedAt = parseUtcTimestamp(
      exception.approvedAt,
      "approvedAt",
      index,
    );
    const expiresAt = parseUtcTimestamp(
      exception.expiresAt,
      "expiresAt",
      index,
    );
    if (approvedAt > Date.now()) {
      throw new Error(
        `exception ${exception.advisory} is approved in the future`,
      );
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
 * Validates the external identifiers that make an exception reviewable.
 *
 * @param exception - Exception metadata under validation.
 * @param index - Zero-based manifest entry position.
 * @throws When the advisory or follow-up issue identifier is malformed.
 */
function validateExceptionIdentifiers(exception, index) {
  if (!ghsaPattern.test(exception.advisory)) {
    throw new TypeError(`exception ${index + 1} requires a valid GHSA`);
  }
  if (!linearIssuePattern.test(exception.followUpIssue)) {
    throw new TypeError(
      `exception ${index + 1} requires a valid Linear issue identifier`,
    );
  }
}

/**
 * Parses one explicit UTC timestamp from exception metadata.
 *
 * @param value - Timestamp text to parse.
 * @param field - Metadata field name for failure output.
 * @param index - Zero-based manifest entry position.
 * @returns Timestamp milliseconds since the Unix epoch.
 * @throws When the value is not a valid explicit UTC timestamp.
 */
function parseUtcTimestamp(value, field, index) {
  if (!utcTimestampPattern.test(value)) {
    throw new TypeError(`exception ${index + 1} ${field} must use UTC`);
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`exception ${index + 1} has an invalid ${field}`);
  }
  const canonical = new Date(timestamp).toISOString();
  const normalized = value.includes(".") ? value : value.replace("Z", ".000Z");
  if (canonical !== normalized) {
    throw new TypeError(`exception ${index + 1} has an invalid ${field}`);
  }

  return timestamp;
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
