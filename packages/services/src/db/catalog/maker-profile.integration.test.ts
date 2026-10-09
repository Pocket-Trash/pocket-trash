import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

describe("maker profile persistence", () => {
  it("creates, protects, and updates maker profiles without changing slugs", async () => {
    const client = new PGlite();
    const db = drizzle({ client: client, relations: schema.relations });
    try {
      await migrate(drizzle({ client }), {
        migrationsFolder: migrationsFolder(),
      });
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
    const db = drizzle({ client: client, relations: schema.relations });
    try {
      await migrate(drizzle({ client }), {
        migrationsFolder: migrationsFolder(),
      });
      await client.exec(`
        insert into users (clerk_id) values ('directory-owner');
        insert into makers (name, slug) values ('Directory Maker', 'directory-maker');
        insert into product_types (name, slug) values ('Spinner', 'spinner');
        insert into product (
          product_type_id, maker_id, name, slug, approval_status, is_private
        ) values
          ((select id from product_types where slug = 'spinner'), (select id from makers where slug = 'directory-maker'), 'Public product', 'public-product', 'approved', false),
          ((select id from product_types where slug = 'spinner'), (select id from makers where slug = 'directory-maker'), 'Pending product', 'pending-product', 'pending', false),
          ((select id from product_types where slug = 'spinner'), (select id from makers where slug = 'directory-maker'), 'Private product', 'private-product', 'approved', true);
        insert into product_detail_spinner (id)
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
        insert into collection_detail_spinner (id, product_spinner_id)
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
      await expect(
        service.getPublicMakerDetail("directory-maker"),
      ).resolves.toEqual(
        expect.objectContaining({
          collectionItems: [
            expect.objectContaining({
              displayName: "Visible",
              makerSlug: "directory-maker",
            }),
          ],
          images: [expect.objectContaining({ fileName: "lead.png" })],
          products: [
            expect.objectContaining({
              makerSlug: "directory-maker",
              name: "Public product",
            }),
          ],
          slug: "directory-maker",
        }),
      );
      await expect(
        service.getPublicMakerDetail("missing-maker"),
      ).resolves.toBeNull();
    } finally {
      await client.close();
    }
  }, 30_000);
});

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
