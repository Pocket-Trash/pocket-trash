# Approve the final pen and refill schema

Status: Accepted

Sources:

- [Approve the final pen and refill schema](https://linear.app/pocket-trash/issue/ENG-412/approve-the-final-pen-and-refill-schema)
- [Final Pens PostgreSQL and Drizzle schema contract](https://linear.app/pocket-trash/document/final-pens-postgresql-and-drizzle-schema-contract-2b270b8391db)
- [Reusable product-configuration availability rules](https://linear.app/pocket-trash/document/reusable-product-configuration-availability-rules-38bb1afc6127)

## Decision

Implement Pens as an additive, normalized PostgreSQL schema on the current Drizzle v1 baseline. The linked contract fixes the columns, foreign keys, uniqueness, indexes, row checks, and deferred cross-row constraints. This record fixes the table boundaries and delivery rules.

### Product and collection details

Add shared-ID product details for `pen`, the shared `pen_part` base, `pen_clip`, `pen_tip`, `pen_top_cap`, `pen_mechanism`, `pen_actuator`, and `refill`. Add matching collection details for Pens and each independently ownable part. Do not add a refill collection detail.

Add the optional, non-unique `serial_number` to `collection_item`. Store an installed refill product and optional matching offering on `collection_detail_pen`. Enforce the product/offering pairing with a row check and composite foreign key.

Seed the new product types and keep mechanism classification separate from physical Pen mechanism products. Do not add unapproved measurement columns.

### Configuration

Add `configuration_slot_kind`, `product_configuration_slot`, `product_configuration_choice`, `product_configuration_choice_rule`, `product_configuration_choice_requirement`, and `collection_item_configuration_selection`.

Choices reference one existing product-material assignment, product finish option, or Pen-part product. Rules use positive, relational choice references: requirements inside a rule are AND; rules for one target are OR. Ordered slots prohibit same-slot, later-slot, and cyclic dependencies. Owned selections may link a same-owner collection part and remain stored when their current rule is unmet.

### Terminology

Add `catalog_terminology_concept`, migrate `catalog_terminology_alias` to a registered concept with global or maker scope, and add `product_alias`. Add explicit carriers for Pen-part roles, Pen nose profiles, and refill compatibility groups. Preserve null-scope uniqueness, preferred-maker uniqueness, and the alias collision audit defined by ENG-408.

### Refills, compatibility, and evidence

Add refill tip-style and ink-colour lookups, `refill_offering`, markets and market containment, versioned offering-market statuses, versioned offering identifiers, source listings, catalog source evidence, source images, and their evidence/mapping joins.

Add refill compatibility groups and memberships, compatibility assertions, structured compatibility evidence, and supporting/contradicting evidence joins. Assertions target exactly one group or refill, optionally require one Pen tip, enforce outcome-specific explanation/remedy fields, and remain unique at one specificity.

Active approved offerings, lifecycle statuses, identifiers, group memberships, and compatibility assertions require supporting evidence. Market containment stays acyclic; active assertions at incomparable overlapping scopes cannot disagree.

### Provenance and images

Use `catalog_source_listing`, `product_source_listing`, `catalog_source_evidence`, `catalog_source_listing_choice`, and `catalog_source_image` to preserve maker source IDs, URLs, captures, listing-to-choice mappings, and source image identities. Keep ownership and deletion behavior in the existing product image table.

Saga remains one product with many source listings and constrained choices. The planning baseline supplies the initial records; a future archive can append reviewed listings, choices, rules, and images without changing this schema.

## Drizzle and migration

Place new tables in `packages/database/src/schema/pens.ts`, export them from the schema barrel, and extend only the centralized v1 `defineRelations()` registry. Use explicit relation aliases for repeated targets and add inferred select/insert types.

Generate one complete `packages/database/drizzle/<YYYYMMDDHHmmss>_pens_catalog_schema/` folder. The migration is additive and schema-only: migrate conflict-free aliases, create and seed stable schema lookups, install deferred constraint triggers, and leave all legacy `tmp_*` tables, routes, scraper behavior, production rows, and objects untouched.

The implementation must include integration tests for every non-row-local invariant, regenerate the database diagram, and pass `db:check`, `db:validate:chain`, and the exact-base PR validation. Production imports and destructive cleanup remain separate, explicitly authorized work.
