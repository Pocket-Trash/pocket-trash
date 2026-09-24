import { imageSize } from "image-size";
import {
  imageMimeTypesByExtension,
  maxImageBytes,
  maxImageInputPixels,
} from "../constants.js";

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
