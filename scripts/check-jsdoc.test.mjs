import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getTrackedSourceFiles, lintJsdoc } from "./check-jsdoc.mjs";

/**
 * Runs Git in a test repository.
 *
 * @param cwd - Test repository directory.
 * @param args - Git command arguments.
 * @returns Trimmed Git standard output.
 * @throws When Git cannot complete the command.
 */
function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/**
 * Creates a committed source fixture with an empty staged diff.
 *
 * @param context - Test lifecycle used to remove the temporary repository.
 * @param files - Source contents keyed by repository-relative path.
 * @returns The temporary repository directory.
 * @throws When fixture files or Git history cannot be created.
 */
function repository(context, files) {
  const cwd = mkdtempSync(join(tmpdir(), "jsdoc-"));
  context.after(() => rmSync(cwd, { force: true, recursive: true }));
  git(cwd, "init", "--initial-branch=main");
  for (const [path, source] of Object.entries(files)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), source);
  }
  git(cwd, "add", "--", ...Object.keys(files));
  git(
    cwd,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "initial",
  );
  return cwd;
}

/**
 * Runs the normal checker command without relying on any Git base ref.
 *
 * @param cwd - Test repository directory.
 * @returns The checker exit status and captured output.
 */
function command(cwd) {
  return spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./check-jsdoc.mjs", import.meta.url))],
    {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        JSDOC_BASE_REF: "nonexistent",
        GITHUB_BASE_REF: "nonexistent",
      },
    },
  );
}

test("CLI rejects an undocumented tracked declaration with an empty staged diff", (context) => {
  const cwd = repository(context, { "legacy.ts": "function legacy() {}\n" });
  assert.equal(git(cwd, "diff", "--cached"), "");
  const result = command(cwd);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /legacy\.ts:1:1 error Missing JSDoc comment/);
});

test("pre-commit runs full JSDoc lint even with an empty staged diff", (context) => {
  const cwd = repository(context, {
    "legacy.ts": "function legacy() {}\n",
    "package.json": JSON.stringify({
      scripts: {
        lint: `node "${fileURLToPath(new URL("./check-jsdoc.mjs", import.meta.url))}"`,
      },
    }),
  });
  const result = spawnSync(
    "sh",
    [fileURLToPath(new URL("../.githooks/pre-commit", import.meta.url))],
    { cwd, encoding: "utf8" },
  );
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /legacy\.ts:1:1 error Missing JSDoc comment/);
});

test("unrelated staged and import-only unstaged edits cannot hide missing JSDoc", async (context) => {
  const cwd = repository(context, {
    "legacy.ts": "function legacy() {}\n",
    "entry.ts": 'import "./legacy";\n',
    "README.md": "Initial documentation.\n",
  });
  writeFileSync(
    join(cwd, "entry.ts"),
    'import "./legacy";\nimport "./other";\n',
  );
  writeFileSync(join(cwd, "README.md"), "Unrelated edit.\n");
  git(cwd, "add", "README.md");
  assert.deepEqual(
    (await lintJsdoc({ cwd })).map(({ ruleId, line }) => ({ ruleId, line })),
    [{ ruleId: "jsdoc/require-jsdoc", line: 1 }],
  );
  assert.equal(command(cwd).status, 1);
});

test("checks every sibling and nested type member even when untouched", async (context) => {
  const cwd = repository(context, {
    "siblings.ts": `function first() {}
function second() {}
interface Pen {
  id: number;
  name: string;
}
`,
  });
  assert.deepEqual(
    (await lintJsdoc({ cwd }))
      .filter(({ ruleId }) => ruleId === "jsdoc/require-jsdoc")
      .map(({ line }) => line),
    [1, 2, 3, 4, 5],
  );
});

test("handles tracked paths with spaces and staged additions", async (context) => {
  const cwd = repository(context, {
    "space name.ts": "function legacy() {}\n",
  });
  writeFileSync(join(cwd, "added space.ts"), "function added() {}\n");
  git(cwd, "add", "added space.ts");
  assert.deepEqual(getTrackedSourceFiles({ cwd }), [
    "added space.ts",
    "space name.ts",
  ]);
  assert.equal((await lintJsdoc({ cwd })).length, 2);
  assert.match(command(cwd).stderr, /space name\.ts:1:1/);
});

test("excludes all three generated files, imports, re-exports, and anonymous callbacks", async (context) => {
  const cwd = repository(context, {
    "apps/api/src/worker-configuration.d.ts":
      "interface Generated { id: string; }\n",
    "apps/web/src/routeTree.gen.ts": "function generated() {}\n",
    "apps/web/src/vite-env.d.ts": "interface GeneratedEnv { value: string; }\n",
    "callbacks.tsx": `import { value } from "./value";
export { value };
items.map(
  /** Maps one identifier. */
  (item) => item.id,
);
new Task((item) => item);
<button onClick={(event) => event.preventDefault()} />;
`,
  });
  assert.deepEqual(getTrackedSourceFiles({ cwd }), ["callbacks.tsx"]);
  assert.deepEqual(await lintJsdoc({ cwd }), []);
  assert.equal(command(cwd).status, 0);
});

test("ignores untracked dependencies, build output, and scratch files", async (context) => {
  const cwd = repository(context, { "entry.ts": 'import "./other";\n' });
  for (const path of [
    "node_modules/dependency/index.ts",
    "dist/built.js",
    "scratch.ts",
  ]) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), "function undocumented() {}\n");
  }
  assert.deepEqual(getTrackedSourceFiles({ cwd }), ["entry.ts"]);
  assert.deepEqual(await lintJsdoc({ cwd }), []);
});

test("does not read tracked files removed from the working tree", async (context) => {
  const cwd = repository(context, {
    "deleted.ts": "function removed() {}\n",
    "entry.ts": 'import "./other";\n',
  });
  rmSync(join(cwd, "deleted.ts"));
  assert.deepEqual(await lintJsdoc({ cwd }), []);
  git(cwd, "rm", "deleted.ts");
  assert.deepEqual(await lintJsdoc({ cwd }), []);
});

test("rejects mismatched parameters and missing return tags without edits", async (context) => {
  const cwd = repository(context, {
    "documentation.ts": `/**
 * Loads a pen.
 * @param wrong - Pen identifier.
 */
function loadPen(penId) {
  return penId;
}
`,
  });
  const ruleIds = new Set(
    (await lintJsdoc({ cwd })).map(({ ruleId }) => ruleId),
  );
  assert.equal(ruleIds.has("jsdoc/check-param-names"), true);
  assert.equal(ruleIds.has("jsdoc/require-returns"), true);
});

test("accepts complete callable and exported value documentation", async (context) => {
  const cwd = repository(context, {
    "documentation.ts": `/**
 * Loads a catalog pen.
 * @param penId - Catalog pen identifier.
 * @returns The matching catalog pen.
 */
function loadPen(penId) {
  return penId;
}
/** Public endpoint path. */
export const endpoint = "/api";
`,
  });
  assert.deepEqual(await lintJsdoc({ cwd }), []);
  assert.equal(command(cwd).status, 0);
});

test("requires applicable template, failure, and yield tags", async (context) => {
  const cwd = repository(context, {
    "conditional.ts": `/** Runs a task. */
async function run<T>(value: T) {
  throw new Error(String(value));
}
/** Validates a value. */
function validate(value: string) {
  throw new Error(value);
}
/** Produces catalog identifiers. */
function* ids() {
  yield 1;
}
`,
  });
  const ruleIds = new Set(
    (await lintJsdoc({ cwd })).map(({ ruleId }) => ruleId),
  );
  for (const ruleId of [
    "jsdoc/require-param",
    "jsdoc/require-rejects",
    "jsdoc/require-template",
    "jsdoc/require-throws",
    "jsdoc/require-yields",
  ]) {
    assert.equal(ruleIds.has(ruleId), true, ruleId);
  }
});

test("rejects undocumented components and types", async (context) => {
  const cwd = repository(context, {
    "added.tsx": `export const PenCard = () => <article />;
export type Pen = {
  id: number;
};
`,
  });
  assert.deepEqual(
    (await lintJsdoc({ cwd }))
      .filter(({ ruleId }) => ruleId === "jsdoc/require-jsdoc")
      .map(({ line }) => line),
    [1, 2, 3],
  );
});

test("does not lint anonymous callbacks inside documented declarations", async (context) => {
  const cwd = repository(context, {
    "callback.ts": `/**
 * Maps catalog identifiers.
 * @param ids - Catalog identifiers.
 * @returns The mapped identifiers.
 */
function mapIds(ids: string[]) {
  return ids.map(
    /** Maps one identifier. */
    (id) => id,
  );
}
`,
  });
  assert.deepEqual(await lintJsdoc({ cwd }), []);
});

test("requires parameter and return tags on callable type members", async (context) => {
  const cwd = repository(context, {
    "type-member.ts": `/** Loads catalog records. */
interface Catalog {
  /** Loads a catalog record. */
  load(id: string): string;
}
`,
  });
  const ruleIds = new Set(
    (await lintJsdoc({ cwd })).map(({ ruleId }) => ruleId),
  );
  assert.equal(ruleIds.has("jsdoc/require-param"), true);
  assert.equal(ruleIds.has("jsdoc/require-returns"), true);
});

test("requires documentation on index and construct signatures", async (context) => {
  const cwd = repository(context, {
    "signatures.ts": `/** Lookup contract. */
interface Lookup {
  [key: string]: string;
}
/** Constructor contract. */
interface Builder {
  new (key: string): object;
}
`,
  });
  assert.deepEqual(
    (await lintJsdoc({ cwd }))
      .filter(({ ruleId }) => ruleId === "jsdoc/require-jsdoc")
      .map(({ line }) => line),
    [3, 7],
  );
});

test("same-line anonymous callbacks cannot hide their enclosing method", async (context) => {
  const cwd = repository(context, {
    "methods.ts": `/** Declared methods. */
class Methods { method() { items.map(item => item); } }
`,
  });
  assert.deepEqual(
    (await lintJsdoc({ cwd })).map(({ line, ruleId }) => ({ line, ruleId })),
    [{ line: 2, ruleId: "jsdoc/require-jsdoc" }],
  );
});

test("nested named functions do not make local values eligible", async (context) => {
  const cwd = repository(context, {
    "locals.ts": `/** Runs a task. */
function run() {
  const pending = new Promise<void>((resolve) => {
    /** Completes the task. */
    const finish = () => { resolve(); };
    finish();
  });
}
`,
  });
  assert.deepEqual(await lintJsdoc({ cwd }), []);
});

test("requires complete tags on declaration-owned callables", async (context) => {
  const cwd = repository(context, {
    "callables.ts": `/** Handles a value. */
type Handler = <T>(value: T) => T;
class Catalog {
  /** Loads a pen. */
  load = (id: string): string => id;
  /** Finds a pen. */
  abstract find(id: string): string;
}
/** Reads a pen. */
declare function read(id: string): string;
`,
  });
  const rulesByLine = Map.groupBy(await lintJsdoc({ cwd }), ({ line }) => line);
  for (const line of [1, 4, 6, 9]) {
    const ruleIds = new Set(rulesByLine.get(line)?.map(({ ruleId }) => ruleId));
    assert.equal(
      ruleIds.has("jsdoc/require-param"),
      true,
      `param on line ${line}`,
    );
    assert.equal(
      ruleIds.has("jsdoc/require-returns"),
      true,
      `returns on line ${line}`,
    );
  }
  assert.equal(
    new Set(rulesByLine.get(1)?.map(({ ruleId }) => ruleId)).has(
      "jsdoc/require-template",
    ),
    true,
  );
});

test("accepts a documented promise rejection and generic function type alias", async (context) => {
  const cwd = repository(context, {
    "valid.ts": `/**
 * Loads a pen.
 * @returns The matching pen.
 * @rejects When the pen cannot be loaded.
 */
async function load() {
  throw new Error("missing");
}
/**
 * Handles a value.
 * @template T - Handled value.
 * @param value - Value to handle.
 * @returns The handled value.
 */
type Handler = <T>(value: T) => T;
`,
  });
  assert.deepEqual(await lintJsdoc({ cwd }), []);
});
