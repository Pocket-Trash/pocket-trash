import type { Database } from "@package/database";
import { describe, expect, it, vi } from "vitest";
import { createSearchService, parseSearchHighlight } from "./index.js";

describe("public search", () => {
  it("turns database match markers into plain structured segments", () => {
    expect(parseSearchHighlight("A \uE000safe <mark>\uE001 result")).toEqual([
      { matched: false, text: "A " },
      { matched: true, text: "safe <mark>" },
      { matched: false, text: " result" },
    ]);
  });

  it("uses fixed surface limits and maps grouped counts", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            context: "Maker",
            headline: "\uE000Bolt\uE001 pen",
            href: "/products/pens/bolt",
            id: "12",
            imageUrl: null,
            kind: "product",
            parentId: null,
            title: "Bolt pen",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "2", group: "products" }] });
    const service = createSearchService({ execute } as unknown as Database);

    await expect(
      service.search({ query: "bolt", surface: "modal" }),
    ).resolves.toEqual({
      counts: {
        all: 2,
        collections: 0,
        makers: 0,
        materials: 0,
        people: 0,
        products: 2,
        resources: 0,
      },
      items: [
        {
          context: "Maker",
          highlights: [
            { matched: true, text: "Bolt" },
            { matched: false, text: " pen" },
          ],
          href: "/products/pens/bolt",
          id: 12,
          kind: "product",
          title: "Bolt pen",
        },
      ],
      page: 1,
      pageSize: 7,
      total: 2,
    });
  });

  it("does not query for fewer than two characters", async () => {
    const execute = vi.fn();
    const service = createSearchService({ execute } as unknown as Database);
    await expect(
      service.search({ query: "a", surface: "page" }),
    ).resolves.toMatchObject({ items: [], pageSize: 10, total: 0 });
    expect(execute).not.toHaveBeenCalled();
  });
});
