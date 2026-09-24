import { imageSize } from "image-size";

export { readResponseBodyWithLimit } from "./body.js";
export const maxImageBytes = 25 * 1024 * 1024;

export function inspectImage(bytes: Uint8Array, maxInputPixels = 80_000_000) {
  if (!bytes.byteLength || bytes.byteLength > maxImageBytes)
    throw new Error("Image exceeds the configured size limit.");
  const metadata = imageSize(bytes);
  if (
    !metadata.type ||
    !["jpg", "png", "webp"].includes(metadata.type) ||
    !metadata.width ||
    !metadata.height ||
    metadata.width * metadata.height > maxInputPixels
  )
    throw new Error("Unsupported image format or dimensions.");
  return {
    width: metadata.width,
    height: metadata.height,
    contentType: `image/${metadata.type === "jpg" ? "jpeg" : metadata.type}`,
    extension: metadata.type,
  };
}

// Full-size delivery uses the Pull Zone's desktop/mobile width limits.
export function imageDeliveryUrl(value: string, width?: number): string {
  const url = new URL(value);
  url.searchParams.set("format", "webp");
  url.searchParams.set("quality", "85");
  if (width !== undefined) url.searchParams.set("width", String(width));
  return url.toString();
}
