import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createRailwayContext, project } from "railway/iac";
import railway from "../.railway/railway.ts";

/** Repository pnpm workspace policy under test. */
const workspacePolicy = await readFile("pnpm-workspace.yaml", "utf8");
/** Committed dependency resolutions under test. */
const workspaceLockfile = await readFile("pnpm-lock.yaml", "utf8");
/** Workspace policy without repository-only package patch metadata. */
const fixturePolicy = workspacePolicy.replace(
  /patchedDependencies:\n(?: {2}.+\n)+/,
  "",
);
/** Continuous integration workflow under test. */
const ciWorkflow = await readFile(".github/workflows/ci.yml", "utf8");
/** Deployment workflow under test. */
const deployWorkflow = await readFile(".github/workflows/deploy.yml", "utf8");
/** Root package manifest under test. */
const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
/** API package manifest under test. */
const apiPackage = JSON.parse(await readFile("apps/api/package.json", "utf8"));
/** Railway service build configurations under test. */
const railwayServices = (
  await railway(
    createRailwayContext({
      projectName: "Pocket Trash",
      environment: "production",
    }),
    project,
  )
).resources.filter((resource) => resource.type === "service");

test("gates artifacts, releases, and deployments on the audit", () => {
  assert.match(ciWorkflow, /name: Security/);
  assert.equal(
    ciWorkflow.match(/needs: \[security, classify-changes\]/g)?.length,
    8,
  );
  assert.ok(
    (deployWorkflow.match(/- name: Audit dependencies/g)?.length ?? 0) >= 5,
  );
  assert.doesNotMatch(deployWorkflow, /\bpnpm dlx\b/);
  assert.doesNotMatch(deployWorkflow, /pnpm exec @railway\/cli/);
  assert.match(rootPackage.scripts.build, /^pnpm security:audit/);
  assert.match(rootPackage.scripts["build:ci"], /^pnpm security:audit/);
  assert.match(rootPackage.scripts.release, /^pnpm security:audit/);
  assert.match(
    apiPackage.scripts.deploy,
    /^pnpm --dir \.\.\/\.\. security:audit/,
  );
  for (const service of railwayServices) {
    assert.match(service.build.buildCommand, /^pnpm security:audit/);
  }
});

test("pins patched Sharp releases across transitive paths", () => {
  assert.match(workspacePolicy, /"sharp@0\.35": "0\.35\.5"/);
  assert.match(workspaceLockfile, /sharp@0\.35\.5/);
  assert.doesNotMatch(workspaceLockfile, /sharp@0\.35\.4/);
});

test("pins patched Undici releases without changing consumer major versions", () => {
  for (const version of ["6.29.1", "7.30.1", "8.12.2"])
    assert.ok(workspaceLockfile.includes(`undici@${version}:`));
  for (const version of ["6.29.0", "7.29.1", "7.30.0", "8.11.2"])
    assert.ok(!workspaceLockfile.includes(`undici@${version}:`));
});

test("provides the locked deployment executables", async () => {
  const commands = [
    ["skills", "1.7.0"],
    ["railway", "5.62.1"],
    ["vercel", "59.26.0"],
  ];

  for (const [command, version] of commands) {
    const result = await run(
      "pnpm",
      ["exec", command, "--version"],
      process.cwd(),
    );
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, new RegExp(version.replaceAll(".", "\\.")));
  }
});

test("rejects a fresh exact external dependency", async (t) => {
  const publishedAt = new Date().toISOString();
  const registry = await startRegistry(t, {
    "fresh-external-package": { publishedAt },
  });

  const result = await installFixture(t, registry, {
    "fresh-external-package": "1.0.0",
  });

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /ERR_PNPM_NO_MATURE_MATCHING_VERSION/);
});

test("rejects an external dependency without a publication timestamp", async (t) => {
  const registry = await startRegistry(t, {
    "external-package": {},
  });

  const result = await installFixture(t, registry, {
    "external-package": "1.0.0",
  });

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /ERR_PNPM_MISSING_TIME/);
});

test("accepts only the named internal packages without timestamps", async (t) => {
  const dependencies = {
    "@pocket-trash/cli": "1.0.0",
    "@pocket-trash/localizations": "1.0.0",
    "@pocket-trash/skills": "1.0.0",
  };
  const registry = await startRegistry(
    t,
    Object.fromEntries(Object.keys(dependencies).map((name) => [name, {}])),
  );

  const result = await installFixture(t, registry, dependencies);

  assert.equal(result.code, 0, result.output);
});

test("accepts an exact reviewed age exception", async (t) => {
  const registry = await startRegistry(t, {
    "external-package": { publishedAt: new Date().toISOString() },
  });

  const result = await installFixture(
    t,
    registry,
    { "external-package": "1.0.0" },
    { ageException: "external-package@1.0.0" },
  );

  assert.equal(result.code, 0, result.output);
});

test("revalidates committed lockfiles against the current policy", async (t) => {
  const registry = await startRegistry(t, {
    "external-package": { publishedAt: new Date().toISOString() },
  });
  const seeded = await installFixture(
    t,
    registry,
    { "external-package": "1.0.0" },
    { ageException: "external-package@1.0.0" },
  );
  assert.equal(seeded.code, 0, seeded.output);

  await writeFile(
    path.join(seeded.directory, "pnpm-workspace.yaml"),
    fixturePolicy,
  );
  const result = await run(
    "pnpm",
    [
      "install",
      "--frozen-lockfile",
      "--lockfile-only",
      "--ignore-scripts",
      "--reporter=append-only",
      `--registry=${registry}`,
      `--store-dir=${path.join(seeded.directory, ".pnpm-store")}`,
    ],
    seeded.directory,
  );

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION/);
});

test("blocks artifacts for a high-severity development advisory", async (t) => {
  await assertAuditBlocksArtifact(
    t,
    vulnerableAudit,
    200,
    /fixture development advisory/i,
  );
});

test("removes the withdrawn braces exception and retains only scoped Vercel Zod approval", async () => {
  const exceptions = JSON.parse(
    await readFile("security-audit-exceptions.json", "utf8"),
  );
  assert.deepEqual(
    exceptions.map(({ advisory }) => advisory),
    ["GHSA-mrhx-c7xc-m3w5"],
  );
  assert.doesNotMatch(workspacePolicy, /GHSA-vfj7-8cjw-p6xm|ignoreGhsas:/);
});

test("locks mature security fixes without changing supported package majors", () => {
  for (const version of [
    "seroval@1.6.11",
    "hono@4.13.11",
    "@hono/node-server@2.1.3",
    "@vitest/mocker@4.1.12",
    "smol-toml@1.9.0",
    "fast-uri@3.1.9",
  ])
    assert.ok(workspaceLockfile.includes(version), version);
  for (const version of [
    "seroval@1.6.7:",
    "hono@4.13.9:",
    "@hono/node-server@2.1.1:",
    "@vitest/mocker@4.1.11:",
    "smol-toml@1.7.1:",
    "fast-uri@3.1.8:",
  ])
    assert.ok(!workspaceLockfile.includes(version), version);
});

test("allows only the reviewed Vercel development Zod finding", async (t) => {
  const result = await runScopedZodAudit(t, scopedZodAudit);
  assert.equal(result.code, 0, result.output);
});

test("blocks changes to the reviewed Zod version, development status or paths", async (t) => {
  for (const change of [
    { version: "4.4.3" },
    { version: "3.25.76" },
    { dev: false },
    { paths: ["apps/api>zod"] },
    { paths: [".>vercel>@vercel/new-consumer>zod"] },
    { paths: [] },
  ]) {
    const audit = structuredClone(scopedZodAudit);
    Object.assign(audit.advisories[123].findings[0], change);
    const result = await runScopedZodAudit(t, audit);
    assert.notEqual(result.code, 0, result.output);
    assert.match(result.output, /outside the reviewed Vercel Zod scope/);
  }
});

test("scoped Zod approval never suppresses another high advisory or an invalid audit response", async (t) => {
  const other = structuredClone(scopedZodAudit);
  other.advisories[456] = {
    ...other.advisories[123],
    github_advisory_id: "GHSA-grv7-fg5c-xmjg",
    title: "Other high advisory",
  };
  for (const audit of [
    other,
    { error: "registry unavailable" },
    { advisories: {} },
    "not json",
  ]) {
    const result = await runScopedZodAudit(t, audit);
    assert.notEqual(result.code, 0, result.output);
  }
});

test("a higher severity requires a new review of the Zod exception", async (t) => {
  const audit = structuredClone(scopedZodAudit);
  audit.advisories[123].severity = "critical";
  const result = await runScopedZodAudit(t, audit);
  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /outside the reviewed Vercel Zod scope/);
});

/**
 * Exercises the public audit command with a deterministic package-manager response.
 * @param t - Test context owning the temporary executable.
 * @param audit - Audit JSON or malformed output.
 * @returns The captured audit command result.
 */
async function runScopedZodAudit(t, audit) {
  const directory = await mkdtemp(path.join(tmpdir(), "scoped-zod-audit-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = typeof audit === "string" ? audit : JSON.stringify(audit);
  await writeFile(
    path.join(directory, "pnpm"),
    `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(output)}); process.exitCode=1;\n`,
    { mode: 0o700 },
  );
  return run(process.execPath, ["scripts/security-audit.mjs"], process.cwd(), {
    PATH: directory + path.delimiter + process.env.PATH,
  });
}

/** Reviewed Zod 3 package-manager finding; no application dependency is exempted. */
const scopedZodAudit = {
  advisories: {
    123: {
      github_advisory_id: "GHSA-mrhx-c7xc-m3w5",
      module_name: "zod",
      severity: "high",
      title: "Reviewed Vercel Zod finding",
      findings: [
        {
          version: "3.22.4",
          dev: true,
          paths: [".>vercel>@vercel/backends>zod"],
        },
      ],
    },
  },
};

test("rejects an incomplete audit exception", async (t) => {
  const result = await runAuditWithExceptions(t, [
    { advisory: "GHSA-vfj7-8cjw-p6xm" },
  ]);

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /owner/);
});

test("rejects an expired audit exception", async (t) => {
  const result = await runAuditWithExceptions(t, [
    {
      ...validAuditException,
      approvedAt: "2026-09-01T00:00:00Z",
      expiresAt: "2026-09-08T00:00:00Z",
    },
  ]);

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /expired/);
});

test("rejects an audit exception lasting more than seven days", async (t) => {
  const result = await runAuditWithExceptions(t, [
    {
      ...validAuditException,
      approvedAt: "2026-10-05T00:00:00Z",
      expiresAt: "2026-10-13T00:00:00Z",
    },
  ]);

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /seven days/);
});

test("rejects audit configuration without matching exception metadata", async (t) => {
  const result = await runAuditWithExceptions(t, [validAuditException]);

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /does not match/);
});

test("rejects an audit exception approved in the future", async (t) => {
  const result = await runAuditWithExceptions(t, [
    {
      ...validAuditException,
      approvedAt: "2099-01-01T00:00:00Z",
      expiresAt: "2099-01-08T00:00:00Z",
    },
  ]);

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /future/);
});

test("requires UTC audit exception timestamps", async (t) => {
  const result = await runAuditWithExceptions(t, [
    {
      ...validAuditException,
      expiresAt: "2026-10-12T17:00:00+00:00",
    },
  ]);

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /UTC/);
});

test("requires a GHSA advisory identifier", async (t) => {
  const result = await runAuditWithExceptions(t, [
    { ...validAuditException, advisory: "CVE-2026-93687" },
  ]);

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /GHSA/);
});

test("requires a Linear follow-up issue identifier", async (t) => {
  const result = await runAuditWithExceptions(t, [
    { ...validAuditException, followUpIssue: "remove-braces-exception" },
  ]);

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /Linear/);
});

test("blocks artifacts when the advisory service is unavailable", async (t) => {
  await assertAuditBlocksArtifact(
    t,
    { error: "unavailable" },
    503,
    /503|audit.*response/i,
  );
});

/**
 * Verifies a failed audit prevents artifact creation.
 *
 * @param t - Node test context.
 * @param audit - Registry audit response body.
 * @param status - Registry HTTP response status.
 * @param outputPattern - Expected audit failure output.
 * @returns Resolves after the gate and artifact assertions pass.
 * @throws When the fixture cannot start or an assertion fails.
 */
async function assertAuditBlocksArtifact(t, audit, status, outputPattern) {
  const registry = await startAuditRegistry(t, audit, status);
  const directory = await mkdtemp(path.join(tmpdir(), "pnpm-security-gate-"));
  const artifact = path.join(directory, "artifact.txt");
  t.after(() => rm(directory, { recursive: true, force: true }));

  const result = await run(
    "sh",
    [
      "-c",
      'pnpm run security:audit && node -e \'require("node:fs").writeFileSync(process.env.SECURITY_ARTIFACT, "built")\'',
    ],
    process.cwd(),
    {
      PNPM_CONFIG_FETCH_RETRIES: "0",
      PNPM_CONFIG_REGISTRY: registry,
      SECURITY_ARTIFACT: artifact,
    },
  );

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, outputPattern);
  await assert.rejects(stat(artifact), { code: "ENOENT" });
}

/**
 * Runs the security audit with temporary exception metadata.
 *
 * @param t - Node test context.
 * @param exceptions - Exception metadata to validate.
 * @returns The audit command result.
 * @rejects When the fixture cannot be created.
 */
async function runAuditWithExceptions(t, exceptions) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "pnpm-audit-exceptions-"),
  );
  const exceptionsFile = path.join(directory, "exceptions.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(exceptionsFile, JSON.stringify(exceptions));

  return run(
    "node",
    ["scripts/security-audit.mjs", "--exceptions-file", exceptionsFile],
    process.cwd(),
  );
}

/**
 * Installs a temporary package against the security policy.
 *
 * @param t - Node test context.
 * @param registry - Fixture registry URL.
 * @param dependencies - Package dependencies to resolve.
 * @param options - Optional exact release-age exception.
 * @returns The install result and fixture directory.
 * @throws When the fixture cannot be created.
 */
async function installFixture(
  t,
  registry,
  dependencies,
  { ageException } = {},
) {
  const directory = await mkdtemp(path.join(tmpdir(), "pnpm-security-policy-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const policy = ageException
    ? fixturePolicy.replace(
        "minimumReleaseAgeExclude:\n",
        `minimumReleaseAgeExclude:\n  - "${ageException}"\n`,
      )
    : fixturePolicy;

  await Promise.all([
    writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({ name: "security-policy-fixture", dependencies }),
    ),
    writeFile(path.join(directory, "pnpm-workspace.yaml"), policy),
  ]);

  return {
    ...(await run(
      "pnpm",
      [
        "install",
        "--lockfile-only",
        "--ignore-scripts",
        "--reporter=append-only",
        `--registry=${registry}`,
        `--store-dir=${path.join(directory, ".pnpm-store")}`,
      ],
      directory,
    )),
    directory,
  };
}

/**
 * Starts a minimal package metadata registry.
 *
 * @param t - Node test context.
 * @param packages - Package metadata keyed by name.
 * @returns The registry URL.
 * @throws When the registry cannot start.
 */
async function startRegistry(t, packages) {
  // A unique URL prevents stale metadata reuse when the OS recycles a port.
  const registryPath = `/${randomUUID()}/`;
  const server = createServer((request, response) => {
    const name = decodeURIComponent(request.url.slice(registryPath.length));
    const entry = packages[name];

    if (!entry) {
      response.writeHead(404).end();
      return;
    }

    const registry = `http://127.0.0.1:${server.address().port}`;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        name,
        "dist-tags": { latest: "1.0.0" },
        versions: {
          "1.0.0": {
            name,
            version: "1.0.0",
            dist: {
              integrity:
                "sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==",
              tarball: `${registry}/${name}/-/package-1.0.0.tgz`,
            },
          },
        },
        time: entry.publishedAt ? { "1.0.0": entry.publishedAt } : undefined,
      }),
    );
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );

  return `http://127.0.0.1:${server.address().port}${registryPath}`;
}

/**
 * Starts a registry that serves one audit response.
 *
 * @param t - Node test context.
 * @param audit - Audit response body.
 * @param status - Audit response status.
 * @returns The registry URL.
 * @throws When the registry cannot start.
 */
async function startAuditRegistry(t, audit, status = 200) {
  const server = createServer((request, response) => {
    if (request.method !== "POST") {
      response.writeHead(404).end();
      return;
    }

    request.resume();
    request.on("end", () => {
      response.setHeader("content-type", "application/json");
      response.statusCode = status;
      response.end(JSON.stringify(audit));
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );

  return `http://127.0.0.1:${server.address().port}`;
}

/**
 * Runs a child process for a fixture assertion.
 *
 * @param command - Executable name.
 * @param args - Command arguments.
 * @param cwd - Working directory.
 * @param env - Additional environment variables.
 * @returns The exit code and combined output.
 */
function run(command, args, cwd, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env, CI: "true" },
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("close", (code) => resolve({ code, output }));
  });
}

/** Valid temporary audit exception metadata. */
const validAuditException = {
  advisory: "GHSA-grv7-fg5c-xmjg",
  owner: "Security Owner",
  followUpIssue: "ENG-337",
  approvedAt: new Date(Date.now() - 60_000).toISOString(),
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  reason: "No patched release exists.",
};

/** High-severity development advisory fixture. */
const vulnerableAudit = {
  braces: [
    {
      id: 999999,
      url: "https://github.com/advisories/GHSA-grv7-fg5c-xmjg",
      title: "Fixture development advisory",
      severity: "high",
      vulnerable_versions: "<=3.0.3",
      cwe: ["CWE-400"],
      cvss: {
        score: 7.5,
        vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H",
      },
    },
  ],
};
