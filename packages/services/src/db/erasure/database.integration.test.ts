import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { createErasureService, createErasureSubjectHmac } from "./index.js";

describe("account database erasure", () => {
  it("rolls back safely, erases every account link, and preserves shared data", async () => {
    const client = new PGlite();
    await stage("migration", async () => await migrate(client));
    await stage("fixture setup", async () => await seedInventory(client));
    const db = drizzle(client, { schema }) as unknown as Database;
    const targetClerkId = "user_to_erase";
    const service = createErasureService(
      db,
      createLogger({
        app: "api",
        environment: "test",
        transports: [{ log() {} }],
      }),
    );
    const subjectHmac = await createErasureSubjectHmac(
      targetClerkId,
      "test-erasure-hmac-secret-at-least-32-characters",
    );

    try {
      await service.create({
        initiator: "self",
        subjectHmac,
        targetClerkId,
        verificationMethod: "clerk_reverification",
        verifiedAt: new Date(),
        verifiedByClerkId: targetClerkId,
      });
      await client.exec(`
        create rule erasure_test_block as on update to product
        where old.owner_clerk_id = 'user_to_erase'
        do instead nothing;
      `);
      await stage("rollback attempt", async () => {
        await expect(
          service.eraseDatabase(targetClerkId),
        ).rejects.toMatchObject({ code: "database_verification_failed" });
      });
      expect(
        await counts(
          client,
          `
          select
            (select count(*)::int from users where clerk_id = 'user_to_erase') as users,
            (select count(*)::int from resources where uploader_clerk_id = 'user_to_erase') as resources,
            (select count(*)::int from product where owner_clerk_id = 'user_to_erase') as products
        `,
        ),
      ).toEqual({ products: 1, resources: 1, users: 1 });
      await client.exec("drop rule erasure_test_block on product");

      await stage("concurrent erasure", async () => {
        await Promise.all([
          service.eraseDatabase(targetClerkId),
          service.eraseDatabase(targetClerkId),
        ]);
      });
      await stage("idempotent retry", async () => {
        await expect(
          service.eraseDatabase(targetClerkId),
        ).resolves.toBeUndefined();
      });

      expect(
        await counts(
          client,
          `
          select
            (select count(*)::int from users where clerk_id = 'user_to_erase') as users,
            (select count(*)::int from user_settings) as settings,
            (select count(*)::int from user_collection where name = 'Erased collection') as collections,
            (select count(*)::int from collection_item where display_name = 'Erased item') as items,
            (select count(*)::int from resources where name = 'Erased resource') as resources,
            (select count(*)::int from feedback where title = 'Erased feedback') as feedback,
            (select count(*)::int from upload_session) as uploads,
            (select count(*)::int from feedback_votes where voter_clerk_id = 'user_to_erase') as votes
        `,
        ),
      ).toEqual({
        collections: 0,
        feedback: 0,
        items: 0,
        resources: 0,
        settings: 0,
        uploads: 0,
        users: 0,
        votes: 0,
      });

      expect(
        await row(
          client,
          `
          select owner_clerk_id as "ownerClerkId", privated_by_clerk_id as "privatedByClerkId"
          from product where name = 'Preserved product'
        `,
        ),
      ).toEqual({ ownerClerkId: null, privatedByClerkId: null });
      expect(
        await row(
          client,
          `
          select uploaded_by_clerk_id as "uploadedByClerkId",
            deleted_by_clerk_id as "deletedByClerkId", deleted_by_role as "deletedByRole",
            deleted_at is not null as "keptDeletionTime"
          from product_image where file_name = 'preserved-product.png'
        `,
        ),
      ).toEqual({
        deletedByClerkId: null,
        deletedByRole: "owner",
        keptDeletionTime: true,
        uploadedByClerkId: null,
      });
      expect(
        await row(
          client,
          `
          select purchased_from_user_id as "purchasedFromUserId",
            purchased_from_user as "purchasedFromUser",
            sold_to_user_id as "soldToUserId", sold_to_user as "soldToUser",
            privated_by_clerk_id as "privatedByClerkId"
          from collection_item where display_name = 'Preserved item'
        `,
        ),
      ).toEqual({
        privatedByClerkId: null,
        purchasedFromUser: null,
        purchasedFromUserId: null,
        soldToUser: null,
        soldToUserId: null,
      });
      expect(
        await row(
          client,
          `
          select uploader_clerk_id as "uploaderClerkId",
            privated_by_clerk_id as "privatedByClerkId",
            deleted_by_clerk_id as "deletedByClerkId"
          from resources where name = 'Preserved resource'
        `,
        ),
      ).toEqual({
        deletedByClerkId: null,
        privatedByClerkId: null,
        uploaderClerkId: "other_user",
      });
      expect(
        await counts(
          client,
          `
          select
            (select count(*)::int from product_material) as product_materials,
            (select count(*)::int from resource_downloads) as anonymous_downloads,
            (select count(*)::int from resource_categories where created_by_clerk_id is null) as categories,
            (select count(*) > 0 from resource_notifications rn join resources r on r.id = rn.resource_id where r.name = 'Preserved resource' and rn.read_at is null and rn.read_by_clerk_id is null) as resource_notifications,
            (select count(*)::int from feedback_notifications where read_at is null and read_by_clerk_id is null) as feedback_notifications,
            (select count(*)::int from feature_flags where created_by_clerk_id is null and updated_by_clerk_id is null and archived_by_clerk_id is null) as flags,
            (select count(*)::int from feature_flag_user_overrides where created_by_clerk_id is null and updated_by_clerk_id is null) as overrides
        `,
        ),
      ).toEqual({
        anonymous_downloads: 1,
        categories: 1,
        feedback_notifications: 1,
        flags: 1,
        overrides: 1,
        product_materials: 1,
        resource_notifications: true,
      });

      await client.exec(`
        insert into users (clerk_id, username)
        values ('new_clerk_account', 'same_username');
      `);
      expect(
        await counts(
          client,
          `
          select
            (select count(*)::int from user_settings us join users u on u.id = us.user_id where u.clerk_id = 'new_clerk_account') as settings,
            (select count(*)::int from user_collection uc join users u on u.id = uc.owner_id where u.clerk_id = 'new_clerk_account') as collections,
            (select count(*)::int from feature_flag_user_overrides ffu join users u on u.id = ffu.user_id where u.clerk_id = 'new_clerk_account') as overrides
        `,
        ),
      ).toEqual({ collections: 0, overrides: 0, settings: 0 });
    } finally {
      await client.close();
    }
  }, 30_000);
});

async function counts(client: PGlite, query: string) {
  return await row(client, query);
}

async function stage(name: string, operation: () => Promise<void>) {
  try {
    await operation();
  } catch (error) {
    throw new Error(`Database erasure test failed during ${name}.`, {
      cause: error,
    });
  }
}

async function row(client: PGlite, query: string) {
  const result = await client.query<Record<string, unknown>>(query);
  return result.rows[0];
}

async function migrate(client: PGlite) {
  const migrationsFolder = fileURLToPath(
    new URL("../../../../database/drizzle", import.meta.url),
  );
  for (const file of readdirSync(migrationsFolder)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await client.exec(
      readFileSync(join(migrationsFolder, file), "utf8").replaceAll(
        "--> statement-breakpoint",
        "",
      ),
    );
  }
}

async function seedInventory(client: PGlite) {
  await client.exec(`
    insert into users (clerk_id, username) values
      ('user_to_erase', 'same_username'),
      ('other_user', 'other_username');
    insert into user_settings (user_id)
      select id from users where clerk_id = 'user_to_erase';

    insert into makers (name, root_url) values ('Shared maker', 'https://maker.test');
    insert into product_types (name, slug) values ('Spinner', 'spinner');
    insert into materials (name, slug) values ('Metal', 'metal');
    insert into product (
      product_type_id, maker_id, owner_clerk_id, name, slug, is_private,
      private_reason, privated_at, privated_by_clerk_id
    ) values (
      (select id from product_types where slug = 'spinner'),
      (select id from makers where name = 'Shared maker'),
      'user_to_erase', 'Preserved product', 'preserved-product', true,
      'moderated', now(), 'user_to_erase'
    );
    insert into product_material (product_id, material_id) values (
      (select id from product where slug = 'preserved-product'),
      (select id from materials where slug = 'metal')
    );
    insert into product_image (
      product_id, position, file_name, content_type, size, sha256,
      object_path, url, uploaded_by_clerk_id, deleted_at,
      deleted_by_clerk_id, deleted_by_role
    ) values (
      (select id from product where slug = 'preserved-product'), 0,
      'preserved-product.png', 'image/png', 10, repeat('a', 64),
      'images/products/preserved.png', 'https://cdn.test/products/preserved.png',
      'user_to_erase', now(), 'user_to_erase', 'owner'
    );

    insert into user_collection (owner_id, name, normalized_name, is_private)
      select id, 'Erased collection', 'erased collection', false
      from users where clerk_id = 'user_to_erase';
    insert into user_collection (
      owner_id, name, normalized_name, is_private, private_reason,
      privated_at, privated_by_clerk_id
    ) select id, 'Preserved collection', 'preserved collection', true,
      'moderated', now(), 'user_to_erase'
      from users where clerk_id = 'other_user';
    insert into collection_item (owner_id, collection_id, display_name)
      select owner_id, id, 'Erased item' from user_collection
      where name = 'Erased collection';
    insert into collection_item (
      owner_id, collection_id, display_name, purchased_from_user_id,
      purchased_from_user, sold_to_user_id, sold_to_user, is_private,
      private_reason, privated_at, privated_by_clerk_id
    ) select uc.owner_id, uc.id, 'Preserved item', target.id,
      'same_username', target.id, 'same_username', true,
      'moderated', now(), 'user_to_erase'
      from user_collection uc cross join users target
      where uc.name = 'Preserved collection'
        and target.clerk_id = 'user_to_erase';
    insert into collection_image (
      collection_id, is_current, position, file_name, content_type, size,
      sha256, object_path, url, uploaded_by_clerk_id
    ) values
      ((select id from user_collection where name = 'Erased collection'), true,
       0, 'erased-collection.png', 'image/png', 10, repeat('b', 64),
       'images/collections/erased.png', 'https://cdn.test/collections/erased.png', 'user_to_erase'),
      ((select id from user_collection where name = 'Preserved collection'), true,
       0, 'preserved-collection.png', 'image/png', 10, repeat('c', 64),
       'images/collections/preserved.png', 'https://cdn.test/collections/preserved.png', 'user_to_erase');
    insert into collection_item_image (
      collection_item_id, position, file_name, content_type, size, sha256,
      object_path, url, uploaded_by_clerk_id
    ) values (
      (select id from collection_item where display_name = 'Erased item'), 0,
      'erased-item.png', 'image/png', 10, repeat('d', 64),
      'images/collection-items/erased.png', 'https://cdn.test/items/erased.png', 'user_to_erase'
    );
    insert into collection_item_image (
      collection_item_id, position, file_name, content_type, size, sha256,
      object_path, url, uploaded_by_clerk_id, deleted_at,
      deleted_by_clerk_id, deleted_by_role
    ) values (
      (select id from collection_item where display_name = 'Preserved item'), 0,
      'preserved-item.png', 'image/png', 10, repeat('e', 64),
      'images/collection-items/preserved.png', 'https://cdn.test/items/preserved.png',
      'user_to_erase', now(), 'user_to_erase', 'owner'
    );

    insert into resource_categories (name, slug, created_by_clerk_id)
    values ('Shared category', 'shared-category', 'user_to_erase');
    insert into resources (uploader_clerk_id, name, description)
    values ('user_to_erase', 'Erased resource', 'delete me');
    insert into resources (
      uploader_clerk_id, name, description, is_private, private_reason,
      privated_at, privated_by_clerk_id, deleted_at, deleted_by_clerk_id,
      deleted_by_role
    ) values (
      'other_user', 'Preserved resource', 'keep me', true, 'moderated',
      now(), 'user_to_erase', now(), 'user_to_erase', 'admin'
    );
    insert into resource_images (
      resource_id, position, file_name, content_type, size, object_path, url
    ) values (
      (select id from resources where name = 'Erased resource'), 0,
      'resource.png', 'image/png', 10, 'images/resources/erased.png',
      'https://cdn.test/resources/erased.png'
    );
    insert into resource_versions (resource_id, version) values
      ((select id from resources where name = 'Erased resource'), 1),
      ((select id from resources where name = 'Preserved resource'), 1);
    insert into resource_files (
      version_id, file_name, content_type, size, object_path, url
    ) values
      ((select id from resource_versions where resource_id = (select id from resources where name = 'Erased resource')),
       'erased.pdf', 'application/pdf', 10, 'resources/files/erased.pdf', 'https://cdn.test/files/erased.pdf'),
      ((select id from resource_versions where resource_id = (select id from resources where name = 'Preserved resource')),
       'preserved.pdf', 'application/pdf', 10, 'resources/files/preserved.pdf', 'https://cdn.test/files/preserved.pdf');
    insert into resource_downloads (version_id, file_id)
      select rv.id, rf.id from resource_versions rv
      join resource_files rf on rf.version_id = rv.id
      join resources r on r.id = rv.resource_id
      where r.name = 'Preserved resource';
    insert into resources_to_categories (resource_id, category_id) values (
      (select id from resources where name = 'Preserved resource'),
      (select id from resource_categories where slug = 'shared-category')
    );
    insert into resource_notifications (
      type, resource_id, uploader_clerk_id
    ) values (
      'resource_created', (select id from resources where name = 'Erased resource'),
      'user_to_erase'
    );
    insert into resource_notifications (
      type, resource_id, uploader_clerk_id, read_at, read_by_clerk_id
    ) values (
      'resource_created', (select id from resources where name = 'Preserved resource'),
      'other_user', now(), 'user_to_erase'
    );

    insert into feedback (submitter_clerk_id, title, description)
    values
      ('user_to_erase', 'Erased feedback', 'delete me'),
      ('other_user', 'Preserved feedback', 'keep me');
    insert into feedback_votes (feedback_id, voter_clerk_id) values
      ((select id from feedback where title = 'Erased feedback'), 'other_user'),
      ((select id from feedback where title = 'Preserved feedback'), 'user_to_erase');
    insert into feedback_notifications (
      feedback_id, type, read_at, read_by_clerk_id
    ) values (
      (select id from feedback where title = 'Preserved feedback'),
      'submitted', now(), 'user_to_erase'
    );

    insert into feature_flags (
      id, slug, name, audience, archived_at, archived_by_clerk_id,
      created_by_clerk_id, updated_by_clerk_id
    ) values (
      '00000000-0000-4000-8000-000000000001', 'shared-flag', 'Shared flag',
      'user', now(), 'user_to_erase', 'user_to_erase', 'user_to_erase'
    );
    insert into feature_flag_user_overrides (
      id, flag_id, user_id, source, enabled,
      created_by_clerk_id, updated_by_clerk_id
    ) values
      ('00000000-0000-4000-8000-000000000002',
       '00000000-0000-4000-8000-000000000001',
       (select id from users where clerk_id = 'user_to_erase'),
       'user', true, 'user_to_erase', 'user_to_erase'),
      ('00000000-0000-4000-8000-000000000003',
       '00000000-0000-4000-8000-000000000001',
       (select id from users where clerk_id = 'other_user'),
       'admin', true, 'user_to_erase', 'user_to_erase');

    insert into upload_session (
      id, uploader_clerk_id, target_type, target_id, expires_at, payload
    ) values (
      '00000000-0000-4000-8000-000000000004', 'user_to_erase',
      'resource', (select id from resources where name = 'Erased resource'),
      now() + interval '1 hour', '{"personal":"payload"}'::jsonb
    );
    insert into upload_file (
      id, session_id, kind, position, file_name, content_type, size, sha256,
      object_path, url
    ) values (
      '00000000-0000-4000-8000-000000000005',
      '00000000-0000-4000-8000-000000000004', 'file', 0,
      'staged.txt', 'text/plain', 10, repeat('f', 64),
      'staged/private.txt', 'https://cdn.test/staged/private.txt'
    );
  `);
}
