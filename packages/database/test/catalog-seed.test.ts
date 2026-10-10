import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  catalogSeedTimestamp,
  loadKapedcSeedData,
  materialPairForTerm,
  seedCatalog,
  seedColorEffects,
  seedColors,
  seedFinishes,
  seedImageFolderPrefix,
  seedKapedcImages,
  seedMakers,
  seedMaterials,
  seedProductTypes,
  seedUserSettings,
  seedUsers,
  seedUsersAndSettings,
  sliderFixtureCatalog,
  sliderFixtureOwnerClerkId,
} from "../scripts/seed.js";
import type { createDb } from "../src/client.js";
import {
  color,
  colorEffect,
  finish,
  maker,
  material,
  materialSpecific,
  productType,
  user,
  userSettings,
} from "../src/schema/index.js";

/**
 * Creates an in-memory Drizzle-shaped fake for catalog seed tests.
 *
 * @returns The fake database and its persisted lookup maps.
 */
function createSeedDb() {
  const makers = new Map<
    string,
    {
      /** Synthetic maker identifier. */
      id: number;
      /** Maker display name. */
      name: string;
      /** Normalized maker root URL. */
      rootUrl: string | null;
      /** Stable maker slug. */
      slug: string;
    }
  >();
  const materials = new Map<
    string,
    {
      /** Material identifier. */
      id: number;
      /** Material display name. */
      name: string;
      /** Stable material slug. */
      slug: string;
    }
  >();
  const finishes = new Map<
    string,
    {
      /** Finish display name. */
      name: string;
      /** Stable finish slug. */
      slug: string;
    }
  >();
  const colors = new Map<
    string,
    {
      /** Hexadecimal color value. */
      hex: string;
      /** Color display name. */
      name: string;
      /** Stable color slug. */
      slug: string;
    }
  >();
  const colorEffects = new Map<
    string,
    {
      /** Color-effect display name. */
      name: string;
      /** Stable color-effect slug. */
      slug: string;
    }
  >();
  const productTypes = new Map<
    string,
    {
      /** Whether the type belongs in Parts and Accessories. */
      isPartOrAccessory: boolean;
      /** Product-type display name. */
      name: string;
      /** Stable product-type slug. */
      slug: string;
    }
  >();

  /** Drizzle-shaped fake that persists mutations in the lookup maps. */
  const db = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(
        (value: {
          /** Optional hexadecimal value for colors. */
          hex?: string;
          /** Optional Parts and Accessories classification. */
          isPartOrAccessory?: boolean;
          /** Lookup display name. */
          name: string;
          /** Optional maker root URL. */
          rootUrl?: string | null;
          /** Optional stable lookup slug. */
          slug?: string;
        }) => {
          /** Persists the supplied value in the map for its table. */
          const insert = () => {
            if (table === maker) {
              makers.set(value.name.toLowerCase(), {
                id: makers.size + 1000,
                name: value.name,
                rootUrl: value.rootUrl ?? null,
                slug: value.slug ?? "",
              });
            } else if (table === material && value.slug) {
              materials.set(value.slug, {
                id: materials.size + 1000,
                name: value.name,
                slug: value.slug,
              });
            } else if (table === finish && value.slug) {
              finishes.set(value.slug, { name: value.name, slug: value.slug });
            } else if (table === color && value.slug && value.hex) {
              colors.set(value.slug, {
                hex: value.hex,
                name: value.name,
                slug: value.slug,
              });
            } else if (table === colorEffect && value.slug) {
              colorEffects.set(value.slug, {
                name: value.name,
                slug: value.slug,
              });
            } else if (table === productType && value.slug) {
              if (!productTypes.has(value.slug))
                productTypes.set(value.slug, {
                  isPartOrAccessory: value.isPartOrAccessory ?? false,
                  name: value.name,
                  slug: value.slug,
                });
            }
          };
          insert();
          return {
            onConflictDoUpdate: vi.fn(
              async (config?: {
                /** Values updated on conflict. */
                set?: {
                  /** Replacement display name. */
                  name?: string;
                };
              }) => {
                if (table === productType && value.slug) {
                  const existing = productTypes.get(value.slug);
                  if (existing && config?.set?.name)
                    productTypes.set(value.slug, {
                      ...existing,
                      name: config.set.name,
                    });
                  return;
                }
                insert();
              },
            ),
          };
        },
      ),
    })),
    select: vi.fn(() => ({
      from: vi.fn(async (table: unknown) =>
        table === material ? [...materials.values()] : [...makers.values()],
      ),
    })),
    update: vi.fn(() => ({
      set: vi.fn(
        (value: {
          /** Updated maker display name. */
          name: string;
          /** Updated normalized maker root URL. */
          rootUrl: string | null;
        }) => ({
          where: vi.fn(async () => {
            const existing = makers.get(value.name.toLowerCase());
            if (existing)
              makers.set(value.name.toLowerCase(), { ...existing, ...value });
          }),
        }),
      ),
    })),
  } as unknown as ReturnType<typeof createDb>;

  return {
    /** Persisted color-effect rows keyed by slug. */
    colorEffects,
    /** Persisted color rows keyed by slug. */
    colors,
    /** Drizzle-shaped fake database client. */
    db,
    /** Persisted finish rows keyed by slug. */
    finishes,
    /** Persisted maker rows keyed by normalized name. */
    makers,
    /** Persisted material rows keyed by slug. */
    materials,
    /** Persisted product-type rows keyed by slug. */
    productTypes,
  };
}

/**
 * Creates one isolated-preview image seed input.
 *
 * @param previewNumber - Pull-request namespace number.
 * @returns Bunny configuration, reviewed product fixture, and image digest.
 */
function createImageSeedInput(previewNumber = 42) {
  const sha256 = "a".repeat(64);
  return {
    config: {
      accessKey: "key",
      cdnBaseUrl: "https://cdn.example.test",
      endpoint: "https://storage.example.test",
      imageFolderPrefix: `images/preview/pr-${previewNumber}`,
      resourceFolderPrefix: `resources/preview/pr-${previewNumber}`,
      zoneName: "zone",
    },
    seededProducts: [
      {
        productId: 1000,
        product: {
          description: "Fixture",
          images: [
            {
              cacheObjectPath: "imports/kapedc/1/image.png",
              contentType: "image/png" as const,
              fileName: "image.png",
              sha256,
              size: 123,
            },
          ],
          materialTerms: [],
          name: "Fixture product",
          slug: "fixture-product",
          sourceUrl: "https://example.test/product",
          type: "spinner" as const,
        },
      },
    ],
    sha256,
  };
}

/**
 * Creates a stateful image-record database fake for retry and rerun tests.
 *
 * @returns Database fake, persisted rows, and insertion spy.
 */
function createImageSeedDb() {
  const rows: Array<Record<string, unknown>> = [];
  const insertValues = vi.fn(async (value: Record<string, unknown>) => {
    rows.push({ deletedAt: null, id: rows.length + 1, ...value });
  });
  const db = {
    insert: vi.fn(() => ({ values: insertValues })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(async () => rows) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    })),
  } as unknown as ReturnType<typeof createDb>;
  return { db, insertValues, rows };
}

describe("catalog seed", () => {
  it("references shared immutable preview images without copying them", async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const db = {
      insert: vi.fn(() => ({
        values: vi.fn(async (value: Record<string, unknown>) => {
          inserted.push(value);
        }),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where: vi.fn(async () => []) })),
      })),
      update: vi.fn(),
    } as unknown as ReturnType<typeof createDb>;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const sha256 = "a".repeat(64);

    const fixture = [
      {
        productId: 1000,
        product: {
          description: "Fixture",
          images: [
            {
              cacheObjectPath: "imports/kapedc/1/image.png",
              contentType: "image/png",
              fileName: "image.png",
              sha256,
              size: 123,
            },
          ],
          materialTerms: [],
          name: "Fixture product",
          slug: "fixture-product",
          sourceUrl: "https://example.test/product",
          type: "spinner" as const,
        },
      },
    ];

    try {
      for (const previewNumber of [42, 43])
        await seedKapedcImages(
          db,
          {
            accessKey: "key",
            cdnBaseUrl: "https://cdn.example.test",
            endpoint: "https://storage.example.test",
            imageFolderPrefix: `images/preview/pr-${previewNumber}`,
            resourceFolderPrefix: `resources/preview/pr-${previewNumber}`,
            zoneName: "zone",
          },
          fixture,
        );
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
        `https://cdn.example.test/images/preview/products/1000/${sha256}.png`,
      );
      expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("HEAD");
      expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
        `https://cdn.example.test/images/preview/products/1000/${sha256}.png`,
      );
      expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("HEAD");
    } finally {
      fetchMock.mockRestore();
    }

    expect(seedImageFolderPrefix("images/preview/pr-42")).toBe(
      "images/preview",
    );
    expect(inserted).toHaveLength(2);
    for (const row of inserted)
      expect(row).toEqual(
        expect.objectContaining({
          objectPath: `images/preview/products/1000/${sha256}.png`,
          productId: 1000,
          storageOwned: false,
          uploadedByClerkId: null,
          url: `https://cdn.example.test/images/preview/products/1000/${sha256}.png?format=webp&quality=85`,
        }),
      );
  });

  it("recovers from timeout, rate-limit, and transient server failures", async () => {
    const { config, seededProducts } = createImageSeedInput();
    const { db, insertValues } = createImageSeedDb();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    try {
      await seedKapedcImages(db, config, seededProducts);
      expect(fetchMock).toHaveBeenCalledTimes(4);
    } finally {
      fetchMock.mockRestore();
    }

    expect(insertValues).toHaveBeenCalledOnce();
  });

  it("retries a refused Bunny connection", async () => {
    const { config, seededProducts } = createImageSeedInput();
    const { db, insertValues } = createImageSeedDb();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(
        new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    try {
      await seedKapedcImages(db, config, seededProducts);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      fetchMock.mockRestore();
    }

    expect(insertValues).toHaveBeenCalledOnce();
  });

  it("retries a content-addressed upload without duplicating its row", async () => {
    const { config, seededProducts } = createImageSeedInput();
    const source = seededProducts[0]?.product.images[0];
    if (!source) throw new Error("Image seed fixture is missing.");
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=",
      "base64",
    );
    source.sha256 = createHash("sha256").update(bytes).digest("hex");
    source.size = bytes.byteLength;
    const { db, insertValues, rows } = createImageSeedDb();
    const uploadedBodies: Uint8Array[] = [];
    let uploadAttempts = 0;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_request, init) => {
        if (init?.method === "HEAD") return new Response(null, { status: 404 });
        if (init?.method === "PUT") {
          uploadedBodies.push(
            new Uint8Array(await new Response(init.body).arrayBuffer()),
          );
          uploadAttempts += 1;
          return new Response(null, {
            status: uploadAttempts === 1 ? 503 : 201,
          });
        }
        return new Response(new Uint8Array(bytes).buffer, { status: 200 });
      });

    try {
      await seedKapedcImages(db, config, seededProducts);
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual([
        "HEAD",
        undefined,
        "PUT",
        "PUT",
      ]);
      expect(uploadedBodies).toEqual([
        new Uint8Array(bytes),
        new Uint8Array(bytes),
      ]);
    } finally {
      fetchMock.mockRestore();
    }

    expect(insertValues).toHaveBeenCalledOnce();
    expect(rows).toHaveLength(1);
  });

  it("retries a timeout while reading the cache response body", async () => {
    const { config, seededProducts } = createImageSeedInput();
    const source = seededProducts[0]?.product.images[0];
    if (!source) throw new Error("Image seed fixture is missing.");
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=",
      "base64",
    );
    source.sha256 = createHash("sha256").update(bytes).digest("hex");
    source.size = bytes.byteLength;
    const { db, insertValues } = createImageSeedDb();
    const timedOutResponse = new Response(null, { status: 200 });
    vi.spyOn(timedOutResponse, "arrayBuffer").mockRejectedValue(
      new DOMException("Timed out", "TimeoutError"),
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(timedOutResponse)
      .mockResolvedValueOnce(
        new Response(new Uint8Array(bytes).buffer, { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 201 }));

    try {
      await seedKapedcImages(db, config, seededProducts);
      expect(fetchMock).toHaveBeenCalledTimes(4);
    } finally {
      fetchMock.mockRestore();
    }

    expect(insertValues).toHaveBeenCalledOnce();
  });

  it("fails permanent Bunny responses immediately", async () => {
    const { config, seededProducts } = createImageSeedInput();
    const { db, insertValues } = createImageSeedDb();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));

    try {
      await expect(
        seedKapedcImages(db, config, seededProducts),
      ).rejects.toThrow("Shared seed image availability check failed: 401.");
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      fetchMock.mockRestore();
    }

    expect(insertValues).not.toHaveBeenCalled();
  });

  it("fails permanent rejected client errors immediately", async () => {
    const { config, seededProducts } = createImageSeedInput();
    const { db, insertValues } = createImageSeedDb();
    const error = new TypeError("Invalid URL");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(error);

    try {
      await expect(seedKapedcImages(db, config, seededProducts)).rejects.toBe(
        error,
      );
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      fetchMock.mockRestore();
    }

    expect(insertValues).not.toHaveBeenCalled();
  });

  it("fails cache validation without retrying or uploading", async () => {
    const { config, seededProducts } = createImageSeedInput();
    const { db, insertValues } = createImageSeedDb();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response("bad", { status: 200 }));

    try {
      await expect(
        seedKapedcImages(db, config, seededProducts),
      ).rejects.toThrow(
        "Cached image verification failed for Fixture product.",
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      fetchMock.mockRestore();
    }

    expect(insertValues).not.toHaveBeenCalled();
  });

  it("reports bounded retry exhaustion with safe rerun guidance", async () => {
    const { config, seededProducts } = createImageSeedInput();
    const { db, insertValues } = createImageSeedDb();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 503 }));

    try {
      await expect(
        seedKapedcImages(db, config, seededProducts),
      ).rejects.toThrow(
        "Bunny seed shared image availability check failed after 4 attempts. It is safe to rerun pnpm db:seed after Bunny recovers.",
      );
      expect(fetchMock).toHaveBeenCalledTimes(4);
    } finally {
      fetchMock.mockRestore();
    }

    expect(insertValues).not.toHaveBeenCalled();
  });

  it("reruns idempotently without duplicate rows or object uploads", async () => {
    const { config, seededProducts } = createImageSeedInput();
    const { db, insertValues, rows } = createImageSeedDb();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    try {
      await seedKapedcImages(db, config, seededProducts);
      await seedKapedcImages(db, config, seededProducts);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(
        fetchMock.mock.calls.every(([, init]) => init?.method === "HEAD"),
      ).toBe(true);
    } finally {
      fetchMock.mockRestore();
    }

    expect(insertValues).toHaveBeenCalledOnce();
    expect(rows).toHaveLength(1);
  });

  it("is idempotent and preserves the planned values", async () => {
    const state = createSeedDb();

    await seedCatalog(state.db);
    const sliderPlate = state.productTypes.get("slider-plate");
    if (!sliderPlate) throw new Error("Slider plate was not seeded.");
    state.productTypes.set("slider-plate", {
      ...sliderPlate,
      isPartOrAccessory: false,
    });
    await seedCatalog(state.db);

    expect(state.productTypes.size).toBe(seedProductTypes.length);
    expect([...state.productTypes.keys()]).toEqual(
      expect.arrayContaining(["slider", "slider-plate", "slider-insert"]),
    );
    expect(state.productTypes.get("slider")?.isPartOrAccessory).toBe(false);
    expect(state.productTypes.get("slider-plate")?.isPartOrAccessory).toBe(
      false,
    );
    expect(state.makers.size).toBe(seedMakers.length);
    expect(state.materials.size).toBe(seedMaterials.length);
    expect(state.materials.has("m390-steel")).toBe(false);
    expect(state.db.insert).toHaveBeenCalledWith(materialSpecific);
    expect(materialPairForTerm("M390 steel")).toEqual({
      materialSlug: "stainless-steel",
      specificSlug: "m390-steel",
    });
    expect(state.finishes.size).toBe(seedFinishes.length);
    expect(state.colors.size).toBe(seedColors.length);
    expect(state.colorEffects.size).toBe(seedColorEffects.length);
    expect(state.finishes.get("machine-finished")?.name).toBe(
      "Machine finished",
    );
    expect(state.colors.get("purple")?.name).toBe("Purple");
    expect(state.colors.get("purple")?.hex).toBe("#9333EA");
    expect(state.colorEffects.get("fade")?.name).toBe("Fade");
    expect(state.materials.get("bronze")?.name).toBe("Bronze");
    expect(state.makers.get("autmog")?.rootUrl).toBe("https://www.autmog.com");
    expect(state.makers.get("autmog")?.slug).toBe("autmog");
    expect(state.makers.get("kap edc")?.rootUrl).toBe("https://www.kapedc.com");
    expect(state.makers.get("kap edc")?.slug).toBe("kap-edc");
  });

  it("contains every approved KAP product and unique gallery image", async () => {
    const snapshot = await loadKapedcSeedData();

    expect(snapshot.products).toHaveLength(71);
    expect(
      snapshot.products.filter(({ type }) => type === "spinner"),
    ).toHaveLength(59);
    expect(
      snapshot.products.filter(({ type }) => type === "spinner-button"),
    ).toHaveLength(12);
    expect(
      snapshot.products.filter(({ slug }) => slug.includes("katla")),
    ).toHaveLength(2);
    expect(
      snapshot.products.reduce((count, { images }) => count + images.length, 0),
    ).toBe(271);
    expect(
      snapshot.products.every(({ images }) =>
        images.every(({ sha256 }) => sha256.length === 64),
      ),
    ).toBe(true);
    expect(
      snapshot.products
        .flatMap(({ materialTerms }) => materialTerms)
        .every((term) => materialPairForTerm(term).materialSlug.length > 0),
    ).toBe(true);
    expect(catalogSeedTimestamp(snapshot.importedAt).toISOString()).toBe(
      snapshot.importedAt,
    );
  });

  it("defines a deterministic slider fixture that exercises every discovery path", () => {
    const byType = Object.groupBy(
      sliderFixtureCatalog.products,
      ({ type }) => type,
    );
    expect(byType.slider).toHaveLength(21);
    expect(byType["slider-plate"]?.length).toBeGreaterThan(0);
    expect(byType["slider-plate"]?.length).toBeLessThanOrEqual(21);
    expect(byType["slider-insert"]?.length).toBeGreaterThan(0);
    expect(byType["slider-insert"]?.length).toBeLessThanOrEqual(21);
    expect(sliderFixtureOwnerClerkId).toBe("user_3JRUuhMIDwBBiLyc4smN8pAtGS9");
    expect(
      new Set(sliderFixtureCatalog.products.map(({ maker }) => maker)),
    ).toEqual(new Set(["Magnus Fidgets", "Novel Carry", "FidgetBoy"]));

    for (const type of ["slider", "slider-plate", "slider-insert"] as const) {
      const products = [...(byType[type] ?? [])].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      );
      expect(products[0]?.images.length).toBeGreaterThan(1);
      expect(products.slice(1).every(({ images }) => images.length === 1)).toBe(
        true,
      );
    }

    const sliders = byType.slider ?? [];
    expect(new Set(sliders.map(({ magnetLayout }) => magnetLayout))).toEqual(
      new Set(["2x2", "2x3", "2x4", null]),
    );
    expect(
      sliders.some(
        ({ includedInsertSlug, usesInserts }) =>
          usesInserts === true && includedInsertSlug !== null,
      ),
    ).toBe(true);
    expect(
      sliders.some(
        ({ includedInsertSlug, magnetLayout, usesInserts }) =>
          usesInserts === true &&
          includedInsertSlug === null &&
          magnetLayout !== null,
      ),
    ).toBe(true);
    expect(sliders.some(({ includedPlateSlug }) => includedPlateSlug)).toBe(
      true,
    );
    expect(sliders.some(({ includedPlateSlug }) => !includedPlateSlug)).toBe(
      true,
    );
    expect(sliderFixtureCatalog.products.some(({ pattern }) => pattern)).toBe(
      true,
    );
    expect(
      new Set(
        sliderFixtureCatalog.products.flatMap(({ images }) =>
          images.map(({ key }) => key),
        ),
      ).size,
    ).toBe(
      sliderFixtureCatalog.products.reduce(
        (count, { images }) => count + images.length,
        0,
      ),
    );
  });
});

describe("user seed", () => {
  it("upserts every approved user and configured preference", async () => {
    const insertedUsers: unknown[] = [];
    const insertedSettings: unknown[] = [];
    const selectedUsers = seedUsers.map(({ clerkId }, index) => ({
      clerkId,
      id: index + 1000,
    }));
    const db = {
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((value: unknown) => {
          (table === user ? insertedUsers : insertedSettings).push(value);
          return { onConflictDoUpdate: vi.fn(async () => undefined) };
        }),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => selectedUsers),
        })),
      })),
    } as unknown as ReturnType<typeof createDb>;

    await seedUsersAndSettings(db);

    expect(insertedUsers).toEqual(seedUsers);
    expect(insertedSettings).toEqual([
      { ...seedUserSettings[0].values, userId: 1000 },
      { ...seedUserSettings[1].values, userId: 1002 },
    ]);
    expect(db.insert).toHaveBeenCalledWith(user);
    expect(db.insert).toHaveBeenCalledWith(userSettings);
  });
});
