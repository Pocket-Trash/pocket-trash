import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

/** Repository pnpm workspace policy under test. */
const workspacePolicy = await readFile("pnpm-workspace.yaml", "utf8");
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
/** Railway build configuration under test. */
const railwayConfig = JSON.parse(await readFile("railway.json", "utf8"));

test("gates artifacts, releases, and deployments on the audit", () => {
  assert.match(ciWorkflow, /name: Security/);
  assert.equal(
    ciWorkflow.match(/needs: \[security, classify-changes\]/g)?.length,
    7,
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
  assert.match(railwayConfig.build.buildCommand, /^pnpm security:audit/);
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
    "external-package": { publishedAt },
  });

  const result = await installFixture(t, registry, {
    "external-package": "1.0.0",
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

test("allows the reviewed braces advisory", async (t) => {
  const registry = await startAuditRegistry(t, bracesAudit);
  const result = await run("pnpm", ["run", "security:audit"], process.cwd(), {
    PNPM_CONFIG_FETCH_RETRIES: "0",
    PNPM_CONFIG_REGISTRY: registry,
  });

  assert.equal(result.code, 0, result.output);
});

test("rejects an incomplete audit exception", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "pnpm-audit-exceptions-"),
  );
  const exceptionsFile = path.join(directory, "exceptions.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    exceptionsFile,
    JSON.stringify([{ advisory: "GHSA-vfj7-8cjw-p6xm" }]),
  );

  const result = await run(
    "node",
    ["scripts/security-audit.mjs", "--exceptions-file", exceptionsFile],
    process.cwd(),
  );

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /owner/);
});

test("rejects an expired audit exception", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "pnpm-audit-exceptions-"),
  );
  const exceptionsFile = path.join(directory, "exceptions.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    exceptionsFile,
    JSON.stringify([
      {
        advisory: "GHSA-vfj7-8cjw-p6xm",
        owner: "Security Owner",
        followUpIssue: "ENG-337",
        approvedAt: "2026-09-01T00:00:00Z",
        expiresAt: "2026-09-08T00:00:00Z",
        reason: "No patched release exists.",
      },
    ]),
  );

  const result = await run(
    "node",
    ["scripts/security-audit.mjs", "--exceptions-file", exceptionsFile],
    process.cwd(),
  );

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /expired/);
});

test("rejects an audit exception lasting more than seven days", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "pnpm-audit-exceptions-"),
  );
  const exceptionsFile = path.join(directory, "exceptions.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    exceptionsFile,
    JSON.stringify([
      {
        advisory: "GHSA-vfj7-8cjw-p6xm",
        owner: "Security Owner",
        followUpIssue: "ENG-337",
        approvedAt: "2026-10-05T00:00:00Z",
        expiresAt: "2026-10-13T00:00:00Z",
        reason: "No patched release exists.",
      },
    ]),
  );

  const result = await run(
    "node",
    ["scripts/security-audit.mjs", "--exceptions-file", exceptionsFile],
    process.cwd(),
  );

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /seven days/);
});

test("rejects audit configuration without matching exception metadata", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "pnpm-audit-exceptions-"),
  );
  const exceptionsFile = path.join(directory, "exceptions.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(exceptionsFile, "[]");

  const result = await run(
    "node",
    ["scripts/security-audit.mjs", "--exceptions-file", exceptionsFile],
    process.cwd(),
  );

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /does not match/);
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
  const server = createServer((request, response) => {
    const name = decodeURIComponent(request.url.slice(1));
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

  return `http://127.0.0.1:${server.address().port}`;
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

/** Reviewed braces advisory fixture. */
const bracesAudit = {
  braces: [
    {
      id: 999998,
      url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
      title: "Braces fixture advisory",
      severity: "high",
      vulnerable_versions: "<=3.0.3",
      cwe: ["CWE-674"],
      cvss: {
        score: 7.5,
        vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H",
      },
    },
  ],
};
