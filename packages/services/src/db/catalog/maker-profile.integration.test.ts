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
      const [image] = await db
        .insert(schema.makerImage)
        .values({
          contentType: "image/png",
          fileName: "maker.png",
          makerId: first.id,
          objectPath: "images/makers/cafe-works/maker.png",
          position: 0,
          sha256: "a".repeat(64),
          size: 10,
          uploadedByClerkId: admin.clerkId,
          url: "https://cdn.test/maker.png",
        })
        .returning({ id: schema.makerImage.id });
      if (!image) throw new Error("Maker image was not created.");
      expect(
        await service.getMakerForAdmin({ actor: admin, makerId: first.id }),
      ).toEqual(
        expect.objectContaining({
          images: [expect.objectContaining({ id: image.id, position: 0 })],
        }),
      );
      await expect(service.listMakersForAdmin(user)).rejects.toThrow(
        "Product does not exist.",
      );
      await expect(
        service.getMakerForAdmin({ actor: user, makerId: first.id }),
      ).rejects.toThrow("Product does not exist.");
      await expect(
        service.softDeleteImage({
          actor: user,
          imageId: image.id,
          targetType: "maker",
        }),
      ).rejects.toThrow("Image does not exist.");
      await service.softDeleteImage({
        actor: admin,
        imageId: image.id,
        targetType: "maker",
      });
      expect(
        (await service.getMakerForAdmin({ actor: admin, makerId: first.id }))
          ?.images[0]?.deletedByRole,
      ).toBe("admin");
      await service.restoreImage({
        actor: admin,
        imageId: image.id,
        targetType: "maker",
      });
      expect(
        (await service.getMakerForAdmin({ actor: admin, makerId: first.id }))
          ?.images[0]?.deletedAt,
      ).toBeNull();
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

  it("aggregates only approved public products and owned public collection items", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });
    try {
      for (const file of migrationFiles()) await runMigration(client, file);
      await client.exec(`
        insert into users (clerk_id) values ('directory-owner');
        insert into makers (name, slug) values ('Directory Maker', 'directory-maker');
        insert into product_types (name, slug) values ('Directory Spinner', 'directory-spinner');
        insert into product (
          product_type_id, maker_id, name, slug, approval_status, is_private
        ) values
          ((select id from product_types where slug = 'directory-spinner'), (select id from makers where slug = 'directory-maker'), 'Public product', 'public-product', 'approved', false),
          ((select id from product_types where slug = 'directory-spinner'), (select id from makers where slug = 'directory-maker'), 'Pending product', 'pending-product', 'pending', false),
          ((select id from product_types where slug = 'directory-spinner'), (select id from makers where slug = 'directory-maker'), 'Private product', 'private-product', 'approved', true);
        insert into product_spinner (id)
          select id from product where slug in ('public-product', 'pending-product', 'private-product');
        insert into user_collection (owner_id, name, normalized_name, is_private)
        values
          ((select id from users where clerk_id = 'directory-owner'), 'Public', 'public', false),
          ((select id from users where clerk_id = 'directory-owner'), 'Private', 'private', true);
        insert into collection_item (
          owner_id, collection_id, display_name, owned, sold_at,
          approval_status, is_private
        )
        select users.id, user_collection.id, fixture.display_name,
          fixture.owned, fixture.sold_at, fixture.approval_status,
          fixture.is_private
        from (
          values
            ('Visible', true, null::timestamptz, 'approved', false, 'Public'),
            ('Unowned', false, null::timestamptz, 'approved', false, 'Public'),
            ('Sold', true, now(), 'approved', false, 'Public'),
            ('Pending', true, null::timestamptz, 'pending', false, 'Public'),
            ('Rejected', true, null::timestamptz, 'rejected', false, 'Public'),
            ('Private item', true, null::timestamptz, 'approved', true, 'Public'),
            ('Private collection', true, null::timestamptz, 'approved', false, 'Private'),
            ('Hidden product', true, null::timestamptz, 'approved', false, 'Public')
        ) fixture(display_name, owned, sold_at, approval_status, is_private, collection_name)
        join users on users.clerk_id = 'directory-owner'
        join user_collection on user_collection.name = fixture.collection_name;
        insert into collection_spinner (id, product_spinner_id)
        select collection_item.id,
          product.id
        from collection_item
        join product on product.slug = case collection_item.display_name
          when 'Hidden product' then 'pending-product'
          else 'public-product'
        end;
        insert into maker_image (
          maker_id, position, file_name, content_type, size, sha256,
          object_path, url, deleted_at, deleted_by_role
        ) values
          ((select id from makers where slug = 'directory-maker'), 0, 'old.png', 'image/png', 10, repeat('c', 64), 'makers/old.png', 'https://cdn.test/old.png', now(), 'admin'),
          ((select id from makers where slug = 'directory-maker'), 1, 'lead.png', 'image/png', 10, repeat('d', 64), 'makers/lead.png', 'https://cdn.test/lead.png', null, null);
      `);
      const service = createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog;

      expect(await service.listPublicMakers()).toEqual([
        expect.objectContaining({
          collectionItemCount: 1,
          images: [expect.objectContaining({ fileName: "lead.png" })],
          name: "Directory Maker",
          productCount: 1,
          slug: "directory-maker",
        }),
      ]);
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
