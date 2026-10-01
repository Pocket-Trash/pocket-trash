/** Maximum accepted source image size in bytes. */
export const maxImageBytes = 25 * 1024 * 1024;
/** Maximum accepted decoded source image pixel count. */
export const maxImageInputPixels = 80_000_000;
/** Default timeout for outbound storage requests in milliseconds. */
export const storageFetchTimeoutMs = 30_000;
/** Maximum size of one resource file in bytes. */
export const maxResourceFileBytes = 20 * 1024 * 1024;
/** Maximum aggregate size of one resource upload session in bytes. */
export const maxResourceSessionBytes = 100 * 1024 * 1024;
/** Maximum resource size buffered in memory in bytes. */
export const maxBufferedResourceBytes = 4 * 1024 * 1024;
/** Maximum image count in one upload session. */
export const maxImageSessionFiles = 20;
/** Maximum aggregate image size per upload session in bytes. */
export const maxImageSessionBytes = 200 * 1024 * 1024;
/** Default signed resource URL lifetime in seconds. */
export const resourceUrlLifetimeSeconds = 120;
/** Default generated image thumbnail width in pixels. */
export const imageThumbnailWidth = 500;
/** Default image delivery quality percentage. */
export const imageDeliveryQuality = 85;
/** Accepted MIME types keyed by normalized image extension. */
export const imageMimeTypesByExtension = {
  ".avif": ["image/avif"],
  ".jpeg": ["image/jpeg"],
  ".jpg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
} as const;
/** Accepted MIME types keyed by normalized resource extension. */
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

/** Maximum file count attached to one resource version. */
export const maxResourceFiles = 10;
/** Maximum image count attached to one resource. */
export const maxResourceImages = 10;
/** Domain targets that may own uploaded content. */
export const uploadTargetTypes = [
  "product",
  "collection",
  "collection_item",
  "resource",
] as const;
/** Domain target that owns uploaded content. */
export type UploadTargetType = (typeof uploadTargetTypes)[number];
/** Storage namespaces that may own images. */
export const imageEntities = [
  "products",
  "collections",
  "collection-items",
  "resources",
] as const;
/** Storage namespace that owns an image. */
export type ImageEntity = (typeof imageEntities)[number];
