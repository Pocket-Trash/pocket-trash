import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
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
    ["skills", "1.7.4"],
    ["railway", "5.71.0"],
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

test("scoped installs omit private icon payloads while warm stores reuse web packages", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "pnpm-install-scopes-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, "package"));
  const entries = {};
  for (const name of [
    "fixture-tool",
    "fixture-backend",
    "fixture-queue",
    "fixture-storage",
    "@fortawesome/pro-light-svg-icons",
    "@awesome.me/kit-fixture",
  ]) {
    await writeFile(
      path.join(directory, "package/package.json"),
      JSON.stringify({ name, version: "1.0.0" }),
    );
    entries[name] = {
      publishedAt: "2020-01-01T00:00:00.000Z",
      tarball: execFileSync("tar", ["-czf", "-", "package"], {
        cwd: directory,
      }),
      blockTarball: name.startsWith("@"),
    };
  }
  const requests = [];
  const registry = await startRegistry(t, entries, (request) =>
    requests.push(request),
  );
  const packages = {
    ".": {
      name: "pocket-trash.app",
      scripts: {
        prepare: `node -e 'require("node:fs").writeFileSync("prepared", "ready")'`,
      },
      devDependencies: {
        "fixture-tool": "1.0.0",
        "@package/lint": "workspace:*",
      },
    },
    "packages/lint": {
      name: "@package/lint",
      dependencies: { "fixture-tool": "1.0.0" },
    },
    "packages/database": {
      name: "@package/database",
      dependencies: { "fixture-backend": "1.0.0" },
    },
    "packages/queue": {
      name: "@package/queue",
      dependencies: { "fixture-queue": "1.0.0" },
    },
    "packages/storage": {
      name: "@package/storage",
      dependencies: { "fixture-storage": "1.0.0" },
    },
    ...Object.fromEntries(
      ["api", "scraper", "discord-bot"].map((name) => [
        `apps/${name}`,
        {
          name: `@app/${name}`,
          dependencies: { "@package/database": "workspace:*" },
        },
      ]),
    ),
    "apps/web": {
      name: "@app/web",
      dependencies: {
        "@fortawesome/pro-light-svg-icons": "1.0.0",
        "@awesome.me/kit-fixture": "1.0.0",
      },
    },
  };
  for (const [location, manifest] of Object.entries(packages)) {
    await mkdir(path.join(directory, location), { recursive: true });
    await writeFile(
      path.join(directory, location, "package.json"),
      JSON.stringify(manifest),
    );
  }
  await writeFile(path.join(directory, "pnpm-workspace.yaml"), fixturePolicy);
  await writeFile(
    path.join(directory, ".npmrc"),
    `registry=${registry}\n@fortawesome:registry=${registry}\n@awesome.me:registry=${registry}\n`,
  );
  const seeded = await run(
    "pnpm",
    ["install", "--lockfile-only", "--ignore-scripts"],
    directory,
    { PNPM_CONFIG_STORE_DIR: path.join(directory, "seed-store") },
  );
  assert.equal(seeded.code, 0, seeded.output);
  const script = new URL("./pnpm-install-scope.sh", import.meta.url).pathname;
  for (const scope of [
    "tools",
    "api",
    "database",
    "scraper",
    "discord-bot",
    "full",
  ]) {
    await t.test(scope, async () => {
      if (scope === "full")
        for (const entry of Object.values(entries)) entry.blockTarball = false;
      requests.length = 0;
      const env = {
        FONTAWESOME_PACKAGE_TOKEN: "fixture-token",
        PNPM_CONFIG_STORE_DIR: path.join(directory, `store-${scope}`),
      };
      await rm(path.join(directory, "prepared"), { force: true });
      const cold = await run("sh", [script, scope], directory, env);
      assert.equal(cold.code, 0, cold.output);
      assert.equal(
        requests.some((request) => /fixture-storage\/-\//u.test(request)),
        scope === "database" || scope === "full",
        cold.output,
      );
      assert.equal(
        await readFile(path.join(directory, "prepared"), "utf8"),
        "ready",
      );
      const icons = requests.filter((request) =>
        /(?:fortawesome|awesome.me).*\/-\//u.test(request),
      );
      assert.equal(
        icons.length,
        scope === "full" ? 2 : 0,
        JSON.stringify(requests),
      );
      assert.ok(
        requests.some((request) => /fixture-tool\/-\//u.test(request)),
        cold.output,
      );
      assert.equal(
        requests.some((request) => /fixture-queue\/-\//u.test(request)),
        scope === "api" || scope === "full",
        cold.output,
      );
      if (scope !== "tools")
        assert.ok(
          requests.some((request) => /fixture-backend\/-\//u.test(request)),
          cold.output,
        );
      await rm(path.join(directory, "node_modules"), {
        recursive: true,
        force: true,
      });
      await rm(path.join(directory, "prepared"));
      requests.length = 0;
      const warm = await run("sh", [script, scope], directory, env);
      assert.equal(warm.code, 0, warm.output);
      assert.equal(
        requests.filter((request) => request.includes("/-/")).length,
        0,
        JSON.stringify(requests),
      );
      await rm(path.join(directory, "node_modules"), {
        recursive: true,
        force: true,
      });
      if (scope === "full") {
        await mkdir(path.join(directory, "packages/unrelated"));
        await writeFile(
          path.join(directory, "packages/unrelated/package.json"),
          JSON.stringify({ name: "unrelated-package", version: "1.0.0" }),
        );
        const changed = await run(
          "pnpm",
          ["install", "--lockfile-only", "--ignore-scripts"],
          directory,
          env,
        );
        assert.equal(changed.code, 0, changed.output);
        requests.length = 0;
        const restored = await run("sh", [script, scope], directory, env);
        assert.equal(restored.code, 0, restored.output);
        assert.equal(
          requests.filter((request) => request.includes("/-/")).length,
          0,
          JSON.stringify(requests),
        );
      }
    });
  }
  await t.test(
    "tooling still rejects an immature unselected web dependency",
    async () => {
      const freshRegistry = await startRegistry(t, {
        ...entries,
        "@fortawesome/pro-light-svg-icons": {
          ...entries["@fortawesome/pro-light-svg-icons"],
          publishedAt: new Date().toISOString(),
        },
      });
      for (const filename of [".npmrc", "pnpm-lock.yaml"]) {
        const contents = await readFile(path.join(directory, filename), "utf8");
        await writeFile(
          path.join(directory, filename),
          contents.replaceAll(registry, freshRegistry),
        );
      }
      // The cold policy check must not inherit links to the full-install store.
      await rm(path.join(directory, "node_modules"), {
        recursive: true,
        force: true,
      });
      const rejected = await run("sh", [script, "tools"], directory, {
        FONTAWESOME_PACKAGE_TOKEN: "fixture-token",
        PNPM_CONFIG_STORE_DIR: path.join(directory, "fresh-policy-store"),
      });
      assert.notEqual(rejected.code, 0, rejected.output);
      assert.match(rejected.output, /ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION/u);
    },
  );
});

test("retains only the approved scoped Vercel Zod exception", async () => {
  const exceptions = JSON.parse(
    await readFile("security-audit-exceptions.json", "utf8"),
  );
  assert.deepEqual(
    exceptions.map(({ advisory }) => advisory),
    ["GHSA-mrhx-c7xc-m3w5"],
  );
  assert.doesNotMatch(workspacePolicy, /GHSA-vfj7-8cjw-p6xm|ignoreGhsas:/);
});

test("locks mature security fixes across qualified package versions", () => {
  for (const version of [
    "seroval@1.6.11",
    "hono@4.13.11",
    "@hono/node-server@2.1.3",
    "@vitest/mocker@5.0.5",
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

test("a returned Picomatch high advisory is never suppressed", async (t) => {
  const audit = structuredClone(scopedZodAudit);
  audit.advisories[456] = {
    github_advisory_id: "GHSA-fc5q-39xc-vjpf",
    module_name: "picomatch",
    severity: "high",
    title: "Picomatch advisory returned by the registry",
    findings: [{ version: "4.0.7", paths: [".>vercel>picomatch"] }],
  };
  const result = await runScopedZodAudit(t, audit);
  assert.notEqual(result.code, 0, result.output);
  assert.match(
    result.output,
    /high: Picomatch advisory returned by the registry/,
  );
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

test("Railway native sources and trimmed uploads install no web icon payloads", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "railway-install-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, "package"));
  const entries = {};
  for (const name of [
    "fixture-tool",
    "fixture-backend",
    "@fortawesome/pro-light-svg-icons",
    "@awesome.me/kit-fixture",
  ]) {
    await writeFile(
      path.join(directory, "package/package.json"),
      JSON.stringify({ name, version: "1.0.0" }),
    );
    entries[name] = {
      publishedAt: "2020-01-01T00:00:00.000Z",
      tarball: execFileSync("tar", ["-czf", "-", "package"], {
        cwd: directory,
      }),
      blockTarball: name.startsWith("@"),
    };
  }
  const requests = [];
  const registry = await startRegistry(t, entries, (request) =>
    requests.push(request),
  );
  const packages = {
    ".": {
      name: "pocket-trash.app",
      devDependencies: { "fixture-tool": "1.0.0" },
    },
    "apps/scraper": {
      name: "@app/scraper",
      dependencies: { "@package/database": "workspace:*" },
    },
    "apps/discord-bot": {
      name: "@app/discord-bot",
      dependencies: { "@package/queue": "workspace:*" },
    },
    "packages/database": {
      name: "@package/database",
      dependencies: { "fixture-backend": "1.0.0" },
    },
    "packages/queue": {
      name: "@package/queue",
      dependencies: { "fixture-backend": "1.0.0" },
    },
    "apps/web": {
      name: "@app/web",
      dependencies: {
        "@fortawesome/pro-light-svg-icons": "1.0.0",
        "@awesome.me/kit-fixture": "1.0.0",
      },
    },
  };
  for (const [location, manifest] of Object.entries(packages)) {
    await mkdir(path.join(directory, location), { recursive: true });
    await writeFile(
      path.join(directory, location, "package.json"),
      JSON.stringify(manifest),
    );
  }
  await mkdir(path.join(directory, "scripts"));
  await writeFile(
    path.join(directory, "scripts/pnpm-install.sh"),
    await readFile("scripts/pnpm-install.sh"),
    { mode: 0o755 },
  );
  await writeFile(path.join(directory, "pnpm-workspace.yaml"), fixturePolicy);
  await writeFile(
    path.join(directory, ".npmrc"),
    `registry=${registry}\n@fortawesome:registry=${registry}\n@awesome.me:registry=${registry}\n`,
  );
  const seeded = await run(
    "pnpm",
    ["install", "--lockfile-only", "--ignore-scripts"],
    directory,
    { PNPM_CONFIG_STORE_DIR: path.join(directory, "seed-store") },
  );
  assert.equal(seeded.code, 0, seeded.output);
  const command = JSON.parse(await readFile("railpack.json", "utf8")).steps
    .install.commands[0];
  for (const context of ["native", "trimmed-upload"]) {
    await t.test(context, async () => {
      if (context === "trimmed-upload") {
        await rm(path.join(directory, "apps/web"), { recursive: true });
        await rm(path.join(directory, "node_modules"), { recursive: true });
      }
      requests.length = 0;
      const installed = await run("sh", ["-c", command], directory, {
        FONTAWESOME_PACKAGE_TOKEN: "fixture-token",
        PNPM_CONFIG_STORE_DIR: path.join(directory, `store-${context}`),
        PNPM_CONFIG_FETCH_RETRIES: "0",
      });
      assert.equal(installed.code, 0, installed.output);
      assert.deepEqual(
        requests.filter((request) => request.includes("/-/")).sort(),
        [
          "fixture-backend/-/package-1.0.0.tgz",
          "fixture-tool/-/package-1.0.0.tgz",
        ],
      );
    });
  }
  await t.test(
    "trimmed uploads retain full-lockfile release-age checks",
    async () => {
      const freshRegistry = await startRegistry(t, {
        ...entries,
        "@awesome.me/kit-fixture": {
          ...entries["@awesome.me/kit-fixture"],
          publishedAt: new Date().toISOString(),
        },
      });
      for (const filename of [".npmrc", "pnpm-lock.yaml"]) {
        const contents = await readFile(path.join(directory, filename), "utf8");
        await writeFile(
          path.join(directory, filename),
          contents.replaceAll(registry, freshRegistry),
        );
      }
      const rejected = await run("sh", ["-c", command], directory, {
        FONTAWESOME_PACKAGE_TOKEN: "fixture-token",
        PNPM_CONFIG_STORE_DIR: path.join(directory, "store-fresh"),
        PNPM_CONFIG_FETCH_RETRIES: "0",
      });
      assert.notEqual(rejected.code, 0, rejected.output);
      assert.match(rejected.output, /ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION/u);
    },
  );
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
 * @param packages - Package metadata and optional generated tarballs keyed by name.
 * @param onRequest - Optional observer for metadata and payload requests.
 * @returns The registry URL.
 * @throws When the registry cannot start.
 */
async function startRegistry(t, packages, onRequest = () => {}) {
  // A unique URL prevents stale metadata reuse when the OS recycles a port.
  const registryPath = `/${randomUUID()}/`;
  const server = createServer((request, response) => {
    const requestPath = decodeURIComponent(
      request.url.slice(registryPath.length),
    );
    onRequest(requestPath);
    const name = requestPath.split("/-/")[0];
    const entry = packages[name];

    if (!entry) {
      response.writeHead(404).end();
      return;
    }

    if (requestPath.includes("/-/")) {
      response
        .writeHead(entry.tarball && !entry.blockTarball ? 200 : 403)
        .end(entry.blockTarball ? undefined : entry.tarball);
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
              integrity: entry.tarball
                ? `sha512-${createHash("sha512").update(entry.tarball).digest("base64")}`
                : "sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==",
              tarball: `${registry}${registryPath}${name}/-/package-1.0.0.tgz`,
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
