import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

describe("maker profile persistence", () => {
  it("preserves migrated makers and assigns stable deterministic slugs", async () => {
    const client = new PGlite();
    try {
      const migrations = migrationFiles();
      for (const file of migrations.filter((name) => name < "0053_")) {
        await runMigration(client, file);
      }
      await client.exec(`
        insert into makers (name, root_url, created_at, updated_at)
        values
          ('Acme & Co', 'https://acme-one.test', '2025-01-01', '2025-02-01'),
          ('Acme Co', 'https://acme-two.test', '2025-03-01', '2025-04-01');
      `);
      const before = await client.query<{
        /** Preserved creation timestamp. */
        created_at: Date;
        /** Preserved maker identifier. */
        id: number;
        /** Preserved maker name. */
        name: string;
        /** Preserved root URL. */
        root_url: string;
        /** Preserved update timestamp. */
        updated_at: Date;
      }>(
        "select id, name, root_url, created_at, updated_at from makers order by id",
      );

      for (const file of migrations.filter((name) => name >= "0053_")) {
        await runMigration(client, file);
      }

      const after = await client.query<{
        /** Preserved creation timestamp. */
        created_at: Date;
        /** Preserved maker identifier. */
        id: number;
        /** Preserved maker name. */
        name: string;
        /** Preserved root URL. */
        root_url: string;
        /** Generated stable slug. */
        slug: string;
        /** Preserved update timestamp. */
        updated_at: Date;
      }>(
        "select id, name, root_url, slug, created_at, updated_at from makers order by id",
      );

      expect(
        after.rows.map(({ created_at, id, name, root_url, updated_at }) => ({
          created_at,
          id,
          name,
          root_url,
          updated_at,
        })),
      ).toEqual(before.rows);
      expect(after.rows.map(({ slug }) => slug)).toEqual([
        "acme-co",
        "acme-co-2",
      ]);
    } finally {
      await client.close();
    }
  }, 30_000);

  it("creates, protects, and updates maker profiles without changing slugs", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });
    try {
      for (const file of migrationFiles()) await runMigration(client, file);
      const service = createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog;
      const admin = { clerkId: "maker-admin", role: "admin" } as const;
      const user = { clerkId: "maker-user", role: "user" } as const;

      const first = await service.createMaker({
        actor: admin,
        description: "First **profile**",
        name: "Café Works",
        rootUrl: "https://cafe.test",
      });
      const second = await service.createMaker({
        actor: admin,
        name: "Cafe Works!",
        rootUrl: null,
      });

      expect(first).toEqual(
        expect.objectContaining({
          description: "First **profile**",
          slug: "cafe-works",
        }),
      );
      expect(second.slug).toBe("cafe-works-2");
      await expect(service.listMakersForAdmin(user)).rejects.toThrow(
        "Product does not exist.",
      );
      await expect(
        service.getMakerForAdmin({ actor: user, makerId: first.id }),
      ).rejects.toThrow("Product does not exist.");
      const updated = await service.updateMaker({
        actor: admin,
        description: null,
        makerId: first.id,
        name: "Renamed Works",
        rootUrl: null,
      });
      expect(updated).toEqual(
        expect.objectContaining({
          description: null,
          name: "Renamed Works",
          rootUrl: null,
          slug: "cafe-works",
        }),
      );
      await expect(
        service.updateMaker({
          actor: admin,
          description: null,
          makerId: second.id,
          name: "Renamed Works",
          rootUrl: null,
        }),
      ).rejects.toThrow("Maker name already exists.");
    } finally {
      await client.close();
    }
  }, 30_000);
});

/**
 * Lists repository migrations in execution order.
 *
 * @returns Sorted SQL migration filenames.
 */
function migrationFiles() {
  return readdirSync(migrationsFolder())
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/**
 * Resolves the repository migration directory.
 *
 * @returns Absolute migration directory path.
 */
function migrationsFolder() {
  return fileURLToPath(
    new URL("../../../../database/drizzle", import.meta.url),
  );
}

/**
 * Applies one repository migration to the isolated database.
 *
 * @param client - PGlite database instance.
 * @param file - Migration filename.
 * @returns Completion after the migration is applied.
 * @rejects When migration SQL cannot be read or executed.
 */
async function runMigration(client: PGlite, file: string) {
  await client.exec(
    readFileSync(join(migrationsFolder(), file), "utf8").replaceAll(
      "--> statement-breakpoint",
      "",
    ),
  );
}
