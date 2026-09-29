import { imageDeliveryQuality } from "../constants.js";
// Full-size delivery uses the Pull Zone's desktop/mobile width limits.
export function imageDeliveryUrl(value: string, width?: number): string {
  const url = new URL(value);
  url.searchParams.set("format", "webp");
  url.searchParams.set("quality", String(imageDeliveryQuality));
  if (width !== undefined) url.searchParams.set("width", String(width));
  return url.toString();
}
