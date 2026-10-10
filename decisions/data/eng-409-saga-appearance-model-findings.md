# Test Saga combinations against the current appearance model

Status: Accepted

Sources:

- [Test Saga combinations against the current appearance model](https://linear.app/pocket-trash/issue/ENG-409/test-saga-combinations-against-the-current-appearance-model)
- [Saga appearance-model evidence and expressiveness findings](https://linear.app/pocket-trash/document/saga-appearance-model-evidence-and-expressiveness-findings-ccca7423881d)
- [Pens and refills implementation plan](https://linear.app/pocket-trash/document/pens-and-refills-implementation-plan-5e2fc43c5fd4)

## Decision

Use the accepted Pens plan and saved planning artifacts as the authoritative Saga baseline for this planning phase. Historical database rows are not required. Do not infer missing historical combinations or generate combinations from the Cartesian product of parser-recognized values. A recovered archive may add evidence or corrections later without blocking the implementation plan.

The current product appearance model is insufficient for the preserved Saga requirements. It can store product materials and flat finish options containing finishes, colours, an optional colour effect, and an optional pattern. It cannot identify the component that owns an appearance value or constrain a separately selectable clip, tip, actuator, mechanism, or other option by a conjunction of material, finish, colour, pattern, or another option.

The preserved plan examples establish the required boundary:

- Titanium plus Caramel PVD can constrain one specific clip option without constraining every Saga clip.
- Titanium plus Helix plus Caramel PVD can constrain one specific actuator option without constraining every Saga actuator or mechanism.
- Logo and no-logo tips are distinct selectable options, not whole-product finish labels.

Representing every complete appearance as one flat finish option would recreate row-per-appearance modelling and would not support the approved independently selectable parts.

## Follow-up boundary

ENG-410 must choose a reusable constraint model attached to the narrow option it governs. It must support typed, conjunctive requirements and exact allowed combinations without implying that every recognized value can combine with every other value. The schema and migration remain ENG-412 work.

Saga supplies the concrete vocabulary, but the limitation is cross-product: any configurable product can have material- or appearance-dependent parts. Do not create a Saga-only constraint engine.

The saved normalizer vocabulary and synthetic test scenarios are mapping and expressiveness inputs only. They are not evidence that a historical production combination existed.
