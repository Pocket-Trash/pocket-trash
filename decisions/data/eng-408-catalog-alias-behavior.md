# Decide reusable aliases and maker terminology behavior

Status: Accepted

Sources:

- [Decide reusable aliases and maker terminology behavior](https://linear.app/pocket-trash/issue/ENG-408/decide-reusable-aliases-and-maker-terminology-behavior)
- [Pens and refills implementation plan](https://linear.app/pocket-trash/document/pens-and-refills-implementation-plan-5e2fc43c5fd4)
- [Ratify the Pens domain baseline](./eng-404-pens-domain-baseline.md)
- [`catalog_terminology_alias` current implementation](../../packages/database/src/schema/collection.ts)

## Decision

Keep terminology aliases and product aliases separate. Terminology aliases name a reusable controlled concept. Product aliases find one or more specifically assigned products and never define taxonomy.

### Registered terminology concepts

A terminology concept has a registered namespace, stable key, and localized canonical label. Aliases reference the registered concept with a foreign key; an unchecked polymorphic namespace/key pair is not sufficient.

Initial Pens namespaces are:

- `product-type`, including `pen-actuator` and the other approved pen product types;
- `pen-part-role`, for functional roles that do not change product identity;
- `pen-nose-profile`, including `round`, `step`, and `cone`; and
- `refill-compatibility-group`, for approved group names such as `parker-g2`.

The registry may contain existing catalog concepts outside Pens. Adding a namespace or concept is a schema/seed change, not free-form alias authoring. Canonical keys are immutable identifiers; editing a label or alias never changes classification.

Each namespace has one carrier and result projection:

| Namespace | Concept carrier | Search results |
| --- | --- | --- |
| `product-type` | A product's product-type relationship | Products of that type and collection items linked to them |
| `pen-part-role` | An explicit role assignment on a pen-part product | Assigned part products, including a Pen clip with the Actuator role, and linked collection items |
| `pen-nose-profile` | An explicit profile assignment on a Pen or Pen tip product | The assigned Pen or Pen tip products and linked collection items; do not expand between pens and compatible tips |
| `refill-compatibility-group` | Verified refill-to-group membership | Member refill products only; compatible pens remain discoverable through compatibility UI, not terminology search |

### Terminology alias scope and precedence

A terminology alias points to one concept and is either global or scoped to one maker.

- Global aliases apply to matching concepts for every maker.
- Maker-scoped aliases apply only when the product's maker matches.
- Search uses the union of canonical labels, global aliases, and applicable maker aliases. A maker alias does not hide global terms.
- A maker may designate at most one maker-scoped alias as its preferred term for a concept. Global aliases cannot be preferred.
- On a maker-specific product card or detail, the preferred maker term replaces the canonical label in the type or attribute badge. General filters, headings, and admin taxonomy use the localized canonical label. Non-preferred aliases are search-only.
- Without a preferred maker term, display falls back to the active-locale canonical label, then its English canonical fallback.

Preferred terminology never replaces the catalog product name, URL slug, concept key, or stored relationship.

### Product aliases

A product alias maps one normalized label to one product. The same label may be assigned to multiple products intentionally, so `Autmog 36` can find every verified Autmog listing with the 36 body-diameter designation. Each assignment is independent and auditable.

Product aliases participate in search but do not replace full product names, create redirects, change slugs, or merge listings. Public product pages do not show them by default; admin product editing may list them as search metadata.

Collection items inherit terminology concepts, terminology aliases, product aliases, and preferred maker display terms through their linked catalog product. Alias matches never replace an owner-defined collection-item display name; they only make the item discoverable and may provide match context.

### Search behavior

Normalize canonical search text and aliases with the existing catalog rule: Unicode NFKD, remove combining marks, lowercase with the `en-US` locale, trim, and collapse whitespace. Preserve the authored label separately for display and audit.

- A query matches a canonical label, alias, maker name, or product name when that normalized field contains the complete normalized query.
- A terminology match includes every product carrying that concept, limited by maker scope when present.
- A product-alias match includes only products assigned that alias.
- Multiple matching aliases produce the union of results. Do not stop at the first alias.
- Searching filters the existing catalog order; alias type does not change ranking.
- Match context may show the authored alias that caused the result. Catalog-product titles remain canonical product names, and collection-item titles remain owner-defined display names when present.

Descriptions remain outside alias matching.

Alias matching remains in the existing client-side catalog and collection search over the loaded alias set. Database B-tree indexes support constraints, concept loading, and exact scope lookups; they are not claimed to accelerate substring matching. A later server-side search change must measure the query and add an appropriate `pg_trgm` GIN index separately if needed.

### Uniqueness and validation

- A concept is unique by `(namespace, key)`.
- Within one namespace and scope, one normalized terminology label maps to only one concept. Treat global scope as one scope and each maker as a separate scope.
- A terminology alias is unique by `(maker scope, namespace, normalized label)` with null global scope treated as equal.
- Reject an alias that collides with another concept's normalized canonical key or label in the same namespace and scope. Repeating a canonical term for the same concept is redundant and rejected.
- A maker can have at most one preferred alias per concept. A preferred alias must have a maker.
- A product-alias assignment is unique by `(product, normalized label)`. The normalized label may map to other products.
- Labels are trimmed, non-empty, at most 80 characters, and retain the current audit trail and `products.manage` authorization boundary.

Foreign keys use `RESTRICT` for concepts and makers while aliases exist. Product-alias assignments use `CASCADE` when their product is deleted. Index terminology aliases by concept and by normalized label plus scope for loading and exact lookups; index product aliases by product and normalized label.

### Approved examples

- `Actuator` is a canonical label in both `product-type/pen-actuator` and `pen-part-role/actuator`. `bolt pin`, `lock pin`, and `thumb stud` may alias both concepts where intended. A clip assigned the Actuator role remains a Pen clip but matches role aliases; standalone actuator products match the product-type aliases.
- `bullet nose` is a global alias of the `Round` nose profile.
- `triple bezel` is a maker-scoped alias of `Step` only where preserved source evidence confirms that maker's usage; it is not a global synonym.
- `smooth` means no pattern and is not a pattern concept or alias.
- `Autmog 36` is a product alias assigned to matching verified products, not a product-type or nose-profile term.

## Migration consequences

The current `catalog_terminology_alias` implementation supports maker-scoped product-type terms only. ENG-412 must evolve it additively:

1. query existing rows by `(maker_id, canonical_namespace, normalized_value)` and report any group that maps to more than one canonical key; also compare every normalized alias with registered canonical keys and labels to find cross-concept collisions and same-concept redundancy; abort migration until each finding receives an explicit, audited resolution;
2. add the registered concept target and seed existing supported product types;
3. migrate the conflict-free current alias rows to their `product-type` concepts without changing labels, normalized values, maker scope, or preference;
4. add global terminology scope, nulls-not-distinct scope uniqueness, and the separate product-alias mapping;
5. switch catalog and collection authoring, search, and display to the registered concept relationship and union matching; and
6. remove the old product-type-only foreign key or compatibility shape only after row counts and behavior are verified.

No existing aliases are inferred from product names. Pens aliases and assignments arrive through reviewed seed/import data or audited admin authoring.
