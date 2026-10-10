import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

describe("product-type classification migration", () => {
  it("backfills known parts and accessories without changing primary types", async () => {
    const client = new PGlite();
    try {
      await client.exec(`
        CREATE TABLE product_types (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          name text NOT NULL,
          slug text NOT NULL,
          created_at timestamp DEFAULT now() NOT NULL,
          updated_at timestamp DEFAULT now() NOT NULL
        );
        INSERT INTO product_types (name, slug) VALUES
          ('Spinner', 'spinner'),
          ('Spinner Button', 'spinner-button'),
          ('Slider', 'slider'),
          ('Slider Plate', 'slider-plate'),
          ('Slider Insert', 'slider-insert');
      `);
      const migration = readFileSync(
        fileURLToPath(
          new URL(
            "../drizzle/20261009181111_furry_guardian/migration.sql",
            import.meta.url,
          ),
        ),
        "utf8",
      );

      await client.exec(migration);

      const result = await client.query<{
        /** Stored product-type classification. */
        is_part_or_accessory: boolean;
        /** Product-type slug. */
        slug: string;
      }>("SELECT slug, is_part_or_accessory FROM product_types ORDER BY slug");
      expect(result.rows).toEqual([
        { is_part_or_accessory: false, slug: "slider" },
        { is_part_or_accessory: true, slug: "slider-insert" },
        { is_part_or_accessory: true, slug: "slider-plate" },
        { is_part_or_accessory: false, slug: "spinner" },
        { is_part_or_accessory: true, slug: "spinner-button" },
      ]);
    } finally {
      await client.close();
    }
  }, 30_000);
});
