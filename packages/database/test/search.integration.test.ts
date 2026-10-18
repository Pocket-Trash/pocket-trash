import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("public search migration", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await migrate(drizzle({ client: database }), {
      migrationsFolder: fileURLToPath(new URL("../drizzle/", import.meta.url)),
    });
  }, 60_000);

  afterAll(async () => {
    await database.close();
  });

  it("creates the normalized search projection and GIN index", async () => {
    await expect(
      database.query(
        "select normalize_search_text('  Café   déjà-vu  ') as normalized",
      ),
    ).resolves.toMatchObject({ rows: [{ normalized: "cafe deja-vu" }] });
    await expect(
      database.query(
        "select indexdef from pg_indexes where tablename = 'search_documents' and indexname = 'search_documents_vector_idx'",
      ),
    ).resolves.toMatchObject({
      rows: [
        {
          indexdef: expect.stringMatching(/using gin \(search_vector\)/iu),
        },
      ],
    });
  });

  it("synchronizes public visibility and repairs projection drift", async () => {
    await database.exec(`
      INSERT INTO makers (name, slug) VALUES ('Café Maker', 'cafe-maker');
      INSERT INTO product (
        product_type_id, maker_id, name, slug, description,
        approval_status, is_private
      ) SELECT pt.id, m.id, 'Bolt Pen', 'bolt-pen', 'A precise pen', 'approved', false
        FROM product_types pt CROSS JOIN makers m
        WHERE pt.slug = 'pen' AND m.slug = 'cafe-maker';
      INSERT INTO product_detail_pen (id)
        SELECT id FROM product WHERE name = 'Bolt Pen';
      INSERT INTO product_types (name, slug, is_part_or_accessory) VALUES
        ('Spinner', 'spinner', false), ('Spinner Button', 'spinner-button', true)
        ON CONFLICT (slug) DO NOTHING;
      INSERT INTO product (
        product_type_id, maker_id, name, slug, approval_status, is_private
      ) SELECT pt.id, m.id, 'Search Spinner', 'search-spinner', 'approved', false
        FROM product_types pt CROSS JOIN makers m
        WHERE pt.slug = 'spinner' AND m.slug = 'cafe-maker';
      INSERT INTO product_detail_spinner (id)
        SELECT id FROM product WHERE name = 'Search Spinner';
      INSERT INTO product (
        product_type_id, maker_id, name, slug, approval_status, is_private
      ) SELECT pt.id, m.id, 'Search Button', 'search-button', 'approved', false
        FROM product_types pt CROSS JOIN makers m
        WHERE pt.slug = 'spinner-button' AND m.slug = 'cafe-maker';
      INSERT INTO product_detail_spinner_button (id)
        SELECT id FROM product WHERE name = 'Search Button';
      INSERT INTO users (clerk_id, username) VALUES ('search-owner', 'search-owner');
      INSERT INTO user_collection (owner_id, name, normalized_name, is_private)
        SELECT id, 'Search Collection', 'search collection', false
        FROM users WHERE clerk_id = 'search-owner';
      INSERT INTO collection_item (
        owner_id, collection_id, display_name, approval_status, is_private
      ) SELECT u.id, c.id, 'My Bolt', 'approved', false
        FROM users u JOIN user_collection c ON c.owner_id = u.id
        WHERE u.clerk_id = 'search-owner' AND c.name = 'Search Collection';
      INSERT INTO collection_detail_pen (id, product_pen_id)
        SELECT i.id, p.id FROM collection_item i CROSS JOIN product p
        WHERE i.display_name = 'My Bolt' AND p.name = 'Bolt Pen';
      INSERT INTO collection_item (
        owner_id, collection_id, display_name, approval_status, is_private
      ) SELECT u.id, c.id, 'My Spinner', 'approved', false
        FROM users u JOIN user_collection c ON c.owner_id = u.id
        WHERE u.clerk_id = 'search-owner' AND c.name = 'Search Collection';
      INSERT INTO collection_item (
        owner_id, collection_id, display_name, approval_status, is_private
      ) SELECT u.id, c.id, 'My Button', 'approved', false
        FROM users u JOIN user_collection c ON c.owner_id = u.id
        WHERE u.clerk_id = 'search-owner' AND c.name = 'Search Collection';
      INSERT INTO collection_detail_spinner_button (id, product_spinner_button_id)
        SELECT i.id, p.id FROM collection_item i CROSS JOIN product p
        WHERE i.display_name = 'My Button' AND p.name = 'Search Button';
      INSERT INTO collection_detail_spinner (id, product_spinner_id, installed_button_id)
        SELECT i.id, p.id, button.id
        FROM collection_item i CROSS JOIN product p CROSS JOIN collection_item button
        WHERE i.display_name = 'My Spinner' AND p.name = 'Search Spinner'
          AND button.display_name = 'My Button';
      INSERT INTO materials (name, slug) VALUES
        ('Search Steel', 'search-steel'), ('Search Brass', 'search-brass');
      INSERT INTO material_specific (material_id, name, slug)
        SELECT id, 'Search Steel Grade', 'search-steel-grade'
        FROM materials WHERE slug = 'search-steel';
      INSERT INTO resources (uploader_clerk_id, name, description, is_private)
        VALUES ('search-owner', 'Search Guide', 'A public guide', false);
    `);

    await expect(
      database.query(
        "select kind, title, href from search_documents where kind = 'product' and title = 'Bolt Pen'",
      ),
    ).resolves.toMatchObject({
      rows: [
        {
          href: "/products/pen/bolt-pen",
          kind: "product",
          title: "Bolt Pen",
        },
      ],
    });
    await expect(
      database.query(`
        select i.display_name, p.name as product_name, i.owned, i.sold_at,
          i.approval_status, i.is_private, p.approval_status as product_status,
          p.is_private as product_private
        from collection_item i
        join collection_item_search_products ip on ip.collection_item_id = i.id
        join product p on p.id = ip.product_id
        where i.display_name in ('My Button', 'My Spinner')
        order by i.display_name
      `),
    ).resolves.toMatchObject({
      rows: [
        { display_name: "My Button", product_name: "Search Button" },
        { display_name: "My Spinner", product_name: "Search Spinner" },
      ],
    });
    await expect(
      database.query(
        "select kind, title from search_documents where kind <> 'product' and (title like 'Search %' or title in ('My Bolt', 'My Button', 'My Spinner', 'search-owner')) order by kind, title",
      ),
    ).resolves.toMatchObject({
      rows: [
        { kind: "collection", title: "Search Collection" },
        { kind: "collection_item", title: "My Bolt" },
        { kind: "collection_item", title: "My Button" },
        { kind: "collection_item", title: "My Spinner" },
        { kind: "material", title: "Search Brass" },
        { kind: "material", title: "Search Steel" },
        { kind: "material_detail", title: "Search Steel Grade" },
        { kind: "person", title: "search-owner" },
        { kind: "resource", title: "Search Guide" },
      ],
    });

    await database.exec(
      "UPDATE collection_item SET is_private = true WHERE display_name = 'My Spinner'",
    );
    await expect(
      database.query(
        "select title from search_documents where title in ('My Button', 'My Spinner')",
      ),
    ).resolves.toMatchObject({ rows: [] });
    await database.exec(
      "UPDATE collection_item SET is_private = false WHERE display_name = 'My Spinner'",
    );

    await database.exec(
      "UPDATE collection_item SET sold_at = now() WHERE display_name = 'My Bolt'",
    );
    await expect(
      database.query("select 1 from search_documents where title = 'My Bolt'"),
    ).resolves.toMatchObject({ rows: [] });
    await database.exec(
      "UPDATE collection_item SET sold_at = null WHERE display_name = 'My Bolt'",
    );

    await database.exec(`
      INSERT INTO material_image (
        material_id, position, file_name, content_type, size, sha256, object_path, url
      ) SELECT id, 0, 'steel.jpg', 'image/jpeg', 10,
          repeat('a', 64), 'search/steel.jpg', 'https://cdn.example/steel.jpg'
        FROM materials WHERE slug = 'search-steel';
    `);
    await expect(
      database.query(
        "select kind, image_url from search_documents where title in ('Search Steel', 'Search Steel Grade') order by kind",
      ),
    ).resolves.toMatchObject({
      rows: [
        { image_url: "https://cdn.example/steel.jpg", kind: "material" },
        {
          image_url: "https://cdn.example/steel.jpg",
          kind: "material_detail",
        },
      ],
    });
    await database.exec(`
      UPDATE material_image SET material_id = (
        SELECT id FROM materials WHERE slug = 'search-brass'
      ) WHERE object_path = 'search/steel.jpg';
    `);
    await expect(
      database.query(
        "select title, image_url from search_documents where title in ('Search Brass', 'Search Steel', 'Search Steel Grade') order by title",
      ),
    ).resolves.toMatchObject({
      rows: [
        { image_url: "https://cdn.example/steel.jpg", title: "Search Brass" },
        { image_url: null, title: "Search Steel" },
        { image_url: null, title: "Search Steel Grade" },
      ],
    });

    await database.exec(`
      UPDATE user_collection SET is_private = true WHERE name = 'Search Collection';
      UPDATE resources SET is_private = true WHERE name = 'Search Guide';
      UPDATE users SET username = null WHERE clerk_id = 'search-owner';
    `);
    await expect(
      database.query(
        "select kind from search_documents where title in ('Search Collection', 'My Bolt', 'Search Guide', 'search-owner')",
      ),
    ).resolves.toMatchObject({ rows: [] });

    await database.exec(
      "UPDATE product SET is_private = true WHERE name = 'Bolt Pen'",
    );
    await expect(
      database.query(
        "select 1 from search_documents where kind = 'product' and title = 'Bolt Pen'",
      ),
    ).resolves.toMatchObject({ rows: [] });

    await database.exec(`
      UPDATE product SET is_private = false WHERE name = 'Bolt Pen';
      DELETE FROM search_documents WHERE kind = 'maker' AND title = 'Café Maker';
      SELECT * FROM reconcile_public_search_documents();
    `);
    await expect(
      database.query(
        "select kind from search_documents where title in ('Bolt Pen', 'Café Maker') order by kind",
      ),
    ).resolves.toMatchObject({
      rows: [{ kind: "maker" }, { kind: "product" }],
    });
    await expect(
      database.query("select * from reconcile_public_search_documents()"),
    ).resolves.toMatchObject({ rows: [{ deleted: 0, upserted: 0 }] });
  });
});
