import { describe, expect, it, vi } from "vitest";
import {
  seedCatalog,
  seedColorEffects,
  seedColors,
  seedFinishes,
  seedMakers,
  seedMaterials,
  seedProductTypes,
} from "../scripts/seed.js";
import type { createDb } from "../src/client.js";
import {
  color,
  colorEffect,
  finish,
  maker,
  material,
  productType,
} from "../src/schema/index.js";

function createSeedDb() {
  const makers = new Map<
    string,
    { id: number; name: string; rootUrl: string | null }
  >();
  const materials = new Map<string, { name: string; slug: string }>();
  const finishes = new Map<string, { name: string; slug: string }>();
  const colors = new Map<string, { hex: string; name: string; slug: string }>();
  const colorEffects = new Map<string, { name: string; slug: string }>();
  const productTypes = new Map<string, { name: string; slug: string }>();

  const db = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(
        (value: {
          hex?: string;
          name: string;
          rootUrl?: string | null;
          slug?: string;
        }) => {
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
      set: vi.fn((value: { name: string; rootUrl: string | null }) => ({
        where: vi.fn(async () => {
          const existing = makers.get(value.name.toLowerCase());
          if (existing)
            makers.set(value.name.toLowerCase(), { ...existing, ...value });
        }),
      })),
    })),
  } as unknown as ReturnType<typeof createDb>;

  return {
    colorEffects,
    colors,
    db,
    finishes,
    makers,
    materials,
    productTypes,
  };
}

describe("catalog seed", () => {
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
    expect(state.makers.get("kap edc")?.rootUrl).toBeNull();
  });
});
