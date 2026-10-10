# Approve the normalized Autmog and Saga target mapping

Status: Accepted

Sources:

- [Approve the normalized Autmog and Saga target mapping](https://linear.app/pocket-trash/issue/ENG-411/approve-the-normalized-autmog-and-saga-target-mapping)
- [Normalized Autmog and Saga target mapping](https://linear.app/pocket-trash/document/normalized-autmog-and-saga-target-mapping-67e1ecdc9f36)
- [Final Pens PostgreSQL and Drizzle schema contract](https://linear.app/pocket-trash/document/final-pens-postgresql-and-drizzle-schema-contract-2b270b8391db)

## Decision

Freeze the initial Autmog import to the committed raw Shopify archive and its two reviewed audit files. Their checksums, field-level dispositions, exception handling, and expected target counts are fixed by the linked mapping.

The 141-record archive contains 137 in-scope listings: 136 Pens and the one Pen Clips listing. The four tray listings remain out of scope. Each in-scope listing maps to a distinct product because the frozen source contains no repeated listing URL and no proven exact duplicate.

Use exact maker, source-system, source-record-ID, listing-URL, and handle identity. Equal titles and shared source images do not merge products. Multiple observations of one listing URL map to one product; different URLs merge only through a reviewed, evidence-backed exact-duplicate override.

### Autmog normalized facts

- Keep full listing titles, source handles, maker URLs, descriptions, and leading-diameter product aliases.
- Map reviewed materials, fixed finish options, nonblank Grip Lines patterns, and canonical nose profiles into their approved relational carriers.
- Treat Smooth as absence of a pattern. Preserve Tapered, fixed mechanism type, clip status, measurements, prices, and SKUs in source evidence rather than inventing target fields or standalone parts.
- Create the Pen Clips product with Copper, Brass, and Aluminum material choices in one required material slot.
- Create reviewed group or exact-refill compatibility assertions only when the approved production refill catalog contains the target. Preserve OHTO C-305/C-307 and Schmidt P8126/P8127 claims as evidence-only until those exact refill products are approved.
- Map 1,162 source image identities to product-owned images after the promised image archive supplies path, size, and content hashes. Shared URLs do not change product or image ownership.

### Saga baseline

Use the accepted plan and saved planning decisions as the complete Saga authority for this phase. Create one Grimsmo Saga Pen, the saved Titanium material choice, Caramel PVD and Helix-plus-Caramel-PVD appearances, and Logo/No-logo tip choices. Do not create a maker listing, image, historical serial, compatibility assertion, placeholder part, or unnamed rule without saved evidence.

Reserve the decided slot order for later clip, mechanism, and actuator choices, but create no empty slots. When named choices become available, the saved clip example requires Titanium plus Caramel PVD and the actuator example requires Titanium plus the Helix/Caramel-PVD appearance.

Saga number remains owned-item serial data. Missing historical Saga rows are an accepted omission, not a migration blocker. A later archive or reviewed source capture is additive and must not silently replace this mapping.

## Import boundary

The production operation is deterministic, idempotent, identity-checked, and separate from schema deployment and fixture seeding. It refuses source checksum or count mismatches, resolves products from the frozen mapping rather than names or images, reports unsupported evidence-only facts in dry-run output, and never deletes unmatched production data.
