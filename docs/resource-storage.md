# Resource Storage

Pocket Trash stores downloadable resources in the shared Bunny Storage Zone and
serves protected files through its linked Pull Zone.

## Bunny services

| Service | Value |
| --- | --- |
| Storage Zone | `pocket-trash-storage` |
| Storage tier | Standard |
| Primary region | New York (`NY`) |
| Pull Zone | `pocket-trash` |
| CDN hostname | `cdn.pocket-trash.app` |

Use the Storage Zone password, not the Bunny account API key, as
`BUNNY_STORAGE_ACCESS_KEY`. Keep every `BUNNY_*` value server-only.

## Object namespaces

| Environment | `BUNNY_RESOURCE_FOLDER_PREFIX` | Object path root |
| --- | --- | --- |
| Production | `resources/files` | `resources/files` |
| Local | `resources/dev` | `resources/dev` |
| Shared preview | `resources/preview` | `resources/preview` |
| Isolated preview | `resources/preview/pr-<number>` | `resources/preview/pr-<number>` |

The PR deploy workflow selects shared or isolated preview storage alongside the
database namespace. The close workflow deletes only the matching isolated PR
prefix.

## Upload sessions

All apps access storage through `@package/services`. The API exposes one authenticated route family:

- `POST /api/v0/storage/upload-sessions` accepts a target (`product`, `collection`, `collection_item`, or `resource`), optional opaque resource metadata, and files with `kind`, original name, MIME type, byte length, and SHA-256.
- `PUT /api/v0/storage/upload-sessions/:sessionId/files/:fileId` accepts the original bytes. Services verify length and hash before sending them to Bunny.
- `POST /api/v0/storage/upload-sessions/:sessionId/complete` attaches all uploads in one database transaction.
- `DELETE /api/v0/storage/file/:fileType/:fileId` checks ownership and deletion rules before removing the object and row. File types are `product_image`, `collection_image`, `collection_item_image`, `resource_image`, and `resource_file`.

Resource payloads are validated in services. Create stores metadata on the session and reserves an ID without creating a draft resource. Completion creates the resource, categories, first version, files and images together. Version uploads reserve their version number before writing files. Buffered resource create/version callers use the same session service.

Sessions expire after one hour. Active sessions reserve their object paths, and overlapping uploads are rejected. Cleanup preserves objects attached to records and retains failed deletions for retry. Completion is idempotent. Expired reservations remain until cleanup succeeds.

Display images allow JPEG, PNG and WebP up to 25 MiB and 80 million pixels. Product, collection and collection-item sessions allow 20 images and 200 MiB total. Resource creation requires 1–10 files and 1–10 images, with 100 MiB total. Each downloadable resource file is limited to 20 MiB, including downloadable images. Filenames within each kind are unique case-insensitively. Resource file extensions are `.3mf`, `.pdf`, `.step`, `.stl`, `.stp`, `.txt`, `.zip`, `.jpg`, `.jpeg`, `.png`, and `.webp` with matching MIME types.

Display images use `{BUNNY_IMAGE_FOLDER_PREFIX}/{entity}/{id}/{sha256}.{ext}`. Downloads use `{BUNNY_RESOURCE_FOLDER_PREFIX}/{resourceId}/v{version}/{sha256}.{ext}`. Original names stay in the database for downloads. The first resource image is its cover. Originals are stored unchanged; Bunny Dynamic Image API optimizes display images on delivery. Images and downloads receive fresh signed URLs on render.

Deletion keeps at least one image per resource and one file per resource version. A current collection cover must be cleared or replaced before deletion.

`@package/storage` owns `createUploadStorage`, `createImageTarget`, `createFileTarget`, `putImage`, and `putFile`; services own permissions and records. Shared Bunny configuration uses `accessKey`, `endpoint`, `zoneName`, and `cdnBaseUrl`, with separate `folderPrefix` and `imageFolderPrefix`. Browser code reads shared limits through `@package/services/constants`.

Run `pnpm resources:reconcile-storage` to review moves and orphan deletions
across every non-production Neon branch and every folder under `resources/`.
The command supports both the legacy preview columns and the gallery schema.
The branch determines the destination:
local-development branches use `resources/dev`, `preview` uses
`resources/preview`, and `preview-pr-<number>` uses
`resources/preview/pr-<number>`. Run
`pnpm resources:reconcile-storage -- --apply` to apply that exact
reconciliation. The production Neon branch is skipped.

Reconciliation preserves resource version folders and the `images/` namespace for resource images. Reserved paths in `upload_file` are protected from orphan deletion; older preview branches retain protection through `resource_upload_files`.
