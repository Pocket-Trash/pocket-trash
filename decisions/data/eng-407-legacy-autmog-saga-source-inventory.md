# Inventory the legacy Autmog and Saga source data

Status: Accepted

Sources:

- [Inventory the legacy Autmog and Saga source data](https://linear.app/pocket-trash/issue/ENG-407/inventory-the-legacy-autmog-and-saga-source-data)
- [`scrapers/sites/autmog/data/archive.json`](../../scrapers/sites/autmog/data/archive.json)
- [`scrapers/sites/autmog/body_details_audit.csv`](../../scrapers/sites/autmog/body_details_audit.csv)
- [`scrapers/sites/autmog/clips_audit.csv`](../../scrapers/sites/autmog/clips_audit.csv)
- [`packages/database/src/schema/scraper.ts`](../../packages/database/src/schema/scraper.ts)
- [Image CDN and object paths](../../docs/image-cdn.md)

## Decision

Approve the preserved Autmog archive and its two manual audit files as migration evidence, subject to the freshness gate below. Do not approve a Saga source-to-target mapping: no authoritative preserved Saga records are currently available.

The fresh-baseline database schema, normalization code, tests, current maker pages, and mutable published output describe shapes or current behavior. They do not replace a preserved source capture.

## Source inventory

| Source | Contents | Authority and limits |
| --- | --- | --- |
| Committed Autmog `archive.json` | Raw Shopify product records keyed by source product ID, including handles, titles, HTML, timestamps, tags, variants, source image URLs, local image paths, and first/last-seen fields | Authoritative preserved raw evidence for its 141 records. The Git blob is `bb96179ae4a5e5ef85fd1f563d8fe646eca0eb31`. It trails the published snapshot by six records. |
| Autmog audit CSVs | 136 body-detail decisions and 23 clip decisions keyed by source product ID and listing URL | Authoritative curated evidence only for the columns explicitly reviewed. They do not replace raw listing records. |
| `https://machinedpens.info/data.json` | Derived Autmog display records and static image paths | A useful deployed snapshot, observed with 147 records and 1,261 referenced local image paths on 2026-10-09. It is mutable, derived, and not an approved import artifact until captured with a checksum beside its corresponding raw archive. |
| Published Autmog images | Add-only files referenced as `images/<shopify-product-id>-<position>.<extension>` | Preserved image bytes for referenced paths, but the path does not prove catalog identity or image ownership by itself. |
| Grimsmo Saga repository data | Only `.gitkeep`; no `archive.json`, `data.json`, images, or raw snapshot | No records to map. |
| `https://machinedpens.info/grimsmo-saga/` | Intended deployed Saga subdirectory | Returned 404 on 2026-10-09. It is not a preserved source. |
| Fresh-baseline staging tables | Normalized Autmog and Saga products, variations, images, and version snapshots | Schema only. Read-only checks of the selected personal development branch and production on 2026-10-09 found zero Autmog pen rows and zero Saga variation rows. |
| Current Shopify collection endpoints | Mutable current listings | Discovery input only. They cannot prove deleted listings, prior URLs, or historical appearance combinations. |

The deployment configuration names an SSH alias, `autmog-hostinger`, as the archive host. That alias is not resolvable in this workspace, and deployment publishes only derived `data.json` plus add-only images. The raw remote `archive.json` is therefore neither accessible nor proven by the public site.

## Database shapes, not records

The fresh baseline creates the following empty source tables:

- Autmog: `tmp_products`, `tmp_autmog_pens`, `tmp_autmog_pen_materials`, `tmp_images`, and `tmp_autmog_pen_versions`.
- Saga: `tmp_products`, `tmp_grimsmo_pens`, `tmp_product_variations`, `tmp_grimsmo_pen_variations`, `tmp_images`, `tmp_grimsmo_pen_versions`, and `tmp_grimsmo_pen_variation_versions`.

Autmog images are product-scoped. Saga images are variation-scoped. Bunny object paths use the configured environment prefix followed by `products/<owner-id>/<source-image-id-or-byte-hash>.<extension>`; the owner ID is `tmp_products.id` for Autmog and `<tmp-products-id>-<tmp-product-variations-id>` for Saga. Database IDs and object paths are storage coordinates, not stable source identities.

Version rows preserve normalized snapshots only after ingestion. With no current source rows, they provide no pre-baseline recovery path.

## Autmog evidence and anomalies

The committed archive contains:

- 141 distinct source product IDs and handles;
- 143 variants, including the three material variants of source product `6955113873595`, `Pen Clips`;
- 1,176 source images and 1,176 unique local paths;
- no duplicate handles, local paths, or missing image sets;
- two pairs of equal titles with different source IDs and listing URLs; and
- 22 source image URLs reused across nine products.

Equal titles are not duplicate proof:

| Title | Distinct source IDs and handles |
| --- | --- |
| `36 Click Pen - 6Al-4V Titanium - ISO G2 (Parker) Refill - Step Nose - 6Al-4V Titanium Clip` | `7673648578747` / `36-click-pen-6al-4v-titanium-iso-g2-parker-step-nose-6al-4v-titanium-clip`; `7902117068987` / `36-click-pen-6al-4v-titanium-iso-g2-parker-refill-step-nose-6al-4v-titanium-clip` |
| `37 Click Pen - 6Al-4V Titanium - Round Nose - Silicone Nitride Ball - Pilot G2` | `7866256851131` / `37-click-pen-6al-4v-titanium-round-nose-silicone-nitride-ball-pilot-g2`; `7899166671035` / `37-click-pen-6al-4v-titanium-round-nose-silicone-nitride-ball-pilot-g2-1` |

Reused image URLs occur in these source-ID groups:

| Source IDs | Shared source image URL count |
| --- | ---: |
| `8003698000059`, `8004006772923` | 2 |
| `8148963786939`, `8185010225339` | 7 |
| `8158274388155`, `8187768307899` | 6 |
| `8210407030971`, `8211176882363` | 4 |
| `8210407030971`, `8215894982843` | 3 |

Shared images are evidence for review, not automatic deduplication. Source listing identity remains the Shopify product ID plus listing URL until an explicit comparison proves the listings identical.

The published snapshot adds six source IDs absent from the committed archive: `8490429350075`, `8506912407739`, `8523554324667`, `8530512380091`, `8547939811515`, and `15401128886459`. One exposes a source anomaly immediately: product `8547939811515` is titled `47 Clipless Twist Pen` while its handle begins `45-clipless-twist-pen`. Preserve both source values; do not repair either during import.

The body-detail audit covers 136 records. The clip audit covers 23 records, including 20 manual classifications and two `Tapered` notes. Audit classifications may supplement the matching source ID but must not be generalized to unreviewed products.

## Saga evidence gap

The Saga normalizer recognizes body finish, colour, and material; slider style, material, and colour; refill; case; engraving; tip logo; pocket book; listing handle; Saga number; variants; and variation-level images. Those fields define the expected inventory shape but do not establish which combinations occurred.

Tests contain synthetic fixtures only. The fresh baseline and production contain no Saga rows. The intended public mirror is absent. Consequently, there is no evidence-backed list of Saga listing URLs, repeated URLs, images, object paths, apparent duplicates, or appearance combinations.

Before ENG-409 or the Saga portion of ENG-411 can be approved, obtain one immutable Saga capture containing the raw append-only archive and image manifest. Record its capture date, byte checksum, product count, image count, and origin. If recovered from the configured archive host, compare its derived record count and paths with the image directory before accepting it. A new live scrape may be retained as a separately dated source, but cannot stand in for missing historical listings.

## Mapping gates

1. Capture and checksum the current 147-record Autmog raw archive, then reconcile the six missing IDs against the committed 141-record archive.
2. Keep source product ID and listing URL through import. Flag equal titles, repeated image URLs, and title/handle disagreement for review; never merge them automatically.
3. Join manual Autmog audits by source product ID and verify the stored listing URL still matches before applying curated values.
4. Recover or create the dated Saga preserved capture described above. Until then, Saga combination testing and Saga source mapping are blocked by missing evidence.
5. Generate catalog maintenance input from approved source captures, not from database staging IDs or mutable live responses.

No schema or production-data change is part of this decision.
