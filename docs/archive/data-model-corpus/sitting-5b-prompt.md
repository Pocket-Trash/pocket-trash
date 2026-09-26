# Sitting 5, continued — prompt for a fresh session

**Written 2026-08-13**, at the close of the sweep + carried-items session. Supersedes
`.notes/sitting-5-prompt.md`, whose Parts 1 and 2 are now complete. Same pattern: paste the fenced
block below into a new session.

---

## Paste this into a fresh session

```
Resume the machinedpens / Pocket Trash pen-refill data-model interview. Sittings 0-4 are complete,
the RATIFICATION SWEEP is complete, and all four CARRIED STRUCTURAL ITEMS are answered. This
session finishes SITTING 5. Do not re-open any of that.

CONTEXT — read in this order:
- `.notes/data-model-answers.md` — SOURCE OF TRUTH. Opens with a "▶ RESUME HERE" block; read it
  first, it overrides everything else. Note its ⚠️ VOCABULARY CHANGED table: five entities were
  renamed on 2026-08-12 and this file was DELIBERATELY not rewritten, so its numbered decisions
  still say "socket", "compat_edge", etc. Translate as you read; do NOT "fix" them.
- `.notes/data-model-erd.md` — the annotated ERD. `//` comments carry decision numbers;
  maintenance rules 1-7 govern edits (rule 6 is the naming law, rule 7 is vocabulary storage).
  Read the "two corpora" section and the DERIVED list before you consider adding anything.
- `.notes/data-model-erd-clean.eraser` — the pastable schema of record. Keep it in sync.
- `.notes/vocabulary-lexicon.md` — §0 NAMING LAW (binding). §2 internal→buyer label map.
  §5 committed-schema inheritance. §2.7, §5.3 and §5.4 are now CLOSED — read them for the
  reasoning, not for open questions.
- `.notes/eraser-integration-findings.md` — eraser.io mechanics + VERIFIED DSL grammar. Settled;
  don't re-research it.

HOW BVG RUNS THIS INTERVIEW — follow it exactly:
- One question at a time. He picks a letter or writes a third option.
- BEFORE each question, state what the accumulated evidence already implies, and give a
  RECOMMENDATION. Don't relay the files back at him.
- FLAG TENSIONS between his answers instead of silently recording contradictions. This keeps
  catching real problems, including two of his own leans being wrong, one place where Sitting 4's
  reasoning had to be deliberately NOT applied (4.4b), and — on 2026-08-13 — two of MY OWN claims
  that the repo disproved.
- Research a claim when it would change an answer. It changed the answer twice on 2026-08-13
  (C1 and C2/C3), both times decisively.
- ⚠️ HE ASKED FOR PLAIN LANGUAGE MID-SESSION. When a question is about storage or mechanism
  rather than pens, explain it without jargon — "a fixed list in the app vs a shared list in the
  database" landed; "enum vs lookup table" did not.
- Record every decision in `.notes/data-model-answers.md` as you go, including knock-ons, and
  update the ERD files IN THE SAME SITTING.

⚠️ THE NAMING LAW IS BINDING (vocabulary-lexicon.md §0, ERD rule 6).
Every new entity, column and enum value must pass: "could someone shopping for a pen say this
name out loud and mean roughly the right thing?" Apply it WHEN THE NAME IS CREATED, not later.
Banned: domain jargon (socket/edge/node/bridge/topology), compound schema nouns where a plain one
exists, brand-anchored words as identifiers. Exempt where the plain word is ALSO wrong
(advance_mechanism, medium, and the terms with no market word). Three traps: don't collapse a
distinction for a shorter name; don't let a plain name OVERCLAIM; when two things share a market
word, qualify both rather than inventing a second unsettled word.

⚠️ BEFORE PROPOSING ANY COLUMN: check the DERIVED list. ELEVEN things have been demoted from
stored to derived, and EIGHT defects were "one enum mixing two orthogonal axes." The last three
of each were caught before being built. Assume the next one is too.

═══ WHAT CHANGED ON 2026-08-13 — read this before anything else ═══

1. ⚠️ DIRECTION CHANGE. BVG: "we are actually dropping field-log and going a different direction
   to build a database only for the web right now and not integrate with the app, we will allow
   users to save their own configs but it will be more limited."
   - `apps/field-log` is ALREADY GONE from origin/main. `apps/` = api · mobile · scraper · web.
   - The project was renamed POCKET TRASH (PR #78). `package.json` = `pocket-trash.app`. The
     GitHub repo is still `Field-Log/field-log` and the working directory is still
     `machinedpens.info` — three names are live at once. Don't be confused by it.
   - `apps/mobile` still exists, so "no app integration" is a direction, not a deletion.
   - CONSEQUENCE: the collection layer is BVG's, not Brownie's. The owner index in
     `data-model-questions.md` is STALE — ignore it for 5.3/5.4/5.5.

2. ⚠️ A REPO FACT THIS PROJECT LEANED ON FOUR TIMES IS OUT OF DATE. Sitting 2 recorded
   "enums.ts is `as const`, NOT pgEnum, so growing a vocabulary is a TS edit, not a migration."
   As of PR #63 every domain vocabulary is `as const` → `pgEnum` at the column
   (`user-settings.ts:10-13`, `feature-flags.ts:14-18`). Growing one now costs a TS edit AND a
   generated migration. Nothing decided flips; the advice STRENGTHENS (ALTER TYPE ADD VALUE is
   cheap, removing a value is not, so "start coarse and grow" is better counsel than before).
   The correction is recorded in the answers file under Sitting 2's repo constraints.

3. The local branch `ra/eng-22-sync-user-settings-to-db` was 23 commits behind origin/main and its
   own ticket had already merged as #63. UNRESOLVED HOUSEKEEPING — ask, don't act.

═══ WHAT THE LAST SESSION DECIDED — do not re-litigate; knock-ons only ═══

RATIFICATION SWEEP — all three confirmed as applied, no schema changed. ZERO soft decisions remain
in the model.
  S1 the `slot_option` → `part` merge. Purchase-option vs fit-required is WHICH JOIN points at the
     row, not a column. (Asked bare on the third attempt; that is what finally got an answer.)
  S2 3.2b's tip-option override — three nullable columns on `tip_option`.
  S3 4.3's `source` split — `claimed_by` / `made_by` / `citation_url`+`citation_note`.

CARRIED STRUCTURAL ITEMS:
  C1  REBRANDED REFILLS → a new `rebrand` table (`refill_id` → `oem_refill_id`, plus `claimed_by`
      + citation). Research pass 8: rebranding is an INDUSTRY STRUCTURE (Schmidt supplies Retro
      51, Baron Fig and Diplomat; Premec advertises white-label manufacture), and the mapping is
      CONTESTED in the wild (REF5P = P8127 per one source, P8126 per two). So it is a CLAIM, not a
      transcription. The verdict rule gains STEP −1: expand the fit_check set to R ∪ R's rebrand
      partners, ONE HOP, and propagated rows render LABELLED ("via Schmidt P8126"), never silently.
      ⚠️ It means SAME PART OFF THE SAME LINE, never same style — Monteverde's "compatible with
      Parker, Cross, Montblanc" refills are style-mates and belong to `refill_style`. Eighth
      axis-mix, caught before construction.
  C2  VOCABULARY STORAGE → a table when members arrive at RUNTIME or carry data; a TS `as const`
      when the set is closed at compile time and a member is nothing but its own name. §5.4's
      premise was FALSE: `materials`/`mechanisms`/`product_types` live in `scraper.ts` and every
      consumer is a `tmp_*` table. One change: `product_variant.material` → `material_id` FK to
      the committed `materials` table (it was free text — neither a fixed list nor a shared one).
      `finish` stays free text, FLAGGED.
  C3  THE TWO COMMITTED-SCHEMA COLLISIONS → both were MISREADINGS, one of them mine. Neither
      table is corrected and neither is used. `mechanisms.name = "click"` is a QUOTE from Autmog's
      page (interned from scraped text, `drizzle/0008_silly_carnage.sql:44`); `product_types` is
      Autmog's Shopify taxonomy (`apps/scraper/src/autmog/normalize.ts:181`), not 3.1's demoted
      category. Real finding: promoting "click" is a SPLIT (→ ratchet + top_button) and it is
      UNDERDETERMINED — a side-click pen also says "click" — so a human must do it. Confirms 4.5.
  C4a `claimed_by` gains a FIFTH value: `maker | retailer | community | owner | staff`. On
      `refill_dimension` it is the ONLY trust signal (4.4b kept `evidence` off that table), so
      merging "measured it" with "retyped it" would destroy it. Fisher PR: Unsharpen 90×4.8
      (community, calipers) vs Penstore 89×5.8 (retailer, spec sheet).
  C4b `ships_with_refill_id` MOVED from `product` to `tip_option`. F3′ a third time — the refill
      in the box belongs to the configuration you bought.

SITTING 5 SO FAR:
  5.3a A SAVED CONFIG IS A PEN YOU OWN — a finish + a pen tip + what is loaded. NOT a wishlist
      (reports would arrive from people who never held the pen, the exact false positive 4.1/4.1b
      guard against); an owned/wanted flag is one defaulted boolean away if ever wanted. NOT an
      inventory — no price, serial, condition or photos; that was the app being dropped.
      🔑 It is the `fit_report` ENTRY POINT: 4.1 requires a report to name a `tip_option`, and a
      saved config already does. "Pick your setup, tell us if it fits."
      `collection_item` gained `user_id`; `user` is a declared entity, INHERITED from the
      committed `users` table (`id` + `clerk_id`, Clerk-backed, PR #63).

═══ THE AGENDA — what is left of Sitting 5 ═══

Agenda in `.notes/data-model-questions.md` §"Sitting 5". CHECK WHAT IS ALREADY ANSWERED BEFORE
ASKING — Sitting 4 and the 2026-08-13 session both ate parts of this list.

  5.1 refill facets — LARGELY SETTLED. Sitting 3 widened `ink_type` to `medium`
      (ballpoint|gel|hybrid|rollerball|pressurized|graphite|permanent marker|highlighter) and
      `tip_size` / `colour` exist. Confirm the residue, don't re-ask the whole thing.
  5.2 colour depth — full long tail vs black/blue/red/other. GENUINELY OPEN
      (`refill.colour string null // OPEN 5.2`).
      ⚠️ ASK THE GRAIN QUESTION WITH IT: `tip_size` and `colour` are BOTH nullable, so a `refill`
      row is currently a MODEL, not a SKU. C1's `rebrand` link inherits that fuzz — if Retro 51
      relabels only one size or colour of an OEM model, the link is coarser than reality. These
      two questions are the same question.
  5.3b collection columns — the SHAPE is answered (5.3a). Residue only: does a saved pen need
      anything beyond owner + finish + pen tip + loaded refill? A nickname? A note? Keep it
      "more limited" per BVG. Do NOT reintroduce the inventory columns.
  5.4 multiples — separate rows vs a quantity field. OPEN. Note 5.3a makes each row a specific
      configuration, which already argues for separate rows.
  5.5 `installed_refill` as a field vs a carry LOG from day one. NEARLY PRE-ANSWERED: "log from
      day one" was FIELD-LOG'S OWN PREMISE (a carry logger over generic `log_entries`), and
      field-log is dropped. Confirm rather than assume.
  5.6 sequencing — the one question the site answers on day one. ⚠️ PARTLY PRE-ANSWERED: 4.5's
      two-corpora split and 4.1b's "accuracy not widespread adoption" already constrain this, and
      the web-only direction constrains it further. Ask the residue.
  5.7 launch catalog scope — pens only vs pens + refills browsable. ⚠️ 4.5 leans this: refills are
      catalog entities and the prior display needs them.
  5.8 credible launch size — how many makers. ~25 researched; 8 have published compat data
      (Autmog, Fellhoelter, NTI, Tactile Turn, Karas, BigIDesign, Grimsmo, Spoke).

THE THREE RULES THE SCHEMA MUST NOT VIOLATE:
1. A need modifies the refill or adds a part. Nothing modifies the pen.
2. An axis exists only for a fact no measurement can express. (Only `rear_topology` passed.)
3. Geometry may produce a negative, never a positive — with THREE guards: both numbers carry a
   `feature` tag · the Autmog 2.5 mm dependency · the feature must be unconflicted or the row must
   be `claimed_by = staff`.

CONSTRAINTS:
- Do NOT rewrite the old vocabulary inside `.notes/data-model-answers.md`. The translation table
  in its RESUME block is the mechanism; the audit trail is worth more than the consistency.
- Keep `fk`, `null` and the `//` comments in the ERD — all verified legal against the renderer.
- Open forks stay as `// OPEN n.n` comments; never invent a field to close one.
- Five `.eraser` files must stay in sync: clean + public + public-catalog + public-compatibility +
  public-collection. VALIDATE before finishing that every relationship endpoint resolves to a
  declared entity and an existing column. Current state: clean 19/33 · public 19/33 · catalog
  8/10 · compatibility 13/20 · collection 8/7 · the fenced block in `data-model-erd.md` 18/33
  (it carries no `open_*` shell, which is the one-entity difference).
- AGENTS.md requires `pnpm format` after documentation-only changes.

ACCESS NOTES (learned the hard way — don't rediscover):
- JetPens, unsharpen.com, Reddit and Fountain Pen Network ALL 403 or fail WebFetch. Use the
  Chrome extension. `old.reddit.com` is blocked; plain web search returns retail spam for every
  community query. Plain WebSearch DOES work for supply-chain/industry questions — that is how
  C1's Schmidt/Premec evidence was found.
- Eraser ERD entities have NO `[label:]` property (icon/color/colorMode/styleMode/typeface only).
  A friendly view must be a separate file. `title` with `(`, `)`, `;`, `?` is UNTESTED — keep
  titles to words and em-dashes.
- The `ERASER DOC URL: ____` slot at the top of every `.eraser` file is STILL BLANK. Nothing has
  ever pushed to eraser.io; every render so far is a manual paste.

BLOCKED ON BVG'S HANDS, not his opinion — ask, don't guess:
- ⚠️ MEASUREMENT ROUND 1 IS A LAUNCH DEPENDENCY (promoted by 4.5). Juice Up BLS-VB5RT + Precise
  V5 RT, then EnerGel/Signo/Sarasa. `tip_option.refill_style_id` is required, so no pen enters the
  catalog until its style exists — and the RB-space styles are still deliberately unnamed pending
  these numbers. It also firms `rear_topology`, whose values are a DRAFT.
- Still UNCONFIRMED: Autmog's published 2.5 mm (a Rule-3 dependency) · whether the Modern Fuel
  aBAP needs a tip swap for Parker · the Charpie cartridge · BigIDesign's pencil mechanism ·
  whether Autmog's 36 Clipless is a different body.

Start by confirming the read, summarising where things stand in a few lines, then ask 5.2
together with the refill-grain question — they are the same question and should not be split.
Do not dump the files back at me.
```

---

## State at the end of the previous session (for whoever picks this up)

**Sittings 0–4 COMPLETE. Ratification sweep COMPLETE. Carried items C1–C4b COMPLETE.**
Session of 2026-08-13.

**Applied to the schema of record this session:**
- `rebrand` — new entity, the 17th (C1). Verdict rule gained **step −1**.
- `material` — new entity, inherited from the committed `materials` table (C2);
  `product_variant.material` → `material_id`.
- `claimed_by` gained `retailer`, on all three tables that carry it (C4a).
- `ships_with_refill_id` moved `product` → `tip_option` (C4b).
- `user` — new entity, inherited from the committed `users` table; `collection_item.user_id` (5.3a).
- The `open_ratification_sweep` shell was removed from the pastables.
- ERD maintenance **rule 7** added (vocabulary storage).

**Counts to keep honest:** 19 entities · 33 edges · 11 demotions · **8** axis-mixes caught ·
4 display states · 5 backbone grains · 3 rules · 3 guards on Rule 3 · **7 questions dissolved into
other questions** (C3 was the seventh).

**Two of my own claims were disproved by the repo this session**, both recorded as corrections:
that `enums.ts` avoids `pgEnum` (it no longer does), and that "no user model" blocked the
collection layer (`users`/`user_settings` are committed and Clerk auth is merged).

**Artifacts in `.notes/`:**

| File | What it is |
|---|---|
| `data-model-answers.md` | Source of truth. Old vocabulary + translation table. |
| `data-model-erd.md` | Annotated ERD, decision numbers, maintenance rules 1–7, the two-corpora section, the DERIVED list. |
| `data-model-erd-clean.eraser` | Schema of record, pastable. |
| `vocabulary-lexicon.md` | §0 naming law · §2 label map · §2.7/§5.3/§5.4 now CLOSED · §5 inheritance. |
| `data-model-erd-public.eraser` | All entities, buyer labels. |
| `data-model-erd-public-catalog.eraser` | The browse view. |
| `data-model-erd-public-compatibility.eraser` | The buyer's actual question. |
| `data-model-erd-public-collection.eraser` | The saved-configs layer. |
| `sitting-4-prompt.md` | Two sessions back. |
| `sitting-5-prompt.md` | **Superseded by this file** — its Parts 1 and 2 are done. |
