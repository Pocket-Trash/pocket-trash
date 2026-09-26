# Sitting 4 — prompt for a fresh session

**Written 2026-08-12**, at the close of the naming/readability thread. Same pattern as
`.notes/vocabulary-research-prompt.md`: paste the fenced block below into a new session.

---

## Paste this into a fresh session

```
Resume the machinedpens pen/refill data-model interview at SITTING 4 (provenance & curation).

CONTEXT — read in this order:
- `.notes/data-model-answers.md` — SOURCE OF TRUTH. Opens with a "▶ RESUME HERE" block; read it
  first, it overrides everything else. Note its ⚠️ VOCABULARY CHANGED table: five entities were
  renamed on 2026-08-12 and this file was DELIBERATELY not rewritten, so its numbered decisions
  still say "socket", "compat_edge", etc. Translate as you read; do NOT "fix" them.
- `.notes/vocabulary-lexicon.md` — §0 is the NAMING LAW (binding on this sitting). §2 is the
  internal→buyer label map. §2.7 is an open structural gap. §5 covers committed-schema inheritance.
- `.notes/data-model-erd.md` — the annotated ERD. Its `//` comments carry decision numbers, and
  its maintenance rules 1–6 govern edits. Rule 6 is the naming law.
- `.notes/data-model-erd-clean.eraser` — the pastable schema of record. Keep it in sync.
- `.notes/eraser-integration-findings.md` — eraser.io mechanics + VERIFIED DSL grammar. Settled;
  don't re-research it.

HOW BVG RUNS THIS INTERVIEW — follow it exactly:
- One question at a time. He picks a letter or writes a third option.
- BEFORE each question, state what the accumulated evidence already implies, and give a
  RECOMMENDATION. Don't relay the file back at him.
- FLAG TENSIONS between his answers instead of silently recording contradictions. This has
  already caught several real problems, including two of his own leans being wrong.
- Research a claim when it would change an answer.
- Record every decision in `.notes/data-model-answers.md` as you go, including knock-ons, and
  update the ERD files IN THE SAME SITTING.

⚠️ THE NAMING LAW IS NOW BINDING (vocabulary-lexicon.md §0, ERD rule 6).
Every new entity, column and enum value must pass: "could someone shopping for a pen say this
name out loud and mean roughly the right thing?" Apply it WHEN THE NAME IS CREATED — not in a
later cleanup pass. Banned: domain jargon (socket/edge/node/bridge/topology), compound schema
nouns where a plain one exists, brand-anchored words as identifiers. Exempt where the plain word
is ALSO wrong (advance_mechanism, medium, and the seven terms with no market word). Three traps:
don't collapse a distinction for a shorter name; don't let a plain name OVERCLAIM; when two
things share a market word, qualify both rather than inventing a second unsettled word.

SITTING 4 AGENDA — provenance & curation:
  4.1  `verified` semantics — what does the flag actually assert, and who clears it?
  4.2  DISSOLVED by 2.1. Skip.
  4.3  Who can assert a fit_check — maker / community / owner, and what each is worth.
  4.4  Conflict display — two sources disagree about the same refill × tip. What does a buyer see?
  4.5  Seeding — how the first corpus gets in, and what "curated" means at launch.

ALSO ON THE TABLE — do not let these slide again:
  a) TWO SOFT DECISIONS, applied to the ERD but NEVER explicitly ratified. Get a yes/no:
     - 3.2b's tip_option override (three nullable columns on tip_option)
     - the slot_option → part merge, Sitting 3 (c′). Asked twice, answered neither time.
  b) REBRANDED REFILLS — a structural gap found via FPN, see vocabulary-lexicon.md §2.7. The
     Retro 51 refill IS a rebranded Schmidt. Today that is two `refill` rows, same geometry, same
     refill_style_id, NO link — so every fit_check gets curated twice and can drift. Candidate
     shapes: a `refill_alias` table (mirrors also_known_as), a nullable `same_as_refill_id`
     self-reference, or a `refill_identity` grouping the way refill_style groups shapes.
     Interacts with `form = sku|harvested` and with 4.5.
  c) LOOKUP TABLES vs TS ENUMS. The committed schema makes open vocabularies into TABLES
     (`mechanisms`, `materials`, `product_types` — id/name/slug unique). Our ERD makes them
     `enum`, and 3.3 says growing `part.kind` is "a TS edit (enums.ts = as const)". These are
     incompatible answers to one question. Affects advance_mechanism, actuator, part.kind,
     product_variant.material, refill.medium.
  d) The two COMMITTED-SCHEMA COLLISIONS (vocabulary-lexicon.md §5.3) — what happens to them?
     `mechanisms.name = "click"` is the mixed-axis value 3.5 split apart; `product_types` stores
     what 3.1 demoted to derived. Correct them, or have v2 simply not use those tables?

CONSTRAINTS:
- Do NOT rewrite the old vocabulary inside `.notes/data-model-answers.md`. The translation table
  in its RESUME block is the mechanism; the audit trail is worth more than the consistency.
- Keep `fk`, `null` and the `//` comments in the ERD — all verified legal against the renderer.
- Open forks stay as `// OPEN n.n` comments; never invent a field to close one.
- Derived things are NOT columns. Seven demotions so far; check the derived table before adding.
- AGENTS.md requires `pnpm format` after documentation-only changes.

ACCESS NOTES (learned the hard way — don't rediscover):
- JetPens, unsharpen.com, Reddit and Fountain Pen Network ALL 403 or fail WebFetch. Use the
  Chrome extension. `old.reddit.com` is blocked; plain web search returns retail spam for every
  community query.
- Eraser ERD entities have NO `[label:]` property (icon/color/colorMode/styleMode/typeface only).
  A friendly view must be a separate file. `title` with `(`, `)`, `;`, `?` is UNTESTED — keep
  titles to words and em-dashes.

BLOCKED ON BVG'S HANDS, not his opinion — ask, don't guess:
- Measurement round 1: Juice Up BLS-VB5RT + Precise V5 RT, then EnerGel/Signo/Sarasa. Places the
  refill_style fracture line, unblocks naming the RB-space styles, and firms `rear_topology`,
  whose values are still marked a DRAFT in the ERD.
- Still UNCONFIRMED: Autmog's published 2.5 mm · whether the Modern Fuel aBAP needs a tip swap
  for Parker · the Charpie cartridge · BigIDesign's pencil mechanism · whether Autmog's 36
  Clipless is a different body.

Start by confirming the read, summarising where things stand in a few lines, then ask 4.1 with a
recommendation. Do not dump the files back at me.
```

---

## State at the end of the previous session (for whoever picks this up)

**Sittings 0–3 COMPLETE.** Sitting 3 closed 2026-08-12.

**Applied to the schema of record this session:**
- **House-style patch** — `id bigint pk` with FKs following, `created_at`/`updated_at timestamptz`
  on all 14 entities, `slug text unique` on canonical entities, `maker.root_url text unique`.
  Marked `// HOUSE`; rule 5 explains why they trace to no numbered decision.
- **Five renames** under the naming law — `socket`→`refill_style`, `socket_alias`→`also_known_as`,
  `compat_edge`→`fit_check`, `edge_required_part`→`part_needed`, `socket_bridge`→`style_adapter`.
- **The missing FK edge** `style_adapter.scope_tip_option_id > tip_option.id` — the two ERD files
  are now in sync.

**Rejected:** `tip_option` → `nose_option`. Asked twice, declined twice. `tip` stays; the
ambiguity with `refill.tip_size` is handled by copy discipline — never a bare "tip" in UI text.

**Artifacts now in `.notes/`:**

| File | What it is |
|---|---|
| `data-model-answers.md` | Source of truth. Old vocabulary + translation table. |
| `data-model-erd.md` | Annotated ERD, decision numbers, maintenance rules 1–6. |
| `data-model-erd-clean.eraser` | Schema of record, pastable. 16 entities / 26 edges. |
| `vocabulary-lexicon.md` | §0 naming law · §2 label map · §2.7 rebrand gap · §5 inheritance. |
| `data-model-erd-public.eraser` | All 16, buyer labels. |
| `data-model-erd-public-catalog.eraser` | 7 entities / 9 edges. |
| `data-model-erd-public-compatibility.eraser` | 11 / 15 — the buyer's actual question. |
| `data-model-erd-public-collection.eraser` | 7 / 6. |

All five `.eraser` files were structurally validated: every relationship endpoint resolves to a
declared entity and an existing column.

**Still blank:** the `ERASER DOC URL: ____` slot at the top of every `.eraser` file. Nothing in
this repo has ever pushed to eraser.io; every render so far has been a manual paste. Fill it once
the canonical diagram exists so later sittings update that diagram instead of minting a new one.
