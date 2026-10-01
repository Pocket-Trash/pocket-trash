import process from "node:process";
import { fileURLToPath } from "node:url";
import { eq, inArray } from "drizzle-orm";
import { createDb } from "../src/client.js";
import { createDatabaseEnv } from "../src/env.schema.js";
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
 * Users required in shared non-production databases.
 *
 * @internal
 */
export const seedUsers = [
  { clerkId: "user_3FrjTtIKHL0ptK6jeljcf5kCM7J", username: "royanger" },
  { clerkId: "user_3JgqrEzHG8RsUFhfmm227e96VCq", username: "someadmin" },
  { clerkId: "user_3JRUuhMIDwBBiLyc4smN8pAtGS9", username: "ranger" },
  { clerkId: "user_3GacmU93tlb9EiT1wQCXRefMJi1", username: "bvg001" },
  { clerkId: "user_3FxAxWTSZhoYlM2C3Jlpk5kGvUA", username: "bvgdigi" },
  { clerkId: "user_3FtlpxLoJA3znNat7qXDb0RHcgm", username: "bvgdigital" },
] as const;

/**
 * Non-default preferences required by seeded users.
 *
 * @internal
 */
export const seedUserSettings = [
  {
    clerkId: "user_3FrjTtIKHL0ptK6jeljcf5kCM7J",
    values: {
      currencyCode: "CAD" as const,
      dimensionUnit: "mm" as const,
      weightUnit: "g" as const,
    },
  },
  {
    clerkId: "user_3JRUuhMIDwBBiLyc4smN8pAtGS9",
    values: { weightUnit: "oz" as const },
  },
] as const;

/**
 * Canonical product types inserted by the catalog seed.
 *
 * @internal
 */
export const seedProductTypes = [
  { name: "Pen", slug: "pen" },
  { name: "Spinner", slug: "spinner" },
  { name: "Spinner Button", slug: "spinner-button" },
  { name: "Slider", slug: "slider" },
  { name: "Fountain Pen", slug: "fountain-pen" },
] as const;

/**
 * Canonical makers inserted or updated by the catalog seed.
 *
 * @internal
 */
export const seedMakers = [
  { name: "Autmog", rootUrl: "https://www.autmog.com" },
  { name: "Inventery", rootUrl: "https://www.inventery.co" },
  { name: "KAP EDC", rootUrl: "https://www.kapedc.com" },
  { name: "Clean EDC", rootUrl: "https://cleanedc.com" },
  { name: "Magnus Fidgets", rootUrl: "https://magnusfidgets.com" },
  {
    name: "Full Throttle Originals",
    rootUrl: "https://fullthrottleoriginals.com",
  },
] as const;

/**
 * Canonical materials inserted by the catalog seed.
 *
 * @internal
 */
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

/**
 * Canonical finishes inserted by the catalog seed.
 *
 * @internal
 */
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

/**
 * Canonical colors inserted by the catalog seed.
 *
 * @internal
 */
export const seedColors = [
  { hex: "#000000", name: "Black", slug: "black" },
  { hex: "#FFFFFF", name: "White", slug: "white" },
  { hex: "#808080", name: "Grey", slug: "grey" },
  { hex: "#C0C0C0", name: "Silver", slug: "silver" },
  { hex: "#DC2626", name: "Red", slug: "red" },
  { hex: "#F97316", name: "Orange", slug: "orange" },
  { hex: "#EAB308", name: "Yellow", slug: "yellow" },
  { hex: "#16A34A", name: "Green", slug: "green" },
  { hex: "#2563EB", name: "Blue", slug: "blue" },
  { hex: "#9333EA", name: "Purple", slug: "purple" },
  { hex: "#EC4899", name: "Pink", slug: "pink" },
  { hex: "#92400E", name: "Brown", slug: "brown" },
  { hex: "#CD7F32", name: "Bronze", slug: "bronze" },
  { hex: "#D4AF37", name: "Gold", slug: "gold" },
  { hex: "#0D9488", name: "Teal", slug: "teal" },
  { hex: "#06B6D4", name: "Cyan", slug: "cyan" },
] as const;

/**
 * Canonical color effects inserted by the catalog seed.
 *
 * @internal
 */
export const seedColorEffects = [
  { name: "Solid", slug: "solid" },
  { name: "Fade", slug: "fade" },
] as const;

/**
 * Normalizes an optional seed URL for stable comparisons and storage.
 *
 * @param url - URL to trim and remove trailing slashes from.
 * @returns The normalized URL, or `null` when the input is absent or blank.
 * @internal
 */
export function normalizeSeedUrl(url: string | null): string | null {
  return url?.trim().replace(/\/+$/, "") || null;
}

/**
 * Upserts the users and preferences needed in non-production databases.
 *
 * @param db - Database client receiving the seed values.
 * @rejects When a user read or write fails.
 * @internal
 */
export async function seedUsersAndSettings(db: ReturnType<typeof createDb>) {
  for (const value of seedUsers) {
    await db
      .insert(user)
      .values(value)
      .onConflictDoUpdate({
        set: { username: value.username },
        target: user.clerkId,
      });
  }

  const users = await db
    .select({ clerkId: user.clerkId, id: user.id })
    .from(user)
    .where(
      inArray(
        user.clerkId,
        seedUsers.map(({ clerkId }) => clerkId),
      ),
    );
  const ids = new Map(users.map(({ clerkId, id }) => [clerkId, id]));

  for (const value of seedUserSettings) {
    const userId = ids.get(value.clerkId);
    if (!userId) throw new Error(`Seed user ${value.clerkId} is missing.`);
    await db
      .insert(userSettings)
      .values({ ...value.values, userId })
      .onConflictDoUpdate({
        set: value.values,
        target: userSettings.userId,
      });
  }
}

/**
 * Upserts the canonical catalog lookup values.
 *
 * @param db - Database client receiving the seed values.
 * @rejects When a catalog read or write fails.
 * @internal
 */
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

  for (const value of seedColors) {
    await db
      .insert(color)
      .values(value)
      .onConflictDoUpdate({
        set: { hex: value.hex, name: value.name, updatedAt: new Date() },
        target: color.slug,
      });
  }
}

/**
 * Seeds the configured database with canonical catalog lookup values.
 *
 * @rejects When the database URL is absent or seeding fails.
 */
async function main() {
  const env = createDatabaseEnv({ DATABASE_URL: process.env.DATABASE_URL });
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed the database.");
  }

  const db = createDb({ databaseUrl: env.DATABASE_URL });
  await seedUsersAndSettings(db);
  await seedCatalog(db);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
