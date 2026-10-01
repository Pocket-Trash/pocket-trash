import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  getChangedFileLines,
  lintChangedDeclarations,
  selectChangedDeclarations,
} from "./check-changed-jsdoc.mjs";

test("selects an undocumented legacy function when its body changes", () => {
  const sourceText = `
function legacy() {
  return "changed";
}
`;

  assert.deepEqual(
    selectChangedDeclarations({
      filePath: "legacy.ts",
      sourceText,
      changedLines: new Set([3]),
    }).map(({ name }) => name),
    ["legacy"],
  );
});

test("selects added named functions, components, and types", () => {
  const sourceText = `
export function loadPen() {
  return null;
}
export const PenCard = () => <article />;
export type Pen = { id: number };
`;

  assert.deepEqual(
    selectChangedDeclarations({
      filePath: "added.tsx",
      sourceText,
      changedLines: new Set([2, 5, 6]),
    }).map(({ name }) => name),
    ["loadPen", "PenCard", "Pen", "id"],
  );
});

test("ignores import and unrelated top-level statement changes", () => {
  const sourceText = `
import { value } from "./value";
value;
function legacy() {
  return true;
}
`;

  assert.deepEqual(
    selectChangedDeclarations({
      filePath: "legacy.ts",
      sourceText,
      changedLines: new Set([2, 3]),
    }),
    [],
  );
});

test("does not select untouched sibling declarations", () => {
  const sourceText = `
function changed() {
  return true;
}
function untouched() {
  return false;
}
`;

  assert.deepEqual(
    selectChangedDeclarations({
      filePath: "siblings.ts",
      sourceText,
      changedLines: new Set([3]),
    }).map(({ name }) => name),
    ["changed"],
  );
});

test("selects a declaration when its attached JSDoc changes", () => {
  const sourceText = `
/**
 * @param wrong - Changed description.
 * @returns The result.
 */
function loadPen(penId) {
  return penId;
}
`;

  assert.deepEqual(
    selectChangedDeclarations({
      filePath: "documentation.ts",
      sourceText,
      changedLines: new Set([3]),
    }).map(({ name }) => name),
    ["loadPen"],
  );
});

test("selects every eligible declaration in a newly added file", () => {
  const sourceText = `
function first() {}
function second() {}
`;

  assert.deepEqual(
    selectChangedDeclarations({
      filePath: "new.ts",
      sourceText,
      changedLines: new Set(),
      isNewFile: true,
    }).map(({ name }) => name),
    ["first", "second"],
  );
});

test("excludes generated files and anonymous callbacks", () => {
  assert.deepEqual(
    selectChangedDeclarations({
      filePath: "apps/web/src/routeTree.gen.ts",
      sourceText: "function generated() {}\n",
      changedLines: new Set([1]),
    }),
    [],
  );
  assert.deepEqual(
    selectChangedDeclarations({
      filePath: "callbacks.ts",
      sourceText: "items.map((item) => item.id);\n",
      changedLines: new Set([1]),
    }),
    [],
  );
});

test("staged and merge-base diffs agree for renamed paths and ignore deletions", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "changed-jsdoc-git-"));
  /**
   * Runs Git in the temporary repository.
   *
   * @param args - Git command arguments.
   * @returns Trimmed Git standard output.
   */
  const git = (...args) =>
    execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
  /**
   * Converts change metadata to assertion-friendly values.
   *
   * @param changes - Changed lines keyed by path.
   * @returns Serializable change metadata.
   */
  const comparable = (changes) =>
    Object.fromEntries(
      [...changes].map(([path, change]) => [
        path,
        {
          changedLines: [...change.changedLines],
          deletedLines: [...change.deletedLines],
          isNewFile: change.isNewFile,
        },
      ]),
    );
  context.after(() => rmSync(directory, { force: true, recursive: true }));

  git("init", "--initial-branch=main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test User");
  writeFileSync(
    join(directory, "space name.ts"),
    "function kept() {\n  return 1;\n}\n",
  );
  writeFileSync(join(directory, "deleted.ts"), "function removed() {}\n");
  git("add", "space name.ts", "deleted.ts");
  git("commit", "-m", "initial");
  git("checkout", "-b", "feature");
  renameSync(
    join(directory, "space name.ts"),
    join(directory, "renamed space.ts"),
  );
  writeFileSync(
    join(directory, "renamed space.ts"),
    "function kept() {\n  return 2;\n}\n",
  );
  git("rm", "deleted.ts");
  git("add", "space name.ts", "renamed space.ts");

  const staged = getChangedFileLines({ cwd: directory });
  git("commit", "-m", "feature");
  const pullRequest = getChangedFileLines({
    baseRef: "main",
    cwd: directory,
  });

  assert.deepEqual(comparable(pullRequest), comparable(staged));
  assert.deepEqual(comparable(staged), {
    "renamed space.ts": {
      changedLines: [2],
      deletedLines: [2],
      isNewFile: false,
    },
  });
});

test("keeps diagnostics only for the changed declaration", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "changed-jsdoc-lint-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  mkdirSync(join(directory, "src"));
  writeFileSync(
    join(directory, "src", "siblings.ts"),
    `function changed() {
  return true;
}
function untouched() {
  return false;
}
`,
  );

  const diagnostics = await lintChangedDeclarations({
    changes: new Map([
      ["src/siblings.ts", { changedLines: new Set([2]), isNewFile: false }],
    ]),
    cwd: directory,
  });

  assert.deepEqual(
    diagnostics.map(({ line, ruleId }) => ({ line, ruleId })),
    [{ line: 1, ruleId: "jsdoc/require-jsdoc" }],
  );
});

test("rejects mismatched parameters and missing return tags", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "changed-jsdoc-tags-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  writeFileSync(
    join(directory, "documentation.ts"),
    `/**
 * Loads a pen.
 * @param wrong - Pen identifier.
 */
function loadPen(penId) {
  return penId;
}
`,
  );

  const diagnostics = await lintChangedDeclarations({
    changes: new Map([
      ["documentation.ts", { changedLines: new Set([3]), isNewFile: false }],
    ]),
    cwd: directory,
  });
  const ruleIds = new Set(diagnostics.map(({ ruleId }) => ruleId));

  assert.equal(ruleIds.has("jsdoc/check-param-names"), true);
  assert.equal(ruleIds.has("jsdoc/require-returns"), true);
});

test("accepts a fully documented changed declaration", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "changed-jsdoc-valid-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  writeFileSync(
    join(directory, "documentation.ts"),
    `/**
 * Loads a catalog pen.
 *
 * @param penId - Catalog pen identifier.
 * @returns The matching catalog pen.
 */
function loadPen(penId) {
  return penId;
}
`,
  );

  const diagnostics = await lintChangedDeclarations({
    changes: new Map([
      ["documentation.ts", { changedLines: new Set([4]), isNewFile: false }],
    ]),
    cwd: directory,
  });

  assert.deepEqual(diagnostics, []);
});

test("accepts a documented exported variable", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "changed-jsdoc-export-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  writeFileSync(
    join(directory, "documentation.ts"),
    `/** Public endpoint path. */
export const endpoint = "/api";
`,
  );

  const diagnostics = await lintChangedDeclarations({
    changes: new Map([
      ["documentation.ts", { changedLines: new Set([2]), isNewFile: false }],
    ]),
    cwd: directory,
  });

  assert.deepEqual(diagnostics, []);
});

test("selects stable data, class, type-member, and object contracts", () => {
  const sourceText = `
interface Pen {
  id: number;
  load(input: string): Pen;
}
class Catalog {
  count = 0;
  find(id: number) { return id; }
}
const settings = {};
const service = {
  run() {},
  load: () => null,
};
`;

  assert.deepEqual(
    selectChangedDeclarations({
      filePath: "contracts.ts",
      sourceText,
      changedLines: new Set(),
      isNewFile: true,
    }).map(({ name }) => name),
    [
      "Pen",
      "id",
      "load",
      "Catalog",
      "count",
      "find",
      "settings",
      "service",
      "run",
      "load",
    ],
  );
});

test("requires applicable template, failure, and yield tags", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "changed-jsdoc-conditional-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  writeFileSync(
    join(directory, "conditional.ts"),
    `/** Runs a task. */
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
  );

  const diagnostics = await lintChangedDeclarations({
    changes: new Map([
      [
        "conditional.ts",
        {
          changedLines: new Set([2, 3, 6, 7, 10, 11]),
          isNewFile: false,
        },
      ],
    ]),
    cwd: directory,
  });
  const ruleIds = new Set(diagnostics.map(({ ruleId }) => ruleId));

  for (const ruleId of [
    "jsdoc/require-rejects",
    "jsdoc/require-template",
    "jsdoc/require-throws",
    "jsdoc/require-yields",
  ]) {
    assert.equal(ruleIds.has(ruleId), true, ruleId);
  }
});

test("does not keep diagnostics for untouched nested siblings", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "changed-jsdoc-members-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  writeFileSync(
    join(directory, "members.ts"),
    `interface Pen {
  changed: string;
  untouched: number;
}
`,
  );

  const diagnostics = await lintChangedDeclarations({
    changes: new Map([
      ["members.ts", { changedLines: new Set([2]), isNewFile: false }],
    ]),
    cwd: directory,
  });

  assert.deepEqual(
    diagnostics
      .filter(({ ruleId }) => ruleId === "jsdoc/require-jsdoc")
      .map(({ line }) => line),
    [1, 2],
  );
});

test("rejects undocumented added components and types", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "changed-jsdoc-added-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  writeFileSync(
    join(directory, "added.tsx"),
    `export const PenCard = () => <article />;
export type Pen = {
  id: number;
};
`,
  );

  const diagnostics = await lintChangedDeclarations({
    changes: new Map([
      ["added.tsx", { changedLines: new Set(), isNewFile: true }],
    ]),
    cwd: directory,
  });

  assert.deepEqual(
    diagnostics
      .filter(({ ruleId }) => ruleId === "jsdoc/require-jsdoc")
      .map(({ line }) => line),
    [1, 2, 3],
  );
});

test("does not lint anonymous callbacks inside changed declarations", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "changed-jsdoc-callback-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  writeFileSync(
    join(directory, "callback.ts"),
    `/**
 * Maps catalog identifiers.
 *
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
  );

  const diagnostics = await lintChangedDeclarations({
    changes: new Map([
      ["callback.ts", { changedLines: new Set([10]), isNewFile: false }],
    ]),
    cwd: directory,
  });

  assert.deepEqual(diagnostics, []);
});

test("requires parameter and return tags on callable type members", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "changed-jsdoc-type-member-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  writeFileSync(
    join(directory, "type-member.ts"),
    `/** Loads catalog records. */
interface Catalog {
  /** Loads a catalog record. */
  load(id: string): string;
}
`,
  );

  const diagnostics = await lintChangedDeclarations({
    changes: new Map([
      ["type-member.ts", { changedLines: new Set([3]), isNewFile: false }],
    ]),
    cwd: directory,
  });
  const ruleIds = new Set(diagnostics.map(({ ruleId }) => ruleId));

  assert.equal(ruleIds.has("jsdoc/require-param"), true);
  assert.equal(ruleIds.has("jsdoc/require-returns"), true);
});

test("requires complete tags on declaration-owned callables", async (context) => {
  const directory = mkdtempSync(
    join(tmpdir(), "changed-jsdoc-owned-callables-"),
  );
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  writeFileSync(
    join(directory, "callables.ts"),
    `/** Handles a value. */
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
  );

  const diagnostics = await lintChangedDeclarations({
    changes: new Map([
      [
        "callables.ts",
        { changedLines: new Set([1, 4, 6, 9]), isNewFile: false },
      ],
    ]),
    cwd: directory,
  });
  const rulesByLine = Map.groupBy(diagnostics, ({ line }) => line);

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

test("accepts a documented promise rejection", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "changed-jsdoc-rejects-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  writeFileSync(
    join(directory, "rejects.ts"),
    `/**
 * Loads a pen.
 *
 * @returns The matching pen.
 * @rejects When the pen cannot be loaded.
 */
async function load() {
  throw new Error("missing");
}
`,
  );

  const diagnostics = await lintChangedDeclarations({
    changes: new Map([
      ["rejects.ts", { changedLines: new Set([5]), isNewFile: false }],
    ]),
    cwd: directory,
  });

  assert.deepEqual(diagnostics, []);
});

test("accepts a fully documented function type alias", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "changed-jsdoc-type-alias-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  writeFileSync(
    join(directory, "handler.ts"),
    `/**
 * Handles a value.
 *
 * @template T - Handled value.
 * @param value - Value to handle.
 * @returns The handled value.
 */
type Handler = <T>(value: T) => T;
`,
  );

  const diagnostics = await lintChangedDeclarations({
    changes: new Map([
      ["handler.ts", { changedLines: new Set([5]), isNewFile: false }],
    ]),
    cwd: directory,
  });

  assert.deepEqual(diagnostics, []);
});

test("selects a surviving declaration when its body only loses lines", () => {
  const previousSourceText = `function loadPen() {
  const pen = findPen();
  return pen;
}
`;
  const sourceText = `function loadPen() {
  return findPen();
}
`;

  assert.deepEqual(
    selectChangedDeclarations({
      changedLines: new Set(),
      deletedLines: new Set([2, 3]),
      filePath: "deletion.ts",
      previousSourceText,
      sourceText,
    }).map(({ name }) => name),
    ["loadPen"],
  );
});

test("ignores a declaration deleted from a surviving file", () => {
  const previousSourceText = `function removed() {
  return true;
}
function untouched() {
  return false;
}
`;
  const sourceText = `function untouched() {
  return false;
}
`;

  assert.deepEqual(
    selectChangedDeclarations({
      changedLines: new Set(),
      deletedLines: new Set([1, 2, 3]),
      filePath: "deletion.ts",
      previousSourceText,
      sourceText,
    }),
    [],
  );
});
