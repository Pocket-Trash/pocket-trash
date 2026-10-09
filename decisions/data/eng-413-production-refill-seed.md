# Select the production refill seed and provenance

Status: Accepted

Sources:

- [Select the production refill seed set and provenance](https://linear.app/pocket-trash/issue/ENG-413/select-the-production-refill-seed-set-and-provenance)
- [Pen refill catalog verification](https://linear.app/pocket-trash/document/pen-refill-catalog-verification-50bcb9818c51)
- [Floatune and EnerGel compatibility evidence](https://linear.app/pocket-trash/document/floatune-and-energel-compatibility-evidence-b451b00d20f4)
- [Monteverde PP43 and Parker G2 compatibility](https://linear.app/pocket-trash/document/monteverde-pp43-and-parker-g2-compatibility-5f2803c766f2)
- `plans/pen-refill-seed-catalog.json`, the non-loadable planning input
- [Refill compatibility evidence model](./eng-406-refill-compatibility-evidence-model.md)
- [Refill-offering provenance and lifecycle](./eng-425-refill-offering-provenance-lifecycle.md)
- [Production refill offering provenance manifest](./eng-413-production-refill-provenance.md)

## Decision

Build the first production refill import from the audited facts below, not by loading the planning JSON. The planning file is reconciliation input only. A production row needs an approved fact and its supporting evidence; `confirmed`, `observed`, or `unverified` text in the planning file is not itself provenance.

The content selection is complete independently of ENG-412's physical table names. ENG-412 may choose the schema and constraints, but must preserve this selection, its unknown values, and its evidence links. Any later expansion is a separately reviewed production import, not fixture promotion.

## Selection rules

- Import a refill product when an official source confirms the stable maker model or family identity. A product may exist without an offering when the reviewed evidence does not establish a complete tip-and-colour combination.
- Import an offering only for an explicitly verified model, tip-size or maker-grade, tip-style when known, and colour combination. Unknown geometry or size stays null; never infer it from another maker's grade, a product photo, a code sequence, or a family name. ENG-412 must make null-bearing identities duplicate-safe.
- Preserve an exact maker code or SKU only when the reviewed source publishes it. Package-size SKUs identify the same offering and never create another refill product or compatibility format.
- Create market and lifecycle assertions only from the source's actual scope. Current regional pages produce regional `current` assertions; dated catalogues produce `historical` assertions unless the audit identifies the edition as the current reviewed catalogue. Press releases prove introduction, not continuing availability. Do not create a `GLOBAL` assertion from a storefront, language, or multi-region audit.
- Use the audit date, `2026-10-08`, as the capture date for ENG-405 sources. Use `2026-10-09` for the Floatune and PP43 decision evidence. Preserve a catalogue's edition/publication date and a captured document checksum when available.
- Import only approved compatibility-group memberships. Do not infer exact pen compatibility from membership, missing rows, family names, or shared ink technology.

## Production products

Seed these stable products. Names separated by commas are separate refill products, not offerings.

| Maker | Products |
| --- | --- |
| Pentel | `LRN3`, `LRN4`, `LRN5`, `LR7`, `LR10`, `LRP5`, `LRP7`, `LRN5TL`, `LRN5H`, `ZRN3`, `ZRN4`, `ZRN5`, `YR8`, `YR10` |
| Pilot | `BLS-G2-38`, `BLS-G2-5`, `BLS-G2-7`, `BLS-G2-10` |
| Monteverde | `P11`, `P13`, `P15`, `P41`, `P42`, `P44`, `PP43`, `G22`, `G23`, `G24`, `G42`, `G43`, `W22`, `W23`, `W24`, `M13`, `M14`, `M42`, `M43`, `M44`, `D13` |
| Parker | `QUINKflow Ballpoint`, `QUINK Gel`, `QUINK Rollerball` |
| Schmidt | `P900`, `easyFLOW 9000`, `P900 Softline`, `MegaLine P950` |
| Schneider | `Express 735`, `Eco 725` |
| Uni-ball / Mitsubishi Pencil | `SXR-38`, `SXR-5`, `SXR-7`, `SXR-10`, `SXR-600-38`, `SXR-600-05`, `SXR-600-07`, `SXR-80-38`, `SXR-80-05`, `SXR-80-07`, `SXR-80-10`, `SXR-200-05`, `SXR-200-07`, `UMR-82`, `UMR-83`, `UMR-83E`, `UMR-85N`, `UMR-85E`, `UMR-87E`, `UMR-38S`, `UMR-05S`, `SNP-5`, `SNP-7`, `SNP-10`, `UBR-Z-38`, `UBR-Z-05`, `UBR-Z-07`, `UBR-ZML-38`, `UBR-ZML-05` |
| OHTO | `PG-105NP` |

Apply these identity corrections while importing:

- Use `UMR-87E`, not the planning file's `UMR-87`.
- Use the exact Monteverde models `M13`, `M14`, `M42`, `M43`, `M44`, and `D13`; `M1`, `M4`, and `D1` remain family/format terms.
- Use `PG-105NP` as the OHTO product. `Flash Dry` is a marketed family name.
- Treat `XLRN*` and `XZRN*` as sourced regional identifiers for the stable Pentel model, not duplicate products. Do not invent unprefixed `LRN4` or `ZRN4` maker identifiers.
- Keep `G22/23/24` and `W22/23/24` as historical products from the 2022 Monteverde catalogue. Do not mark them current from their absence or presence in current navigation.

## Production offerings

The following matrices are the approved offering facts. Each listed colour applies only to the named product and tip size or maker grade. A source-specific maker code is an identifier assignment on that offering, not part of its identity.

| Maker | Product and tip | Approved colours |
| --- | --- | --- |
| Pentel | `LRN3` 0.3 needle | Black, red, blue, blue-black, brown |
| Pentel | `LRN4` 0.4 needle | Black, red, blue, blue-black, brown |
| Pentel | `LRN5` 0.5 needle | Black, red, blue, green, orange, pink, sky blue, violet |
| Pentel | `LR7` 0.7 metal tip; geometry unknown | Black, red, blue |
| Pentel | `LR10` 1.0 metal tip; geometry unknown | Black, red, blue, violet |
| Pentel | `LRN5H` 0.5 needle | Black, red, blue |
| Pentel | `ZRN3` 0.3, `ZRN4` 0.4, `ZRN5` 0.5 | Black, red, blue for each; geometry remains unknown |
| Pentel | `YR8` 0.8 rollerball, `YR10` 1.0 rollerball | Black, red, blue for each |
| Pilot | `BLS-G2-38` 0.38 conical | Black, red, blue, green |
| Pilot | `BLS-G2-5` 0.5 conical | Black, red, blue, green, blue-black |
| Pilot | `BLS-G2-7` 0.7 conical | Black, red, blue, green, violet, pink, dark red, orange |
| Pilot | `BLS-G2-10` 1.0 conical | Black, red, blue, green |
| Monteverde | `P11` Extra-fine | Black, blue, blue-black |
| Monteverde | `P13` Medium | Black, blue, blue-black, red, green, turquoise, purple, brown, pink |
| Monteverde | `P15` Super-broad | Black, blue |
| Monteverde | `P41` 0.5 Extra-fine needle | Black, blue |
| Monteverde | `P42` Fine | Black, blue, red, purple, green, turquoise, blue-black |
| Monteverde | `P44` Broad | Black, blue, blue-black |
| Monteverde | `PP43` Medium | Black; `PP432BK` and `PP433BK` are pack identifiers for this one offering |
| Parker | `QUINKflow Ballpoint` Fine | Black, blue |
| Parker | `QUINKflow Ballpoint` Medium | Black, red, blue |
| Parker | `QUINKflow Ballpoint` Broad | Black, blue |
| Parker | `QUINK Gel` Fine | Black, blue |
| Parker | `QUINK Gel` Medium | Black, blue |
| Parker | `QUINK Rollerball` Fine or Medium | Black, blue for each grade |
| Schmidt | `P900` Fine | Black, blue |
| Schmidt | `P900` Medium | Black, blue, red, green, magenta, turquoise, violet |
| Schmidt | `P900` Broad | Black, blue |
| Schmidt | `easyFLOW 9000` 0.8 or 1.0 TC ball | Black, blue for each size |
| Schmidt | `P900 Softline` | Black, blue; exact tip size remains unknown |
| Schmidt | `MegaLine P950` Medium | Black, blue |
| Schneider | `Express 735` Fine | Black, red, blue |
| Schneider | `Express 735` Medium | Black, red, blue, green |
| Schneider | `Express 735` Broad | Black, blue |
| Schneider | `Eco 725` Fine or Medium | Black, blue for each grade |
| Uni-ball | `SXR-38` 0.38, `SXR-5` 0.5, `SXR-7` 0.7, `SXR-10` 1.0 | Black, red, blue for each model |
| Uni-ball | `SXR-600-38` 0.38, `SXR-600-05` 0.5, `SXR-600-07` 0.7 | Black for each model |
| Uni-ball | `SXR-80-38` 0.38, `SXR-80-05` 0.5, `SXR-80-07` 0.7 | Black, red, blue, green for each model |
| Uni-ball | `SXR-80-10` 1.0 | Black, red, blue |
| Uni-ball | `SXR-200-05` 0.5, `SXR-200-07` 0.7 | Black, red, blue for each model |
| Uni-ball | `UMR-82` 0.28 | Black, red, blue |
| Uni-ball | `UMR-83` 0.38 | Black, red, blue, blue-black |
| Uni-ball | `UMR-83E` 0.38 | Black, red, blue |
| Uni-ball | `UMR-85N` 0.5 | Black, red, blue, blue-black |
| Uni-ball | `UMR-85E` 0.5 | Black is current in Japan; red and blue are discontinued in Japan |
| Uni-ball | `UMR-87E` 0.7 | Black, red, blue |
| Uni-ball | `UMR-38S` 0.38, `UMR-05S` 0.5 | Black, red, blue, orange, blue-black for each model |
| Uni-ball | `UBR-Z-38` 0.38, `UBR-Z-05` 0.5, `UBR-Z-07` 0.7 | Black, red, blue for each model |
| Uni-ball | `UBR-ZML-38` 0.38, `UBR-ZML-05` 0.5 | Black, red, blue for each model |
| OHTO | `PG-105NP` 0.5 needle gel | Black, blue |

Products without a row in this table remain product-only in the initial import. Add no offering until an approved source establishes its exact combination.

`SNP-5`, `SNP-7`, and `SNP-10` are product-only. ENG-405 records a Japan colour conclusion but cites no offering-level source that can support a deterministic production row.

Apply the audit's maker-code corrections:

- Parker `1950370` is Medium Red; add `1950371` as Medium Blue and `2020761` as Fine Blue. Remove the unsupported `Economy` label from `2136210` and `2136231`.
- Monteverde uses `BU`, `PL`, `BN`, and `PK`; do not seed `BL` or `PU` as maker codes.
- Do not seed Schmidt's numeric P900 SKUs or its supplied exact grade diameters; the reviewed maker sources did not confirm them.
- Exclude Schneider `7354`. Treat `7361`, `7362`, `7363`, `7364`, and `7373` as confirmed by the current official pages.
- Do not seed exact full ZENTO `.24`, `.15`, or `.33` ordering codes until an official table confirms them. The model-and-colour offerings themselves are approved.
- Do not seed Pilot hyphenless forms as maker identifiers. They may be added later as reviewed product aliases, not source facts.

## Compatibility groups and aliases

Seed these group memberships:

| Group | Members |
| --- | --- |
| `EnerGel` | Pentel `LRN3`, `LRN4`, `LRN5`, `LR7`, `LR10`, `LRN5TL`, plus every Floatune model: `ZRN3`, `ZRN4`, `ZRN5`, `YR8`, `YR10` |
| `Parker G2` | Monteverde `P11`, `P13`, `P15`, `P41`, `P42`, `P44`, `PP43`; Parker `QUINKflow Ballpoint`, `QUINK Gel`; Schmidt `P900`, `easyFLOW 9000`, `P900 Softline`, `MegaLine P950`; Schneider `Express 735`, `Eco 725`; Uni-ball `SXR-600-38`, `SXR-600-05`, `SXR-600-07`; OHTO `PG-105NP` |
| `Pilot G2 standard` | Pilot `BLS-G2-38`, `BLS-G2-5`, `BLS-G2-7`, `BLS-G2-10` |
| `Jetstream SXR full-size` | Uni-ball `SXR-38`, `SXR-5`, `SXR-7`, `SXR-10` |
| `Jetstream SXR-80 multi-pen` | Uni-ball `SXR-80-38`, `SXR-80-05`, `SXR-80-07`, `SXR-80-10` |
| `Jetstream SXR-200 multi-pen` | Uni-ball `SXR-200-05`, `SXR-200-07` |
| `ZENTO standard` | Uni-ball `UBR-Z-38`, `UBR-Z-05`, `UBR-Z-07` |
| `ZENTO 3 Color` | Uni-ball `UBR-ZML-38`, `UBR-ZML-05` |

`LRN5H`, Parker `QUINK Rollerball`, Monteverde rollerballs, Signo/One, and Power Tank remain outside these groups. Absence is unknown or a distinct documented format, never an incompatible assertion.

Seed only these reviewed terminology aliases:

- `Parker-style G2` and `ISO G2` for `Parker G2`;
- `Floatune`, `Floatune-compatible`, `Floutane`, and `Enegerl-compatible` for `EnerGel`;
- `Pilot G2` for `Pilot G2 standard`;
- `Standard Jetstream SXR` for `Jetstream SXR full-size`;
- `UBR-Z` for `ZENTO standard`; and
- `UBR-ZML` for `ZENTO 3 Color`.

These are terminology aliases under ENG-408. They do not rename products, duplicate groups, or prove compatibility.

## Evidence imported with the facts

- Preserve one source-evidence record per reviewed official page, catalogue, technical sheet, or press release cited by ENG-405. Store publisher, source kind, URL, capture date, edition/publication date when present, preserved identity/checksum when available, reviewed claim, and market scope. The production provenance manifest is the controlling offering-to-source mapping.
- Link every offering-market assertion and maker identifier to the evidence that publishes that exact fact. A maker-wide colour-code table cannot by itself prove a model offers that colour.
- Link group memberships to their manufacturer statements or dimensional evidence. For Floatune, preserve Roy Anger's `ZRN5-CX` versus `ZLRN5-SA` visual and caliper comparison and the successful installation observation, together with the explicit domain-owner decision that all Floatune models join `EnerGel`.
- Link PP43 to Monteverde's PP43 page and Parker-refill collection. Preserve the copied-body-text caveat and do not import unverified dimensions, construction material, or the broad brand list.
- Preserve contradictory and superseded evidence. Do not import unsupported planning comments as evidence and do not manufacture a source record for an internal alias.

## Excluded and fixture-only input

- Never load `plans/pen-refill-seed-catalog.json` in production. Rows marked `observed` or `unverified`, retailer-only mappings, code-sequence guesses, incomplete regional matrices, and contradicted values remain reconciliation input only.
- Development and preview may use explicit synthetic fixture records for UI coverage, including the required image distribution. Fixture identifiers must be visibly synthetic and must not be promoted or copied into production.
- Production images require separately verified source rights and paths. The planning requirement for one two-image refill and twenty one-image refills applies only to development and preview fixtures.
- No refill-to-pen compatibility assertion enters this import unless its exact pen, optional required tip, outcome, and evidence meet ENG-406. Group membership alone is not a pen assertion.

## Import contract handed to ENG-412 and ENG-414

- Implement this as an explicit, reviewable, idempotent production import with stable keys and a dry-run manifest. Ordinary production deployment remains schema-only and must never call fixture seeding.
- Abort before writes when a source, market, required evidence link, duplicate identity, conflicting active assertion, or referenced group/product is missing. Do not partially import a maker.
- Report planned and written counts by maker, product, offering, identifier, group membership, alias, evidence record, and lifecycle assertion. ENG-414 decides the authorization, transaction, rollback, and cutover gates around that import.

## Consequences

- The initial production catalog is deliberately verified rather than exhaustive. Missing offerings remain absent until reviewed evidence supports them.
- Regional and historical truth survives the import instead of being flattened into global current availability.
- The same source fact is not copied into product identity, offering identity, compatibility, and lifecycle fields without explicit links to the shared evidence record.
- Additional researched refills can enter production later through the same reviewed import path without changing development or preview fixtures.
