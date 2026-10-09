# Ratify the Pens domain baseline

Status: Accepted

Sources:

- [Ratify the existing Pens domain baseline](https://linear.app/pocket-trash/issue/ENG-404/ratify-the-existing-pens-domain-baseline)
- [Pens and refills implementation plan](https://linear.app/pocket-trash/document/pens-and-refills-implementation-plan-5e2fc43c5fd4)
- [Legacy Pens, tips and refills proposal](https://github.com/Pocket-Trash/pocket-trash/pull/87)

## Decision

The implementation plan is the canonical Pens baseline. The legacy proposal remains evidence and context where it agrees with this record. It does not define requirements.

### Product identity and pen parts

- Pen, pen clip, pen tip, pen top cap, pen mechanism, pen actuator, and refill are catalog product types. Each product has one generic product identity and one shared-ID type detail.
- A pen part is user-swappable and can serve more than one role. A clip-action clip remains a pen clip while serving clip and actuator roles. Internal components that users cannot reasonably swap are outside the catalog model.
- A mechanism type such as bolt action classifies behavior. A physical mechanism that users can select, purchase, or own is a pen mechanism product.
- `product_detail_*` and `collection_detail_*` remain reserved for shared-ID type details. Options, aliases, roles, offerings, images, and relationships use descriptive supporting names.

### Owned configuration

- An owned pen can select a tip, top cap, clip, mechanism, actuator, and refill independently.
- Each installed part can be a virtual catalog selection or a link to an explicitly owned part. This extends the existing installed-component pattern without requiring every selected part to be a collection item.
- A part change preserves the other selections. The application reports incompatibility instead of deleting the installed refill or another configuration choice.
- A serial number belongs to an owned item. It is optional text, is not globally unique, and is not catalog product data.

### Refill identity and compatibility

- One stable maker model is one refill product. Tip and ink-colour combinations are refill offerings under that product. Only confirmed combinations become offerings.
- Users can select an installed refill model and an optional known offering on an owned pen. A refill cannot be added to a collection as an independent owned item.
- A compatibility group means verified physical interchangeability. Brand, ink technology, and similar family names do not establish membership.
- A pen can record compatibility with a group, an exact refill model, or both. A compatibility claim can require an installed tip. Exact compatibility supports tightly machined pens without forcing broad group membership.

### Names, images, and maker normalization

- Terminology aliases map alternate words to one concept. Product aliases provide alternate searchable names for one product. Neither replaces the canonical display name.
- Pens, pen parts, and refills use the existing catalog cover and gallery model. Owned pens and parts use collection-item images.
- Each distinct Autmog listing URL identifies one product unless evidence proves that two listings are exact duplicates. Keep the full listing name; treat the leading number as a body-diameter designation. Autmog clips are pen clip products.
- Model Saga as one pen product with constrained options and replaceable parts. A Saga number is an owned-item serial number, not a catalog variant or separate product.

### Scope boundary

- Pen trays, fountain pens, fountain-pen cartridges and converters, generic refill adapters, and one-off internal mechanism components that users cannot reasonably swap remain outside this project.
- Public owner reports and refill installation or usage counts remain outside this project.
- Legacy Autmog routes receive no redirects after removal.

### Delivery and migration boundary

- Pens work builds on the completed Drizzle `1.0.0-rc.4` fresh baseline. New migrations use complete timestamp folders, and schema relationships stay in the centralized v1 `defineRelations()` registry.
- Production deployment remains schema-only. Explicit identity-checked, idempotent maintenance operations load approved catalog, Autmog, Saga, and refill data.
- Work proceeds additively: approve the schema and source mapping, add storage and behavior, import and verify data, cut over the scraper, expand production refills from a separately approved research batch, remove legacy behavior, then drop temporary storage.
- Destructive cleanup stays in later reviewable changes with production evidence and rollback gates. The legacy proposal PR remains untouched until final project closeout.

## Superseded legacy assumptions

The baseline rejects these claims from the legacy proposal:

- A body-tip pairing is the sole compatibility subject and matching refill styles prove fit.
- Pen tips are the only first-class pen parts.
- Refills are collection items.
- One Saga appearance row should become one catalog product.

## Open decisions

This record does not pre-empt the remaining planning work:

- [Decide the refill compatibility evidence and exception model](https://linear.app/pocket-trash/issue/ENG-406/decide-the-refill-compatibility-evidence-and-exception-model) defines positive, negative, conditional, and sourced compatibility evidence.
- [Decide reusable aliases and maker terminology behavior](https://linear.app/pocket-trash/issue/ENG-408/decide-reusable-aliases-and-maker-terminology-behavior) defines alias precedence, uniqueness, search, and display behavior.
- [Test Saga combinations against the current appearance model](https://linear.app/pocket-trash/issue/ENG-409/test-saga-combinations-against-the-current-appearance-model) and [Decide Saga appearance and option constraints](https://linear.app/pocket-trash/issue/ENG-410/decide-saga-appearance-and-option-constraints) settle the option restrictions.
- [Approve the final pen and refill schema](https://linear.app/pocket-trash/issue/ENG-412/approve-the-final-pen-and-refill-schema) defines PostgreSQL tables, constraints, indexes, and migration artifacts.
- Refill provenance, production seed selection, source mapping, and cutover gates remain with their linked Pens project issues.
