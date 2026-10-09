# Inventory the legacy Autmog and Saga source data

Status: Accepted

Sources:

- [Inventory the legacy Autmog and Saga source data](https://linear.app/pocket-trash/issue/ENG-407/inventory-the-legacy-autmog-and-saga-source-data)
- [Legacy Autmog and Saga source inventory](https://linear.app/pocket-trash/document/legacy-autmog-and-saga-source-inventory-1d22d08e1c67)
- [`scrapers/README.md`](../../scrapers/README.md)
- [`packages/database/src/schema/scraper.ts`](../../packages/database/src/schema/scraper.ts)
- [Image CDN and object paths](../../docs/image-cdn.md)

## Decision

Use the committed Autmog append-only archive and its two manual audit files as migration evidence, subject to the capture gates below. Keep source product ID and listing URL through import. Equal titles, shared source images, and title/handle disagreement require review and never trigger an automatic merge.

Do not approve a Saga source-to-target mapping until the raw append-only archive and image directory are recovered from the Raspberry Pi scraper runner. The expected recovery location is `/home/bvg/autmog/scrapers/sites/grimsmo-saga/data/`. Hostinger receives only derived `data.json` and add-only images, so its missing public Saga path does not prove that the raw archive is absent.

The fresh-baseline database schema, normalization code, synthetic tests, current maker pages, and mutable published output describe shapes or current behavior. They do not replace preserved source captures. Current personal-development and production staging tables contain no Autmog or Saga source records.

## Capture and mapping gates

1. Capture and checksum the current raw Autmog archive, then reconcile the six source IDs present in the deployed 147-record snapshot but absent from the committed 141-record archive.
2. Create an Autmog image manifest containing origin, capture date, path, size, and content hash. Add-only remote storage without that manifest is uncertified evidence.
3. Join manual Autmog audits by source product ID and verify their stored listing URL before applying curated values. Blank body-detail values remain unknown because the audit has no explicit reviewed-blank marker.
4. Recover the Saga raw archive and image directory from the Pi runner. Record origin, capture date, archive checksum, product count, image count, and a path/size/content-hash manifest; rebuild derived data and reconcile its count and paths.
5. Keep a new live scrape as a separately dated source. It cannot stand in for missing historical listings.
6. Generate catalog maintenance input only from approved captures. Database staging IDs and Bunny object paths are storage coordinates, not stable source identities.

ENG-409 and the Saga portion of ENG-411 remain blocked on gate 4. Autmog source mapping remains blocked on gates 1 through 3.

No schema or production-data change is part of this decision.
