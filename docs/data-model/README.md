# Data model — pen/refill compatibility

The model behind *"will this refill work in my pen?"* — **20 entities, 37 relationships**, settled
across six design sittings and distilled here on 2026-08-15.

## Start here

| | |
|---|---|
| **[`MODEL.md`](./MODEL.md)** | **The source of truth. Read and implement from this file.** Every entity and column, what it means, and one line of why. Plus what is deliberately derived, what was rejected, the rules enforced by convention, and the primary measurement data |
| [`DROPPED.md`](./DROPPED.md) | What the distillation left behind, and the risk if that judgment was wrong |
| [`open-items.md`](./open-items.md) | Every known gap — what it blocks and how it closes |
| [`schema.eraser`](./schema.eraser) | The **structural expression** of `MODEL.md` — the machine-checkable form the validators enforce. Where the two disagree, `MODEL.md` wins and this file is the thing to correct |

## Diagrams

Five views. Each answers one question; none puts 20 boxes on one canvas.

| File | Size | Answers |
|---|---|---|
| **[`fit.eraser`](./fit.eraser)** | 5 · 8 | **"Will this refill fit?"** — the moat. **Review this first** |
| [`remedies.eraser`](./remedies.eraser) | 10 · 10 | "It doesn't drop straight in. Now what?" |
| [`collection.eraser`](./collection.eraser) | 10 · 12 | "What do I own, and what's loaded?" |
| [`catalog.eraser`](./catalog.eraser) | 9 · 11 | "What is this pen, and what does it come as?" |
| [`full.eraser`](./full.eraser) | 20 · 37 | everything, in buyer words — a reference, not a review artifact |

Render by pasting into [app.eraser.io](https://app.eraser.io) → **Diagram as code** →
**Entity Relationship Diagram**:

```sh
pbcopy < docs/data-model/fit.eraser
```

**Rendered doc URLs** — fill these in as you create them, so the next person can open the diagram
instead of re-pasting it:

| | URL |
|---|---|
| fit | `____________________________________________` |
| remedies | `____________________________________________` |
| collection | `____________________________________________` |
| catalog | `____________________________________________` |
| full | `____________________________________________` |
| schema (of record) | `____________________________________________` |

## Reading the diagrams

**The comments are the point.** Each file carries what boxes cannot show: why a column exists, the
rules that govern the canvas without being entities, and — at the bottom of every file — **what is
deliberately absent and why**. That last section matters most: roughly half the decisions in this
model were *refusals*, and an absence otherwise reads as an oversight.

| Convention | Meaning |
|---|---|
| **Colour marks the layer** | blue = the pen side · green = refills · purple = refill styles · orange = the assertion corpus · red = adapters · grey = the collection |
| **No icon = a join, not a thing** | `part_needed`, `part_fitted` and `also_known_as` are deliberately unadorned |
| **"Stub" entities** | some boxes appear in short form so a link resolves; the file says where the full form lives |

⚠️ Everything except `schema.eraser` uses **buyer-facing labels** — `tip` is `tip_option`, `report`
is `fit_report`, `also_sold_as` is `rebrand`. The full map is [`MODEL.md` §7b](./MODEL.md). **Do
not implement from a buyer view.**

Two quirks of the renderer, both verified: it **reorders columns within an entity**, so adjacency
in the source carries no meaning; and it auto-lays-out entities, so declaration order only *biases*
placement. Crossings are reduced by **splitting a view**, not by reordering it.

## Checks

```sh
python3 docs/data-model/validate.py            # diagrams agree with the schema
python3 docs/data-model/verify-model-doc.py    # MODEL.md covers every entity and column
```

`validate.py` resolves every relationship endpoint against a declared entity and an existing
column, confirms `full.eraser` matches `schema.eraser` through the rename map, and enforces that
every scoped view is a **genuine subset** — so a diagram cannot silently drift from the schema.
**Add any new `.eraser` file to its `FILES` list or it goes unchecked.**

## History

This replaces a 9,784-line working corpus, archived verbatim at
[`docs/archive/data-model-corpus/`](../archive/data-model-corpus/) and **superseded** — where the
archive and `MODEL.md` disagree, `MODEL.md` wins. What was consciously dropped in the distillation,
and the risk if that judgment was wrong, is listed in [`DROPPED.md`](./DROPPED.md).
