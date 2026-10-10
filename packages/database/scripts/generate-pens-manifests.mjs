import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

/** Pocket Trash repository root. */
const root = resolve(import.meta.dirname, "../../..");
/** Directory receiving generated Pens manifests. */
const outputDirectory = join(root, "packages/database/seed-data/pens");
/** Frozen raw Autmog Shopify archive. */
const archivePath = join(root, "scrapers/sites/autmog/data/archive.json");
/** Reviewed Autmog body-detail audit. */
const bodyAuditPath = join(
  root,
  "scrapers/sites/autmog/body_details_audit.csv",
);
/** Reviewed Autmog clip and mechanism audit. */
const clipAuditPath = join(root, "scrapers/sites/autmog/clips_audit.csv");
/** Accepted production refill decision. */
const refillDecisionPath = join(
  root,
  "decisions/data/eng-413-production-refill-seed.md",
);
/** Complete available Autmog image archive. */
const imageDirectory = join(root, "apps/web/public/images/tmp");
/** Explicitly excluded Pen tray source identities. */
const trayIds = new Set([
  "7805591322811",
  "7801123176635",
  "7231423381691",
  "7217731240123",
]);

/**
 * Returns the lowercase SHA-256 digest for source or image bytes.
 *
 * @param {Uint8Array} bytes - Bytes to hash.
 * @returns {string} Lowercase hexadecimal digest.
 */
function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Parses the reviewed audit CSV without changing cell text.
 *
 * @param {string} value - Complete CSV source.
 * @returns {Array<Record<string, string>>} Header-keyed source rows.
 */
function parseCsv(value) {
  const rows = [];
  let field = "";
  let quoted = false;
  let row = [];
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"' && quoted && value[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && value[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...values] = rows;
  return values.map((fields) =>
    Object.fromEntries(
      headers.map((header, index) => [header, fields[index] ?? ""]),
    ),
  );
}

/**
 * Extracts one bounded Markdown table as string-keyed records.
 *
 * @param {string} markdown - Reviewed decision document.
 * @param {string} heading - Exact section heading preceding the table.
 * @returns {Array<Record<string, string>>} Parsed table rows.
 * @throws {Error} When the requested section is absent.
 */
function parseMarkdownTable(markdown, heading) {
  const start = markdown.indexOf(heading);
  if (start === -1)
    throw new Error(`Missing refill decision section ${heading}.`);
  const lines = markdown.slice(start).split("\n");
  const tableStart = lines.findIndex((line) => line.startsWith("|"));
  const bounded = [];
  for (const line of lines.slice(tableStart)) {
    if (!line.startsWith("|")) break;
    bounded.push(line);
  }
  const rows = bounded.map((line) =>
    line
      .slice(1, -1)
      .split("|")
      .map((value) => value.trim()),
  );
  const [headers, , ...values] = rows;
  return values.map((fields) =>
    Object.fromEntries(
      headers.map((header, index) => [header, fields[index] ?? ""]),
    ),
  );
}

/**
 * Maps one reviewed Autmog title to its approved compatibility disposition.
 *
 * @param {string} title - Frozen Autmog listing title.
 * @param {string} productId - Shopify product identity for reviewed exceptions.
 * @returns {string | null} Approved group, exact model, evidence-only fact, or null.
 */
function compatibility(title, productId) {
  if (["7426342486203", "7444415742139", "7455381651643"].includes(productId))
    return "parker-g2";
  if (productId === "7357869162683") return "pilot-g2-standard";
  if (productId === "7649912520891" || /energel/iu.test(title))
    return "energel";
  if (/sxr-?5/iu.test(title)) return "jetstream-sxr-full-size";
  if (/umr-83/iu.test(title)) return "exact:uni-ball:UMR-83";
  if (/ohto\s*c-30[57]/iu.test(title)) return "evidence-only:ohto-c-305-c-307";
  if (/schmidt.*p812[67]/iu.test(title))
    return "evidence-only:schmidt-p8126-p8127";
  if (/parker|iso\s*g2|easy\s*flow|p812[67]/iu.test(title)) return "parker-g2";
  if (/pilot\s*g2|rollerball/iu.test(title)) return "pilot-g2-standard";
  return null;
}

/**
 * Validates image magic bytes and returns the matching stored media type.
 *
 * @param {string} path - Source image path.
 * @param {Buffer} bytes - Source image bytes.
 * @returns {"image/jpeg" | "image/png" | "image/webp"} Validated media type.
 * @throws {Error} When the extension or magic bytes are unsupported.
 */
function imageContentType(path, bytes) {
  const extension = extname(path).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8)
      throw new Error(`Invalid JPEG ${path}.`);
    return "image/jpeg";
  }
  if (extension === ".png") {
    if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
      throw new Error(`Invalid PNG ${path}.`);
    return "image/png";
  }
  if (extension === ".webp") {
    if (
      bytes.subarray(0, 4).toString() !== "RIFF" ||
      bytes.subarray(8, 12).toString() !== "WEBP"
    )
      throw new Error(`Invalid WebP ${path}.`);
    return "image/webp";
  }
  throw new Error(`Unsupported image extension ${path}.`);
}

/**
 * Generates immutable Pens import inputs from the frozen reviewed sources.
 *
 * @returns {Promise<void>} Completion after every manifest is written.
 * @rejects When a source, identity, or image fails validation.
 */
async function main() {
  const [archiveBytes, bodyBytes, clipBytes, refillDecisionBytes, imageNames] =
    await Promise.all([
      readFile(archivePath),
      readFile(bodyAuditPath),
      readFile(clipAuditPath),
      readFile(refillDecisionPath),
      readdir(imageDirectory),
    ]);
  const archive = JSON.parse(archiveBytes.toString());
  const bodyAudit = new Map(
    parseCsv(bodyBytes.toString()).map((row) => [row.product_id, row]),
  );
  const clipAudit = new Map(
    parseCsv(clipBytes.toString()).map((row) => [row.product_id, row]),
  );
  const products = Object.values(archive.products).sort((left, right) =>
    String(left.id).localeCompare(String(right.id)),
  );
  const sourceByFile = new Map();
  for (const source of products) {
    for (const [index, image] of source.images.entries()) {
      sourceByFile.set(`${source.id}-${index}`, { image, source });
    }
  }

  const images = [];
  for (const fileName of imageNames.sort()) {
    const path = join(imageDirectory, fileName);
    if (!(await stat(path)).isFile()) continue;
    const match = basename(fileName, extname(fileName)).match(/^(\d+)-(\d+)$/u);
    if (!match)
      throw new Error(`Unrecognized Autmog archive image ${fileName}.`);
    const sourceEntry = sourceByFile.get(`${match[1]}-${match[2]}`);
    if (!sourceEntry)
      throw new Error(`Image ${fileName} has no source identity.`);
    const bytes = await readFile(path);
    images.push({
      contentType: imageContentType(path, bytes),
      disposition: trayIds.has(match[1]) ? "excluded-pen-tray" : "include",
      path: `apps/web/public/images/tmp/${fileName}`,
      position: sourceEntry.image.position ?? Number(match[2]) + 1,
      productSourceRecordId: match[1],
      sha256: sha256(bytes),
      size: bytes.byteLength,
      sourceImageId: String(sourceEntry.image.id),
      sourceUrl: sourceEntry.image.src,
    });
  }

  const autmogProducts = products.map((source) => {
    const sourceRecordId = String(source.id);
    if (trayIds.has(sourceRecordId))
      return {
        disposition: "excluded-pen-tray",
        sourceRecordId,
        title: source.title,
      };
    const body = bodyAudit.get(sourceRecordId);
    const clip = clipAudit.get(sourceRecordId);
    return {
      bodyDetails: body?.body_details || null,
      clip: clip?.manual_override || clip?.auto_classification || null,
      compatibility: compatibility(source.title, sourceRecordId),
      disposition: "include",
      handle: source.handle,
      imageKeys: source.images.map(
        (_image, index) => `${sourceRecordId}-${index}`,
      ),
      listingUrl: `https://www.autmog.com/products/${source.handle}`,
      mechanism: body?.mechanism || clip?.mechanism || null,
      productType: sourceRecordId === "6955113873595" ? "pen-clip" : "pen",
      sourceRecordId,
      title: source.title,
      variants: source.variants.map((variant) => ({
        id: String(variant.id),
        price: variant.price,
        sku: variant.sku,
        title: variant.title,
      })),
    };
  });
  const refillDecision = refillDecisionBytes.toString();
  const refillAdditions = [
    {
      maker: "Pentel",
      model: "LRP5",
      offerings: [
        {
          colors: ["Black"],
          identifiers: ["LRP5-AX"],
          lifecycle: "current",
          tipSize: "0.5 mm",
        },
        {
          colors: ["Blue"],
          identifiers: ["LRP5-CX"],
          lifecycle: "historical",
          tipSize: "0.5 mm",
        },
      ],
    },
    {
      maker: "Pentel",
      model: "LRP7",
      offerings: [
        {
          colors: ["Black"],
          identifiers: ["LRP7-AX"],
          lifecycle: "current",
          tipSize: "0.7 mm",
        },
        {
          colors: ["Blue"],
          identifiers: ["LRP7-CX"],
          lifecycle: "historical",
          tipSize: "0.7 mm",
        },
      ],
    },
    {
      maker: "Pentel",
      model: "LRN5TL",
      offerings: [
        {
          colors: [
            "Black",
            "Red",
            "Burgundy",
            "Blue",
            "Blue-black",
            "Orange",
            "Rough gray",
            "Pink",
            "Turquoise blue",
            "Violet",
          ],
          identifiers: [
            "XLRN5TL-A",
            "XLRN5TL-B",
            "XLRN5TL-BG",
            "XLRN5TL-C",
            "XLRN5TL-CA",
            "XLRN5TL-F",
            "XLRN5TL-N2",
            "XLRN5TL-P",
            "XLRN5TL-S3",
            "XLRN5TL-V",
          ],
          lifecycle: "current",
          market: "JP",
          tipSize: "0.5 mm",
          tipStyle: "needle",
        },
      ],
    },
    ...[
      "G22",
      "G23",
      "G24",
      "G42",
      "G43",
      "W22",
      "W23",
      "W24",
      "M13",
      "M14",
      "M42",
      "M43",
      "M44",
      "D13",
    ].map((model) => ({
      maker: "Monteverde",
      model,
      offerings: [],
      disposition: "approved-product-existence; offering unknowns remain null",
    })),
    {
      maker: "Uni-ball",
      model: "SNP-5",
      offerings: [
        {
          colors: ["Black", "Red"],
          lifecycle: "historical",
          tipSize: "0.5 mm",
        },
      ],
    },
    {
      maker: "Uni-ball",
      model: "SNP-7",
      offerings: [
        {
          colors: ["Black", "Red", "Blue"],
          lifecycle: "historical",
          tipSize: "0.7 mm",
        },
      ],
    },
    {
      maker: "Uni-ball",
      model: "SNP-10",
      offerings: [
        {
          colors: ["Black", "Red", "Blue"],
          lifecycle: "historical",
          tipSize: "1.0 mm",
        },
      ],
    },
    {
      maker: "Pilot",
      model: "BXS-V5-RT",
      offerings: [
        {
          colors: ["Black", "Blue", "Red"],
          identifiers: ["PV5RRBLK/77273", "PV5RRBLU/77274", "PV5RRRED/77275"],
          lifecycle: "historical",
          market: "North America",
          tipSize: "0.5 mm",
        },
      ],
    },
    {
      maker: "Pilot",
      model: "BXS-V7-RT",
      offerings: [
        {
          colors: ["Black", "Blue", "Red"],
          identifiers: ["PV7RRBLK/77278", "PV7RRBLU/77279", "PV7RRRED/77280"],
          lifecycle: "historical",
          market: "North America",
          tipSize: "0.7 mm",
        },
      ],
    },
    {
      maker: "Pilot",
      model: "BXS-V10-RT",
      offerings: [
        {
          colors: ["Black", "Blue"],
          identifiers: ["PV1RRBLK/13905", "PV1RRBLU/13908"],
          lifecycle: "historical",
          market: "North America",
          tipSize: "1.0 mm",
        },
      ],
    },
  ];

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      join(outputDirectory, "autmog.json"),
      `${JSON.stringify(
        {
          expected: {
            excludedTrayListings: 4,
            includedImages: 1162,
            includedProducts: 137,
            penClipProducts: 1,
            penProducts: 136,
          },
          products: autmogProducts,
          schemaVersion: 1,
          sources: [
            {
              path: "scrapers/sites/autmog/data/archive.json",
              sha256: sha256(archiveBytes),
            },
            {
              path: "scrapers/sites/autmog/body_details_audit.csv",
              sha256: sha256(bodyBytes),
            },
            {
              path: "scrapers/sites/autmog/clips_audit.csv",
              sha256: sha256(clipBytes),
            },
          ],
        },
        null,
        2,
      )}\n`,
    ),
    writeFile(
      join(outputDirectory, "images.json"),
      `${JSON.stringify({ images, schemaVersion: 1 }, null, 2)}\n`,
    ),
    writeFile(
      join(outputDirectory, "refills.json"),
      `${JSON.stringify(
        {
          compatibilityGroups: parseMarkdownTable(
            refillDecision,
            "## Compatibility groups and aliases",
          ),
          evidenceKeys: [
            "production-refill-offering-provenance-manifest-008a1f2bed7d",
            "ENG-413-domain-owner-approvals-2026-10-09",
          ],
          offeringRows: parseMarkdownTable(
            refillDecision,
            "## Production offerings",
          ),
          approvedAdditions: refillAdditions,
          schemaVersion: 1,
          source: {
            path: "decisions/data/eng-413-production-refill-seed.md",
            sha256: sha256(refillDecisionBytes),
          },
        },
        null,
        2,
      )}\n`,
    ),
    writeFile(
      join(outputDirectory, "saga.json"),
      `${JSON.stringify(
        {
          evidenceKeys: [
            "pens-and-refills-implementation-plan-5e2fc43c5fd4",
            "ENG-409",
            "ENG-410",
            "ENG-412",
          ],
          expected: {
            appearanceChoices: 2,
            materialChoices: 1,
            products: 3,
            tipChoices: 2,
          },
          missingHistory: {
            disposition: "accepted-omission",
            sourceListings: 0,
            images: 0,
            serialValues: 0,
          },
          product: {
            maker: "Grimsmo",
            name: "Saga",
            slug: "saga",
            type: "pen",
          },
          slots: [
            {
              choices: [{ key: "titanium", material: "Titanium" }],
              key: "material",
              position: 0,
              required: true,
            },
            {
              choices: [
                { finish: "Caramel PVD", key: "caramel-pvd" },
                {
                  finish: "Caramel PVD",
                  key: "helix-caramel-pvd",
                  pattern: "Helix",
                },
              ],
              key: "appearance",
              position: 1,
              required: true,
            },
            {
              choices: [
                { key: "logo-tip", product: "Saga Logo Tip" },
                { key: "no-logo-tip", product: "Saga No-logo Tip" },
              ],
              key: "tip",
              position: 2,
              required: true,
            },
          ],
          unresolvedLaterSlots: [
            { key: "clip", position: 3 },
            { key: "mechanism", position: 4 },
            { key: "actuator", position: 5 },
          ],
          schemaVersion: 1,
        },
        null,
        2,
      )}\n`,
    ),
  ]);
}

await main();
