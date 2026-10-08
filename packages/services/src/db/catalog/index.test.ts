import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger, type LogEvent, loggerMessages } from "@package/logger";
import { describe, expect, it, vi } from "vitest";
import {
  assertValidFinishOptions,
  CollectionButtonAlreadyInstalledError,
  createCatalogService,
  createCollectionsService,
  normalizeCollectionName,
  resolveEffectiveSliderSetup,
} from "./index.js";

/**
 * Creates a test actor.
 *
 * @param clerkId - Clerk user identifier for the test actor.
 * @param role - Permission role assigned to the actor.
 * @returns Test actor identity.
 */
const actor = (
  clerkId: string,
  role: "user" | "admin" | "system_admin" = "user",
) => ({ clerkId, role }) as const;

/**
 * Creates a representative catalog lookup through the requested service method.
 *
 * @param service - Catalog service under test.
 * @param kind - Lookup kind to create.
 * @returns Promise for the created lookup.
 * @rejects When the selected catalog creation fails.
 */
function createLookup(
  service: ReturnType<typeof createCatalogService>,
  kind: "color" | "finish" | "maker" | "material" | "pattern",
) {
  switch (kind) {
    case "color":
      return service.createColor({
        actor: actor("user-secret", "admin"),
        hex: "#CD7F32",
        name: "bronze",
        slug: "bronze-2",
      });
    case "finish":
      return service.createFinish({
        actor: actor("user-secret", "admin"),
        name: "bronze",
        slug: "bronze-2",
      });
    case "maker":
      return service.createMaker({
        actor: actor("user-secret", "admin"),
        name: "bronze",
        rootUrl: null,
      });
    case "material":
      return service.createMaterial({
        actor: actor("user-secret", "admin"),
        name: "bronze",
      });
    case "pattern":
      return service.createPattern({
        actor: actor("user-secret", "admin"),
        name: "bronze",
        slug: "bronze-2",
      });
  }
}

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

describe("effective owned slider setup", () => {
  const configuration = {
    groups: [],
    label: "Catalog layout",
    slots: [
      {
        documentedColumn: null,
        documentedRow: null,
        groupKey: null,
        half: "half-a" as const,
        key: "A1",
        state: "empty" as const,
      },
    ],
    sourceLabel: null,
    sourceNotes: null,
  };
  it("uses the slider body setup when present", () => {
    expect(
      resolveEffectiveSliderSetup({
        bodyHostedSetup: {
          clickCount: 5,
          configuration,
          sourceNote: null,
        },
        installedInsertProductId: null,
        ownedInsertSetup: null,
      }),
    ).toMatchObject({
      clickCount: 5,
      source: "body-hosted",
    });
  });

  it("lets a partial owned snapshot win without filling catalog gaps", () => {
    expect(
      resolveEffectiveSliderSetup({
        bodyHostedSetup: null,
        installedInsertProductId: 3000,
        ownedInsertSetup: {
          clickCount: null,
          configuration: null,
          sourceOfferId: null,
        },
      }),
    ).toEqual({
      clickCount: null,
      configuration: null,
      isLiveCatalog: false,
      source: "owned-insert",
    });
  });

  it("does not invent an insert setup", () => {
    expect(
      resolveEffectiveSliderSetup({
        bodyHostedSetup: null,
        installedInsertProductId: null,
        ownedInsertSetup: null,
      }),
    ).toMatchObject({ isLiveCatalog: false, source: "not-recorded" });
  });
});

/**
 * Creates catalog service test doubles with queued query results.
 *
 * @param returningRows - Queued rows returned by write statements.
 * @param selectRows - Queued rows returned by select statements.
 * @param spinnerUpdateError - Optional failure injected into spinner updates.
 * @returns Test service, captured writes, and query controls.
 */
function setup(
  returningRows: unknown[][],
  selectRows: unknown[][],
  spinnerUpdateError?: unknown,
) {
  const updates: Array<{
    /**
     * Table passed to the query builder.
     */
    table: unknown;
    /**
     * Values written by the query builder.
     */
    value: unknown;
  }> = [];
  const writes: Array<{
    /**
     * Table passed to the query builder.
     */
    table: unknown;
    /**
     * Values written by the query builder.
     */
    value: unknown;
  }> = [];
  /**
   * Creates a chainable Drizzle query stub.
   *
   * @returns Chainable query stub.
   */
  const query = () => {
    /**
     * Returns and removes the next queued select result.
     *
     * @returns Next queued select result.
     */
    const take = async () => selectRows.shift() ?? [];
    const chain: Record<string, unknown> = {
      // biome-ignore lint/suspicious/noThenProperty: Drizzle queries are awaitable thenables.
      /**
       * Delegates awaitable query resolution to the next result.
       *
       * @param resolve - Callback receiving the next queued rows.
       * @param reject - Callback receiving a query-stub failure.
       * @returns Promise produced by the queued result.
       */
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
  /**
   * Creates a tracked update-query stub.
   *
   * @param table - Schema table targeted by the update.
   * @returns Tracked update-query stub.
   */
  const update = (table: unknown) => ({
    set: vi.fn((value: unknown) => {
      updates.push({ table, value });
      return {
        where: vi.fn(async () => {
          if (
            table === schema.collectionSpinner &&
            spinnerUpdateError &&
            "installedButtonId" in (value as object)
          ) {
            throw spinnerUpdateError;
          }
          return [];
        }),
      };
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
  const audit = { redactAccount: vi.fn(), write: vi.fn() };

  return {
    db,
    service: createCollectionsService(
      db,
      users as never,
      audit as never,
      logger,
    ),
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
        role: "admin",
      }),
    ).resolves.toEqual([]);
  });

  it("uses collection overrides and falls back to product details", async () => {
    const baseRow = {
      bearingOverride: null,
      buttonId: null,
      collectionId: 900,
      collectionIsPrivate: false,
      collectionItemId: 2001,
      collectionName: "Daily Carry",
      colorEffectId: null,
      colorEffectName: null,
      colorEffectSlug: null,
      descriptionOverride: null,
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
      productBearing: "R188",
      productDescription: "**Fast** spinner",
      productId: 1100,
      productSlug: "catla",
      productTypeName: "Spinner",
      sourceProductFinishOptionId: null,
      spinnerId: 2001,
      updatedAt: new Date("2026-09-23"),
    };
    const { service } = setup(
      [],
      [
        [
          baseRow,
          {
            ...baseRow,
            bearingOverride: "One Drop",
            collectionItemId: 2002,
            descriptionOverride: "Collection **override**",
          },
        ],
        [],
        [],
      ],
    );

    await expect(service.listProductItems(1100)).resolves.toEqual([
      expect.objectContaining({
        bearing: "R188",
        bearingOverride: null,
        description: "**Fast** spinner",
        descriptionOverride: null,
      }),
      expect.objectContaining({
        bearing: "One Drop",
        bearingOverride: "One Drop",
        description: "Collection **override**",
        descriptionOverride: "Collection **override**",
      }),
    ]);
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
      service.listOwnedCollections(actor("user-secret", "admin")),
    ).resolves.toEqual([]);
  });

  it("treats an admin changing their own collection as an owner action", async () => {
    const { service, updates } = setup(
      [],
      [[{ isPrivate: false, ownerId: 1000, privatedByClerkId: null }]],
    );

    await expect(
      service.setCollectionVisibility({
        actor: actor("user-secret", "admin"),
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
        actor: actor("user-secret", "admin"),
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
        [{ colorEffectId: null, patternId: 1203 }],
        [{ finishId: 1202, position: 0 }],
        [],
        [{ materialId: 1101 }],
        [{ colorEffectId: null, patternId: 1103 }],
        [{ finishId: 1102, position: 0 }],
        [],
      ],
    );

    await expect(
      service.addSpinner({
        actor: actor("user-secret"),
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
            patternId: 1203,
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
        [{ colorEffectId: null, patternId: 1103 }],
        [{ finishId: 1102, position: 0 }],
        [],
      ],
    );

    await expect(
      service.addSpinner({
        actor: actor("user-secret"),
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
          patternId: 1103,
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

  it("stores a collection item without an appearance snapshot", async () => {
    const { service, writes } = setup(
      [[{ id: 2001 }]],
      [[{ id: 900 }], [{ materialId: 1101 }]],
    );

    await expect(
      service.addSpinner({
        actor: actor("user-secret"),
        buttonCustomFinish: null,
        buttonFinishOptionId: null,
        buttonMaterialId: null,
        buttonProductId: null,
        collectionId: 900,
        displayName: "My spinner",
        spinnerCustomFinish: null,
        spinnerFinishOptionId: null,
        spinnerMaterialId: 1101,
        spinnerProductId: 1100,
      }),
    ).resolves.toEqual({ buttonItemId: null, spinnerItemId: 2001 });

    expect(writes.some(({ table }) => table === schema.finishOption)).toBe(
      false,
    );
  });

  it("stores a private custom finish with ordered fade colors", async () => {
    const { service, writes } = setup(
      [[{ id: 2000 }], [{ id: 3000 }]],
      [[{ id: 900 }], [{ materialId: 1201 }], [{ id: 10, slug: "fade" }]],
    );

    await expect(
      service.addSpinnerButton({
        actor: actor("user-secret"),
        customFinish: {
          colorEffectId: 10,
          colorIds: [22, 21],
          finishIds: [31, 32],
          patternId: 33,
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
            patternId: 33,
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
        actor: actor("other-user"),
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
        actor: actor("user-secret"),
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

  it("returns a domain error when a button is already installed", async () => {
    const { service } = setup(
      [],
      [
        [
          {
            buttonProductId: null,
            collectionId: 900,
            installedButtonId: null,
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
      new Error("Query failed", {
        cause: {
          code: "23505",
          constraint: "collection_spinner_installed_button_unique",
        },
      }),
    );

    const error = await service
      .updateItem({
        actor: actor("user-secret"),
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
      })
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(CollectionButtonAlreadyInstalledError);
    expect(error).toHaveProperty(
      "message",
      "Collection button is already installed on another spinner.",
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
      actor: actor("user-secret"),
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
        actor: actor("user-secret"),
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
        actor: actor("user-secret"),
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
  it("creates product source details as valid", async () => {
    const { db, writes } = setup(
      [[{ id: 900 }], [{ id: 5000 }]],
      [[{ id: 1000 }]],
    );
    const service = createCatalogService(
      db,
      createLogger({ app: "api", environment: "test" }),
    );
    service.getProduct = vi.fn().mockResolvedValue({
      bearing: "R188",
      description: "**Fast** spinner",
      id: 900,
      makerProductUrl: "https://maker.example/spinner",
      makerProductUrlValid: true,
      spinDiameterMm: "52",
    } as never);

    await expect(
      service.createProduct({
        actor: actor("user-secret"),
        description: "**Fast** spinner",
        finishOptions: [
          {
            colorEffectId: null,
            colorIds: [],
            finishIds: [1000],
          },
        ],
        makerId: 100,
        makerProductUrl: " https://maker.example/spinner/ ",
        materialIds: [1000],
        name: "Catla",
        productTypeSlug: "spinner",
        slug: "catla",
        specs: { bearing: " R188 ", spinDiameterMm: "52" },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        bearing: "R188",
        description: "**Fast** spinner",
        makerProductUrl: "https://maker.example/spinner",
        makerProductUrlValid: true,
        spinDiameterMm: "52",
      }),
    );
    expect(writes).toEqual(
      expect.arrayContaining([
        {
          table: schema.product,
          value: expect.objectContaining({
            description: "**Fast** spinner",
            makerProductUrl: "https://maker.example/spinner",
            makerProductUrlValid: true,
          }),
        },
        {
          table: schema.productSpinner,
          value: expect.objectContaining({
            bearing: "R188",
            spinDiameterMm: "52",
          }),
        },
      ]),
    );
  });

  it("reads product source details", async () => {
    const { db } = setup(
      [],
      [
        [
          {
            bearing: "R188",
            createdAt: new Date(0),
            description: "**Fast** spinner",
            id: 900,
            isPrivate: false,
            makerId: 100,
            makerName: "Maker",
            makerProductUrl: "https://maker.example/spinner",
            makerProductUrlValid: false,
            name: "Catla",
            ownerClerkId: "user-secret",
            privatedByClerkId: null,
            productTypeId: 1000,
            productTypeName: "Spinner",
            productTypeSlug: "spinner",
            slug: "catla",
            spinDiameterMm: "52",
            updatedAt: new Date(0),
          },
        ],
        [],
        [],
      ],
    );
    const service = createCatalogService(
      db,
      createLogger({ app: "api", environment: "test" }),
    );

    await expect(service.getProduct("spinner", "catla")).resolves.toEqual(
      expect.objectContaining({
        bearing: "R188",
        description: "**Fast** spinner",
        makerProductUrl: "https://maker.example/spinner",
        makerProductUrlValid: false,
        spinDiameterMm: "52",
      }),
    );
  });

  it.each([
    {
      existingMakerProductUrl: "https://maker.example/original/",
      expectedValidity: false,
      makerProductUrl: "https://maker.example/original",
      name: "preserves invalidity when the URL is unchanged",
    },
    {
      existingMakerProductUrl: "https://maker.example/original",
      expectedValidity: true,
      makerProductUrl: "https://maker.example/replacement",
      name: "resets validity when the URL changes",
    },
    {
      existingMakerProductUrl: "https://maker.example/original",
      expectedValidity: undefined,
      makerProductUrl: undefined,
      name: "leaves validity untouched for unrelated edits",
    },
  ])("$name", async ({
    existingMakerProductUrl,
    expectedValidity,
    makerProductUrl,
  }) => {
    const { db, updates } = setup(
      [[{ id: 5000 }]],
      [
        [
          {
            id: 900,
            makerProductUrl: existingMakerProductUrl,
            makerProductUrlValid: false,
            ownerClerkId: "user-secret",
          },
        ],
      ],
    );
    const service = createCatalogService(
      db,
      createLogger({ app: "api", environment: "test" }),
    );
    service.getProduct = vi.fn().mockResolvedValue({ id: 900 } as never);

    await service.updateProduct({
      actor: actor("user-secret"),
      description: "Updated **description**",
      finishOptions: [
        {
          colorEffectId: null,
          colorIds: [],
          finishIds: [1000],
        },
      ],
      makerId: 100,
      makerProductUrl,
      materialIds: [1000],
      name: "Catla edited",
      productId: 900,
      productTypeSlug: "spinner",
      slug: "catla-edited",
      specs: { bearing: " One Drop ", spinDiameterMm: "54" },
    });

    const value = updates.find(({ table }) => table === schema.product)
      ?.value as Record<string, unknown>;
    expect(value).toEqual(
      expect.objectContaining({ description: "Updated **description**" }),
    );
    expect(
      updates.find(({ table }) => table === schema.productSpinner)?.value,
    ).toEqual(
      expect.objectContaining({ bearing: "One Drop", spinDiameterMm: "54" }),
    );
    if (expectedValidity === undefined) {
      expect(value).not.toHaveProperty("makerProductUrlValid");
    } else {
      expect(value).toEqual(
        expect.objectContaining({ makerProductUrlValid: expectedValidity }),
      );
    }
  });

  it("marks maker product URL validity as a meaningful update", async () => {
    const { db, updates } = setup(
      [],
      [[{ makerProductUrlValid: true, ownerUserId: 1000 }]],
    );
    const service = createCatalogService(
      db,
      createLogger({ app: "api", environment: "test" }),
    );

    await service.setMakerProductUrlValidity({
      actor: actor("admin-secret", "admin"),
      makerProductUrlValid: false,
      productId: 900,
      reason: "Broken source link",
    });

    expect(updates).toContainEqual({
      table: schema.product,
      value: {
        makerProductUrlValid: false,
        updatedAt: expect.any(Date),
      },
    });
  });

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
        actor: actor("user-secret", "admin"),
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
      actor: actor("user-secret", "admin"),
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
          leftJoin: vi.fn(() => query),
          where: vi.fn(() => query),
          limit: vi.fn().mockResolvedValue(rows),
        };
        return query;
      }),
      transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback(db),
      ),
      update,
    } as unknown as Database;
    const service = createCatalogService(
      db,
      createLogger({ app: "api", environment: "test" }),
      {
        getByClerkId: vi.fn().mockResolvedValue({ id: 1000, username: null }),
      } as never,
      { write: vi.fn() } as never,
    );

    await expect(
      service.softDeleteImage({
        actor: actor("user-secret"),
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
    "pattern",
  ] as const)("rejects a case-insensitive duplicate %s name", async (kind) => {
    const insert = vi.fn();
    const db = {
      execute: vi.fn(),
      insert,
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ id: 1000 }]),
          })),
        })),
      })),
      transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback(db),
      ),
    } as unknown as Database;
    const service = createCatalogService(
      db,
      createLogger({ app: "api", environment: "test" }),
    );

    const result = createLookup(service, kind);

    await expect(result).rejects.toThrow(/already exists/i);
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    ["color", "color_name_case_insensitive_unique", "Color"],
    ["finish", "finish_name_case_insensitive_unique", "Finish"],
    ["maker", "makers_name_case_insensitive_unique", "Maker"],
    ["material", "materials_name_case_insensitive_unique", "Material"],
    ["pattern", "pattern_name_case_insensitive_unique", "Pattern"],
  ] as const)("maps a concurrent duplicate %s name to the existing domain error", async (kind, constraint, label) => {
    const databaseError = new Error("Query failed", {
      cause: { code: "23505", constraint },
    });
    const db = {
      execute: vi.fn().mockResolvedValue([]),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockRejectedValue(databaseError),
        })),
      })),
      select: vi.fn((fields: Record<string, unknown>) => ({
        from: vi.fn(() =>
          Object.hasOwn(fields, "slug")
            ? Promise.resolve([])
            : {
                where: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue([]),
                })),
              },
        ),
      })),
      transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback(db),
      ),
    } as unknown as Database;
    const service = createCatalogService(
      db,
      createLogger({ app: "api", environment: "test" }),
    );

    await expect(createLookup(service, kind)).rejects.toThrow(
      `${label} name already exists.`,
    );
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
            patternId: null,
          },
        ],
        effects,
      ),
    ).not.toThrow();
  });

  it("accepts no appearance options and a pattern-only option", () => {
    expect(() => assertValidFinishOptions([], effects)).not.toThrow();
    expect(() =>
      assertValidFinishOptions(
        [
          {
            colorEffectId: null,
            colorIds: [],
            finishIds: [],
            patternId: 1002,
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
      patternId: null,
    },
    {
      colorEffectId: 1001,
      colorIds: [1000],
      finishIds: [1000],
      patternId: null,
    },
    {
      colorEffectId: 1000,
      colorIds: [1000, 1001],
      finishIds: [1000],
      patternId: null,
    },
    {
      colorEffectId: null,
      colorIds: [],
      finishIds: [1000, 1000],
      patternId: null,
    },
  ])("rejects an invalid option", (option) => {
    expect(() => assertValidFinishOptions([option], effects)).toThrow();
  });

  it("rejects duplicate options", () => {
    const option = {
      colorEffectId: null,
      colorIds: [] as number[],
      finishIds: [1000],
      patternId: null,
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
          /**
           * Captures a structured log event for assertions.
           *
           * @param event - Event.
           */
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
      {
        getByClerkId: vi.fn().mockResolvedValue({ id: 1000, username: null }),
      } as never,
      { write: vi.fn() } as never,
    );
    const uploadActor = actor("private-owner");
    await service.attachImages({
      actor: uploadActor,
      target: { type: "product", id: 1 },
      files: [],
    });
    await service.selectCollectionCover({
      actor: uploadActor,
      collectionId: 1,
      imageId: null,
    });
    const failure = new Error(
      "SQL parameters: private-owner private-filename.jpg",
    );
    transaction.mockRejectedValueOnce(failure);
    await expect(
      service.selectCollectionCover({
        actor: uploadActor,
        collectionId: 1,
        imageId: null,
      }),
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
