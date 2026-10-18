import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSearchService } from "./index.js";

describe("public search integration", () => {
  const client = new PGlite();
  const db = drizzle({ client });
  const service = createSearchService(db as unknown as Database);

  beforeAll(async () => {
    await migrate(db, {
      migrationsFolder: fileURLToPath(
        new URL("../../../../database/drizzle/", import.meta.url),
      ),
    });
    await client.exec(`
      INSERT INTO users (clerk_id, username) VALUES ('search-person', 'SearchPerson');
      INSERT INTO makers (name, slug) VALUES ('Café Search Maker', 'cafe-search-maker');
      INSERT INTO product_types (name, slug) VALUES ('Search Writing Tool', 'search-writing-tool');
      INSERT INTO product (
        product_type_id, maker_id, name, slug, description,
        approval_status, is_private
      ) SELECT pt.id, m.id, 'Bolt', 'bolt', 'A precise titanium pen', 'approved', false
        FROM product_types pt CROSS JOIN makers m
        WHERE pt.slug = 'search-writing-tool' AND m.slug = 'cafe-search-maker';
      INSERT INTO product (
        product_type_id, maker_id, name, slug, description,
        approval_status, is_private
      ) SELECT pt.id, m.id, 'Bolt Action', 'bolt-action', 'A brass pen', 'approved', false
        FROM product_types pt CROSS JOIN makers m
        WHERE pt.slug = 'search-writing-tool' AND m.slug = 'cafe-search-maker';
      INSERT INTO product (
        product_type_id, maker_id, name, slug, description,
        approval_status, is_private
      ) SELECT pt.id, m.id, 'Smør Pen', 'smor-pen', 'A normalized name', 'approved', false
        FROM product_types pt CROSS JOIN makers m
        WHERE pt.slug = 'search-writing-tool' AND m.slug = 'cafe-search-maker';
    `);
  }, 60_000);

  afterAll(async () => {
    await client.close();
  });

  it("ranks exact titles before prefixes and supports accent-insensitive prefixes", async () => {
    await expect(
      service.search({ group: "products", query: "bolt", surface: "page" }),
    ).resolves.toMatchObject({
      items: [{ title: "Bolt" }, { title: "Bolt Action" }],
      total: 2,
    });
    await expect(
      service.search({ query: "café bo", surface: "modal" }),
    ).resolves.toMatchObject({ total: 2 });
    await expect(
      service.search({ query: "smør", surface: "modal" }),
    ).resolves.toMatchObject({ items: [{ title: "Smør Pen" }], total: 1 });
  });

  it("supports phrases and exclusions without exposing private records", async () => {
    await expect(
      service.search({
        query: '"precise titanium" -brass',
        surface: "page",
      }),
    ).resolves.toMatchObject({ items: [{ title: "Bolt" }], total: 1 });

    await client.exec(
      "UPDATE product SET is_private = true WHERE name = 'Bolt'",
    );
    await expect(
      service.search({ query: "bolt", surface: "page" }),
    ).resolves.toMatchObject({ items: [{ title: "Bolt Action" }], total: 1 });
  });

  it("finds public people by username", async () => {
    await expect(
      service.search({
        group: "people",
        query: "searchperson",
        surface: "page",
      }),
    ).resolves.toMatchObject({
      items: [
        {
          href: "/users/SearchPerson",
          kind: "person",
          title: "SearchPerson",
        },
      ],
      total: 1,
    });
  });
});
