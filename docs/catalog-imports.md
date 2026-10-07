# Catalog imports

Production catalog imports use the reusable `@package/services/catalog-import`
runner. Exact manifests and source-image bytes remain outside the merged
repository; the durable safety contract, application history, and ownership
mappings ship with the application.

## Manifest contract

`catalog-import-v1` is catalog-only. Its entity allowlist covers makers,
catalog vocabulary, products, subtype rows, appearances, compatibility and
inclusion relationships, slider magnet configurations, insert offers, and
terminology aliases. Collection entities are rejected.

Records are dependency ordered. Each record has:

- a stable manifest key and allowlisted entity type;
- a JSON payload interpreted by the operation-specific executor;
- named references to earlier records;
- an expected prior state of `absent` or an exact SHA-256 fingerprint.

Images have stable keys, product-owner record keys, gallery positions, media
types, byte counts, and SHA-256 checksums. Every imported product must use the
manifest owner and start approved and public.

The canonical manifest hash includes the complete manifest. The separate
`approvalPayloadHash` links it to the reviewed scope and provenance artifact.

## Required operator flow

1. Resolve the deployment environment and owner independently from the
   manifest.
2. Run `dryRun`. It performs no writes and returns the target environment,
   owner, canonical hash, redacted create/update plan, record and image counts,
   and total image bytes.
3. Confirm the exact canonical hash and pass it as `approvedManifestHash` to
   `apply`.
4. Run `verify` after apply and after any retry.
5. Use `rollback` only with the same immutable manifest and hash, after again
   resolving and asserting the deployment environment and owner independently.

Apply rejects an ambiguous environment, owner mismatch, an unconfirmed hash,
unexpected prior state, or image checksum/size mismatch. It uploads every
image to a manifest-versioned object path and verifies it before the catalog
transaction activates records and image rows.

## Retry and rollback

Application attempts start as `running` and end as `succeeded`, `failed`, or
`rolled_back`. Terminal attempts are immutable at the database level. Record
and object ownership mappings persist the exact manifest key, database ID or
object path, and applied fingerprint/checksum.

A failed pre-activation attempt may be rerun with the same manifest and
content-addressed objects. A successful retry verifies already-owned records
instead of silently overwriting drift. Rollback proceeds in reverse dependency
order, requires unchanged owned fingerprints, marks mappings rolled back, and
does not delete stored objects. The executor must reject database deletion when
collection snapshots or unrelated catalog records still reference an owned
record.

The exact one-time production executor and assets belong to the disposable
operator worktree. It must implement the exported executor, asset, and object
interfaces; it must not weaken the runner or bypass the durable mappings.
