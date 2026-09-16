import process from "node:process";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { createDb } from "../src/client.js";
import { createDatabaseEnv } from "../src/env.schema.js";
import {
  color,
  colorEffect,
  finish,
  maker,
  material,
  productType,
} from "../src/schema/index.js";

export const seedProductTypes = [
  { name: "Pen", slug: "pen" },
  { name: "Spinner", slug: "spinner" },
  { name: "Spinner Button", slug: "spinner-button" },
  { name: "Slider", slug: "slider" },
  { name: "Fountain Pen", slug: "fountain-pen" },
] as const;

export const seedMakers = [
  { name: "Autmog", rootUrl: "https://www.autmog.com" },
  { name: "Inventery", rootUrl: "https://www.inventery.co" },
  { name: "KAP EDC", rootUrl: null },
  { name: "Clean EDC", rootUrl: "https://cleanedc.com" },
  { name: "Magnus Fidgets", rootUrl: "https://magnusfidgets.com" },
  {
    name: "Full Throttle Originals",
    rootUrl: "https://fullthrottleoriginals.com",
  },
] as const;

export const seedMaterials = [
  { name: "Aluminum", slug: "aluminum" },
  { name: "Brass", slug: "brass" },
  { name: "Bronze", slug: "bronze" },
  { name: "Copper", slug: "copper" },
  { name: "Stainless Steel", slug: "stainless-steel" },
  { name: "Titanium", slug: "titanium" },
  { name: "Tungsten", slug: "tungsten" },
  { name: "Ultem", slug: "ultem" },
  { name: "Zirconium", slug: "zirconium" },
] as const;

export const seedFinishes = [
  { name: "Anodized", slug: "anodized" },
  { name: "Cerakoted", slug: "cerakoted" },
  { name: "Polished", slug: "polished" },
  { name: "Machine finished", slug: "machine-finished" },
  { name: "Blackened", slug: "blackened" },
  { name: "Satin", slug: "satin" },
  { name: "Tumbled", slug: "tumbled" },
  { name: "Blasted", slug: "blasted" },
] as const;

export const seedColors = [
  { name: "Blue", slug: "blue" },
  { name: "Green", slug: "green" },
  { name: "Purple", slug: "purple" },
] as const;

export const seedColorEffects = [
  { name: "Solid", slug: "solid" },
  { name: "Fade", slug: "fade" },
] as const;

export function normalizeSeedUrl(url: string | null): string | null {
  return url?.trim().replace(/\/+$/, "") || null;
}

export async function seedCatalog(db: ReturnType<typeof createDb>) {
  for (const value of seedProductTypes) {
    await db
      .insert(productType)
      .values(value)
      .onConflictDoUpdate({
        set: { name: value.name, updatedAt: new Date() },
        target: productType.slug,
      });
  }

  const existingMakers = await db.select().from(maker);
  for (const value of seedMakers) {
    const existing = existingMakers.find(
      ({ name }) => name.toLocaleLowerCase() === value.name.toLocaleLowerCase(),
    );
    const rootUrl = normalizeSeedUrl(value.rootUrl);

    if (existing) {
      await db
        .update(maker)
        .set({ name: value.name, rootUrl, updatedAt: new Date() })
        .where(eq(maker.id, existing.id));
    } else {
      await db.insert(maker).values({ name: value.name, rootUrl });
    }
  }

  for (const value of seedMaterials) {
    await db
      .insert(material)
      .values(value)
      .onConflictDoUpdate({
        set: { name: value.name, updatedAt: new Date() },
        target: material.slug,
      });
  }

  for (const [table, values] of [
    [finish, seedFinishes],
    [color, seedColors],
    [colorEffect, seedColorEffects],
  ] as const) {
    for (const value of values) {
      await db
        .insert(table)
        .values(value)
        .onConflictDoUpdate({
          set: { name: value.name, updatedAt: new Date() },
          target: table.slug,
        });
    }
  }
}

async function main() {
  const env = createDatabaseEnv({ DATABASE_URL: process.env.DATABASE_URL });
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed the product catalog.");
  }

  await seedCatalog(createDb({ databaseUrl: env.DATABASE_URL }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
