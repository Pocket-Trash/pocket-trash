import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("product measurements migration", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await database.exec(`
      CREATE TYPE "dimension_unit" AS ENUM ('in', 'mm');
      CREATE TYPE "weight_unit" AS ENUM ('g', 'oz');
      CREATE TABLE "product_slider" (
        "id" bigint PRIMARY KEY,
        "weight_g" numeric,
        "length_mm" numeric,
        "width_mm" numeric,
        "thickness_mm" numeric,
        CONSTRAINT "product_slider_measurements_positive" CHECK (weight_g > 0 AND length_mm > 0 AND width_mm > 0 AND thickness_mm > 0)
      );
      CREATE TABLE "product_spinner" (
        "id" bigint PRIMARY KEY,
        "weight_g" numeric,
        "length_mm" numeric,
        "width_mm" numeric,
        "thickness_mm" numeric,
        "thickness_with_button_mm" numeric,
        "button_diameter_mm" numeric,
        "spin_diameter_mm" numeric,
        CONSTRAINT "product_spinner_measurements_positive" CHECK (weight_g > 0 AND length_mm > 0 AND width_mm > 0 AND thickness_mm > 0 AND thickness_with_button_mm > 0 AND button_diameter_mm > 0 AND spin_diameter_mm > 0)
      );
      CREATE TABLE "product_spinner_button" (
        "id" bigint PRIMARY KEY,
        "weight_g" numeric,
        "diameter_mm" numeric,
        "thickness_mm" numeric,
        CONSTRAINT "product_spinner_button_measurements_positive" CHECK (weight_g > 0 AND diameter_mm > 0 AND thickness_mm > 0)
      );
      CREATE TABLE "user_settings" (
        "user_id" bigint PRIMARY KEY,
        "dimension_unit" dimension_unit NOT NULL DEFAULT 'in',
        "weight_unit" weight_unit NOT NULL DEFAULT 'g'
      );
      INSERT INTO "product_slider" VALUES (1, 96.00, 52, 24.50, 12);
      INSERT INTO "product_spinner" VALUES (2, 90, 50.8, 40, 12.7, 15, 22, 55);
      INSERT INTO "product_spinner_button" VALUES (3, 20, 22, 9);
      INSERT INTO "user_settings" VALUES (1, 'in', 'oz');
    `);
    const migration = readFileSync(
      new URL("../drizzle/0074_fine_black_queen.sql", import.meta.url),
      "utf8",
    ).replaceAll("--> statement-breakpoint", "");
    await database.exec(migration);
  });

  afterAll(async () => {
    await database.close();
  });

  it("preserves numeric text and backfills the original metric units", async () => {
    await expect(
      database.query<{
        /** Original slider length. */
        length_value: string;
        /** Backfilled slider length unit. */
        length_unit: string;
        /** Original slider weight. */
        weight_value: string;
        /** Backfilled slider weight unit. */
        weight_unit: string;
      }>(
        "SELECT length_value, length_unit, weight_value, weight_unit FROM product_slider WHERE id = 1",
      ),
    ).resolves.toMatchObject({
      rows: [
        {
          length_unit: "mm",
          length_value: "52",
          weight_unit: "g",
          weight_value: "96.00",
        },
      ],
    });
  });

  it("initializes every existing preference to metric", async () => {
    await expect(
      database.query<{
        /** Migrated display system. */ measurement_system: string;
      }>("SELECT measurement_system FROM user_settings WHERE user_id = 1"),
    ).resolves.toMatchObject({ rows: [{ measurement_system: "metric" }] });
  });

  it("requires positive values and units to be present together", async () => {
    await expect(
      database.exec(
        "INSERT INTO product_slider (id, length_value) VALUES (4, 2)",
      ),
    ).rejects.toThrow(/constraint/iu);
    await expect(
      database.exec(
        "INSERT INTO product_slider (id, length_value, length_unit) VALUES (5, 2, 'in')",
      ),
    ).resolves.toBeDefined();
  });
});
