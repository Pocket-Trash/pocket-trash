import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, it } from "vitest";

/** Exact installed Kit executable, without package-manager resolution. */
const kit = fileURLToPath(
  new URL("../node_modules/drizzle-kit/bin.cjs", import.meta.url),
);

it("retains compatible sibling migrations, applies a late older name, and rejects conflicting siblings", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "drizzle-branches-"));
  context.onTestFinished(() =>
    rmSync(directory, { recursive: true, force: true }),
  );
  symlinkSync(
    fileURLToPath(new URL("../node_modules", import.meta.url)),
    join(directory, "node_modules"),
    "dir",
  );
  writeFileSync(
    join(directory, "drizzle.config.ts"),
    'export default { dialect: "postgresql", schema: "./schema.ts", out: process.env.DRIZZLE_TEST_OUT };',
  );
  writeFileSync(
    join(directory, "schema.ts"),
    'import { pgTable, integer, text, uuid } from "drizzle-orm/pg-core"; export const example = pgTable("example", { id: integer("id").primaryKey() });',
  );
  runKit(directory, ["generate", "--name=baseline"], "baseline");
  const baseline = readdirSync(join(directory, "baseline"))[0];
  if (!baseline) throw new Error("Kit did not generate a baseline.");
  renameSync(
    join(directory, "baseline", baseline),
    join(directory, "baseline", "20200101000000_baseline"),
  );

  for (const [name, column] of [
    ["left", 'first: text("first")'],
    ["right", 'second: text("second")'],
    ["conflicting", 'first: uuid("first")'],
  ] as const) {
    cpSync(join(directory, "baseline"), join(directory, name), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "schema.ts"),
      `import { pgTable, integer, text, uuid } from "drizzle-orm/pg-core"; export const example = pgTable("example", { id: integer("id").primaryKey(), ${column} });`,
    );
    runKit(directory, ["generate", `--name=${name}`], name);
    const generated = readdirSync(join(directory, name)).find(
      (folder) => folder !== "20200101000000_baseline",
    );
    if (!generated)
      throw new Error("Kit did not generate the branch migration.");
    renameSync(
      join(directory, name, generated),
      join(
        directory,
        name,
        name === "right" ? "20200102000000_right" : `20200103000000_${name}`,
      ),
    );
  }

  const combined = join(directory, "combined");
  cpSync(join(directory, "left"), combined, { recursive: true });
  const database = new PGlite();
  context.onTestFinished(() => database.close());
  const db = drizzle({ client: database });
  await migrate(db, { migrationsFolder: combined });
  cpSync(
    join(directory, "right", "20200102000000_right"),
    join(combined, "20200102000000_right"),
    { recursive: true },
  );
  runKit(directory, ["check"], "combined");
  await migrate(db, { migrationsFolder: combined });
  await migrate(db, { migrationsFolder: combined });
  await expect(
    database.query(
      "INSERT INTO example (id, first, second) VALUES (1, 'left', 'right') RETURNING first, second",
    ),
  ).resolves.toMatchObject({ rows: [{ first: "left", second: "right" }] });
  await expect(
    database.query("SELECT name FROM drizzle.__drizzle_migrations ORDER BY id"),
  ).resolves.toMatchObject({
    rows: [
      { name: "20200101000000_baseline" },
      { name: "20200103000000_left" },
      { name: "20200102000000_right" },
    ],
  });

  const incompatible = join(directory, "incompatible");
  mkdirSync(incompatible);
  cpSync(join(directory, "left"), incompatible, { recursive: true });
  cpSync(
    join(directory, "conflicting", "20200103000000_conflicting"),
    join(incompatible, "20200103000000_conflicting"),
    { recursive: true },
  );
  const result = spawnSync(process.execPath, [kit, "check"], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, DRIZZLE_TEST_OUT: "./incompatible" },
  });
  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).toMatch(/non-commutative/iu);
}, 60_000);

/**
 * Runs the pinned Kit against an isolated schema fixture.
 *
 * @param directory - Temporary fixture root.
 * @param args - Native Kit command arguments.
 * @param out - Migration directory within the fixture.
 * @throws When Kit fails or cannot start.
 */
function runKit(directory: string, args: string[], out: string): void {
  const result = spawnSync(process.execPath, [kit, ...args], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, DRIZZLE_TEST_OUT: `./${out}` },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
}
