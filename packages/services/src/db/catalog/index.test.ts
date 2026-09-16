import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { describe, expect, it, vi } from "vitest";
import {
  assertValidFinishOptions,
  createCatalogService,
  createCollectionsService,
} from "./index.js";

function setup(returningRows: unknown[][]) {
  const writes: Array<{ table: unknown; value: unknown }> = [];
  const tx = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((value: unknown) => {
        writes.push({ table, value });
        return {
          returning: vi.fn(async () => returningRows.shift() ?? []),
        };
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
  };
  const logger = createLogger({ app: "api", environment: "test" });

  return {
    db,
    service: createCollectionsService(db, users as never, logger),
    writes,
  };
}

describe("collection catalog writes", () => {
  it("creates a spinner with its custom owned button in one transaction", async () => {
    const { db, service, writes } = setup([[{ id: 2000 }], [{ id: 2001 }]]);

    await expect(
      service.addSpinner({
        actorClerkId: "user-secret",
        buttonProductId: 1200,
        spinnerProductId: 1100,
      }),
    ).resolves.toEqual({ buttonItemId: 2000, spinnerItemId: 2001 });

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(writes).toEqual([
      { table: schema.collectionItem, value: { ownerId: 1000 } },
      {
        table: schema.collectionSpinnerButton,
        value: { id: 2000, productSpinnerButtonId: 1200 },
      },
      { table: schema.collectionItem, value: { ownerId: 1000 } },
      {
        table: schema.collectionSpinner,
        value: {
          id: 2001,
          installedButtonId: 2000,
          productSpinnerId: 1100,
        },
      },
    ]);
  });

  it("creates no button row for the default spinner button", async () => {
    const { service, writes } = setup([[{ id: 2001 }]]);

    await expect(
      service.addSpinner({
        actorClerkId: "user-secret",
        buttonProductId: null,
        spinnerProductId: 1100,
      }),
    ).resolves.toEqual({ buttonItemId: null, spinnerItemId: 2001 });

    expect(writes).toEqual([
      { table: schema.collectionItem, value: { ownerId: 1000 } },
      {
        table: schema.collectionSpinner,
        value: {
          id: 2001,
          installedButtonId: null,
          productSpinnerId: 1100,
        },
      },
    ]);
  });
});

describe("catalog lookup writes", () => {
  it.each([
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

    const result =
      kind === "maker"
        ? service.createMaker({
            actorClerkId: "user-secret",
            name: "bronze",
            rootUrl: null,
          })
        : service.createMaterial({
            actorClerkId: "user-secret",
            name: "bronze",
            slug: "bronze-2",
          });

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
