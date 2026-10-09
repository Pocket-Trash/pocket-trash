import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, onTestFinished, test } from "vitest";
import {
  type AppliedMigration,
  compareMigrationHistories,
  loadRepositoryMigrations,
  type MigrationRecord,
} from "../scripts/migration-history.js";

/** Named repository history used independently of insertion order. */
const expected: MigrationRecord[] = [
  { createdAt: Date.UTC(2026, 9, 1), hash: "aaa", tag: "20261001000000_first" },
  {
    createdAt: Date.UTC(2026, 9, 2),
    hash: "bbb",
    tag: "20261002000000_second",
  },
];
/** Applied form of the repository history. */
const applied: AppliedMigration[] = expected.map((migration) => ({
  ...migration,
}));

describe("compareMigrationHistories", () => {
  test.each([
    ["exact", applied],
    ["exact", [...applied].reverse()],
    ["behind", applied.slice(1)],
    [
      "ahead",
      [
        ...applied,
        {
          createdAt: Date.UTC(2026, 9, 3),
          hash: "ccc",
          tag: "20261003000000_extra",
        },
      ],
    ],
    ["diverged", [{ ...applied[0]!, hash: "changed" }]],
    ["diverged", [...applied, applied[0]!]],
    ["diverged", [{ ...applied[0]!, tag: null }]],
    ["diverged", [{ ...applied[0]!, createdAt: 1 }]],
    ["missing-history", null],
  ] as const)("classifies %s named history", (state, history) => {
    const comparison = compareMigrationHistories(expected, history);
    expect(comparison.state).toBe(state);
    expect(comparison.summary).not.toBe("");
    expect(comparison.guidance).not.toBe("");
    if (state !== "exact") expect(comparison.guidance).toMatch(/Do not|Never/u);
  });
});

test("loads UTC timestamp folders and hashes unmodified SQL without a journal", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "migration-history-v1-"));
  context.onTestFinished(() =>
    rmSync(directory, { force: true, recursive: true }),
  );
  const sql = "select 1;\n--> statement-breakpoint\nselect 2;\n";
  for (const tag of ["20261001000000_b", "20261001000000_a"]) {
    mkdirSync(join(directory, tag));
    writeFileSync(join(directory, tag, "migration.sql"), sql);
  }
  expect(loadRepositoryMigrations(directory)).toEqual(
    ["20261001000000_a", "20261001000000_b"].map((tag) => ({
      createdAt: Date.UTC(2026, 9, 1),
      hash: createHash("sha256").update(sql).digest("hex"),
      statements: ["select 1;", "select 2;"],
      tag,
    })),
  );
});

test.each([
  "0000_legacy.sql",
  "unexpected",
  "20260230000000_invalid",
])("rejects unsupported or incomplete artifact %s", (name) => {
  const directory = mkdtempSync(join(tmpdir(), "migration-history-invalid-"));
  onTestFinished(() => rmSync(directory, { force: true, recursive: true }));
  if (name.endsWith(".sql")) writeFileSync(join(directory, name), "select 1;");
  else {
    mkdirSync(join(directory, name));
    writeFileSync(join(directory, name, "migration.sql"), "select 1;");
  }
  expect(() => loadRepositoryMigrations(directory)).toThrow();
});

test("rejects a migration folder missing its SQL instead of silently skipping it", (context) => {
  const directory = mkdtempSync(
    join(tmpdir(), "migration-history-missing-sql-"),
  );
  context.onTestFinished(() =>
    rmSync(directory, { force: true, recursive: true }),
  );
  mkdirSync(join(directory, "20261001000000_missing"));
  expect(() => loadRepositoryMigrations(directory)).toThrow();
});
