# Database

- Reserve `product_detail_*` for catalog product-type details and `collection_detail_*` for collection-item details. Keep `product`/`collection_item` shared-ID bases; supporting entities/lookups/options/images/aliases/relationships use neither prefix.
- After schema edits, run `pnpm db:generate`; review and commit complete timestamp folders (`migration.sql`, `snapshot.json`). Never edit applied SQL, snapshots or ledger rows. There is no shared journal or numbered SQL file.
- Put unsupported functions/triggers in custom migrations after dependent tables. Unchanged schema generation after custom SQL must emit no DDL.
- Preserve verified TLS: promote `sslmode=require` to `verify-full`, retain `channel_binding=require`; never add `uselibpqcompat=true`.
- Run `db:check`, replay the chain twice on disposable PGlite with `pnpm db:validate:chain`, and compare selected personal history read-only with `pnpm db:validate:personal`. Compare named migration sets, not highest timestamps/prefixes.
- Follow [database operations](../database.md) for application, selection, recovery and lifecycle safeguards.
