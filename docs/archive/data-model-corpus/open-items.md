# Open items — every hole in the model, in one place

**Opened 2026-08-14**, at the close of Sitting 5. This is the tracking document BVG asked for:
*"a deep dive into the holes we have… to track the work."*

**What this file is.** The data-model interview's job was **the tables and how they connect**, and
that job is done — 20 entities, 37 edges, zero soft decisions. Everything the interview
deliberately did **not** answer is below, with what it blocks and how it closes. Nothing here is a
schema question; if something turns out to be one, it goes back to the interview.

**Where the truth lives.** `.notes/data-model-answers.md` is the source of truth and every row
below cites it. This file **duplicates no reasoning** — it is an index of unfinished work.

**Status key:** 🔴 blocks something · 🟡 blocks nothing, wanted · ⚪️ noted, no action ·
✅ resolved, listed for the audit trail.

---

## A. Corrections owed to the corpus — do these first, they are cheap and they mislead

Errors found in our own notes. Left in place per the audit-trail rule, so each one needs a reader
to know about it.

| # | The error | Where | Impact | Status |
|---|---|---|---|---|
| A1 | **`BLS-VB5RT` is not the Juice Up refill.** It is the **V Ball RT**, which is the **Precise V5 RT**. The Juice Up takes **LP3RF-12S3/S4/S5**. | research pass 1's `pilot-g2` membership table · the measurement queue | The queue names **one refill twice**, so round 1 under-covers by one. 2.4's `rear_topology` rests on the Juice Up case — **confirm which refill was in hand**. | 🔴 |
| A2 | **Bastion's cause IS published.** 2.5 records *"cause never published."* They publish it: Parker's post-2015 wider-to-the-point body vs the classic taper. | decision 2.5's stored-negatives table | Good news — the negative becomes **citable** (4.3), and **2.4 survives its hardest case** (a Ø at a named location). See D4 for the part it complicates. | 🟡 |
| A3 | **CW&T is filed wrong in §A** of `data-model-research-findings.md` — in the catch-all row as *"mostly Parker or G2, single socket."* It is **Hi-Tec-C**, which §B of the same file states correctly. | research findings §A vs §B | Would seed the wrong style for a maker that publishes a real list. | 🟡 |
| A4 | **F4 is wrong** — the ISO G2 band is **97.75–98.50**, not *"98–99"*. Corrected in the answers file; **the finding itself was never rewritten.** | research findings, F4 | A 99 mm refill is **out of spec**, not at the edge of it. Changes how conformance reads. | 🟡 |
| A5 | **§A's per-maker archetype table is superseded by F3′** (archetype is per-body and derived, not stored). | research findings §A | Reading it as current re-introduces a demoted field. | ⚪️ |
| A6 | **NTI's Parker Mid-Size → pencil "via a kit" is wrong** — the LeadSlinger is a **separate body**. | research findings | — | ⚪️ |
| A7 | **§A's roster is missing three makers that publish fit data** — Studio Neat, Everyman, Sunderland (R-B, research pass 11). | research findings §A | Under-counts the seedable roster by three, one of which publishes better data than most of the original eight. | 🟡 |
| A8 | ✅ **Stale `OPEN 4.4b` marker** in `data-model-erd-clean.eraser` — closed by **C4a** on 2026-08-13 (`retailer`, the fifth value). | clean `.eraser` | Cleared 2026-08-14. | ✅ |

---

## B. Facts we asserted but never verified

Each is researchable. **B1 is the only one that blocks a rule from firing.**

| # | The claim | Blocks | How to close |
|---|---|---|---|
| B1 | **Autmog's published 2.5 mm — tip aperture or body bore?** | 🔴 **Rule 3, guard 2.** The geometry negative **cannot fire on Autmog** until this is settled. If it is the bore, an in-spec Parker refill at the top of ISO's 2.50–2.57 band would be failed wrongly. | Autmog product pages (Chrome — their copy is inconsistent listing-to-listing, R3) |
| B2 | **`rear_topology` values** — `open \| plugged \| finned \| flanged` is a **first draft**. | 🔴 Seeding **2.4's only axis**, the one thing no measurement can express. | Measurement round 1 firms it (D1) |
| B3 | **The Charpie cartridge.** Retailers say the Mark 22 ships 3D-printed tools to gut a Sharpie; **Fellhoelter's own page says only *"tools for assembly and disassembly."*** | 🟡 Relying on `refill.form = harvested` for that row | Fellhoelter page, or ask them |
| B4 | **BigIDesign's pencil mechanism.** Copy says *"0.5, 0.7 and 0.9 mm mechanical pencil **systems**"* — Schmidt's own word — but never names Schmidt. | 🟡 A `rebrand` row, and 5.2's graphite reading | BigIDesign product pages |
| B5 | **Does the Modern Fuel aBAP need a tip/spring swap for a Parker?** 98 mm sits **inside** its published 89–116 window. | 🟡 If the swap **is** needed, it is the **clean real-world case for negatives-only** that the withdrawn EnerGel example failed to be. | **BVG has the pen** |
| B6 | **Is Autmog's 36 Clipless a different body, or the same body without a clip?** | 🟡 Product identity under 3.1 | Autmog pages |
| B7 | **`colour_family`'s remaining values.** `blue_black` is now **sourced at all three makers** (R-A); `black \| blue \| red \| green \| other` are still **reasoned, not sourced**. | ⚪️ Nothing — `ALTER TYPE ADD VALUE` is cheap, removal is not | A retailer facet read, whenever |
| B8 | **BVG's claim 3** — G2 jams in Signo/Sarasa/EnerGel bodies; the trio fits G2 bodies with wiggle. **Mechanism confirmed, pairing unverified.** | 🟡 The provisional fracture line in the RB space | Measurement round 1 (D1) |
| B9 | **`schmidt-888`** — same cluster as the 8120 (6.81 mm) or its own row? | 🟡 A `refill_style` row | Measurement, or Schmidt's own spec sheets |
| B10 | **Does any maker target ISO G1?** Resolved as *skip* (≈ A2, obsolete) in the answers file — but the lexicon (§2.6) records FPN using **G1** as a live sibling class (Paper Mate Lubriglide, Schneider Express 225) and says it is *"worth a row when the corpus reaches it."* **Our two files disagree.** | 🟡 One `refill_style` row, and the disagreement itself | Decide once, record in both |
| B11 | **`toggle` appears in BOTH 3.3's parts list and 3.5's action list.** If a maker sells a toggle that **converts** a pen's actuation, then `product.actuator` has the same defect `socket_id` had under F3′ — it would belong on the part. | 🟡 Would move a column | Tactile Turn's toggle listings |

---

## C. Things the model deliberately cannot express — each with its trigger

**None of these are defects.** Every one was declined under **ERD rule 2** (*never invent a field to
close an open fork*) with a named condition for revisiting. Listed so a future reader does not
mistake a deliberate absence for an oversight.

| # | Not built | Trigger that would build it | Shape it would take |
|---|---|---|---|
| C1 | **The submission path** — user submits a pen/part, staff approve or amend, it goes public. Out of scope by BVG (5.6a). | Building the collection at all — **5.6a makes it the only way in** | **`fit_report`'s pattern, one corpus over**: `review_state` = `pending \| approved \| rejected`, rejected rows **kept**. Reuse it; do not invent a second shape. |
| C2 | **`tip_variant`** — which alloy of a pen tip you own. The **tenth axis-mix, avoided**. | A maker starts selling **tips alone, by alloy**. R-F found **none** — TT machines tip and body together; Fellhoelter's spare kit is an o-ring, a spring and a refill. | The identity-vs-purchase-option pattern's **third** instance — `tip_option` + `tip_variant`, **never** `tip` in `part.kind` (that puts one SKU in two tables, which S1's merge removed). |
| C3 | **Refill revisions over time** — *"Parker cartridges made after 2015"* (A2). | A curator hits a third instance | **1.3's escape hatch**: the post-2015 part becomes **its own `refill` row**, kept apart until proven identical. The style-wide fact goes in **`refill_style.variance_note`**. No revision column. |
| C4 | **Fountain-pen ink.** BVG, 5.5: *"later, specific ink in a fountain pen."* | Fountain pens entering scope — they are **out** per Sitting 3 (*"is there a seated cartridge"*) | **Ink is the same class as graphite lead**, which 5.2 already ruled: a consumable **one level below** the seated part. A new entity in a later scope — **never** a `refill` or `refill_variant` row. |
| C5 | **A carry log.** 5.5 answered *field*. | Consumption history becoming a feature | An **append-only child table**; `installed_refill_id` becomes *"the newest row"* — a clean **twelfth demotion**, no backfill. |
| C6 | **A nickname on a saved pen.** 5.4 declined it once `part_fitted` closed the gap. | The collection UI needing a user-supplied label | One nullable text column. **Now a UI-pass question, not a schema one.** |
| C7 | **Owner-commissioned finishing** — you send **your** pen to KVR. Same finisher fact as `product_variant.finisher_maker_id`, but on the owned side. | A second instance in the wild | Carried in the ERD as `OPEN 5.x`. Noted, not built. |
| C8 | **A refill item/part code** (`LR7-A`, `BLS-VB5RT-BB`). | Nothing yet | `(refill_id, tip_size, colour_name)` is **already a natural key**. ERD rule 2. |
| C9 | **Writing system as a field** (refill / pencil / marker). | — | Derived from the refill's `medium`; one structural class is in scope. |

---

## D. Work only BVG can do

| # | The work | What it unblocks |
|---|---|---|
| D1 | 🔴 **MEASUREMENT ROUND 1.** Juice Up **LP3RF-12S4** + Precise V5 RT **(BLS-VB5RT)** — *note A1, these are two different refills* — then EnerGel / Signo / Sarasa. | **The single biggest unblock in the model.** It places the RB-space fracture line → names the RB-space styles → and **`tip_option.refill_style_id` is required**, so **no pen in that space can enter the catalog at all** until it lands: Autmog, TT Standard, Fellhoelter G2, Ti2, Sunderland. It also firms **B2** and tests **B8**. |
| D2 | 🟡 **The Modern Fuel aBAP Parker question** (B5). | The clean negatives-only case for Rule 3 |
| D3 | 🟡 **Confirm the Juice Up rear-plug observation** against the corrected refill identity (A1). | 2.4's axis rests on it |
| D4 | 🟡 **Decide the Bastion / post-2015 Parker split** before any rows are written (A2, C3). | Whether `parker-style` gets a `variance_note`, a second `refill` row, or both |

---

## E. Naming still open

| # | Item | Note |
|---|---|---|
| E1 | 🟡 **The RB-space `refill_style` names.** **Deliberately deferred** — Rule 3 may make it three clusters and one boundary is provisional; naming clusters whose edges move is wasted work. | Blocked by **D1**. Aliases are already settled: **model-level, never brand-level** (`Signo UMR-85`, `EnerGel LR/LRN`, `Sarasa JF` — never a bare "Signo"). |
| E2 | 🟡 **`energel` as the name of the 111 mm cluster** is the **1.1 trap pointed at Pentel** — it spans three brands with no owner. | Either keep it with Signo/Sarasa as first-class aliases, or take a neutral name. Decide with E1. |

---

## F. Curation and seeding — the bulk of the later work

Not schema. Listed because **5.6a** made catalog completeness the gate on everything a user can do.

| # | The work | Notes |
|---|---|---|
| F1 | **Seed order is fixed by 4.5** — styles first (**FK-required**), then makers; fit checks **negatives-first**: research corpus → BVG's own pens → **maker lists last**. | And **launch order is set by style readiness, not maker popularity** (R-B). Parker-space, Hi-Tec-C, Fisher PR, D1 and M22 are settled; the RB space is not. The gate is **per pen tip**, so most makers ship **partially** — TT's Short and Karas' Parker variants are unblocked while their G2-space siblings are not. |
| F2 | **The publisher roster is ~13–15, deep on ~8–10** (R-B) — not the 8 previously assumed. **Newly found: Studio Neat (a 14-refill guide with a trim instruction), Everyman (accept-list, plus a different one for the Mini Twist), Sunderland (a blanket declared claim).** **Upgraded: Bastion, CW&T, Schon DSGN.** **Thin: Ti2** (identification, not compatibility). **Not a list: Modern Fuel** (a length window). | |
| F3 | **Four `style_adapter` rows are sourced and ready** — TT's Parker adapter · Fisher's bundled converter · **Schon's D1 adapter** · **CW&T's spacer path** (Hi-Tec-C → 10 more cartridges). Directed, maker-published: the hardest kind of row to source. | |
| F4 | **`refill_variant` bulk seeding** has **two consumers waiting** — the optional exact refill on a saved pen (5.3b(i)) and the faceted browse (5.7). Neither blocks launch. | **R-A**: Pentel, uni and Pilot each publish a **complete size × colour matrix** on their own site. The matrix is **ragged** — colours do not survive a size change — so it must be seeded as rows, never generated. |
| F5 | **`ships_with_refill_id` is a curation worklist, not a free positive** (4.5) — the shipped refill is the first `fit_check` a curator writes per pen, **by hand**. | BilletSpin's in-box refill is **pre-trimmed**. |
| F6 | **Promotion is judgment, not a lookup** (C3/4.5) — Autmog's *"click"* becomes `advance_mechanism = ratchet` **and** `actuator = top_button`, and it does **not** determine them. *"Cheap per row, still a human."* | |

---

## G. Notes for whoever implements this

Decisions that are easy to get wrong at the keyboard and are **not** obvious from the diagram.

| # | Note |
|---|---|
| G1 | **The saved pen's two refill columns cannot be allowed to disagree.** `refill_variant` needs **`UNIQUE (id, refill_id)`**; `collection_item` takes a **two-column FK** `(installed_refill_variant_id, installed_refill_id) → refill_variant (id, refill_id)` **plus** `CHECK (installed_refill_variant_id IS NULL OR installed_refill_id IS NOT NULL)`. ⚠️ **`MATCH FULL` would be wrong** — it forbids the model-only row the design exists for. |
| G2 | **The pre-fill is WRITTEN at save time, never resolved on read** (5.3b(ii)). Otherwise a curator's catalog edit silently rewrites what is loaded in every saved pen. |
| G3 | **Curation rules are stated, not constrained** — a citation is required when `claimed_by` is `maker` or `community`; a disputed row requires a note; `part_fitted` is **cosmetic parts only** (`part.kind` is the test). Enforce in the app or in review, not necessarily in DDL. |
| G4 | **Growing an enum costs a TS edit AND a generated migration** (every domain vocabulary is `as const` → `pgEnum` at the column, PR #63). `ALTER TYPE ADD VALUE` is cheap; **removing a value is not** — which is what makes *"start coarse and grow"* the right counsel. |
| G5 | **`material` and `user` are INHERITED, not designed** — the committed `materials` and `users` tables. Declared in the ERD only so the FKs resolve. Do not re-model them. |
| G6 | **`mechanisms` and `product_types` are scraper staging** — interned from scraped strings, **not corrected and not used** by this model (C3). |
| G7 | **House style** (rule 5): `id bigint pk`, `created_at` / `updated_at timestamptz` on every entity, `slug text unique` on canonical entities, `maker.root_url text unique`. |
| G8 | **Eleven things are DERIVED and must not be stored.** Check the list before adding any column. |

---

## H. Deliberately out of this process

| # | Item | Why |
|---|---|---|
| H1 | **5.8 — launch size / how many makers.** | **No schema consequence.** It is a curation-effort question, and R-B's roster (F2) is the input for it whenever it is picked up. |
| H2 | **The UI pass** — trim-length display (captured always, display deferred), the nickname (C6), and copy discipline (*never a bare "tip"*: **"pen tip" / "tip size" / "tip opening"**). | Naming thread + UI, not the data model |
| H3 | **eraser.io automation.** The `ERASER DOC URL: ____` slots are **still blank** — nothing has ever been pushed; every render is a manual paste. **`docs/data-model/README.md` now has a URL table to fill in as you render**, which closes the *referencing* half without the automation. | Mechanics are settled and verified in `.notes/eraser-integration-findings.md`; wiring it was never started |
| H4 | **The three review diagrams moved into the repo** — `docs/data-model/` — on 2026-08-15, because `.notes/` is git-excluded and nothing in it ships. **The rest of the corpus is still scratch-only**, including `data-model-erd-clean.eraser`, which is the file implementation will be built from. Worth deciding whether that one belongs in `docs/` too. | Not blocking; flagged so it is a choice rather than an oversight |

---

## Where things stand

**Sittings 0–5 COMPLETE. Ratification sweep COMPLETE. Carried items C1–C4b COMPLETE.**
**20 entities · 37 edges · zero shells · zero soft decisions.**

Counts to keep honest: **11** demotions · **10** axis-mixes caught (the last five *before*
construction) · 2 further defect classes · 4 display states · 5 backbone grains · 2
identity/purchase-option grains · 3 rules · 3 guards on Rule 3 · 7 questions dissolved into other
questions · 11 research passes.

`python3 .notes/validate-eraser.py` → **exit 0**. It prints the counts for all six ERD sources,
resolves every relationship endpoint, **and as of 2026-08-14 also checks that the files agree with
each other** — the two schema-of-record files are the same schema, the full public view matches it
through the rename map, and each scoped view is a genuine subset. That last part used to be *"still
a read"*; it is mechanical now. Column **order** is deliberately ignored, because Eraser reorders
columns within an entity on render.
