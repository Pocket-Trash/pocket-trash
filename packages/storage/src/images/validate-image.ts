import { imageSize } from "image-size";
import {
  imageMimeTypesByExtension,
  maxImageBytes,
  maxImageInputPixels,
} from "../constants.js";

/**
 * Validates encoded image size, format, dimensions, and decoded pixel count.
 *
 * @param bytes - Encoded image bytes, limited to 25 MiB.
 * @param maxInputPixels - Maximum decoded width multiplied by height.
 * @returns Normalized dimensions, MIME type, and extension.
 * @throws When bytes are empty, oversized, malformed, unsupported, or too large when decoded.
 */
export function inspectImage(
  bytes: Uint8Array,
  maxInputPixels = maxImageInputPixels,
) {
  if (!bytes.byteLength || bytes.byteLength > maxImageBytes)
    throw new Error("Image exceeds the configured size limit.");
  const metadata = imageSize(bytes);
  if (
    !metadata.type ||
    !Object.hasOwn(imageMimeTypesByExtension, `.${metadata.type}`) ||
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
