import type { GrimsmoVariationImageRecord } from "@package/database";
import { htmlToMarkdown } from "@package/markdown";
import { hashObject, hashString } from "../lib/hash.js";
import { htmlToText, normalizeWhitespace } from "../lib/text.js";
import type {
  GrimsmoCollectionKind,
  NormalizedGrimsmoKnifeVariation,
  NormalizedGrimsmoPenVariation,
  NormalizedGrimsmoProduct,
  scraperSources,
} from "../scraper-types.js";
import type { ShopifyProduct } from "../shopify.js";
import {
  buildGrimsmoProductFamilyUrl,
  buildGrimsmoProductUrl,
  getGrimsmoSourceDefinition,
} from "./source.js";

const sagaNumberPattern = /#\s*(\d+)/;
const knifeNumberPattern = /#\s*(\d+)/;
const listItemPattern = /<li[^>]*>(.*?)<\/li>/gis;

const bulletClassifiers = [
  ["book", /\bpocket book\b|\bbook included\b/i],
  ["foam", /\bfoam insert\b/i],
  ["case", /carrying case|\bNanuk\b/i],
  [
    "refill",
    /\bink cartridge\b|\bSchmidt\b|\bSCHMIDT\b|\bLAMY\b|\bPilot\b|\bPentel\b|\bcartridge\b|\brefill\b/i,
  ],
  [
    "mechanism",
    /\bmechanism\b|\b17-?\s*4PH\b|\bceramic bearing\b|\bbearing balls\b/i,
  ],
  [
    "engraving",
    /engraving on the button|logo.* on the button|engraving on button/i,
  ],
  ["tip_logo", /logos? on the tip|logoless tip|on the tip/i],
  ["slider", /\bslider\b|\bbutton mechanism\b/i],
  ["body", /\bbody\b.*\b(tip|clip)\b|\b(tip|clip)\b.*\bbody\b/i],
] as const;

const bodyFinishes = [
  ["Stonewashed", /\bStonewash(?:ed)?\b/i],
  ["Blasted", /\bBlasted\b/i],
  ["Hand Brushed", /\bhand[\s-]*brushed\b|\bSatin\b/i],
  ["DLC Coated", /\bDLC\b/i],
  ["TiAlN PVD", /\bTitanium Aluminum Nitride\b|\bTiAlN\b|\bPVD\b/i],
  ["Polished", /\bPolished\b/i],
  ["Anodized", /\bAnodize[ds]?\b|\bAnodise[ds]?\b/i],
  ["Cerakote", /\bCerakote\b/i],
  ["Plain", /^Titanium Body/i],
] as const;

const colors = [
  ["Black", /\bBlack\b/i],
  ["Plum", /\bPlum\b/i],
  ["Bronze", /\bBronze\b/i],
  ["Blue", /\bBlue\b/i],
  ["Blurple", /\bBlurple\b/i],
  ["Purple", /\bPurple\b/i],
  ["Green", /\bGreen\b/i],
  ["Red", /\bRed\b/i],
  ["Pink", /\bPink\b/i],
  ["Gold", /\bGold\b/i],
  ["Copper", /\bCopper\b/i],
  ["Raw", /\bRaw\b/i],
  ["Silver/Grey", /\bSilver\b|\bGrey\b|\bGray\b/i],
  ["Rainbow", /\bRainbow\b/i],
] as const;

const materials = [
  ["Titanium", /\bTitanium\b/i],
  ["Bronze", /\bBronze\b/i],
  ["Aluminum", /\bAluminum\b|\bAluminium\b/i],
  ["Copper", /\bCopper\b/i],
  ["Damascus", /\bDamascus\b/i],
  ["Zirconium", /\bZirconium\b|\bZirc\b/i],
  ["Delrin", /\bDelrin\b/i],
  ["AEB-L Stainless", /\bAEB-L\b/i],
  ["M2 Stainless", /\bM2 Stainless\b/i],
] as const;

const sliderStyles = [
  ["Helix", /\bHelix\b/i],
  ["Crosshatch", /\bCrosshatch\b|\bCross[\s-]?hatch\b/i],
  ["Spiral", /\bSpiral\b/i],
  ["Plain", /\bSlider\b/i],
] as const;

const refills = [
  ["Schmidt P900F", /SCHMIDT\s*P900F?|Schmidt\s*P900/i],
  ["Schmidt", /\bSchmidt\b/i],
  ["LAMY M22", /LAMY\s*M22/i],
  ["LAMY", /\bLAMY\b/i],
  ["Pilot G2", /\bPilot\s*G2\b/i],
  ["Pilot", /\bPilot\b/i],
  ["Pentel EnerGel", /\bPentel\s*EnerGel\b/i],
] as const;

const cases = [
  ["Algonquin Green", /\bAlgonquin\b/i],
  ["Bisaro Black", /\bBisaro\b/i],
  ["Badlands Orange", /\bBadlands\b/i],
  ["Kananaskis Blue", /\bKananaskis\b/i],
  ["Moose Blood Red", /\bMoose\b/i],
  ["Black", /Black\s+Nanuk|Nanuk\s+x\s+Grimsmo\s+Black\b/i],
  ["Other Nanuk", /\bNanuk\b/i],
  ["Other Case", /carrying case/i],
] as const;

const engraving = [
  [
    "Grimsmo Logo",
    /Grimsmo\s+Logo\s+Engraving|Grimsmo\s+Logo\s+on\s+the\s+Button/i,
  ],
  [
    "No Logo",
    /No\s+Logo\s+Engraving|No\s+Engraving|No\s+Logo\s+on\s+the\s+Button/i,
  ],
] as const;

const tipLogo = [
  ["Grimsmo Logo", /Grimsmo\s+Logos?\s+on\s+the\s+Tip/i],
  [
    "None",
    /No\s+Grimsmo\s+Logos?\s+on\s+the\s+Tip|No\s+Logos?\s+on\s+the\s+Tip|Logoless\s+tip/i,
  ],
] as const;

const books = [
  ["Grimsmo V2 Pocket Book", /V2\s+Pocket\s+Book/i],
  ["Grimsmo Pocket Book", /Pocket\s+Book/i],
] as const;

const knifePatterns = [
  ["Starburst", /\bStarburst\b/i],
  ["Streamline", /\bStreamline\b/i],
  ["Smooth", /\bSmooth\b/i],
  ["Dragon Scales", /\bDragon Scales\b/i],
  ["Honeycomb", /\bHoneycomb\b/i],
] as const;

const bladeSteels = [
  ["RWL 34", /\bRWL\s*34\b/i],
  ["CPM 154", /\bCPM\s*154\b/i],
  ["AEB-L", /\bAEB-L\b/i],
] as const;

const mechanisms = [
  ["Button Lock", /\bButton Lock\b/i],
  ["Lock Bar Insert", /\bLock Bar Insert\b/i],
] as const;

export function normalizeGrimsmoPenVariation(input: {
  collectionKind: GrimsmoCollectionKind;
  product: ShopifyProduct;
  source: typeof scraperSources.grimsmoSaga;
}): NormalizedGrimsmoPenVariation {
  const productDefinition = getGrimsmoSourceDefinition(input.source);
  const product = input.product;
  const bodyText = htmlToText(product.body_html ?? null);
  const description = htmlToMarkdown(product.body_html ?? null);
  const bullets = extractBullets(product.body_html ?? "");
  const bulletsByCategory = classifyBullets(bullets);
  const fullBodyText = bodyText ?? "";
  const bodyTextForSearch = getCategoryText(bulletsByCategory, "body");
  const sliderText = getCategoryText(bulletsByCategory, "slider");
  const caseText = getCategoryText(bulletsByCategory, "case") || fullBodyText;
  const refillText =
    getCategoryText(bulletsByCategory, "refill") || fullBodyText;
  const engravingText =
    getCategoryText(bulletsByCategory, "engraving") || fullBodyText;
  const tipText =
    getCategoryText(bulletsByCategory, "tip_logo") || fullBodyText;
  const bookText = getCategoryText(bulletsByCategory, "book") || fullBodyText;
  const sagaNumber = extractNumber(product.title, sagaNumberPattern);
  const title = sagaNumber ? `Saga #${sagaNumber}` : product.title;
  const visibleBullets = [
    "body",
    "slider",
    "engraving",
    "tip_logo",
    "refill",
  ].flatMap((category) => bulletsByCategory[category] ?? []);
  const images = normalizeImages(product);
  const imageSetHash = getImageSetHash(images);
  const variants = normalizeVariants(product);
  const prices = getVariantPriceCents(product);
  const availableForSale = getAvailableForSale(product);
  const normalizedData = {
    availableForSale,
    bodyColors: matchAll(bodyTextForSearch, colors),
    bodyFinishes: matchAll(bodyTextForSearch, bodyFinishes),
    bodyMaterials: matchAll(bodyTextForSearch, materials),
    book: matchFirst(bookText, books),
    bullets,
    bulletsByCategory,
    case: matchFirst(caseText, cases),
    description,
    engraving: matchFirst(engravingText, engraving),
    imageSetHash,
    images,
    priceMaxCents: prices.length > 0 ? Math.max(...prices) : null,
    priceMinCents: prices.length > 0 ? Math.min(...prices) : null,
    productUrl: buildGrimsmoProductUrl(product.handle),
    refill: matchFirst(refillText, refills),
    sagaNumber,
    sliderColors: matchAll(sliderText, colors),
    sliderMaterials: matchAll(sliderText, materials),
    sliderStyle: matchFirst(sliderText, sliderStyles),
    tipLogo: matchFirst(tipText, tipLogo),
    title,
    titleFull: product.title,
    variants,
    visibleBullets,
  };
  const detailsHash = hashObject({
    ...normalizedData,
    images: undefined,
    imageSetHash: undefined,
  });

  return {
    ...normalizedData,
    bodyText,
    currencyCode: "USD",
    detailsHash,
    imageSetHash,
    images,
    product: normalizeGrimsmoProduct(productDefinition),
    sourceCollection: input.collectionKind,
    sourceHandle: product.handle,
    sourceProductId: String(product.id),
    tags: product.tags,
  };
}

export function normalizeGrimsmoKnifeVariation(input: {
  collectionKind: GrimsmoCollectionKind;
  product: ShopifyProduct;
  source:
    | typeof scraperSources.grimsmoFjell
    | typeof scraperSources.grimsmoNorseman
    | typeof scraperSources.grimsmoRask;
}): NormalizedGrimsmoKnifeVariation {
  const productDefinition = getGrimsmoSourceDefinition(input.source);

  if (productDefinition.kind !== "knife") {
    throw new Error(`Expected knife source, received "${input.source}".`);
  }

  const product = input.product;
  const bodyText = htmlToText(product.body_html ?? null);
  const description = htmlToMarkdown(product.body_html ?? null);
  const bullets = extractBullets(product.body_html ?? "");
  const bulletsByCategory = classifyKnifeBullets(bullets);
  const fullBodyText = bodyText ?? "";
  const handleText =
    getCategoryText(bulletsByCategory, "handle") || fullBodyText;
  const hardwareText =
    getCategoryText(bulletsByCategory, "hardware") || fullBodyText;
  const bladeText = getCategoryText(bulletsByCategory, "blade") || fullBodyText;
  const caseText = getCategoryText(bulletsByCategory, "case") || fullBodyText;
  const mechanismText =
    getCategoryText(bulletsByCategory, "mechanism") || fullBodyText;
  const images = normalizeImages(product);
  const imageSetHash = getImageSetHash(images);
  const variants = normalizeVariants(product);
  const prices = getVariantPriceCents(product);
  const availableForSale = getAvailableForSale(product);
  const knifeNumber = extractNumber(product.title, knifeNumberPattern);
  const title = knifeNumber
    ? `${productDefinition.title} #${knifeNumber}`
    : product.title;
  const normalizedData = {
    availableForSale,
    bladeFinishes: matchAll(bladeText, bodyFinishes),
    bladeSteels: matchAll(bladeText, bladeSteels),
    bodyText,
    bullets,
    bulletsByCategory,
    case: matchFirst(caseText, cases),
    description,
    handleColors: matchAll(handleText, colors),
    handleFinishes: matchAll(handleText, bodyFinishes),
    handleMaterials: matchAll(handleText, materials),
    hardwareColors: matchAll(hardwareText, colors),
    imageSetHash,
    images,
    knifeNumber,
    knifeType: productDefinition.knifeType,
    mechanisms: matchAll(mechanismText, mechanisms),
    patterns: matchAll(fullBodyText, knifePatterns),
    priceMaxCents: prices.length > 0 ? Math.max(...prices) : null,
    priceMinCents: prices.length > 0 ? Math.min(...prices) : null,
    productUrl: buildGrimsmoProductUrl(product.handle),
    title,
    titleFull: product.title,
    variants,
  };
  const detailsHash = hashObject({
    ...normalizedData,
    images: undefined,
    imageSetHash: undefined,
  });

  return {
    ...normalizedData,
    currencyCode: "USD",
    detailsHash,
    imageSetHash,
    images,
    product: normalizeGrimsmoProduct(productDefinition),
    sourceCollection: input.collectionKind,
    sourceHandle: product.handle,
    sourceProductId: String(product.id),
    tags: product.tags,
  };
}

export function extractBullets(bodyHtml: string): string[] {
  if (!bodyHtml) {
    return [];
  }

  const listBullets = [...bodyHtml.matchAll(listItemPattern)]
    .map((match) => stripHtml(match[1] ?? ""))
    .filter((bullet) => bullet.length > 3 && bullet.length < 300);

  if (listBullets.length > 0) {
    return listBullets;
  }

  return stripHtml(bodyHtml)
    .split(/(?:^|\s|\.)\s*-\s+/)
    .map((part) => normalizeWhitespace(part).replace(/\.$/, ""))
    .filter(
      (part) =>
        part.length > 5 &&
        part.length < 300 &&
        !part.toLowerCase().startsWith("custom titanium saga pen"),
    );
}

function classifyBullets(bullets: readonly string[]) {
  const classified: Record<string, string[]> = {};

  for (const bullet of bullets) {
    const category =
      bulletClassifiers.find(([, pattern]) => pattern.test(bullet))?.[0] ??
      "other";

    classified[category] ??= [];
    classified[category].push(bullet);
  }

  return classified;
}

function classifyKnifeBullets(bullets: readonly string[]) {
  const classified: Record<string, string[]> = {};

  for (const bullet of bullets) {
    const category = getKnifeBulletCategory(bullet);

    classified[category] ??= [];
    classified[category].push(bullet);
  }

  return classified;
}

function getKnifeBulletCategory(bullet: string): string {
  if (/carrying case|\bNanuk\b/i.test(bullet)) {
    return "case";
  }

  if (/\bblade\b|\bRWL\s*34\b|\bCPM\s*154\b/i.test(bullet)) {
    return "blade";
  }

  if (
    /\bmechanism\b|\bbearing\b|\bLock Bar Insert\b|\bButton Lock\b/i.test(
      bullet,
    )
  ) {
    return "mechanism";
  }

  if (/\bhardware\b|\bclip\b/i.test(bullet)) {
    return "hardware";
  }

  if (/\bhandle\b|\bpattern\b/i.test(bullet)) {
    return "handle";
  }

  if (/\bfoam\b|\boil\b|\bdriver\b/i.test(bullet)) {
    return "accessory";
  }

  return "other";
}

function normalizeImages(
  product: ShopifyProduct,
): GrimsmoVariationImageRecord[] {
  return product.images.map((image, index) => {
    const sourceImageId = image.id === undefined ? null : String(image.id);
    const position = image.position ?? index + 1;
    const width = image.width ?? null;
    const height = image.height ?? null;

    return {
      altText: image.alt ?? null,
      height,
      position,
      sourceHash: hashString(
        JSON.stringify({
          height,
          sourceImageId,
          sourceUrl: image.src,
          width,
        }),
      ),
      sourceImageId,
      sourceUrl: image.src,
      width,
    };
  });
}

function getImageSetHash(images: readonly GrimsmoVariationImageRecord[]) {
  return hashObject(
    images.map((image) => ({
      position: image.position,
      sourceHash: image.sourceHash,
      sourceImageId: image.sourceImageId,
      sourceUrl: image.sourceUrl,
    })),
  );
}

function normalizeVariants(product: ShopifyProduct): unknown[] {
  return product.variants.map((variant) => ({
    available: variant.available ?? null,
    id: String(variant.id),
    price: variant.price ?? null,
    title: variant.title ?? null,
  }));
}

function getVariantPriceCents(product: ShopifyProduct): number[] {
  return product.variants
    .map((variant) => parsePriceCents(variant.price))
    .filter((price): price is number => price !== null);
}

function parsePriceCents(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue =
    typeof value === "number" ? value : Number(value.replace(/[^0-9.]/g, ""));

  return Number.isFinite(numberValue) ? Math.round(numberValue * 100) : null;
}

function getAvailableForSale(product: ShopifyProduct) {
  return (
    product.available ??
    product.variants.some((variant) => variant.available === true)
  );
}

function normalizeGrimsmoProduct(
  definition: ReturnType<typeof getGrimsmoSourceDefinition>,
): NormalizedGrimsmoProduct {
  const product = {
    productHandle: definition.productHandle,
    productUrl: buildGrimsmoProductFamilyUrl(definition.productHandle),
    title: definition.title,
  };

  return {
    ...product,
    detailsHash: hashObject(product),
  };
}

function extractNumber(value: string, pattern: RegExp): string | null {
  return value.match(pattern)?.[1] ?? null;
}

function getCategoryText(
  bulletsByCategory: Record<string, string[]>,
  category: string,
) {
  return (bulletsByCategory[category] ?? []).join(" ");
}

function matchFirst(
  value: string,
  patterns: readonly (readonly [string, RegExp])[],
): string | null {
  return patterns.find(([, pattern]) => pattern.test(value))?.[0] ?? null;
}

function matchAll(
  value: string,
  patterns: readonly (readonly [string, RegExp])[],
): string[] {
  return patterns
    .filter(([, pattern]) => pattern.test(value))
    .map(([label]) => label);
}

function stripHtml(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}
