# Ratification sweep + Sitting 5 — prompt for a fresh session

> ⚠️ **SUPERSEDED 2026-08-13 by `.notes/sitting-5b-prompt.md`.** Part 1 (the ratification sweep)
> and Part 2 (the four carried structural items) are **complete** — S1/S2/S3 ratified, C1–C4b
> answered. Part 3's ownership warning is **moot**: field-log was dropped and there is no app to
> integrate with, so 5.3/5.4/5.5 are BVG's. Kept for the audit trail; do not paste this one.

**Written 2026-08-12**, at the close of Sitting 4. Same pattern as `.notes/sitting-4-prompt.md`:
paste the fenced block below into a new session.

---

## Paste this into a fresh session

```
Resume the machinedpens pen/refill data-model interview. Sittings 0-4 are COMPLETE. This session
opens with the RATIFICATION SWEEP, then the four carried structural items, then SITTING 5
(refills, collection, launch).

CONTEXT — read in this order:
- `.notes/data-model-answers.md` — SOURCE OF TRUTH. Opens with a "▶ RESUME HERE" block; read it
  first, it overrides everything else. Note its ⚠️ VOCABULARY CHANGED table: five entities were
  renamed on 2026-08-12 and this file was DELIBERATELY not rewritten, so its numbered decisions
  still say "socket", "compat_edge", etc. Translate as you read; do NOT "fix" them.
- `.notes/data-model-erd.md` — the annotated ERD. `//` comments carry decision numbers;
  maintenance rules 1-6 govern edits (rule 6 is the naming law). Read the "two corpora" section
  and the DERIVED list before you consider adding anything.
- `.notes/data-model-erd-clean.eraser` — the pastable schema of record. Keep it in sync.
- `.notes/vocabulary-lexicon.md` — §0 NAMING LAW (binding). §2 internal→buyer label map.
  §2.7 rebranded refills (an open structural gap). §5 committed-schema inheritance, §5.3
  collisions, §5.4 lookup-tables-vs-enums.
- `.notes/eraser-integration-findings.md` — eraser.io mechanics + VERIFIED DSL grammar. Settled;
  don't re-research it.

HOW BVG RUNS THIS INTERVIEW — follow it exactly:
- One question at a time. He picks a letter or writes a third option.
- BEFORE each question, state what the accumulated evidence already implies, and give a
  RECOMMENDATION. Don't relay the files back at him.
- FLAG TENSIONS between his answers instead of silently recording contradictions. This has
  caught several real problems, including two of his own leans being wrong and one place where
  Sitting 4's own reasoning had to be deliberately NOT applied (4.4b).
- Research a claim when it would change an answer.
- Record every decision in `.notes/data-model-answers.md` as you go, including knock-ons, and
  update the ERD files IN THE SAME SITTING.

⚠️ THE NAMING LAW IS BINDING (vocabulary-lexicon.md §0, ERD rule 6).
Every new entity, column and enum value must pass: "could someone shopping for a pen say this
name out loud and mean roughly the right thing?" Apply it WHEN THE NAME IS CREATED, not later.
Banned: domain jargon (socket/edge/node/bridge/topology), compound schema nouns where a plain one
exists, brand-anchored words as identifiers. Exempt where the plain word is ALSO wrong
(advance_mechanism, medium, and the seven terms with no market word). Three traps: don't collapse
a distinction for a shorter name; don't let a plain name OVERCLAIM; when two things share a market
word, qualify both rather than inventing a second unsettled word.

⚠️ BEFORE PROPOSING ANY COLUMN: check the DERIVED list. ELEVEN things have been demoted from
stored to derived, and SEVEN defects were "one enum mixing two orthogonal axes." The last few of
each were caught before being built. Assume the next one is too.

═══ PART 1 — THE RATIFICATION SWEEP (do this FIRST, it is cheap) ═══

Three things are applied to the ERD but were never explicitly chosen. Two have now slid across
three sittings. Get a yes/no on each; do not let them slide again.

  S1. The `slot_option` → `part` merge, Sitting 3 (c′). ASK THIS ONE FIRST AND ASK IT BARE —
      it has been asked twice and dodged twice, both times because it was embedded in a
      vocabulary discussion and he answered the vocabulary. A direct yes/no, nothing else in
      the message. It was applied on the strength of his own "specific parts lists for brands"
      requirement.
  S2. 3.2b's tip_option override — three nullable columns on `tip_option`. He said "seems
      logical" to the recommendation, so this has real assent, just not a letter.
  S3. 4.3's `source` split — `claimed_by` / `made_by` / `citation_url`+`citation_note`. Applied
      on OPT-OUT ("I'd do it; say if you'd rather not") while he answered a different fork.
      4.4b since added `claimed_by` to `refill_dimension` as an explicit choice, so part of this
      shape already has his assent.

═══ PART 2 — THE FOUR CARRIED STRUCTURAL ITEMS ═══

  C1. REBRANDED REFILLS (lexicon §2.7). The Retro 51 refill IS a rebranded Schmidt. Today that
      is two `refill` rows, same geometry, same `refill_style_id`, NO link — so every fit_check
      gets curated twice and can drift. Candidates: a `refill_alias` table (mirrors
      `also_known_as`), a nullable `same_as_refill_id` self-reference, or a `refill_identity`
      grouping the way `refill_style` groups shapes. Interacts with `form = sku|harvested` and
      with 4.5's seed order — duplicate curation is exactly what a negatives-first seed cannot
      afford.
  C2. LOOKUP TABLES vs TS ENUMS (§5.4). The committed schema makes open vocabularies into TABLES
      (`mechanisms`, `materials`, `product_types` — id/name/slug unique). Our ERD makes them
      `enum`, and 3.3 says growing `part.kind` is "a TS edit (enums.ts = as const)". Incompatible
      answers to one question. Affects advance_mechanism, actuator, part.kind,
      product_variant.material, refill.medium, and now `claimed_by` on two tables.
  C3. THE TWO COMMITTED-SCHEMA COLLISIONS (§5.3). `mechanisms.name = "click"` is the mixed-axis
      value 3.5 split apart; `product_types` stores what 3.1 demoted to derived. Correct them,
      or have v2 simply not use those tables?
  C4. Two residual OPENs from Sitting 4, neither blocking:
      · the RETAILER GAP in `claimed_by` — a retail listing reprinting a spec (Penstore) is
        neither `maker` nor 4.3's "forum/guide harvested by a curator". Fold into one of them,
        or a fifth value. Labelling only; no resolution rule depends on it.
      · `product.ships_with_refill_id` is product-scoped but the fit it implies is
        tip_option-scoped, so a two-tip product cannot say which configuration ships.

═══ PART 3 — SITTING 5, refills / collection / launch ═══

Agenda in `.notes/data-model-questions.md` §"Sitting 5". CHECK WHAT IS ALREADY ANSWERED BEFORE
ASKING — Sitting 4 ate part of this list:

  5.1 refill facets — LARGELY SETTLED already. Sitting 3 widened `ink_type` to `medium`
      (ballpoint|gel|hybrid|rollerball|pressurized|graphite|permanent marker|highlighter) and
      `tip_size` / `colour` exist. Confirm the residue, don't re-ask the whole thing.
  5.2 colour depth — full long tail vs black/blue/red/other. Still genuinely open
      (`refill.colour string null // OPEN 5.2`).
  5.3 `collection_item` columns at launch — drop number · serial · acquisition date · source ·
      price paid · current value · condition · notes · photos · installed refill.
  5.4 multiples — separate rows vs a quantity field.
  5.5 `installed_refill` as a field vs a carry LOG from day one.
  5.6 sequencing — the one question the site answers on day one. ⚠️ PARTLY PRE-ANSWERED: 4.5's
      two-corpora split (catalog broad, fit checks narrow and deep) and 4.1b's "accuracy not
      widespread adoption" already constrain this. Ask the residue.
  5.7 launch catalog scope — pens only vs pens + refills browsable. ⚠️ 4.5 leans this too:
      refills are catalog entities and the prior display needs them.
  5.8 credible launch size — how many makers. ~25 researched; 8 have published compat data
      (Autmog, Fellhoelter, NTI, Tactile Turn, Karas, BigIDesign, Grimsmo, Spoke).

⚠️ OWNERSHIP: 5.3, 5.4 and 5.5 are the COLLECTION layer, which is Brownie's app's centre of
gravity, not BVG's. Ask whether he wants to answer for it, defer it, or bring Brownie in —
before spending a sitting on it.

WHAT SITTING 4 DECIDED (do not re-litigate; knock-ons only):
- `evidence` enum (declared|tested) replaced `verified bool`; `fit_report` holds the approval
  gate; `fit_quality` is nullable (4.1).
- NOTHING renders until approved. `fit_report` has NO buyer read path; every buyer query reads
  `fit_check` only (4.1b).
- `source` split three ways: `claimed_by` / `made_by` / `citation_url`+`citation_note` (4.3).
- The fit VERDICT is DERIVED, demotion #9: disputed-out → scope → evidence → tie = no verdict.
  `fit_check.disputed_note text null` is the staff override, per row, never per maker (4.4).
- `fit_check` is MUTABLE curated state; `fit_report` is the APPEND-ONLY log. No `retracted_at`,
  no soft delete anywhere (4.4).
- NO `disputed_note` on `refill_dimension` — a bad number is DELETED, not annotated. It gained
  `claimed_by` instead, and a geometry negative now fires only on an unconflicted `feature` or a
  `staff` row. Displayed measurement is demotion #10 (4.4b).
- TWO CORPORA: catalog broad (scraper stages, a human promotes) vs fit checks narrow and deep,
  seeded NEGATIVES-FIRST (research corpus → BVG's own pens → maker lists last). Zero fit rows
  renders the PRIOR (`refill_style` + `observance`), a FOURTH display state that must never read
  as a negative. Coverage is demotion #11. `ships_with_refill_id` is the seeder's worklist, not
  a free positive (4.5).

THE THREE RULES THE SCHEMA MUST NOT VIOLATE:
1. A need modifies the refill or adds a part. Nothing modifies the pen.
2. An axis exists only for a fact no measurement can express. (Only `rear_topology` passed.)
3. Geometry may produce a negative, never a positive — now with THREE guards: both numbers
   carry a `feature` tag · the Autmog 2.5 mm dependency · the feature must be unconflicted or
   the row must be `claimed_by = staff`.

CONSTRAINTS:
- Do NOT rewrite the old vocabulary inside `.notes/data-model-answers.md`. The translation table
  in its RESUME block is the mechanism; the audit trail is worth more than the consistency.
- Keep `fk`, `null` and the `//` comments in the ERD — all verified legal against the renderer.
- Open forks stay as `// OPEN n.n` comments; never invent a field to close one.
- Five `.eraser` files must stay in sync: clean + public + public-catalog +
  public-compatibility + public-collection. Validate that every relationship endpoint resolves
  to a declared entity and an existing column before finishing.
- AGENTS.md requires `pnpm format` after documentation-only changes.

ACCESS NOTES (learned the hard way — don't rediscover):
- JetPens, unsharpen.com, Reddit and Fountain Pen Network ALL 403 or fail WebFetch. Use the
  Chrome extension. `old.reddit.com` is blocked; plain web search returns retail spam for every
  community query.
- Eraser ERD entities have NO `[label:]` property (icon/color/colorMode/styleMode/typeface only).
  A friendly view must be a separate file. `title` with `(`, `)`, `;`, `?` is UNTESTED — keep
  titles to words and em-dashes.
- The `ERASER DOC URL: ____` slot at the top of every `.eraser` file is STILL BLANK. Nothing has
  ever pushed to eraser.io; every render so far is a manual paste.

BLOCKED ON BVG'S HANDS, not his opinion — ask, don't guess:
- ⚠️ MEASUREMENT ROUND 1 IS NOW A LAUNCH DEPENDENCY (promoted by 4.5). Juice Up BLS-VB5RT +
  Precise V5 RT, then EnerGel/Signo/Sarasa. `tip_option.refill_style_id` is required, so no pen
  enters the catalog until its style exists — and the RB-space styles are still deliberately
  unnamed pending these numbers. It also firms `rear_topology`, whose values are a DRAFT.
- Still UNCONFIRMED: Autmog's published 2.5 mm (a Rule-3 dependency) · whether the Modern Fuel
  aBAP needs a tip swap for Parker · the Charpie cartridge · BigIDesign's pencil mechanism ·
  whether Autmog's 36 Clipless is a different body.

Start by confirming the read, summarising where things stand in a few lines, then ask S1 —
bare, nothing else in the message. Do not dump the files back at me.
```

---

## State at the end of the previous session (for whoever picks this up)

**Sittings 0-4 COMPLETE.** Sitting 4 closed 2026-08-12: 4.1, 4.1b, 4.3, 4.4, 4.4b, 4.5, with
4.2 dissolved by 2.1.

**Applied to the schema of record this sitting:**
- `fit_check.evidence` + the new `fit_report` table (4.1); `fit_quality` made nullable.
- `claimed_by` / `made_by` / `citation_url` + `citation_note` — the `source` split (4.3).
- `fit_check.disputed_note text null`, and the verdict demoted to derived (4.4).
- `refill_dimension.claimed_by`, plus guard 3 on Rule 3 (4.4b).
- No columns from 4.5 — it produced the two-corpora split, the seed order, the fourth display
  state and demotion #11, all of them structure rather than schema.

**Counts to keep honest:** 17 entities · 11 demotions · 7 axis-mixes caught · 4 display states ·
5 backbone grains · 3 rules · 3 guards on Rule 3.

**The three softs are STILL unratified** — that is why the next session opens with them, and why
S1 is to be asked bare. It has now been dodged twice, both times by answering an adjacent
vocabulary question instead.

**Artifacts in `.notes/`:**

| File | What it is |
|---|---|
| `data-model-answers.md` | Source of truth. Old vocabulary + translation table. |
| `data-model-erd.md` | Annotated ERD, decision numbers, maintenance rules 1-6, the two-corpora section, the DERIVED list. |
| `data-model-erd-clean.eraser` | Schema of record, pastable. |
| `vocabulary-lexicon.md` | §0 naming law · §2 label map · §2.7 rebrand gap · §5 inheritance. |
| `data-model-erd-public.eraser` | All entities, buyer labels. |
| `data-model-erd-public-catalog.eraser` | The browse view. |
| `data-model-erd-public-compatibility.eraser` | The buyer's actual question. |
| `data-model-erd-public-collection.eraser` | Brownie's layer. |
| `sitting-4-prompt.md` | The previous session's prompt, same pattern as this one. |
