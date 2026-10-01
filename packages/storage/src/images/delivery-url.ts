import { imageDeliveryQuality } from "../constants.js";
// Full-size delivery uses the Pull Zone's desktop/mobile width limits.
/**
 * Adds WebP quality and optional width transforms to an image delivery URL.
 *
 * @param value - Absolute image delivery URL.
 * @param width - Optional output width in pixels.
 * @returns The transformed delivery URL.
 * @throws When the input is not a valid absolute URL.
 */
export function imageDeliveryUrl(value: string, width?: number): string {
  const url = new URL(value);
  url.searchParams.set("format", "webp");
  url.searchParams.set("quality", String(imageDeliveryQuality));
  if (width !== undefined) url.searchParams.set("width", String(width));
  return url.toString();
}
