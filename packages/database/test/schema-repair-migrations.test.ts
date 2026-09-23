import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("schema repair migrations", () => {
  it("renames the legacy user table only when users is absent", () => {
    const migration = readFileSync(
      new URL("../drizzle/0024_repair_users_table_name.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain("to_regclass('public.users') IS NULL");
    expect(migration).toContain("to_regclass('public.\"user\"') IS NOT NULL");
    expect(migration).toContain('ALTER TABLE "user" RENAME TO "users"');
  });
});
