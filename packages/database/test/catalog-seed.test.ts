import { describe, expect, it, vi } from "vitest";
import {
  isSeedImageInTargetPrefix,
  loadKapedcSeedData,
  materialSlugForTerm,
  seedCatalog,
  seedColorEffects,
  seedColors,
  seedFinishes,
  seedMakers,
  seedMaterials,
  seedProductTypes,
  seedUserSettings,
  seedUsers,
  seedUsersAndSettings,
} from "../scripts/seed.js";
import type { createDb } from "../src/client.js";
import {
  color,
  colorEffect,
  finish,
  maker,
  material,
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
    }
  >();
  const materials = new Map<
    string,
    {
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
              });
            } else if (table === material && value.slug) {
              materials.set(value.slug, { name: value.name, slug: value.slug });
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
              productTypes.set(value.slug, {
                name: value.name,
                slug: value.slug,
              });
            }
          };
          insert();
          return { onConflictDoUpdate: vi.fn(async () => insert()) };
        },
      ),
    })),
    select: vi.fn(() => ({
      from: vi.fn(async () => [...makers.values()]),
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

describe("catalog seed", () => {
  it("recognizes images already copied into the target environment", () => {
    expect(
      isSeedImageInTargetPrefix(
        "images/preview/products/1000/image.jpg",
        "images/preview",
      ),
    ).toBe(true);
    expect(
      isSeedImageInTargetPrefix(
        "images/preview/products/1000/image.jpg",
        "images/preview/pr-158",
      ),
    ).toBe(false);
  });

  it("is idempotent and preserves the planned values", async () => {
    const state = createSeedDb();

    await seedCatalog(state.db);
    await seedCatalog(state.db);

    expect(state.productTypes.size).toBe(seedProductTypes.length);
    expect(state.makers.size).toBe(seedMakers.length);
    expect(state.materials.size).toBe(seedMaterials.length);
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
    expect(state.makers.get("kap edc")?.rootUrl).toBe("https://www.kapedc.com");
  });

  it("contains every approved KAP product and primary image", async () => {
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
      snapshot.products.every(({ image }) => image.sha256.length === 64),
    ).toBe(true);
    expect(
      snapshot.products
        .flatMap(({ materialTerms }) => materialTerms)
        .every((term) => materialSlugForTerm(term).length > 0),
    ).toBe(true);
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
