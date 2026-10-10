import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validatePensManifests } from "../scripts/validate-pens-manifests.mjs";

/** Pocket Trash repository root under test. */
const root = resolve(import.meta.dirname, "../../..");
/** Committed Pens manifest directory under test. */
const directory = resolve(root, "packages/database/seed-data/pens");

/**
 * Reads one committed Pens manifest for mutation-based negative tests.
 *
 * @param {string} name - Manifest base name.
 * @returns {Promise<object>} Parsed manifest.
 */
async function manifest(name) {
  return JSON.parse(await readFile(resolve(directory, `${name}.json`), "utf8"));
}

describe("Pens production manifests", () => {
  it("validates the frozen sources, identities, evidence, counts, and image bytes", async () => {
    await expect(validatePensManifests(root)).resolves.toEqual({
      images: 1162,
      products: 140,
      refillRows: 96,
    });
    const [autmog, saga] = await Promise.all([
      manifest("autmog"),
      manifest("saga"),
    ]);
    expect(
      autmog.products
        .filter((product) => product.disposition === "excluded-pen-tray")
        .map((product) => product.sourceRecordId)
        .sort(),
    ).toEqual([
      "7217731240123",
      "7231423381691",
      "7801123176635",
      "7805591322811",
    ]);
    expect(
      autmog.products.filter((product) =>
        product.compatibility?.startsWith("evidence-only:"),
      ),
    ).toHaveLength(8);
    expect(saga.missingHistory).toEqual({
      disposition: "accepted-omission",
      images: 0,
      serialValues: 0,
      sourceListings: 0,
    });
  }, 60_000);

  it("rejects checksum, identity, count, evidence, and image-integrity drift", async () => {
    const [autmog, images, refills] = await Promise.all([
      manifest("autmog"),
      manifest("images"),
      manifest("refills"),
    ]);
    await expect(
      validatePensManifests(root, {
        autmog: {
          ...autmog,
          sources: [{ ...autmog.sources[0], sha256: "0".repeat(64) }],
        },
      }),
    ).rejects.toThrow(/source checksum mismatch/iu);
    await expect(
      validatePensManifests(root, {
        autmog: {
          ...autmog,
          products: [autmog.products[0], ...autmog.products],
        },
      }),
    ).rejects.toThrow(/duplicate source identity/iu);
    await expect(
      validatePensManifests(root, {
        autmog: {
          ...autmog,
          expected: { ...autmog.expected, includedProducts: 1 },
        },
      }),
    ).rejects.toThrow(/product count mismatch/iu);
    await expect(
      validatePensManifests(root, {
        images: {
          ...images,
          images: [
            { ...images.images[0], sha256: "0".repeat(64) },
            ...images.images.slice(1),
          ],
        },
      }),
    ).rejects.toThrow(/image checksum mismatch/iu);
    await expect(
      validatePensManifests(root, {
        refills: { ...refills, evidenceKeys: [] },
      }),
    ).rejects.toThrow(/evidence keys are missing/iu);
  }, 60_000);
});
