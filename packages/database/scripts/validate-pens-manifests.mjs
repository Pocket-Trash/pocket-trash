import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Returns the lowercase SHA-256 digest for supplied bytes.
 *
 * @param {Uint8Array} bytes - Bytes to hash.
 * @returns {string} Lowercase hexadecimal digest.
 */
function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Reads a JSON manifest relative to the repository root.
 *
 * @param {string} root - Repository root.
 * @param {string} path - Repository-relative manifest path.
 * @returns {Promise<object>} Parsed JSON value.
 */
async function readJson(root, path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

/**
 * Throws when a reviewed manifest invariant is false.
 *
 * @param {unknown} condition - Invariant result.
 * @param {string} message - Failure message.
 * @returns {asserts condition} Successful invariant assertion.
 * @throws {Error} When the invariant is false.
 */
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Validates the complete committed Pens production input without writing data.
 *
 * @param {string} root - Pocket Trash repository root.
 * @param {object} [overrides] - Optional parsed manifests used by negative tests.
 * @returns {Promise<{images: number, products: number, refillRows: number}>} Validated counts.
 */
export async function validatePensManifests(root, overrides = {}) {
  const directory = "packages/database/seed-data/pens";
  const [autmog, images, refills, saga] = await Promise.all([
    overrides.autmog ?? readJson(root, `${directory}/autmog.json`),
    overrides.images ?? readJson(root, `${directory}/images.json`),
    overrides.refills ?? readJson(root, `${directory}/refills.json`),
    overrides.saga ?? readJson(root, `${directory}/saga.json`),
  ]);

  for (const source of autmog.sources) {
    const bytes = await readFile(resolve(root, source.path));
    assert(
      sha256(bytes) === source.sha256,
      `Source checksum mismatch: ${source.path}.`,
    );
  }
  const sourceIds = new Set();
  const listingUrls = new Set();
  const includedProducts = autmog.products.filter(
    (product) => product.disposition === "include",
  );
  for (const product of autmog.products) {
    assert(
      !sourceIds.has(product.sourceRecordId),
      `Duplicate source identity: ${product.sourceRecordId}.`,
    );
    sourceIds.add(product.sourceRecordId);
    if (product.disposition !== "include") continue;
    assert(
      product.listingUrl && !listingUrls.has(product.listingUrl),
      `Duplicate or missing listing URL: ${product.sourceRecordId}.`,
    );
    listingUrls.add(product.listingUrl);
    assert(
      product.productType === "pen" || product.productType === "pen-clip",
      `Invalid product type: ${product.sourceRecordId}.`,
    );
    if (product.productType === "pen")
      assert(
        product.compatibility,
        `Missing compatibility disposition: ${product.sourceRecordId}.`,
      );
  }
  assert(
    includedProducts.length === autmog.expected.includedProducts,
    "Autmog product count mismatch.",
  );
  assert(
    autmog.products.filter(
      (product) => product.disposition === "excluded-pen-tray",
    ).length === autmog.expected.excludedTrayListings,
    "Autmog tray disposition count mismatch.",
  );
  assert(
    includedProducts.filter((product) => product.productType === "pen")
      .length === autmog.expected.penProducts,
    "Autmog Pen count mismatch.",
  );
  assert(
    includedProducts.filter((product) => product.productType === "pen-clip")
      .length === autmog.expected.penClipProducts,
    "Autmog Pen clip count mismatch.",
  );

  const imageKeys = new Set();
  for (const image of images.images) {
    const key = `${image.productSourceRecordId}-${image.position - 1}`;
    assert(!imageKeys.has(key), `Duplicate image identity: ${key}.`);
    imageKeys.add(key);
    assert(
      sourceIds.has(image.productSourceRecordId),
      `Unknown image source identity: ${key}.`,
    );
    const bytes = await readFile(resolve(root, image.path));
    assert(
      bytes.byteLength === image.size,
      `Image size mismatch: ${image.path}.`,
    );
    assert(
      sha256(bytes) === image.sha256,
      `Image checksum mismatch: ${image.path}.`,
    );
  }
  const includedImages = images.images.filter(
    (image) => image.disposition === "include",
  );
  assert(
    includedImages.length === autmog.expected.includedImages,
    "Autmog image count mismatch.",
  );
  for (const product of includedProducts)
    for (const key of product.imageKeys)
      assert(imageKeys.has(key), `Missing image identity: ${key}.`);

  const refillSource = await readFile(resolve(root, refills.source.path));
  assert(
    sha256(refillSource) === refills.source.sha256,
    "Refill decision checksum mismatch.",
  );
  assert(refills.evidenceKeys.length > 0, "Refill evidence keys are missing.");
  assert(refills.offeringRows.length > 0, "Refill offering rows are missing.");
  for (const row of refills.offeringRows)
    assert(
      row.Maker && row["Product and tip"] && row["Approved colours"],
      "Incomplete refill offering row.",
    );
  for (const addition of refills.approvedAdditions) {
    assert(
      addition.maker && addition.model,
      "Approved refill identity is incomplete.",
    );
    assert(
      Array.isArray(addition.offerings),
      `Approved refill offerings are missing: ${addition.model}.`,
    );
  }
  assert(saga.evidenceKeys.length > 0, "Saga evidence keys are missing.");
  assert(
    saga.missingHistory.disposition === "accepted-omission",
    "Missing Saga history lacks an accepted disposition.",
  );
  assert(
    saga.slots.map((slot) => slot.position).join(",") === "0,1,2",
    "Saga slot order mismatch.",
  );

  return {
    images: includedImages.length,
    products: includedProducts.length + saga.expected.products,
    refillRows: refills.offeringRows.length + refills.approvedAdditions.length,
  };
}

/**
 * Runs manifest validation from the repository root.
 *
 * @returns {Promise<void>} Completion after reporting validated counts.
 */
async function main() {
  const root = resolve(import.meta.dirname, "../../..");
  const result = await validatePensManifests(root);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
