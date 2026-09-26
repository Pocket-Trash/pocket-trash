# What the distillation dropped — read this, not the 9,784 lines

**Phase 3 of the 2026-08-15 distillation.** `MODEL.md` is 698 lines; the corpus it came from is
9,784. This file lists **everything consciously not carried forward**, so the review is a read of
what is *missing* rather than a re-read of everything.

**Mechanically verified already** *(so it is not on this list)*: all **20 entities** and all **102
non-house-style columns** appear in `MODEL.md`, plus the three rules, the eleven demotions and the
composite-FK note. `python3 docs/data-model/verify-model-doc.py` → exit 0.

**Nothing is lost, only moved.** Everything below is verbatim in
[`docs/archive/data-model-corpus/`](../archive/data-model-corpus/).

---

## A. Whole files retired

| File | Lines | Why |
|---|---|---|
| `sitting-4-prompt.md`, `sitting-5-prompt.md`, `sitting-5b-prompt.md`, `sitting-5c-prompt.md` | 941 | Session hand-off scaffolding — each one superseded by the next, and the last by the interview finishing |
| `data-model-questions.md` | 275 | The question set. **Every question is answered**, and its owner index is stale |
| `data-model-question-sketch.md` | 205 | The original scaffold. Holds the first draft of the five fit grades, which 2.6 replaced |
| `data-model-refills-and-products.md` | 338 | Early sketch. Its compat model was rewritten by Sitting 2 |
| `vocabulary-research-prompt.md` | 115 | The brief that produced the lexicon; the lexicon answered it |
| `eraser-research-prompt.md` | 83 | The brief that produced `eraser-integration-findings.md`; the findings answered it |
| `data-model-research-findings.md` | 307 | The first research pass. ⚠️ **Carries four known errors.** Its surviving facts are in `MODEL.md` Appendix A |
| `data-model-erd-public-compatibility.eraser` | 307 | The fit and remedies views on one canvas. **Superseded by splitting it** into `fit.eraser` (5 / 8) and `remedies.eraser` (10 / 10) |

**Archived rather than dropped:** `eraser-integration-findings.md` — 527 lines of *verified*
renderer mechanics, still referenced, and re-researching it would cost a day. It is in
[`docs/archive/data-model-corpus/`](../archive/data-model-corpus/) with the rest of the corpus.

**Moved into the repo rather than dropped:** `schema.eraser` (was `data-model-erd-clean.eraser`),
`open-items.md`, the remaining diagram views, and both validator scripts. `docs/data-model/` no
longer reads anything out of `.notes/`.

---

## B. Content dropped from the folded files

| # | Dropped | Kept instead | Risk if we are wrong |
|---|---|---|---|
| B1 | **The chronology.** Most decisions appear 3× in the corpus — proposed, corrected, ratified | The outcome plus one line of why | Low. But this is ~60% of the volume, and it is the single biggest reason the doc is 698 lines instead of 3,000 |
| B2 | **The vocabulary translation table** (`socket` → `refill_style`, `compat_edge` → `fit_check`, …) | Nothing — `MODEL.md` uses **current names only** | **None. This is a pure win**: nobody has to mentally translate while reading again |
| B3 | **Research-pass narratives** — 11 passes, source by source, with what was searched and what failed | The **findings**, in Appendix A, and the source list per pass in the archive | Low. But re-verifying a fact now means opening the archive to find the URL |
| B4 | ✅ **PARTLY RESTORED** — **the corrections trail** — "F4 is wrong", "pass 2's conclusion was wrong", "the assistant overstated this", "BVG's lean was wrong here" | The corrected fact, stated plainly | ⚠️ **Medium, and it is the judgment call I am least sure of.** It changes no schema, but it is the record of *why the process caught things*. **Resolved by adding `MODEL.md` §10**, which lists the **eight** conclusions that reversed on evidence, one line each. The full arguments stay in the archive |
| B5 | **The lexicon's evidence tables** — who uses which market word, with quotes from makers, retailers, two forums | The resulting labels (§7b) and the copy rule | Low. The conclusions are stable and were confirmed from two independent directions |
| B6 | **Per-sitting method notes** — how each question was framed, what was asked in what order | Nothing | None for the model. Some for whoever runs the next interview |
| B7 | **Counts of process** — "7 questions dissolved into other questions", "5 backbone grains", "11 research passes" | The substance (the patterns, the derived list) without the tallies | None |

---

## C. ✅ RESOLVED — maker names are back in

**`MODEL.md` had genericised maker names.** It said *"one maker publishes 89–116"*, *"one maker
publishes ±25 µm"*, *"one pen declares Parker and rejects some Parker refills"* — where the corpus
says **Modern Fuel**, **Autmog** and **Bastion**.

- **Why I did it:** the doc reads as a model spec rather than a competitor dossier, and the examples
  carry their point without the names.
- **Why it may be wrong:** whoever seeds the catalog needs the names, and *"Autmog publishes a
  2.5 mm bore ±25 µm"* is a concrete lead in a way that *"one maker"* is not. `open-items.md` names
  them throughout, so the doc set is **inconsistent with itself** as it stands.
- **Resolved 2026-08-15: the names are back**, in all 24 places. `MODEL.md` now names Autmog,
  Tactile Turn, Modern Fuel, Bastion, Karas, Schmidt, Premec, Fisher, BigIDesign, Ti2, Alpha,
  BilletSpin, Magnus, KVR and Dark Pines where the argument depends on them.

---

## D. What survived that you might expect to have been cut

Listed so you can confirm these were worth the lines:

- **Appendix A, the primary data** — the dimensioned drawing, the ISO tolerance bands (from a
  standard that costs ~$65 and is not freely available), the type seed table, the measured ~110 mm
  spread, and the R-A/R-B findings. **Measured or transcribed, not reasoned.**
- **§6, what was rejected** — ten axis-mixes and two further defect classes, one line each. This is
  what stops someone re-adding a field the model spent five sittings removing.
- **§5, the rules enforced by convention** — citation required, disputed rows need a note,
  `part_fitted` is cosmetic-only, the completeness gate, pre-fill is written not resolved, and the
  bare-"tip" copy rule. None of these are DDL, so nothing else records them.
- **§8, the implementation notes** — especially the composite FK and why `MATCH FULL` would be
  wrong. A day of debugging, in five lines.

---

## E. Status — closed

The distillation is complete and committed.

- [x] **C** — maker names restored, all 24
- [x] **B4** — the reversals survive as `MODEL.md` §10
- [x] Phase 4 moves done — `docs/data-model/` is self-contained and reads nothing from `.notes/`
- [x] **Committed** — the corpus is in git at
      [`docs/archive/data-model-corpus/`](../archive/data-model-corpus/), so it is a backup and
      not merely a copy. `.notes/` is scratch from here on and nothing reads from it

**Going forward this file is the standing record of what the model does *not* carry.** When
something is deliberately cut, add it here with the same three columns — what was dropped, what is
kept instead, and the risk if that judgment was wrong — so an absence never reads as an oversight.
The source of truth for what the model *does* carry is [`MODEL.md`](./MODEL.md).
