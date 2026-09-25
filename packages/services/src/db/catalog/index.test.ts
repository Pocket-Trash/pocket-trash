import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger, type LogEvent, loggerMessages } from "@package/logger";
import { describe, expect, it, vi } from "vitest";
import {
  assertValidFinishOptions,
  createCatalogService,
  createCollectionsService,
  normalizeCollectionName,
} from "./index.js";

describe("collection name normalization", () => {
  it("collapses case, spacing, punctuation, and diacritics", () => {
    expect(["Roy's", " roys ", "RÓY’S"].map(normalizeCollectionName)).toEqual([
      "roys",
      "roys",
      "roys",
    ]);
    expect(normalizeCollectionName(" --- ")).toBe("");
  });
});

function setup(returningRows: unknown[][], selectRows: unknown[][]) {
  const updates: Array<{ table: unknown; value: unknown }> = [];
  const writes: Array<{ table: unknown; value: unknown }> = [];
  const query = () => {
    const take = async () => selectRows.shift() ?? [];
    const chain: Record<string, unknown> = {
      // biome-ignore lint/suspicious/noThenProperty: Drizzle queries are awaitable thenables.
      then: (
        resolve: (value: unknown[]) => unknown,
        reject: (reason: unknown) => unknown,
      ) => take().then(resolve, reject),
    };
    for (const method of [
      "from",
      "groupBy",
      "innerJoin",
      "leftJoin",
      "orderBy",
      "where",
    ]) {
      chain[method] = vi.fn(() => chain);
    }
    chain.limit = vi.fn(take);
    return chain;
  };
  const update = (table: unknown) => ({
    set: vi.fn((value: unknown) => {
      updates.push({ table, value });
      return { where: vi.fn(async () => []) };
    }),
  });
  const tx = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((value: unknown) => {
        if (table !== schema.userCollection) writes.push({ table, value });
        return {
          onConflictDoNothing: vi.fn(async () => []),
          returning: vi.fn(async () => returningRows.shift() ?? []),
        };
      }),
    })),
    delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
    select: vi.fn(query),
    update: vi.fn(update),
  };
  const db = {
    select: vi.fn(query),
    transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
    ),
    update: vi.fn(update),
  } as unknown as Database;
  const users = {
    ensure: vi.fn().mockResolvedValue({ clerkId: "user-secret", id: 1000 }),
    getByClerkId: vi.fn().mockResolvedValue({
      clerkId: "user-secret",
      id: 1000,
    }),
  };
  const logger = createLogger({ app: "api", environment: "test" });

  return {
    db,
    service: createCollectionsService(db, users as never, logger),
    updates,
    users,
    writes,
  };
}

describe("collection catalog writes", () => {
  it("excludes private collections from product relationships", async () => {
    const { service } = setup(
      [],
      [
        [
          {
            buttonId: null,
            collectionId: 900,
            collectionIsPrivate: true,
            collectionItemId: 2001,
            collectionName: "Private collection",
            colorEffectId: null,
            colorEffectName: null,
            colorEffectSlug: null,
            displayName: "My spinner",
            finishOptionId: null,
            installedButtonId: null,
            isPrivate: false,
            makerId: 100,
            makerName: "KAP EDC",
            makerUrl: null,
            materialId: null,
            materialName: null,
            materialSlug: null,
            name: "Catla",
            ownerClerkId: "user-secret",
            ownerUserId: 1000,
            ownerUsername: "ranger",
            privatedByClerkId: null,
            productId: 1100,
            productSlug: "catla",
            productTypeName: "Spinner",
            sourceProductFinishOptionId: null,
            spinnerId: 2001,
            updatedAt: new Date("2026-09-23"),
          },
        ],
        [],
        [],
      ],
    );

    await expect(
      service.listProductItems(1100, {
        clerkId: "user-secret",
        isAdmin: true,
      }),
    ).resolves.toEqual([]);
  });

  it("lists public collections that have no public items", async () => {
    const createdAt = new Date("2026-09-23T22:59:55.454Z");
    const updatedAt = new Date("2026-09-23T23:02:19.572Z");
    const { service } = setup(
      [],
      [
        [],
        [
          {
            createdAt,
            description: null,
            id: 1000,
            isPrivate: false,
            name: "Roy's Collection",
            ownerClerkId: "user-secret",
            ownerUserId: 1015,
            privatedByClerkId: null,
            updatedAt,
          },
        ],
        [],
        [],
        [{ clerkId: "user-secret", userId: 1015, username: null }],
      ],
    );

    await expect(service.listOwners()).resolves.toEqual([
      expect.objectContaining({
        collections: [
          expect.objectContaining({ id: 1000, name: "Roy's Collection" }),
        ],
        itemCount: 0,
        items: [],
        userId: 1015,
        username: "user-secret",
      }),
    ]);
  });

  it("keeps an admin personal collection list scoped to that admin", async () => {
    const { service } = setup(
      [],
      [
        [
          {
            createdAt: new Date("2026-09-23"),
            description: null,
            id: 1001,
            isPrivate: false,
            name: "ranger's Collection",
            ownerClerkId: "other-user",
            ownerUserId: 1015,
            privatedByClerkId: null,
            updatedAt: new Date("2026-09-23"),
          },
        ],
        [],
        [],
      ],
    );

    await expect(
      service.listOwnedCollections("user-secret", true),
    ).resolves.toEqual([]);
  });

  it("treats an admin changing their own collection as an owner action", async () => {
    const { service, updates } = setup(
      [],
      [[{ isPrivate: false, ownerId: 1000, privatedByClerkId: null }]],
    );

    await expect(
      service.setCollectionVisibility({
        actorClerkId: "user-secret",
        actorIsAdmin: true,
        collectionId: 900,
        isPrivate: true,
      }),
    ).resolves.toBeUndefined();

    expect(updates[0]?.value).toEqual(
      expect.objectContaining({ isPrivate: true, privateReason: "" }),
    );
  });

  it("treats an admin changing their own collection item as an owner action", async () => {
    const { service, updates } = setup(
      [],
      [[{ ownerId: 1000, privatedByClerkId: null }]],
    );

    await expect(
      service.setItemVisibility({
        actorClerkId: "user-secret",
        actorIsAdmin: true,
        collectionItemId: 900,
        isPrivate: true,
      }),
    ).resolves.toBeUndefined();

    expect(updates[0]?.value).toEqual(
      expect.objectContaining({ isPrivate: true, privateReason: "" }),
    );
  });

  it("uses the synchronized username for the default collection name", async () => {
    const { service } = setup([], [[{ username: "royanger" }]]);

    await expect(service.getDefaultCollectionName("user-secret")).resolves.toBe(
      "royanger's Collection",
    );
  });

  it("rejects automatic collection creation while user sync is incomplete", async () => {
    const { service } = setup([], [[]]);

    await expect(
      service.getDefaultCollectionName("user-secret"),
    ).rejects.toThrow(/sync is incomplete/i);
  });

  it("creates a spinner with its custom owned button in one transaction", async () => {
    const { db, service, writes } = setup(
      [[{ id: 2000 }], [{ id: 3000 }], [{ id: 2001 }], [{ id: 3001 }]],
      [
        [{ id: 900 }],
        [{ materialId: 1201 }],
        [{ colorEffectId: null }],
        [{ finishId: 1202, position: 0 }],
        [],
        [{ materialId: 1101 }],
        [{ colorEffectId: null }],
        [{ finishId: 1102, position: 0 }],
        [],
      ],
    );

    await expect(
      service.addSpinner({
        actorClerkId: "user-secret",
        buttonCustomFinish: null,
        buttonFinishOptionId: 1202,
        buttonMaterialId: 1201,
        buttonProductId: 1200,
        collectionId: 900,
        displayName: "My spinner",
        spinnerFinishOptionId: 1102,
        spinnerCustomFinish: null,
        spinnerMaterialId: 1101,
        spinnerProductId: 1100,
      }),
    ).resolves.toEqual({ buttonItemId: 2000, spinnerItemId: 2001 });

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(writes).toEqual(
      expect.arrayContaining([
        {
          table: schema.collectionItem,
          value: { collectionId: 900, materialId: 1201, ownerId: 1000 },
        },
        {
          table: schema.collectionSpinnerButton,
          value: { id: 2000, productSpinnerButtonId: 1200 },
        },
        {
          table: schema.finishOption,
          value: {
            collectionItemId: 2000,
            colorEffectId: null,
            position: 0,
            sourceProductFinishOptionId: 1202,
          },
        },
        {
          table: schema.collectionItem,
          value: {
            collectionId: 900,
            displayName: "My spinner",
            materialId: 1101,
            ownerId: 1000,
          },
        },
        {
          table: schema.collectionSpinner,
          value: {
            id: 2001,
            installedButtonId: 2000,
            productSpinnerId: 1100,
          },
        },
      ]),
    );
  });

  it("creates no button row for the default spinner button", async () => {
    const { service, writes } = setup(
      [[{ id: 2001 }], [{ id: 3001 }]],
      [
        [{ id: 900 }],
        [{ materialId: 1101 }],
        [{ colorEffectId: null }],
        [{ finishId: 1102, position: 0 }],
        [],
      ],
    );

    await expect(
      service.addSpinner({
        actorClerkId: "user-secret",
        buttonCustomFinish: null,
        buttonFinishOptionId: null,
        buttonMaterialId: null,
        buttonProductId: null,
        collectionId: 900,
        displayName: "My spinner",
        spinnerFinishOptionId: 1102,
        spinnerCustomFinish: null,
        spinnerMaterialId: 1101,
        spinnerProductId: 1100,
      }),
    ).resolves.toEqual({ buttonItemId: null, spinnerItemId: 2001 });

    expect(writes).toEqual([
      {
        table: schema.collectionItem,
        value: {
          collectionId: 900,
          displayName: "My spinner",
          materialId: 1101,
          ownerId: 1000,
        },
      },
      {
        table: schema.collectionSpinner,
        value: {
          id: 2001,
          installedButtonId: null,
          productSpinnerId: 1100,
        },
      },
      {
        table: schema.finishOption,
        value: {
          collectionItemId: 2001,
          colorEffectId: null,
          position: 0,
          sourceProductFinishOptionId: 1102,
        },
      },
      {
        table: schema.finishOptionFinish,
        value: [{ finishId: 1102, finishOptionId: 3001, position: 0 }],
      },
    ]);
  });

  it("stores a private custom finish with ordered fade colors", async () => {
    const { service, writes } = setup(
      [[{ id: 2000 }], [{ id: 3000 }]],
      [[{ id: 900 }], [{ materialId: 1201 }], [{ id: 10, slug: "fade" }]],
    );

    await expect(
      service.addSpinnerButton({
        actorClerkId: "user-secret",
        customFinish: {
          colorEffectId: 10,
          colorIds: [22, 21],
          finishIds: [31, 32],
        },
        finishOptionId: null,
        collectionId: 900,
        displayName: "My button",
        materialId: 1201,
        productId: 1200,
      }),
    ).resolves.toBe(2000);

    expect(writes).toEqual(
      expect.arrayContaining([
        {
          table: schema.finishOption,
          value: {
            collectionItemId: 2000,
            colorEffectId: 10,
            position: 0,
          },
        },
        {
          table: schema.finishOptionFinish,
          value: [
            { finishId: 31, finishOptionId: 3000, position: 0 },
            { finishId: 32, finishOptionId: 3000, position: 1 },
          ],
        },
        {
          table: schema.finishOptionColor,
          value: [
            { colorId: 22, finishOptionId: 3000, position: 0 },
            { colorId: 21, finishOptionId: 3000, position: 1 },
          ],
        },
      ]),
    );
    const optionWrite = writes.find(
      ({ table }) => table === schema.finishOption,
    )?.value;
    expect(optionWrite).not.toHaveProperty("productId");
    expect(optionWrite).not.toHaveProperty("sourceProductFinishOptionId");
  });

  it("rejects collection edits when the authenticated owner is missing", async () => {
    const { db, service, users } = setup([], []);
    users.getByClerkId.mockResolvedValueOnce(null as never);

    await expect(
      service.updateItem({
        actorClerkId: "other-user",
        collectionItemId: 2001,
        customFinish: null,
        displayName: "My spinner",
        finishOptionId: 1102,
        materialId: 1101,
      }),
    ).rejects.toThrow(/does not exist/i);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("updates spinner and installed button snapshots in one transaction", async () => {
    const { db, service, updates } = setup(
      [],
      [
        [
          {
            buttonProductId: null,
            collectionId: 900,
            installedButtonId: 2000,
            ownerId: 1000,
            spinnerProductId: 1100,
          },
        ],
        [{ id: 900 }],
        [{ materialId: 1101 }],
        [{ id: 3100 }],
        [{ id: 2000, productId: 1200 }],
        [{ materialId: 1201 }],
        [{ id: 3200 }],
      ],
    );

    await expect(
      service.updateItem({
        actorClerkId: "user-secret",
        collectionId: 900,
        collectionItemId: 2001,
        customFinish: null,
        displayName: "My spinner",
        finishOptionId: null,
        installedButton: {
          collectionItemId: 2000,
          customFinish: null,
          finishOptionId: null,
          materialId: 1201,
        },
        materialId: 1101,
      }),
    ).resolves.toBeUndefined();

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(updates).toEqual(
      expect.arrayContaining([
        { table: schema.collectionItem, value: { materialId: 1101 } },
        { table: schema.collectionItem, value: { materialId: 1201 } },
        {
          table: schema.collectionSpinner,
          value: { installedButtonId: 2000 },
        },
      ]),
    );
  });

  it("moves a spinner and its linked items to the selected collection", async () => {
    const { service, updates } = setup(
      [],
      [
        [
          {
            buttonProductId: null,
            collectionId: 900,
            installedButtonId: 2000,
            ownerId: 1000,
            spinnerProductId: 1100,
          },
        ],
        [{ id: 901 }],
        [{ id: 2002 }],
        [{ materialId: 1101 }],
        [{ id: 3100 }],
      ],
    );

    await service.updateItem({
      actorClerkId: "user-secret",
      collectionId: 901,
      collectionItemId: 2001,
      customFinish: null,
      displayName: "My spinner",
      finishOptionId: null,
      materialId: 1101,
    });

    expect(updates).toEqual(
      expect.arrayContaining([
        {
          table: schema.collectionItem,
          value: { collectionId: 901, updatedAt: expect.any(Date) },
        },
      ]),
    );
  });

  it("rejects a material not offered by the selected product", async () => {
    const { service, writes } = setup([], [[{ id: 900 }], []]);

    await expect(
      service.addSpinner({
        actorClerkId: "user-secret",
        buttonCustomFinish: null,
        buttonFinishOptionId: null,
        buttonMaterialId: null,
        buttonProductId: null,
        collectionId: 900,
        displayName: "My spinner",
        spinnerFinishOptionId: 1102,
        spinnerCustomFinish: null,
        spinnerMaterialId: 9999,
        spinnerProductId: 1100,
      }),
    ).rejects.toThrow(/material/i);
    expect(writes).toEqual([]);
  });

  it("rejects a finish option from another product", async () => {
    const { service } = setup(
      [[{ id: 2001 }]],
      [[{ id: 900 }], [{ materialId: 1101 }], []],
    );

    await expect(
      service.addSpinner({
        actorClerkId: "user-secret",
        buttonCustomFinish: null,
        buttonFinishOptionId: null,
        buttonMaterialId: null,
        buttonProductId: null,
        collectionId: 900,
        displayName: "My spinner",
        spinnerFinishOptionId: 9999,
        spinnerCustomFinish: null,
        spinnerMaterialId: 1101,
        spinnerProductId: 1100,
      }),
    ).rejects.toThrow(/finish option/i);
  });
});

describe("catalog lookup writes", () => {
  it("treats an admin changing their own product as an owner action", async () => {
    const { db, updates } = setup(
      [],
      [[{ ownerClerkId: "user-secret", privatedByClerkId: null }]],
    );
    const service = createCatalogService(
      db,
      createLogger({ app: "api", environment: "test" }),
    );

    await expect(
      service.setVisibility({
        actorClerkId: "user-secret",
        actorIsAdmin: true,
        isPrivate: true,
        productId: 900,
      }),
    ).resolves.toBeUndefined();

    expect(updates[0]?.value).toEqual(
      expect.objectContaining({ isPrivate: true, privateReason: "" }),
    );
  });

  it("records an admin deleting their own image as an owner action", async () => {
    const { db, updates } = setup(
      [],
      [[{ deletedAt: null, ownerClerkId: "user-secret" }]],
    );
    const service = createCatalogService(
      db,
      createLogger({ app: "api", environment: "test" }),
    );

    await service.softDeleteImage({
      actorClerkId: "user-secret",
      actorIsAdmin: true,
      imageId: 1000,
      targetType: "product",
    });

    expect(updates[0]?.value).toEqual(
      expect.objectContaining({ deletedByRole: "owner" }),
    );
  });

  it.each([
    "product",
    "collection_item",
  ] as const)("treats an already-deleted %s image as a successful delete", async (targetType) => {
    const update = vi.fn();
    const db = {
      select: vi.fn((fields: Record<string, unknown>) => {
        const rows = Object.hasOwn(fields, "deletedAt")
          ? [
              {
                deletedAt: new Date("2026-09-23T03:57:30.447Z"),
                ownerClerkId: "user-secret",
              },
            ]
          : [];
        const query = {
          from: vi.fn(() => query),
          innerJoin: vi.fn(() => query),
          where: vi.fn(() => query),
          limit: vi.fn().mockResolvedValue(rows),
        };
        return query;
      }),
      update,
    } as unknown as Database;
    const service = createCatalogService(
      db,
      createLogger({ app: "api", environment: "test" }),
    );

    await expect(
      service.softDeleteImage({
        actorClerkId: "user-secret",
        actorIsAdmin: false,
        imageId: 1000,
        targetType,
      }),
    ).resolves.toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    "color",
    "finish",
    "maker",
    "material",
  ] as const)("rejects a case-insensitive duplicate %s name", async (kind) => {
    const insert = vi.fn();
    const db = {
      insert,
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ id: 1000 }]),
          })),
        })),
      })),
    } as unknown as Database;
    const service = createCatalogService(
      db,
      createLogger({ app: "api", environment: "test" }),
    );

    const result = (() => {
      switch (kind) {
        case "color":
          return service.createColor({
            actorClerkId: "user-secret",
            hex: "#CD7F32",
            name: "bronze",
            slug: "bronze-2",
          });
        case "finish":
          return service.createFinish({
            actorClerkId: "user-secret",
            name: "bronze",
            slug: "bronze-2",
          });
        case "maker":
          return service.createMaker({
            actorClerkId: "user-secret",
            name: "bronze",
            rootUrl: null,
          });
        case "material":
          return service.createMaterial({
            actorClerkId: "user-secret",
            name: "bronze",
            slug: "bronze-2",
          });
      }
    })();

    await expect(result).rejects.toThrow(/already exists/i);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("catalog finish validation", () => {
  const effects = [
    { id: 1000, slug: "solid" },
    { id: 1001, slug: "fade" },
  ];

  it("accepts ordered finish and fade components", () => {
    expect(() =>
      assertValidFinishOptions(
        [
          {
            colorEffectId: 1001,
            colorIds: [1000, 1001],
            finishIds: [1000, 1001],
          },
        ],
        effects,
      ),
    ).not.toThrow();
  });

  it.each([
    {
      colorEffectId: null,
      colorIds: [],
      finishIds: [],
    },
    {
      colorEffectId: 1001,
      colorIds: [1000],
      finishIds: [1000],
    },
    {
      colorEffectId: 1000,
      colorIds: [1000, 1001],
      finishIds: [1000],
    },
    {
      colorEffectId: null,
      colorIds: [],
      finishIds: [1000, 1000],
    },
  ])("rejects an invalid option", (option) => {
    expect(() => assertValidFinishOptions([option], effects)).toThrow();
  });

  it("rejects duplicate options", () => {
    const option = {
      colorEffectId: null,
      colorIds: [] as number[],
      finishIds: [1000],
    };
    expect(() => assertValidFinishOptions([option, option], effects)).toThrow(
      /duplicate/i,
    );
  });
});

describe("catalog image operation logging", () => {
  it("logs attachment and cover operations and redacts failures", async () => {
    const events: LogEvent[] = [];
    const logger = createLogger({
      app: "api",
      environment: "test",
      transports: [
        {
          log(event) {
            events.push(event);
          },
        },
      ],
    });
    const transaction = vi.fn(async () => undefined);
    const service = createCatalogService(
      { transaction } as unknown as Database,
      logger,
    );
    const actor = { clerkId: "private-owner", isAdmin: false };
    await service.attachImages({
      actor,
      target: { type: "product", id: 1 },
      files: [],
    });
    await service.selectCollectionCover({
      actor,
      collectionId: 1,
      imageId: null,
    });
    const failure = new Error(
      "SQL parameters: private-owner private-filename.jpg",
    );
    transaction.mockRejectedValueOnce(failure);
    await expect(
      service.selectCollectionCover({ actor, collectionId: 1, imageId: null }),
    ).rejects.toBe(failure);
    await logger.flush();
    expect(events.map((event) => event.message)).toEqual([
      `${loggerMessages.database.catalog.attachImages}.succeeded`,
      `${loggerMessages.database.catalog.selectCollectionCover}.succeeded`,
      `${loggerMessages.database.catalog.selectCollectionCover}.failed`,
    ]);
    for (const event of events)
      expect(event.attributes?.clerkIdHash).toMatch(/^sha256:/u);
    expect(JSON.stringify(events)).not.toContain("private-owner");
    expect(JSON.stringify(events)).not.toContain("private-filename.jpg");
  });
});
