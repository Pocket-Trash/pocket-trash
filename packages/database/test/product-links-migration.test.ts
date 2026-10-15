import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("moves each legacy product URL into its first ordered link", async () => {
  const client = new PGlite();
  try {
    await client.exec(`
      CREATE TABLE product (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        maker_product_url text,
        maker_product_url_valid boolean DEFAULT true NOT NULL
      );
      INSERT INTO product (maker_product_url, maker_product_url_valid) VALUES
        ('https://maker.example/valid', true),
        ('https://maker.example/invalid', false),
        (NULL, true);
    `);
    const migration = readFileSync(
      fileURLToPath(
        new URL(
          "../drizzle/20261015064719_careful_garia/migration.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    );

    await client.exec(migration);

    await expect(
      client.query(
        `SELECT product_id::int, position, url, is_valid
         FROM product_link ORDER BY product_id`,
      ),
    ).resolves.toMatchObject({
      rows: [
        {
          is_valid: true,
          position: 0,
          product_id: 1,
          url: "https://maker.example/valid",
        },
        {
          is_valid: false,
          position: 0,
          product_id: 2,
          url: "https://maker.example/invalid",
        },
      ],
    });
    await expect(
      client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'product' AND column_name LIKE 'maker_product_url%'`,
      ),
    ).resolves.toMatchObject({ rows: [] });
  } finally {
    await client.close();
  }
}, 30_000);
