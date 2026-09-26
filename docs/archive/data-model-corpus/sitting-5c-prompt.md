# Sitting 5, part 3 — prompt for a fresh session

**Written 2026-08-14**, at the close of the session that answered **5.2 + the refill grain**.
Supersedes `.notes/sitting-5b-prompt.md`, whose only open agenda item at the top (5.2) is now
closed. Same pattern: paste the fenced block below into a new session.

The **next question is already framed and recommended** inside the block — 5.3b's structural half,
*does `collection_item.installed_refill_id` name the model or the exact one you loaded?* BVG can
answer it with a letter on the first turn.

---

## Paste this into a fresh session

```
Resume the machinedpens / Pocket Trash pen-refill data-model interview. Sittings 0-4 are complete,
the RATIFICATION SWEEP is complete, all four CARRIED STRUCTURAL ITEMS are answered, and Sitting 5
has answered 5.3a and 5.2. Do not re-open any of that. This session finishes SITTING 5.

CONTEXT — read in this order:
- `.notes/data-model-answers.md` — SOURCE OF TRUTH. Opens with a "▶ RESUME HERE" block; read it
  first, it overrides everything else. Note its ⚠️ VOCABULARY CHANGED table: five entities were
  renamed on 2026-08-12 and this file was DELIBERATELY not rewritten, so its numbered decisions
  still say "socket", "compat_edge", etc. Translate as you read; do NOT "fix" them.
- `.notes/data-model-erd.md` — the annotated ERD. `//` comments carry decision numbers;
  maintenance rules 1-7 govern edits (rule 6 is the naming law, rule 7 is vocabulary storage).
  Read the "two corpora" section, the DERIVED list, and the two defect-class sections before you
  consider adding anything.
- `.notes/data-model-erd-clean.eraser` — the pastable schema of record. Keep it in sync.
- `.notes/vocabulary-lexicon.md` — §0 NAMING LAW (binding). §2 internal→buyer label map.
  §5 committed-schema inheritance. §2.7, §5.3 and §5.4 are CLOSED — read them for the reasoning,
  not for open questions.
- `.notes/eraser-integration-findings.md` — eraser.io mechanics + VERIFIED DSL grammar. Settled;
  don't re-research it.

HOW BVG RUNS THIS INTERVIEW — follow it exactly:
- One question at a time. He picks a letter or writes a third option.
- BEFORE each question, state what the accumulated evidence already implies, and give a
  RECOMMENDATION. Don't relay the files back at him.
- FLAG TENSIONS between his answers instead of silently recording contradictions. This keeps
  catching real problems, including two of his own leans being wrong, one place where Sitting 4's
  reasoning had to be deliberately NOT applied (4.4b), two of MY OWN claims that the repo
  disproved (2026-08-13), and a live defect in a column that had been sitting in the ERD for
  three sittings (2026-08-14, see 5.2 below).
- Research a claim when it would change an answer. It changed the answer twice on 2026-08-13
  (C1 and C2/C3), both times decisively. There is a RESEARCH BRIEF near the bottom of this prompt.
- ⚠️ HE ASKED FOR PLAIN LANGUAGE. When a question is about storage or mechanism rather than pens,
  explain it without jargon — "a fixed list in the app vs a shared list in the database" landed;
  "enum vs lookup table" did not. On 2026-08-14 "is one row the model, or the exact one you buy?"
  landed where "grain" would not have.
- Record every decision in `.notes/data-model-answers.md` as you go, including knock-ons, and
  update the ERD files IN THE SAME SITTING.

⚠️ THE NAMING LAW IS BINDING (vocabulary-lexicon.md §0, ERD rule 6).
Every new entity, column and enum value must pass: "could someone shopping for a pen say this
name out loud and mean roughly the right thing?" Apply it WHEN THE NAME IS CREATED, not later.
Banned: domain jargon (socket/edge/node/bridge/topology), compound schema nouns where a plain one
exists, brand-anchored words as identifiers. Exempt where the plain word is ALSO wrong
(advance_mechanism, medium, and the terms with no market word). Three traps: don't collapse a
distinction for a shorter name; don't let a plain name OVERCLAIM; when two things share a market
word, qualify both rather than inventing a second unsettled word. (Trap 3 fired again on
2026-08-14: `colour` became `colour_name` + `colour_family`.)

⚠️ BEFORE PROPOSING ANY COLUMN: check the DERIVED list. ELEVEN things have been demoted from
stored to derived. And check BOTH defect-class sections in the ERD — NINE axis-mixes, the last
four caught before construction, plus two one-off classes. Assume the next one is yours.

═══ WHAT THE LAST SESSION DECIDED — 2026-08-14, do not re-litigate ═══

5.2 + THE REFILL GRAIN, asked as ONE question because they were one question.

  THE DEFECT THAT FORCED IT — a NEW class, not axis-mixing. `tip_size decimal null` and
  `colour string null` were SINGLE-VALUED columns on a row every join treats as a MODEL. A Sarasa
  comes in 3 tip sizes x 20 colours; one decimal and one string cannot say that. Named as a third
  defect class: A COLUMN WHOSE CARDINALITY CONTRADICTS ITS ROW'S GRAIN. The tell is that both
  columns had to be nullable to be writable at all.

  ANSWERED (a):
  · `refill` IS THE MODEL. `tip_size` and `colour` came OFF it.
  · NEW ENTITY `refill_variant` — refill_id · tip_size · colour_name · colour_family.
    No slug, no name — product_variant has neither either.
  · 5.2's own fork answered BOTH WAYS, because it was two columns wearing one name:
      colour_name text null   — the FULL LONG TAIL, the maker's own word ("Vintage Vermillion"),
                                free text. Same call C2 made for product_variant.finish.
      colour_family enum null — black|blue|red|green|other, THE BROWSE FACET. Cannot be derived
                                (no code turns "Vintage Vermillion" into red), so it is curated.
                                Starts coarse and grows. NINTH axis-mix.

  WHAT DECIDED THE GRAIN — counting the joins. Six FKs point at `refill` and FIVE want the model:
  fit_check (TT publishes "Pilot G2", never "Pilot G2 0.7 blue") · refill_dimension (Unsharpen
  measured THE FISHER PR) · rebrand (Retro 51 REF5P ≡ Schmidt P8126 is model-to-model) ·
  toleranced_for (±25 µm against a body OD) · ships_with. Only collection_item.installed_refill_id
  leans SKU-ward — WHICH IS THE FIRST QUESTION OF THIS SESSION.

  🔑 AND 4.5'S SPLIT ALREADY DREW THIS LINE ONE LEVEL UP. The CATALOG corpus is SKU-shaped
  (BigIDesign's ~800-row sheet is brand + model + tip size + colour per row); the FIT corpus is
  model-shaped. SKU-grained refills would have multiplied every hand-curated fit check,
  measurement and rebrand by ~60 for ZERO added truth, because colour never affects fit.

  WHY A VARIANT TABLE: it is the refill-side TWIN of product_variant, for the identical reason
  3.7 (d') gave — surface differences that change nothing about fit must never duplicate the
  assertion corpus. Now a named pattern at two instances ("identity vs purchase option", in the
  ERD next to the backbone table). Both children are pure CATALOG leaves. ⚠️ IF A FUTURE COLUMN ON
  EITHER CHILD EVER NEEDS TO BE READ BY A FIT QUERY, THE SPLIT WAS DRAWN IN THE WRONG PLACE.

  ESCAPE HATCH (decision 1.3's precedent): if a tip size ever turns out to change the physical
  part — a needle tip seating differently in Autmog's 2.5 mm aperture is the plausible case — that
  size becomes ITS OWN `refill` row, kept apart until proven identical. The fit corpus never has
  to learn about variants.

  KNOCK-ONS ALREADY RECORDED (don't re-ask, but he may overrule):
  · ✅ CLOSES C1's `OPEN 5.2` on `rebrand` — a rebrand is MODEL → MODEL, which is what Schmidt
    actually sells Retro 51. The grain is no longer fuzzy.
  · `tip_option.ships_with_refill_id` STAYS at the model ("ships with a G2").
  · 5.1 IS CONFIRMED AND COMPLETE — `medium` stays on `refill` (an EnerGel is gel in every
    colour); tip_size and colour moved, so the browse facets read the variant table. All five of
    5.1's facets survive, at two grains.
  · GRAPHITE NEEDS NO `hardness` COLUMN, and this was checked rather than assumed: a
    medium=graphite refill row IS the pencil MECHANISM (Schmidt DSM 2006 — the seated cartridge,
    per Sitting 3's boundary), and tip_size is the LEAD DIAMETER IT ACCEPTS (0.5/0.7/0.9). The
    lead is a consumable one level BELOW the mechanism and is not in this model at all. So a
    graphite refill's variants differ by lead Ø alone, and colour_family is null there.
  · NO item/part code column (LR7-A, BLS-VB5RT-BB) — ERD rule 2, not invented.
    (refill_id, tip_size, colour_name) already keys it. Flagged, not built.

═══ THE AGENDA — what is left of Sitting 5 ═══

Agenda in `.notes/data-model-questions.md` §"Sitting 5", but it is STALE in two ways: its owner
index still assigns 5.3/5.4/5.5 to Brownie (field-log is dropped — they are BVG's), and 5.1/5.2
are done. CHECK WHAT IS ALREADY ANSWERED BEFORE ASKING.

▶ 5.3b — ASK THIS FIRST. It is fully framed; he can answer with a letter.
  TWO HALVES, and the STRUCTURAL one goes first:

  (i) DOES `collection_item.installed_refill_id` NAME THE MODEL, OR THE EXACT ONE YOU LOADED?

      What the evidence says. Symmetry argues for the exact one: `collection_item.variant_id`
      already points at `product_variant`, not `product` — what you own is a specific object. But
      the asymmetry is PRINCIPLED, not sloppy. A pen has ~5 finishes, you own exactly one, and it
      never changes — the finish is WHY you saved the row. A refill model has ~60 variants, the
      one in the pen changes monthly, and it is a status field.
      Two harder facts push the same way:
        · COLD START. refill_variant is catalog corpus — scraper stages, a human promotes — so at
          launch it is thin. If a user must pick "EnerGel LR7 0.5 blue" and only 0.7 black has
          been promoted, they cannot record the truth. The model always works.
          ⚠️ THIS CLAIM IS THE ONE WORTH RESEARCHING — see R-A in the brief below.
        · fit_report WANTS THE MODEL ANYWAY. 4.1 shaped it as refill_id + tip_option_id, so a
          variant-grained saved config needs a downgrade join to generate the report it exists
          to feed.
      RECOMMENDATION: (a). It matches "more limited", and the upgrade is genuinely cheap IN THIS
      ONE CASE — adding a nullable installed_variant_id later is additive, needs no backfill, and
      lands on the coarse-plus-precise pattern this schema already runs four times (bore_class +
      bore_mm; axial_adjust + accepts_length_*; colour_family + colour_name; observance + the
      measurements). Same "one boolean away" reasoning 5.3a used for the wishlist flag.
        (a) THE MODEL. "An EnerGel LR7." Always recordable; feeds fit_report directly. You cannot
            say which colour is loaded.
        (b) THE EXACT ONE (refill_variant). Symmetrical with the finish, enables a re-order link.
            Blocked whenever the variant has not been promoted; every report needs a downgrade
            join.
        (c) BOTH — required model + nullable exact one. Records everything, but stores one fact in
            two FKs that can disagree.

  (ii) THEN THE RESIDUE: does a saved pen need anything beyond owner + finish + pen tip + loaded
       refill? A nickname? A note? Keep it "more limited" per BVG. Do NOT reintroduce the
       inventory columns 5.3 originally posed (drop number · serial · acquisition date · price
       paid · current value · condition · photos) — that shape was the app being dropped, and
       5.3a explicitly stepped away from it.

  5.4 multiples — separate rows vs a quantity field. OPEN. 5.3a makes each row a specific
      configuration, which already argues for separate rows; and under (a)/(b) above the loaded
      refill differs per copy, which argues for it again. Confirm, don't re-derive.

  5.5 `installed_refill` as a field vs a carry LOG from day one. NEARLY PRE-ANSWERED: "log from
      day one" was FIELD-LOG'S OWN PREMISE (a carry logger over generic log_entries), and
      field-log is dropped. Confirm rather than assume.

  5.6 sequencing — the one question the site answers on day one. ⚠️ PARTLY PRE-ANSWERED: 4.5's
      two-corpora split and 4.1b's "accuracy not widespread adoption" already constrain this, and
      the web-only direction constrains it further. Ask the residue.

  5.7 launch catalog scope — pens only vs pens + refills browsable. ⚠️ 4.5 leans this: refills are
      catalog entities and the prior display needs them. NEW INPUT: refill_variant now exists, so
      "browsable refills" has a concrete cost — see R-A.

  5.8 credible launch size — how many makers. ~25 researched; 8 have published compat data
      (Autmog, Fellhoelter, NTI, Tactile Turn, Karas, BigIDesign, Grimsmo, Spoke). This one is
      genuinely a RESEARCH question — see R-B.

═══ RESEARCH BRIEF — do these BEFORE the question each one blocks ═══

R-A ⚠️ BLOCKS 5.3b(i) AND INFORMS 5.7. CAN `refill_variant` ACTUALLY BE POPULATED AT LAUNCH?
    The recommendation for 5.3b(i)(a) rests on "the variant table will be thin at launch." TEST IT
    rather than assume it. Take three models already in the corpus — Pentel EnerGel LR7, Pilot
    Juice Up BLS-VB5RT, Uni-ball Signo UMR-85 — and see whether a COMPLETE tip-size x colour
    matrix is obtainable from the maker's own site or a retailer.
      · If all three are trivially enumerable, the cold-start argument WEAKENS and (b) or (c)
        gets stronger. Say so; do not defend the recommendation.
      · If they are partial or inconsistent, (a) is confirmed and 5.7 inherits the finding.
    Note the maker sites are Japanese (pentel.co.jp, pilot.co.jp, zebra.co.jp) and often carry the
    full lineup as a spec table where retailers carry only stocked SKUs. Plain WebSearch/WebFetch
    is worth trying on the maker sites FIRST; JetPens needs Chrome.

R-B ⚠️ BLOCKS 5.8. WHICH OF THE ~25 RESEARCHED MAKERS PUBLISH A REFILL/COMPAT LIST?
    Eight are known (above). The launch-size answer is "how many makers can we do WELL", and under
    4.5 a maker with no published list still enters the catalog — it just renders the PRIOR
    (refill_style + observance), the fourth display state. So the real question is how many can be
    seeded with fit checks, not how many exist. Check the remaining ~17 in
    `.notes/data-model-research-findings.md` §A for a published list, and note any maker in the
    machined-pen space that the corpus never covered.

R-C 5.7 ONLY, cheap. Does a browsable REFILL catalog need anything the schema now lacks? The
    entities exist (refill · refill_variant · refill_style · also_known_as · rebrand). Confirm no
    new column is implied before answering — ERD rule 2.

R-D ⚠️ UNVERIFIED CLAIM MADE ON 2026-08-14, flagged in lexicon §2.3. The STARTING VALUE LIST for
    `colour_family` (black|blue|red|green|other) was reasoned, not sourced, and the note that
    JetPens carries `blue_black` as its own facet value is UNVERIFIED — JetPens 403s WebFetch and
    needs Chrome. Blocks nothing (ALTER TYPE ADD VALUE is cheap) but confirm before implementing.

R-E STANDING FACTUAL UNKNOWNS. Some are researchable, some need BVG's hands — do not conflate:
      RESEARCHABLE (Chrome, mostly maker product pages):
        · Autmog's published 2.5 mm — tip aperture or body bore? A RULE-3 DEPENDENCY: the geometry
          negative cannot fire on Autmog until this is settled.
        · The Charpie cartridge — retailers say the Mark 22 ships with 3D-printed tools to gut a
          Sharpie; Fellhoelter's own page says only "tools for assembly and disassembly". Confirm
          before relying on refill.form = harvested.
        · BigIDesign's pencil mechanism — copy says "0.5, 0.7 and 0.9 mm mechanical pencil
          SYSTEMS" (Schmidt's own word) but never names Schmidt.
        · Whether Autmog's 36 Clipless is a different body or the same body without a clip.
      BVG'S HANDS, ask don't guess:
        · MEASUREMENT ROUND 1 IS A LAUNCH DEPENDENCY (promoted by 4.5). Juice Up BLS-VB5RT +
          Precise V5 RT, then EnerGel/Signo/Sarasa. tip_option.refill_style_id is required, so no
          pen enters the catalog until its style exists — and the RB-space styles are still
          deliberately unnamed pending these numbers. It also firms rear_topology, a DRAFT.
        · Whether the Modern Fuel aBAP needs a tip swap for a Parker. 98 mm sits inside its
          published 89-116 window, so if the swap IS needed it is the clean real-world case for
          negatives-only that the withdrawn EnerGel example failed to be.

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
  public-collection. RUN `python3 .notes/validate-eraser.py` BEFORE FINISHING — it checks that
  every relationship endpoint resolves to a declared entity and an existing column, and prints the
  counts. Exit 0 = clean. It does NOT check that the five files agree with each other; that is
  still a read. Current state (2026-08-14, all green):
      clean 20 blocks (19 entities + 1 shell) / 34 · public 20 (19+1) / 34 ·
      catalog 9 / 11 · compatibility 13 / 20 · collection 8 (7+1) / 7 ·
      the fenced block in data-model-erd.md 19 / 34 (it carries no open_* shell).
- AGENTS.md requires `pnpm format` after documentation-only changes. Nothing else — no test, lint
  or typecheck run is needed while this work stays inside `.notes/`.

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
- `.notes/` is git-excluded (`.git/info/exclude`). Nothing in it ships.

REPO FACTS THAT KEEP MATTERING:
- DIRECTION: field-log is DROPPED (already gone from `apps/` on origin/main; apps/ = api · mobile
  · scraper · web). Web-only, no app integration, users save their own configs but "more limited".
  apps/mobile still exists, so this is a direction, not a deletion.
- THE PROJECT IS RENAMED POCKET TRASH (PR #78). `package.json` = `pocket-trash.app`. The GitHub
  repo is still `Field-Log/field-log` and the working directory is still `machinedpens.info` —
  three names live at once. Don't be confused by it.
- ⚠️ As of PR #63 every domain vocabulary is `as const` → `pgEnum` AT THE COLUMN
  (`user-settings.ts:10-13`, `feature-flags.ts:14-18`). Growing one costs a TS edit AND a
  generated migration. Nothing decided flips; the advice STRENGTHENS — ALTER TYPE ADD VALUE is
  cheap, removing a value is not, so "start coarse and grow" is better counsel than before.
  (An older note saying enums.ts avoids pgEnum is OUT OF DATE; the correction is recorded under
  Sitting 2's repo constraints.)
- `users` = id + clerk_id (Clerk-backed, PR #63); `user_settings` = one row per user, user_id PK,
  ON DELETE cascade. Both are INHERITED into the ERD, not designed.
- HOUSEKEEPING, UNRESOLVED — ask, don't act: the local branch `ra/eng-22-sync-user-settings-to-db`
  was 23 commits behind origin/main and its own ticket had already merged as #63.

Start by confirming the read, summarising where things stand in a few lines, then run R-A and
report what it actually found — INCLUDING if it undercuts the recommendation — and then ask
5.3b(i). Do not dump the files back at me.
```

---

## State at the end of this session (for whoever picks this up)

**Sittings 0–4 COMPLETE. Ratification sweep COMPLETE. Carried items C1–C4b COMPLETE.
Sitting 5: 5.3a and 5.2 COMPLETE.** Session of 2026-08-14.

**Applied to the schema of record this session:**

- `refill_variant` — new entity, the 19th (5.2). `refill_id` · `tip_size` · `colour_name` ·
  `colour_family`. No slug, no name.
- `refill` lost `tip_size` and `colour`; it is now explicitly **the model**.
- `colour` split into `colour_name` (free text, long tail) + `colour_family` (coarse enum, the
  facet) — the **ninth** axis-mix.
- C1's `OPEN 5.2` on `rebrand` **closed** — a rebrand is model → model.
- A new **OPEN 5.3b** raised on `collection_item.installed_refill_id` (model or variant).
- ERD gained a second named pattern, **identity vs purchase option**, at two instances
  (`product`/`product_variant`, `refill`/`refill_variant`).
- ERD's defect-class sections restructured: nine axis-mixes, plus **two** one-off classes
  (3.2b's derived-field-with-demoted-input, and 5.2's cardinality-vs-grain).
- New tool: **`.notes/validate-eraser.py`** — checks every relationship endpoint in all six ERD
  sources against declared entities and existing columns. All green.

**Counts to keep honest:** 19 entities · 34 edges · 11 demotions · **9** axis-mixes caught ·
2 further defect classes · 4 display states · 5 backbone grains · **2** identity/purchase-option
grains · 3 rules · 3 guards on Rule 3 · 7 questions dissolved into other questions.

**One unverified claim was made and is flagged**, not buried: the starting value list for
`colour_family`, and the note that JetPens carries `blue_black` as its own facet value. Flagged in
lexicon §2.3 and carried as **R-D** in the research brief. It blocks nothing.

**Artifacts in `.notes/`:**

| File | What it is |
|---|---|
| `data-model-answers.md` | Source of truth. Old vocabulary + translation table. |
| `data-model-erd.md` | Annotated ERD, decision numbers, maintenance rules 1–7, the two-corpora section, the DERIVED list, both defect-class sections. |
| `data-model-erd-clean.eraser` | Schema of record, pastable. |
| `vocabulary-lexicon.md` | §0 naming law · §2 label map · §2.7/§5.3/§5.4 CLOSED · §5 inheritance. |
| `data-model-erd-public.eraser` | All entities, buyer labels. |
| `data-model-erd-public-catalog.eraser` | The browse view. Gained `refill_option`. |
| `data-model-erd-public-compatibility.eraser` | The buyer's actual question. **Unchanged in shape by 5.2 — which is the evidence the grain call was right.** |
| `data-model-erd-public-collection.eraser` | The saved-configs layer. Carries the OPEN 5.3b note. |
| `validate-eraser.py` | Endpoint validator. `python3 .notes/validate-eraser.py`, exit 0 = clean. |
| `sitting-4-prompt.md` | Three sessions back. |
| `sitting-5-prompt.md` | Superseded. |
| `sitting-5b-prompt.md` | **Superseded by this file** — its 5.1/5.2 agenda is done. |
