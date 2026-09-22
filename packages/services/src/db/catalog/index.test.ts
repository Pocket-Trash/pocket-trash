import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { describe, expect, it, vi } from "vitest";
import {
  assertValidFinishOptions,
  createCatalogService,
  createCollectionsService,
} from "./index.js";

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
    update: vi.fn((table: unknown) => ({
      set: vi.fn((value: unknown) => {
        updates.push({ table, value });
        return { where: vi.fn(async () => []) };
      }),
    })),
  };
  const db = {
    transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
    ),
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
  it("creates a spinner with its custom owned button in one transaction", async () => {
    const { db, service, writes } = setup(
      [[{ id: 2000 }], [{ id: 3000 }], [{ id: 2001 }], [{ id: 3001 }]],
      [
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
          value: { materialId: 1201, ownerId: 1000 },
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
          value: { materialId: 1101, ownerId: 1000 },
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
        spinnerFinishOptionId: 1102,
        spinnerCustomFinish: null,
        spinnerMaterialId: 1101,
        spinnerProductId: 1100,
      }),
    ).resolves.toEqual({ buttonItemId: null, spinnerItemId: 2001 });

    expect(writes).toEqual([
      {
        table: schema.collectionItem,
        value: { materialId: 1101, ownerId: 1000 },
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
      [[{ materialId: 1201 }], [{ id: 10, slug: "fade" }]],
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
        [{ buttonProductId: null, spinnerProductId: 1100 }],
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
        collectionItemId: 2001,
        customFinish: null,
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

  it("rejects a material not offered by the selected product", async () => {
    const { service, writes } = setup([], [[]]);

    await expect(
      service.addSpinner({
        actorClerkId: "user-secret",
        buttonCustomFinish: null,
        buttonFinishOptionId: null,
        buttonMaterialId: null,
        buttonProductId: null,
        spinnerFinishOptionId: 1102,
        spinnerCustomFinish: null,
        spinnerMaterialId: 9999,
        spinnerProductId: 1100,
      }),
    ).rejects.toThrow(/material/i);
    expect(writes).toEqual([]);
  });

  it("rejects a finish option from another product", async () => {
    const { service } = setup([[{ id: 2001 }]], [[{ materialId: 1101 }], []]);

    await expect(
      service.addSpinner({
        actorClerkId: "user-secret",
        buttonCustomFinish: null,
        buttonFinishOptionId: null,
        buttonMaterialId: null,
        buttonProductId: null,
        spinnerFinishOptionId: 9999,
        spinnerCustomFinish: null,
        spinnerMaterialId: 1101,
        spinnerProductId: 1100,
      }),
    ).rejects.toThrow(/finish option/i);
  });
});

describe("catalog lookup writes", () => {
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
