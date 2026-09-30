export const maxImageBytes = 25 * 1024 * 1024;
export const maxImageInputPixels = 80_000_000;
export const storageFetchTimeoutMs = 30_000;
export const maxResourceFileBytes = 20 * 1024 * 1024;
export const maxResourceSessionBytes = 100 * 1024 * 1024;
export const maxBufferedResourceBytes = 4 * 1024 * 1024;
export const maxImageSessionFiles = 20;
export const maxImageSessionBytes = 200 * 1024 * 1024;
export const resourceUrlLifetimeSeconds = 120;
export const imageThumbnailWidth = 500;
export const imageDeliveryQuality = 85;
export const imageMimeTypesByExtension = {
  ".jpeg": ["image/jpeg"],
  ".jpg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
} as const;
export const resourceMimeTypesByExtension = {
  ...imageMimeTypesByExtension,
  ".3mf": [
    "application/octet-stream",
    "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
  ],
  ".pdf": ["application/octet-stream", "application/pdf"],
  ".step": ["application/octet-stream", "application/step", "model/step"],
  ".stl": ["application/octet-stream", "application/sla", "model/stl"],
  ".stp": ["application/octet-stream", "application/step", "model/step"],
  ".txt": ["application/octet-stream", "text/plain"],
  ".zip": [
    "application/octet-stream",
    "application/x-zip-compressed",
    "application/zip",
  ],
} as const;

export const maxResourceFiles = 10;
export const maxResourceImages = 10;
export const uploadTargetTypes = [
  "product",
  "collection",
  "collection_item",
  "resource",
] as const;
export type UploadTargetType = (typeof uploadTargetTypes)[number];
export const imageEntities = [
  "products",
  "collections",
  "collection-items",
  "resources",
] as const;
export type ImageEntity = (typeof imageEntities)[number];
