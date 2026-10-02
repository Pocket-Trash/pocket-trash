import { type PenProduct, products } from "@/lib/pen-data";
import { normalizedHeadline } from "@/lib/pen-filters";

/**
 * Converts text to a lowercase hyphenated ASCII slug.
 *
 * @param value - Text to normalize.
 * @returns The normalized slug, possibly empty.
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Encodes human-readable name parts and an ID as a shared entity route parameter.
 * The slug is decorative; the trailing base36 code is authoritative, so every collection can use the same route shape.
 * Callers must supply a positive safe integer ID for the route to round-trip.
 *
 * @param nameParts - Human-readable parts used for the decorative slug.
 * @param id - Positive safe integer entity identifier encoded in base36.
 * @returns A decorative slug followed by the authoritative base36 code, or the code alone.
 * @example
 * entityParam(["Orbit", "Titanium"], 42); // "orbit-titanium-16"
 */
export function entityParam(
  nameParts: Array<string | null | undefined>,
  id: number,
): string {
  const slug = slugify(nameParts.filter(Boolean).join(" "));
  const code = id.toString(36);
  return slug ? `${slug}-${code}` : code;
}

/**
 * Decodes the trailing base36 segment while ignoring the decorative slug.
 * Edited slugs, short links, and bare codes therefore resolve to the same entity.
 *
 * @param param - Entity route parameter.
 * @returns The decoded positive ID, or `null` when the trailing segment is empty or has no positive base36 prefix.
 * @example
 * entityIdFromParam("edited-slug-16"); // 42
 */
export function entityIdFromParam(param: string): number | null {
  const code = param.split("-").pop();
  if (!code) return null;
  const id = Number.parseInt(code, 36);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// --- Pens -------------------------------------------------------------------

/**
 * Builds a `/pens/$penId` route parameter from a pen's headline, materials, noses, and Shopify ID.
 *
 * @param product - Archive product to encode.
 * @returns The decorative pen slug followed by the authoritative base36 Shopify code.
 * @example
 * // "38-clipless-click-pen-bronze-titanium-conical-2zmtshtq3"
 * penParam(product);
 */
export function penParam(product: PenProduct): string {
  return entityParam(
    [
      normalizedHeadline(product),
      product.materials.join(" "),
      product.noses.join(" "),
    ],
    product.id,
  );
}

/**
 * Resolves a pen route parameter to the matching imported product or `null`.
 *
 * @param penId - Pen route parameter.
 * @returns The matching imported product, or `null` for an invalid or unknown code.
 */
export function decodePenParam(penId: string): PenProduct | null {
  const id = entityIdFromParam(penId);
  if (id === null) return null;
  return products.find((product) => product.id === id) ?? null;
}
