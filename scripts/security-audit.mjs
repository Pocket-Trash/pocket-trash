import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
/** Advisory requiring temporary approval even with the local mitigation. */
const picomatchAdvisory = "GHSA-fc5q-39xc-vjpf";
/** Exact patched graph; any dependency change requires a fresh review. */
const picomatchLockHash =
  "9f0cd1036fb2761c1e93d69749d5c8843c3381357e19ab62b1fc8cf4482d13bf";
/** Reviewed patch bytes for both installed Picomatch release lines. */
const picomatchPatchHashes = {
  "2.3.2": "35c864bcb736926ba6eafe136b4a3187b3c8359c12dd1a1b29b65b1aadba716b",
  "4.0.7": "af8a4ce5936e7746a1530c913888e54a8b297fad53702f11f186ac8183730c77",
};
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
  const approvedAdvisories = exceptions.map(({ advisory }) => advisory);
  if (approvedAdvisories.includes(picomatchAdvisory))
    await validatePicomatchMitigation(workspace);

  if (
    approvedAdvisories.some((advisory) =>
      [vercelZodAdvisory, picomatchAdvisory].includes(advisory),
    )
  ) {
    process.exitCode = auditWithReviewedScopes(
      workspace.auditConfig?.ignoreGhsas ?? [],
      approvedAdvisories,
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
 * Excludes approved scoped findings while retaining unrelated and registry failures.
 * @param ignoredAdvisories - Other globally reviewed advisory exceptions.
 * @param approvedAdvisories - Advisories with validated, unexpired approval.
 * @returns Zero when no unapproved high or critical findings remain, otherwise one.
 * @throws When the report is unavailable, malformed, or exceeds the reviewed scope.
 */
function auditWithReviewedScopes(ignoredAdvisories, approvedAdvisories) {
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
    if (
      advisory.github_advisory_id === vercelZodAdvisory &&
      approvedAdvisories.includes(vercelZodAdvisory)
    ) {
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
    if (
      advisory.github_advisory_id === picomatchAdvisory &&
      approvedAdvisories.includes(picomatchAdvisory)
    ) {
      if (
        advisory.module_name !== "picomatch" ||
        advisory.severity !== "high" ||
        !Array.isArray(advisory.findings) ||
        !advisory.findings.length ||
        advisory.findings.some(
          (finding) =>
            !Object.hasOwn(picomatchPatchHashes, finding.version) ||
            !Array.isArray(finding.paths) ||
            !finding.paths.length ||
            finding.paths.some((value) => typeof value !== "string" || !value),
        )
      )
        throw new Error(
          "Finding outside the reviewed Picomatch scope; audit blocked.",
        );
      console.log(
        `Reviewed patched-graph Picomatch exception: ${picomatchAdvisory}`,
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
 * Rejects changes to the partially mitigated graph or its patch bytes.
 * @param workspace - Parsed pnpm workspace configuration.
 * @rejects When the lockfile, patch configuration or patch bytes differ.
 */
async function validatePicomatchMitigation(workspace) {
  const lockfile = await readFile(
    new URL("../pnpm-lock.yaml", import.meta.url),
  );
  if (createHash("sha256").update(lockfile).digest("hex") !== picomatchLockHash)
    throw new Error(
      "Dependency graph outside the reviewed Picomatch scope; audit blocked.",
    );
  for (const [version, hash] of Object.entries(picomatchPatchHashes)) {
    const file = `patches/picomatch@${version}.patch`;
    if (workspace.patchedDependencies?.[`picomatch@${version}`] !== file)
      throw new Error("Picomatch mitigation is not configured; audit blocked.");
    const patch = await readFile(new URL(`../${file}`, import.meta.url));
    if (createHash("sha256").update(patch).digest("hex") !== hash)
      throw new Error(
        "Picomatch patch outside the reviewed scope; audit blocked.",
      );
  }
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
    .filter(
      (advisory) => ![vercelZodAdvisory, picomatchAdvisory].includes(advisory),
    )
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
