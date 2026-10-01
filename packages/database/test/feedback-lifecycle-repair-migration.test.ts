import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

describe("feedback lifecycle repair migration", () => {
  it.each([
    false,
    true,
  ])("repairs missing columns and preserves existing timestamps (already migrated: %s)", async (alreadyMigrated) => {
    const database = new PGlite();
    try {
      await database.exec(`
        CREATE TABLE feedback (id bigint PRIMARY KEY, status text NOT NULL, updated_at timestamptz NOT NULL);
        INSERT INTO feedback VALUES (1, 'completed', '2026-09-30T12:00:00Z'), (2, 'requested', '2026-09-30T12:00:00Z');
      `);
      if (alreadyMigrated) {
        await database.exec(
          readFileSync(
            new URL("../drizzle/0045_charming_molten_man.sql", import.meta.url),
            "utf8",
          ),
        );
        await database.exec(
          `UPDATE feedback SET completed_at = '2026-09-29T12:00:00Z', linear_updated_at = '2026-09-29T13:00:00Z' WHERE id = 1`,
        );
      }
      const migration = readFileSync(
        new URL(
          "../drizzle/0049_repair_feedback_lifecycle.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await database.exec(migration);
      await database.exec(migration);

      const result = await database.query<{
        /** UTC completion time, or null for incomplete feedback. */
        completed_at: string | null;
        /** Existing Linear synchronization time, when present. */
        linear_updated_at: string | null;
      }>(`
        SELECT to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS completed_at,
          to_char(linear_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS linear_updated_at
        FROM feedback ORDER BY id
      `);
      expect(result.rows).toEqual([
        {
          completed_at: alreadyMigrated
            ? "2026-09-29 12:00:00"
            : "2026-09-30 12:00:00",
          linear_updated_at: alreadyMigrated ? "2026-09-29 13:00:00" : null,
        },
        { completed_at: null, linear_updated_at: null },
      ]);
      const indexes = await database.query(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'feedback' AND indexname = 'feedback_status_completed_at_idx'`,
      );
      expect(indexes.rows).toHaveLength(1);
    } finally {
      await database.close();
    }
  });
});
