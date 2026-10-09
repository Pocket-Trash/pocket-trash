import { Pool } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** PostgreSQL connection used only when live database tests are enabled. */
const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("current subtype table row locking", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const schemaName = `subtype_rename_lock_${process.pid}_${Date.now()}`;

  beforeAll(async () => {
    await pool.query(`
      CREATE SCHEMA "${schemaName}";
      CREATE TABLE "${schemaName}".product_detail_spinner (
        id bigint PRIMARY KEY,
        bearing text
      );
      INSERT INTO "${schemaName}".product_detail_spinner (id, bearing)
        VALUES (1, 'R188');
    `);
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.end();
  });

  it("blocks a current-table update until its row lock commits", async () => {
    const locker = await pool.connect();
    const updater = await pool.connect();
    try {
      await locker.query("BEGIN");
      await locker.query(`SET LOCAL search_path TO "${schemaName}"`);
      await locker.query("SELECT id FROM product_detail_spinner FOR UPDATE");

      await updater.query("BEGIN");
      await updater.query(`SET LOCAL search_path TO "${schemaName}"`);
      await updater.query("SET LOCAL lock_timeout = '100ms'");
      await expect(
        updater.query(
          "UPDATE product_detail_spinner SET bearing = 'locked' WHERE id = 1",
        ),
      ).rejects.toMatchObject({ code: "55P03" });
      await updater.query("ROLLBACK");

      await locker.query("COMMIT");
      await expect(
        updater.query(
          `UPDATE "${schemaName}".product_detail_spinner SET bearing = 'released' WHERE id = 1 RETURNING bearing`,
        ),
      ).resolves.toMatchObject({ rows: [{ bearing: "released" }] });
    } finally {
      await locker.query("ROLLBACK");
      locker.release();
      await updater.query("ROLLBACK");
      updater.release();
    }
  });
});
