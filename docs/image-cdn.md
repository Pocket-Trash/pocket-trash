# Image CDN

Pocket Trash uses Bunny for product and collection image storage and delivery.
Shared upload, update, and delete behavior lives in `@package/storage` and is
exposed to apps through `@package/services`.

## Bunny Services

Create these Bunny resources:

| Service | Suggested value | Purpose |
| --- | --- | --- |
| Storage Zone | `pocket-trash-storage` | Stores all Pocket Trash files. |
| Storage tier | Standard | Keeps storage simple for the initial launch. |
| Primary region | New York | Closest default region for North American users. |
| Pull Zone | `pocket-trash` | CDN delivery for the Storage Zone. |
| Optimizer | Enabled | Enables cached query-based transformations. |
| Dynamic Images API | Enabled | Supports width/format/quality query transforms. |
| Custom hostname | `cdn.pocket-trash.app` | Serves images from the Pocket Trash domain. |

Use the Storage Zone password from Bunny Storage Zone -> Access -> API/HTTP as
`BUNNY_STORAGE_ACCESS_KEY`. Do not use the global Bunny API key for runtime image
uploads.

## Runtime Env Vars

| Variable | Suggested value | Notes |
| --- | --- | --- |
| `IMAGE_STORAGE_PROVIDER` | unset, defaults to `bunny` | Set only to override provider selection. Unsupported values fail fast. |
| `BUNNY_IMAGE_FOLDER_PREFIX` | production `images`; local `images/dev`; shared preview `images/preview`; isolated PR preview `images/preview/pr-<number>` | Complete image namespace prepended to upload folders. |
| `BUNNY_CDN_BASE_URL` | `https://cdn.pocket-trash.app` | Shared public delivery root. |
| `BUNNY_STORAGE_ZONE_NAME` | `pocket-trash-storage` | Shared Storage Zone name. |
| `BUNNY_STORAGE_ENDPOINT` | `https://ny.storage.bunnycdn.com` | Use the endpoint shown in Bunny if it differs. |
| `BUNNY_STORAGE_ACCESS_KEY` | Storage Zone password | Secret. Required outside dry-run mode. |

## Upload Behavior

Upload folders are built from:

```text
{BUNNY_IMAGE_FOLDER_PREFIX}/{entity}/{id}/{sha256}.{ext}
```

Pocket Trash validates the source format, dimensions, and 25 MiB size limit,
then uploads the original bytes to Bunny Storage with their original format.
Bunny Optimizer performs conversion, resizing, and compression at delivery time.

| Environment | Folder prefix | Lifetime |
| --- | --- | --- |
| Production | `images` | Long term. |
| Preview with isolated PR DB | `images/preview/pr-<number>` | Ephemeral. Delete when the PR closes or merges. |
| Preview using shared staging DB | `images/preview` | Long term non-production. |
| Local dev | `images/dev` | Shared local development namespace. |

## Image Paths

Display images use `{BUNNY_IMAGE_FOLDER_PREFIX}/{entity}/{id}/{sha256}.{ext}`.
The entity values are `products`, `collections`, `collection-items`, and `resources`.
Uploaded filenames use the SHA-256 of the original bytes and the original extension.

Scraper images use the same path builder, with a source image ID instead of the hash when available. Product owner IDs remain `tmp_products.id`; variation owner IDs remain `<tmp-products-id>-<tmp-product-variations-id>`. Autmog pen images are product-level, while Grimsmo images are variation-level. No existing scraper paths change.

## Delivery And Transforms

Stored image URLs are built from `BUNNY_CDN_BASE_URL` and the object path.
`BUNNY_CDN_BASE_URL` must include the public Storage Zone path when the CDN
serves one. Thumbnail URLs use Bunny Dynamic Images query transforms, for
example:

```text
https://cdn.pocket-trash.app/images/products/1000/image.webp?width=500&format=webp&quality=85
```

Bunny CDN caches served files and Optimizer transformations.

## CI Behavior

The API deploy workflow selects the preview image prefix from the same DB-change
detection that selects the database branch:

- DB-changing PRs get `BUNNY_IMAGE_FOLDER_PREFIX=images/preview/pr-<number>`.
- PRs without DB changes get `BUNNY_IMAGE_FOLDER_PREFIX=images/preview`.
- DB-changing PR scraper previews set `SCRAPER_CRON_ENABLED=true` because they
  have an isolated Neon branch. PRs without DB changes set
  `SCRAPER_CRON_ENABLED=false` because they share the preview database.

The cleanup workflow removes branch-specific Vercel `BUNNY_IMAGE_FOLDER_PREFIX` when
the PR closes. Isolated PR image folders under `/images/preview/pr-<number>` are
deleted from Bunny Storage.

## Central storage package

`@package/storage` replaces `@package/images` and `@package/resources`. It owns
Bunny transport, upload validation and targets, signed downloads, image delivery
URLs, deletion, and preview cleanup. Images retain their original bytes, MIME
type, extension, and dimensions in storage. JPEG, PNG, and WebP inputs are
supported up to 25 MiB and 80 million pixels. The API handles user uploads; the
scraper imports this package through services for its own uploads only. No
service calls the scraper, and no always-on Node processor is needed.

### Bunny Dynamic Image API

Enable both Bunny Optimizer and **Dynamic Image API** on the Pull Zone.
`imageDeliveryUrl` adds `format=webp&quality=85` to image URLs, including signed
catalog and resource image URLs. Thumbnail URLs additionally request `width=500`.
Original resource-file downloads retain their existing URLs without transforms.
See [Dynamic Image API](https://bunny.net/docs/optimizer/dynamic-images/overview).

Full-size image URLs omit an explicit width so Smart Image Optimization uses the
configured dashboard limits: **2000 px desktop width**, **1000 px mobile width**,
and **85 quality** for both. These are width limits, not longest-edge limits.
Bunny preserves the stored original and caches transformed variants at the edge.
Existing objects do not require a conversion or storage migration.

Cloudflare Image Transformations, temporary source objects, and API signing keys
for processing are unnecessary. Existing signed-download credentials remain in
the web/services configuration. No scraper deployment or scheduler changes are
required.

Preview cleanup runs `pnpm --filter @package/storage cleanup:preview` once to delete both isolated image and resource prefixes.

## Shared paths and signing

The scraper and upload service use the same validated image path builder:
`{BUNNY_IMAGE_FOLDER_PREFIX}/{entity}/{entityId}/{name}.{ext}`.
Entities are `products`, `collections`, `collection-items`, and `resources`.
Uploaded names are the SHA-256 of the original bytes. Scraper names use the source image ID when available, otherwise the same SHA-256 rule. Variation owner keys remain unchanged.

`BUNNY_IMAGE_FOLDER_PREFIX` is required by the API Worker as well as the scraper and web storage configuration. The deploy workflow sets it alongside the resource prefix for each environment.

The services `signImages` helper signs uploaded product, collection, collection-item and resource images at render, then applies Bunny Dynamic Image API parameters. Tokens last 120 seconds. Enforcing tokens on the `images/*` CDN namespace remains a separate Bunny dashboard change; scraper delivery is unchanged.
