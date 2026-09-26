# Data-model corpus — frozen 2026-08-15

**This is the working corpus of the pen/refill data-model interview, archived verbatim.** It is
**superseded** by [`docs/data-model/MODEL.md`](../../data-model/MODEL.md). Read that first. This
directory exists so nothing is lost, not so anyone has to read 9,784 lines.

## Why it was archived

The interview ran across six sittings between 2026-08-10 and 2026-08-14 and produced ~9,800 lines
in `.notes/`, which is **git-excluded and never shipped**. Roughly 60% of that is chronology — the
same decision recorded as it was proposed, corrected and ratified. `MODEL.md` distils the outcome;
this holds the reasoning that produced it.

**Nothing here is current.** Where this corpus and `MODEL.md` disagree, `MODEL.md` wins.

## What is in here

| File | Lines | What it is |
|---|---|---|
| `data-model-answers.md` | 3,444 | The source of truth at the time. Every numbered decision, 11 research passes, and the corrections trail. ⚠️ Its numbered decisions use **pre-2026-08-12 vocabulary** (`socket`, `compat_edge`, …); it carries its own translation table. |
| `data-model-erd.md` | 1,140 | The annotated ERD — maintenance rules, the derived list, the defect classes, the backbone patterns |
| `vocabulary-lexicon.md` | 652 | The naming law, and internal name → buyer-facing label |
| `eraser-integration-findings.md` | 527 | eraser.io mechanics and the **verified** DSL grammar. Still referenced — do not re-research |
| `open-items.md` | 155 | The open-work register at freeze time |
| `data-model-research-findings.md` | 307 | The first research pass. ⚠️ **Contains four known errors** — see the register's section A |
| `data-model-questions.md` | 275 | The question set. All answered; the owner index is stale |
| `sitting-*-prompt.md` | 941 | Session hand-off prompts, a superseded chain |
| `data-model-refills-and-products.md`, `data-model-question-sketch.md` | 543 | Early sketches, largely superseded by Sitting 2 |
| `vocabulary-research-prompt.md`, `eraser-research-prompt.md` | 198 | The research briefs that produced `vocabulary-lexicon.md` and `eraser-integration-findings.md`. Kept because they record what was *asked*, which is what you would need to re-run either pass |
| `*.eraser`, `validate-eraser.py` | — | The diagram sources as they stood at freeze |

## What it is still good for

Three things, and they are the reason it was kept rather than deleted:

1. **Why something is *not* in the model.** Eleven fields were demoted to derived and ten
   enum designs were rejected for mixing two axes. `MODEL.md` records each in a line; the argument
   is here.
2. **The corrections trail.** Several conclusions reversed on evidence — two of BVG's own leans,
   two of the assistant's claims that the repo disproved, and one column that sat in the ERD for
   three sittings before its defect was named. That record is why the process caught things.
3. **Primary data**, though it has been carried forward into `MODEL.md`'s appendix: the dimensioned
   Pilot G2 drawing, the ISO 12757 G1/G2 tolerance bands, and the ISO type seed table.
