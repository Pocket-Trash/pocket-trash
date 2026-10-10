# Approve the production cutover gates and cleanup boundaries

Status: Accepted

Sources:

- [Approve the production cutover gates and cleanup boundaries](https://linear.app/pocket-trash/issue/ENG-414/approve-the-production-cutover-gates-and-cleanup-boundaries)
- [Pens production cutover and destructive cleanup gates](https://linear.app/pocket-trash/document/pens-production-cutover-and-destructive-cleanup-gates-e7885e04144e)
- [Normalized Autmog and Saga target mapping](https://linear.app/pocket-trash/document/normalized-autmog-and-saga-target-mapping-67e1ecdc9f36)
- [Production refill offering provenance manifest](https://linear.app/pocket-trash/document/production-refill-offering-provenance-manifest-008a1f2bed7d)

## Decision

Keep ordinary production deployment schema-only. Every data import, object mutation, scraper cutover, production-only refill expansion, object deletion, and temporary-table drop is a separately authorized, identity-checked operation with checksummed inputs and retained evidence.

Deliver Pens in additive stages: schema, frozen manifests, transactional database imports, verified image upload, new application behavior, canonical scraper cutover, and final refill expansion. Preserve all legacy routes, writers, tables, and objects until the new behavior and scraper have passed their production gates.

### Identity and rollback

Production commands fail closed unless repository/release, database environment, Neon project/branch/database/role, storage zone/prefix, migration names and hashes, source checksums, and manifest checksum match the approved operation.

Database imports run in one transaction and emit stable-identity result manifests. Before user or scraper references exist, unchanged rows inserted by one run may be removed only through a separately authorized manifest rollback. After references exist, disable the new behavior and forward-fix. Additive schema remains during application rollback.

Object uploads use deterministic final paths, refuse different-hash overwrites, verify bytes before database linking, and record compensating-cleanup candidates. Scraper rollback remains available only while the legacy writer and tables are intact. Object deletion and table drops require recovery artifacts because they have no online rollback.

### Destructive boundary

After a successful canonical scraper run and idempotent rerun, require seven consecutive days and seven successful scheduled runs with no failures, unexpected changes, or legacy writes before removing legacy application surfaces. Remove `/autmog` without redirects, the JSON/static-site/archive surfaces, related localization, and stale documentation in independently reviewable PRs. Keep the canonical TypeScript scraper.

Before deleting legacy objects, subtract every current database and scraper reference, export the exact candidate bytes and manifest to a non-serving 30-day recovery archive, and delete only explicitly approved paths in bounded batches.

After code no longer references Pen staging storage, require another seven consecutive days of zero reads/writes. The final migration may drop only the three `tmp_autmog_*` Pen tables and four `tmp_grimsmo_pen*` tables named in the linked contract. Do not drop shared `tmp_products`, `tmp_product_variations`, `tmp_images`, or Grimsmo knife tables. Delete shared rows only when their captured IDs are proven exclusive to retired Pen sources and unreferenced by surviving subtypes.

PR #87 remains untouched until legacy removal has shipped and canonical data and behavior are verified; its disposition is a separate project-closeout action.

## Evidence

The release record retains preflight, dry-run, write, postflight, idempotent-rerun, image path/hash, scraper run, cleanup candidate/result, restore-point, and table-drop reports. A changed source or manifest requires a new review and authorization; it is never accepted as an implicit rerun.
