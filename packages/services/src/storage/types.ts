import type { Database } from "@package/database";
import type { UploadMetadata } from "@package/storage";
import type { Actor } from "../authorization.js";
/** Minimal database surface used by storage workflow helpers. */
export type StorageDb = Pick<Database, "execute">;
/** Authenticated actor allowed to own or administer an upload. */
export type UploadActor = Actor;

import type { UploadTargetType } from "@package/storage/constants";

export type { UploadTargetType } from "@package/storage/constants";
/** Entity whose files or images are being uploaded. */
export type UploadTarget = {
  /** Target entity kind. */
  type: UploadTargetType;
  /** Target entity identifier. */
  id: number;
};
/** Persisted metadata for a file accepted by an upload session. */
export type UploadedFile = UploadMetadata & {
  /** Whether the object is an attachment or display image. */
  kind: "image" | "file";
  /** Object-storage path. */
  objectPath: string;
  /** Public delivery URL recorded with the upload. */
  url: string;
  /** Lowercase SHA-256 digest supplied by storage metadata. */
  sha256: string;
  /** Zero-based position within its image or file kind. */
  position: number;
};
/** Caller-visible upload-session failure with an HTTP status and optional conflict metadata. */
export class UploadSessionError extends Error {
  /**
   * Creates a stable upload failure for service and HTTP error handling.
   *
   * @param code - Stable upload error code returned to callers.
   * @param status - HTTP status associated with the failure.
   * @param imageId - Existing image involved in a duplicate conflict.
   * @param sha256 - Digest involved in a duplicate conflict.
   */
  constructor(
    readonly code: string,
    readonly status: 400 | 404 | 409 | 411 | 502,
    readonly imageId?: number,
    readonly sha256?: string,
  ) {
    super(code);
    this.name = "UploadSessionError";
  }
}
