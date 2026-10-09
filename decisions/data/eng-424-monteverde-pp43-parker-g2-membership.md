# Verify Monteverde PP43 membership in Parker G2

Status: Accepted

Sources:

- [Verify whether Monteverde PP43 belongs in Parker G2](https://linear.app/pocket-trash/issue/ENG-424/verify-whether-monteverde-pp43-belongs-in-parker-g2)
- [Monteverde PP43 and Parker G2 compatibility](https://linear.app/pocket-trash/document/monteverde-pp43-and-parker-g2-compatibility-5f2803c766f2)
- [Decide the refill compatibility evidence and exception model](./eng-406-refill-compatibility-evidence-model.md)

## Decision

Admit the Monteverde USA Premium Gel PP43 refill model to the canonical `parker-g2` compatibility group. Monteverde explicitly sells PP43 as a refill "To Fit Parker Ballpoint Pens" and lists it in its dedicated Parker-refill collection. That is manufacturer-statement evidence for membership under ENG-406; a dimensional comparison or physical test is not required before migration.

Use `Parker-style` as terminology for the same format, not a second group. First-party Monteverde, Yafa, and Schmidt sources establish the terminology mapping between Parker-style and the G2 large-capacity ballpoint format. Do not claim that PP43 itself is ISO-certified or copy Schmidt P900's approximate 98 × 6 mm dimensions onto PP43; no accessible source establishes either fact.

The membership applies to the stable PP43 refill model. Treat `PP432BK` and `PP433BK` as pack-size and colour offerings of PP43 when the ENG-425 provenance model supports them, not as different refill formats.

## Source boundaries

Use Monteverde's product title, SKU, and Parker-refill collection placement as the evidence-bearing fields. The product body contains conflicting templated claims about plastic versus metal construction and repeats a broad brand list. Do not migrate those construction details or infer compatibility with every named brand without separate evidence.

Group membership also does not assert compatibility with every Parker product. It concerns the Parker-style ballpoint format; Parker rollerballs and other writing modes may use different formats. Exact pen compatibility and any exception remain separate assertions under ENG-406.

## Migration mapping

- Seed one Monteverde Premium Gel PP43 refill model in `parker-g2`.
- Attach manufacturer-statement evidence using the preserved PP43 product title and Parker-refill collection source, including capture date.
- Keep PP43 dimensions and ISO conformance unset.
- Do not create exact pen assertions from the page's generic brand list.
- Preserve later contradictory physical results as exact compatible, incompatible, conditional, or variable pen assertions without automatically removing the group membership.

## Consequences

- ENG-413 may include PP43 in the production refill seed set without waiting for a fit test.
- ENG-425 must distinguish the PP43 refill model from its two-pack and six-pack commercial offerings.
- The final schema needs no PP43-specific exception.
