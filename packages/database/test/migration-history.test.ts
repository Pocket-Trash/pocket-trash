import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import {
  type AppliedMigration,
  compareMigrationHistories,
  loadRepositoryMigrations,
  type MigrationRecord,
} from "../scripts/migration-history.js";

/** Repository history fixture used by comparison tests. */
const expected: MigrationRecord[] = [
  { createdAt: 100, hash: "aaa", tag: "0000_first" },
  { createdAt: 200, hash: "bbb", tag: "0001_second" },
];

/** Applied form of the expected history. */
const applied: AppliedMigration[] = expected.map(({ createdAt, hash }) => ({
  createdAt,
  hash,
}));

describe("compareMigrationHistories", () => {
  test.each([
    ["exact", applied],
    ["behind", applied.slice(0, 1)],
    ["ahead", [...applied, { createdAt: 300, hash: "ccc" }]],
    ["reordered", [...applied].reverse()],
    ["diverged", [{ createdAt: 100, hash: "changed" }]],
    ["missing-history", null],
  ] as const)("classifies %s history", (state, databaseHistory) => {
    const comparison = compareMigrationHistories(expected, databaseHistory);

    expect(comparison.state).toBe(state);
    expect(comparison.summary).not.toBe("");
    expect(comparison.guidance).not.toBe("");
    if (state !== "exact") {
      expect(comparison.guidance).toMatch(/Do not|Never/u);
    }
  });
});

test("loads journal order and hashes the unmodified SQL", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "migration-history-"));
  context.onTestFinished(() =>
    rmSync(directory, { force: true, recursive: true }),
  );
  mkdirSync(join(directory, "meta"), { recursive: true });
  const sql = "select 1;\n--> statement-breakpoint\nselect 2;\n";
  writeFileSync(
    join(directory, "meta", "_journal.json"),
    JSON.stringify({
      entries: [
        {
          breakpoints: true,
          idx: 0,
          tag: "0000_first",
          when: 100,
        },
      ],
    }),
  );
  writeFileSync(join(directory, "0000_first.sql"), sql);

  expect(loadRepositoryMigrations(directory)).toEqual([
    {
      createdAt: 100,
      hash: createHash("sha256").update(sql).digest("hex"),
      statements: ["select 1;", "select 2;"],
      tag: "0000_first",
    },
  ]);
});

test("rejects SQL files omitted from the journal", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "migration-history-orphan-"));
  context.onTestFinished(() =>
    rmSync(directory, { force: true, recursive: true }),
  );
  mkdirSync(join(directory, "meta"), { recursive: true });
  writeFileSync(
    join(directory, "meta", "_journal.json"),
    JSON.stringify({ entries: [] }),
  );
  writeFileSync(join(directory, "0000_orphan.sql"), "select 1;");

  expect(() => loadRepositoryMigrations(directory)).toThrow(
    /missing from the migration journal/u,
  );
});

test("rejects timestamps that Drizzle would skip", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "migration-history-order-"));
  context.onTestFinished(() =>
    rmSync(directory, { force: true, recursive: true }),
  );
  mkdirSync(join(directory, "meta"), { recursive: true });
  writeFileSync(
    join(directory, "meta", "_journal.json"),
    JSON.stringify({
      entries: [
        { breakpoints: true, idx: 0, tag: "0000_first", when: 200 },
        { breakpoints: true, idx: 1, tag: "0001_second", when: 100 },
      ],
    }),
  );
  writeFileSync(join(directory, "0000_first.sql"), "select 1;");
  writeFileSync(join(directory, "0001_second.sql"), "select 2;");

  expect(() => loadRepositoryMigrations(directory)).toThrow(/must be newer/u);
});
