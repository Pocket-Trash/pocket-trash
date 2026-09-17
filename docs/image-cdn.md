# Image CDN

Pocket Trash uses Bunny for product and collection image storage and delivery.
Shared upload, update, and delete behavior lives in `@package/images` and is
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
| `IMAGE_FOLDER_PREFIX` | production `images`; local `images/dev`; shared preview `images/preview`; isolated PR preview `images/preview/pr-<number>` | Complete image namespace prepended to upload folders. |
| `IMAGE_CDN_BASE_URL` | `https://cdn.pocket-trash.app` | Shared public delivery root. |
| `BUNNY_STORAGE_ZONE_NAME` | `pocket-trash-storage` | Shared Storage Zone name. |
| `BUNNY_STORAGE_ENDPOINT` | `https://ny.storage.bunnycdn.com` | Use the endpoint shown in Bunny if it differs. |
| `BUNNY_STORAGE_ACCESS_KEY` | Storage Zone password | Secret. Required outside dry-run mode. |

## Upload Behavior

Upload folders are built from:

```text
/<IMAGE_FOLDER_PREFIX>/products/<image-owner-key>
```

Before upload, Pocket Trash fetches the remote source image, auto-rotates it,
resizes it so the longest edge is at most 2,000 pixels without enlargement, and
converts it to WebP quality 85. Bunny stores that optimized WebP object.

| Environment | Folder prefix | Lifetime |
| --- | --- | --- |
| Production | `images` | Long term. |
| Preview with isolated PR DB | `images/preview/pr-<number>` | Ephemeral. Delete when the PR closes or merges. |
| Preview using shared staging DB | `images/preview` | Long term non-production. |
| Local dev | `images/dev` | Shared local development namespace. |

## Product Paths

Products use:

```text
/<prefix>/products/<tmp-products-id>
```

Variation images use:

```text
/<prefix>/products/<tmp-products-id>-<tmp-product-variations-id>
```

Autmog pen images are product-level images and use `tmp_products.id` as the
image folder key. Grimsmo images are variation-level images because each scraped
listing handle is a product variation under a stable Grimsmo product.

## Delivery And Transforms

Stored image URLs are built from `IMAGE_CDN_BASE_URL` and the object path.
`IMAGE_CDN_BASE_URL` must include the public Storage Zone path when the CDN
serves one. Thumbnail URLs use Bunny Dynamic Images query transforms, for
example:

```text
https://cdn.pocket-trash.app/images/products/1000/image.webp?width=500&format=webp&quality=85
```

Bunny CDN caches served files and Optimizer transformations.

## CI Behavior

The API deploy workflow selects the preview image prefix from the same DB-change
detection that selects the database branch:

- DB-changing PRs get `IMAGE_FOLDER_PREFIX=images/preview/pr-<number>`.
- PRs without DB changes get `IMAGE_FOLDER_PREFIX=images/preview`.
- DB-changing PR scraper previews set `SCRAPER_CRON_ENABLED=true` because they
  have an isolated Neon branch. PRs without DB changes set
  `SCRAPER_CRON_ENABLED=false` because they share the preview database.

The cleanup workflow removes branch-specific Vercel `IMAGE_FOLDER_PREFIX` when
the PR closes. Isolated PR image folders under `/images/preview/pr-<number>` are
deleted from Bunny Storage.
