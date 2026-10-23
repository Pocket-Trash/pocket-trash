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

/** Advisory approved only for the exact Vercel development-tooling finding. */
const vercelZodAdvisory = "GHSA-mrhx-c7xc-m3w5";
/** Reviewed dependency paths; new consumers require another security review. */
const vercelZodPaths = new Set([
  ".>vercel>@vercel/backends>zod",
  ".>vercel>@vercel/express>@vercel/cervel>@vercel/backends>zod",
  ".>vercel>@vercel/express>zod",
  ".>vercel>@vercel/hono>zod",
  ".>vercel>@vercel/python>@vercel/python-analysis>zod",
  ".>vercel>@vercel/python-analysis>zod",
]);

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

  if (exceptions.some(({ advisory }) => advisory === vercelZodAdvisory)) {
    process.exitCode = auditWithVercelZodScope(
      workspace.auditConfig?.ignoreGhsas ?? [],
    );
  } else {
    const result = spawnSync("pnpm", ["audit", "--audit-level", "high"], {
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(`[security:audit] ${error.message}`);
  process.exitCode = 1;
}

/**
 * Excludes only the reviewed finding while retaining application and registry failures.
 * The Zod advisory is never added to pnpm's global advisory ignore list.
 * @param ignoredAdvisories - Other globally reviewed advisory exceptions.
 * @returns Zero when no unapproved high or critical findings remain, otherwise one.
 * @throws When the report is unavailable, malformed, or exceeds the reviewed scope.
 */
function auditWithVercelZodScope(ignoredAdvisories) {
  const result = spawnSync(
    "pnpm",
    ["audit", "--audit-level", "high", "--json"],
    {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: 60_000,
    },
  );
  if (result.error)
    throw new Error("Package-manager audit failed; no findings were exempted.");
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error("Invalid package-manager audit response.");
  }
  if (
    report.error ||
    !report.advisories ||
    typeof report.advisories !== "object" ||
    Array.isArray(report.advisories) ||
    ![0, 1].includes(result.status)
  )
    throw new Error("Invalid package-manager audit response.");
  const advisories = Object.values(report.advisories);
  if (result.status !== 0 && advisories.length === 0)
    throw new Error("Package-manager audit failed without findings.");
  let blocked = false;
  for (const advisory of advisories) {
    if (advisory.github_advisory_id === vercelZodAdvisory) {
      if (
        advisory.module_name !== "zod" ||
        advisory.severity !== "high" ||
        !Array.isArray(advisory.findings) ||
        !advisory.findings.length ||
        advisory.findings.some(
          (finding) =>
            finding.version !== "3.22.4" ||
            finding.dev !== true ||
            !Array.isArray(finding.paths) ||
            !finding.paths.length ||
            finding.paths.some((value) => !vercelZodPaths.has(value)),
        )
      ) {
        throw new Error(
          "Finding outside the reviewed Vercel Zod scope; audit blocked.",
        );
      }
      console.log(
        `Reviewed Vercel-only Zod 3.22.4 exception: ${vercelZodAdvisory}`,
      );
      continue;
    }
    if (ignoredAdvisories.includes(advisory.github_advisory_id)) continue;
    if (
      !["info", "low", "moderate", "high", "critical"].includes(
        advisory.severity,
      )
    )
      throw new Error("Invalid advisory severity.");
    console.log(
      `${advisory.severity}: ${advisory.title} (${advisory.github_advisory_id})`,
    );
    if (["high", "critical"].includes(advisory.severity)) blocked = true;
  }
  return blocked ? 1 : 0;
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
  const reviewed = exceptions
    .map(({ advisory }) => advisory)
    .filter((advisory) => advisory !== vercelZodAdvisory)
    .sort();
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
