# Decide the refill compatibility evidence and exception model

Status: Accepted

Sources:

- [Decide the refill compatibility evidence and exception model](https://linear.app/pocket-trash/issue/ENG-406/decide-the-refill-compatibility-evidence-and-exception-model)
- [Pen refill catalog verification](https://linear.app/pocket-trash/document/pen-refill-catalog-verification-50bcb9818c51)
- [Pens and refills implementation plan](https://linear.app/pocket-trash/document/pens-and-refills-implementation-plan-5e2fc43c5fd4)
- [Legacy Pens, tips and refills proposal](https://github.com/Pocket-Trash/pocket-trash/pull/87)

## Decision

Store approved compatibility assertions, including useful exceptions, rather than inferring fit from matching group membership alone. Keep evidence as separate provenance records. The final PostgreSQL design must enforce the rules below without restoring the legacy body-tip pairing as a catalog identity.

### Subject and target

- A compatibility subject is one pen catalog product plus an optional required pen-tip catalog product. A pen-wide assertion applies with any installed tip; a tip-scoped assertion applies only while that tip is selected.
- The subject never references an owned pen, collection item, refill offering, or legacy body-tip option row. An owned part resolves to its catalog pen-tip product before compatibility is evaluated.
- Each assertion targets exactly one compatibility group or one exact refill product. Exact refill assertions cover tightly machined exceptions without changing group membership.
- Tip size, ink colour, and other offering data do not create separate compatibility targets.

### Outcomes and exception data

Each assertion has one outcome:

- `compatible`: fits without a recorded condition;
- `incompatible`: is known not to fit;
- `conditional`: fits only after a documented remedy, such as trimming;
- `variable`: fit varies across documented samples, tolerances, or configurations.

Absence means unknown. Do not create an assertion whose outcome is unknown.

An incompatible or variable assertion requires an explanation. A conditional assertion requires remedy instructions. Any assertion may carry a concise warning when fit alone does not communicate safe or expected use. Generic refill adapters remain outside the project and cannot be introduced as remedies.

Do not add separate `fits`, `needs_trim`, `tested`, or `reliability` flags. The outcome, required explanation or remedy, and linked evidence represent those facts without contradictory combinations.

### Evidence

- Store one or more evidence records separately from the approved assertion. Evidence can support or contradict the current conclusion.
- Classify evidence as a manufacturer statement, dimensional comparison, physical fit test, or curated observation. Do not reduce those methods to a `tested` boolean or confidence percentage.
- Manufacturer and documentary evidence records identify the source URL plus source date or catalogue edition. Dimensional comparisons identify both measured formats and their sources. Physical fit tests identify the tested pen, required tip when applicable, refill, date, result, and repeatable procedure or notes.
- The same evidence shape supports refill-to-group membership decisions. Group admission thresholds remain a separate decision.
- Preserve superseded evidence for auditability. Changing the approved conclusion does not erase the sources that led to the prior conclusion.
- Public owner reports remain out of scope. Curated observations enter through staff review and carry normal audit provenance.

### Resolution and precedence

For an owned pen and selected refill, resolve the first applicable assertion in this order:

1. installed-tip subject and exact refill;
2. installed-tip subject and refill group;
3. pen-wide subject and exact refill;
4. pen-wide subject and refill group.

Ignore tip-scoped assertions when the owned pen has no matching installed tip. Reject conflicting assertions at the same specificity during authoring or import instead of choosing one at runtime.

An installed-tip change recomputes compatibility with the same order. It never clears or changes the installed refill or offering.

### User-facing behavior

- Compatible, conditional, and variable matches remain in the compatible-first tier. Conditional and variable matches show their accessible warning or remedy.
- Explicitly incompatible and unknown models remain selectable in the later tier and show a red indicator with accessible text that distinguishes known incompatibility from missing evidence.
- Search filters within the same two tiers and preserves their order.
- Refill detail pages may show compatible pens and any required tip. They do not expose owners, installation counts, or collection usage.

## Consequences

- Matching group membership is a candidate positive match, not proof that every pen accepts every member without exception.
- Exact negative and conditional assertions can correct a broad group match without fragmenting the group.
- The final schema needs assertion uniqueness and same-specificity conflict protection, evidence provenance, and query support for the precedence order.
