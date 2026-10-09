# Decide Saga appearance and option constraints

Status: Accepted

Sources:

- [Decide Saga appearance and option constraints](https://linear.app/pocket-trash/issue/ENG-410/decide-saga-appearance-and-option-constraints)
- [Reusable product-configuration availability rules](https://linear.app/pocket-trash/document/reusable-product-configuration-availability-rules-38bb1afc6127)
- [Saga appearance-model evidence and expressiveness findings](https://linear.app/pocket-trash/document/saga-appearance-model-evidence-and-expressiveness-findings-ccca7423881d)

## Decision

Model configurable products with ordered configuration slots, stable choices within each slot, and positive availability rules attached to the narrow choice they govern.

- A rule contains required choices from earlier slots. All requirements in one rule are required together.
- Multiple rules for one target choice are alternatives. A choice with no rules is generally available for that product.
- Product materials, finish options, and pen-part options remain their existing catalog concepts and become configuration choices rather than being copied into rules.
- Create a slot only for an independently selected dimension. A multi-role part does not require duplicate choices for each role it serves.
- Component appearance belongs to the affected component choice. Do not flatten body, tip, clip, and actuator appearances into one whole-product finish bundle.
- Rules are scoped to one parent product and describe maker-supported catalog configurations, not physical compatibility.
- Rules are non-empty and cannot reference the target slot or a later slot. This prevents dependency cycles and gives editors a deterministic evaluation order.
- Use relational references with database integrity. Do not store arbitrary predicates or entity identifiers in JSON.

ENG-412 will choose exact PostgreSQL tables, constraints, indexes, delete actions, and Drizzle relations while preserving these semantics.

## Saga application

Saga remains one pen product. Material, appearance, tip, clip, mechanism, and actuator are ordered slots. Logo/no-logo tips and actuator styles, icons, or engravings belong to the affected choices unless users select them independently.

The preserved examples become narrow positive rules: a specific clip can require Titanium and Caramel PVD, while a specific actuator can require Titanium, Helix, and Caramel PVD. These rules do not constrain every Saga clip, actuator, or mechanism. Only plan-backed choices and combinations enter the initial mapping; a recovered archive can append approved choices and rules later.

Do not enumerate one finish option per complete Saga appearance, generate Cartesian products, mix allow and deny rules, add free-form expressions, or build Saga-only constraint tables.

## Presentation

Catalog administration presents slots in dependency order and authors readable “available when” rule groups. Public catalog surfaces the conditions for conditional choices and does not present invalid combinations as maker-supported.

Owned-item configuration keeps unmet choices visible and selectable after satisfied choices, marks them with accessible warnings, and preserves existing selections when an earlier choice changes. It never silently replaces or clears the owner's physical configuration.
