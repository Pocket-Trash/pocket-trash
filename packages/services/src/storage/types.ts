import type { Database } from "@package/database";
import type { UploadMetadata } from "@package/storage";
export type StorageDb = Pick<Database, "execute">;
export type UploadActor = { clerkId: string; isAdmin: boolean };
export type UploadTargetType =
  | "product"
  | "collection"
  | "collection_item"
  | "resource";
export type UploadTarget = { type: UploadTargetType; id: number };
export type UploadedFile = UploadMetadata & {
  kind: "image" | "file";
  objectPath: string;
  url: string;
  sha256: string;
  position: number;
};
export class UploadSessionError extends Error {
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
