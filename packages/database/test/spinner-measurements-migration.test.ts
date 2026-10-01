import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Spinner measurement columns and their expected positive-value constraints. */
const measurements = [
  ["product_spinner", "weight_g", "product_spinner_measurements_positive"],
  ["product_spinner", "length_mm", "product_spinner_measurements_positive"],
  ["product_spinner", "width_mm", "product_spinner_measurements_positive"],
  ["product_spinner", "thickness_mm", "product_spinner_measurements_positive"],
  [
    "product_spinner",
    "thickness_with_button_mm",
    "product_spinner_measurements_positive",
  ],
  [
    "product_spinner",
    "button_diameter_mm",
    "product_spinner_measurements_positive",
  ],
  [
    "product_spinner",
    "spin_diameter_mm",
    "product_spinner_measurements_positive",
  ],
  [
    "product_spinner_button",
    "weight_g",
    "product_spinner_button_measurements_positive",
  ],
  [
    "product_spinner_button",
    "diameter_mm",
    "product_spinner_button_measurements_positive",
  ],
  [
    "product_spinner_button",
    "thickness_mm",
    "product_spinner_button_measurements_positive",
  ],
] as const;

describe("spinner measurements migration", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await database.exec(`
      CREATE TABLE "product_spinner" (
        "id" bigint PRIMARY KEY,
        "weight_g" numeric,
        "length_mm" numeric,
        "width_mm" numeric,
        "thickness_mm" numeric,
        "thickness_with_button_mm" numeric,
        "button_diameter_mm" numeric,
        "spin_diameter_mm" numeric
      );
      CREATE TABLE "product_spinner_button" (
        "id" bigint PRIMARY KEY,
        "weight_g" numeric,
        "diameter_mm" numeric,
        "thickness_mm" numeric
      );
    `);
    const migrations = new URL("../drizzle/", import.meta.url);
    const migration = readdirSync(migrations).find(
      (name) =>
        name.endsWith(".sql") &&
        readFileSync(new URL(name, migrations), "utf8").includes(
          "product_spinner_button_measurements_positive",
        ),
    );
    if (!migration)
      throw new Error("Spinner measurement migration was not found.");
    await database.exec(
      readFileSync(new URL(migration, migrations), "utf8").replaceAll(
        "--> statement-breakpoint",
        "",
      ),
    );
  });

  afterAll(async () => {
    await database.close();
  });

  it.each(
    measurements,
  )("allows positive or absent %s.%s and rejects non-positive values", async (table, column, constraint) => {
    const id = measurements.findIndex(
      ([candidateTable, candidateColumn]) =>
        candidateTable === table && candidateColumn === column,
    );
    const violation = new RegExp(constraint, "iu");

    await expect(
      database.exec(
        `INSERT INTO "${table}" ("id", "${column}") VALUES (${id}, 1)`,
      ),
    ).resolves.toBeDefined();
    await expect(
      database.exec(`INSERT INTO "${table}" ("id") VALUES (${id + 100})`),
    ).resolves.toBeDefined();
    await expect(
      database.exec(
        `INSERT INTO "${table}" ("id", "${column}") VALUES (${id + 200}, 0)`,
      ),
    ).rejects.toThrow(violation);
    await expect(
      database.exec(
        `INSERT INTO "${table}" ("id", "${column}") VALUES (${id + 300}, -1)`,
      ),
    ).rejects.toThrow(violation);
    await expect(
      database.exec(`UPDATE "${table}" SET "${column}" = 0 WHERE "id" = ${id}`),
    ).rejects.toThrow(violation);
    await expect(
      database.exec(
        `UPDATE "${table}" SET "${column}" = -1 WHERE "id" = ${id}`,
      ),
    ).rejects.toThrow(violation);
  });
});
