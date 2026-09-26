# Pen/refill data model — ERD (eraser.io DSL)

**First cut 2026-08-11 · Sittings 0–4 complete 2026-08-12 · ratification sweep + carried
structural items 2026-08-13 · Sitting 5 in progress (5.3a, 5.2 + grain, 5.3b(i)) 2026-08-14.** Target format
for this project per BVG: *"the closer to an Entity Relationship Diagram (what eraser.io is using)
the better."*

Paste the block below into <https://app.eraser.io> → Diagram-as-code → Entity Relationship
Diagram. *(How to drive eraser.io programmatically is a separate research thread —
see `.notes/eraser-research-prompt.md`.)*

**Rules for maintaining this file:**

1. **Decided material only.** Every field traces to a numbered decision in
   `.notes/data-model-answers.md`. Comments carry the decision number.
2. **Open items appear as comments, never as invented fields.** `// OPEN 4.1` marks a fork
   that hasn't been answered — do not resolve it here.
3. **Derived things are NOT entities or columns.** They go in the derived list at the bottom.
   **Eleven** things have been demoted from stored to derived; that pattern is the spine of
   the model.
4. Update this file **in the same sitting** a decision lands, not later.
5. **Columns marked `// HOUSE` are the exception to rule 1.** They trace to no numbered
   decision because they are not model decisions — they are the **committed schema's house
   style**, inherited wholesale (BVG, 2026-08-12, naming thread): `id bigint pk` with FKs
   following, `created_at`/`updated_at timestamptz` on every entity, `slug text unique` on
   canonical entities, and `maker.root_url text unique`. Source:
   `packages/database/src/schema/` and `docs/database-schema/`. Rationale, plus the two
   things we deliberately did **not** inherit, are in `.notes/vocabulary-lexicon.md` §5.
   Non-id `string` columns were left alone — converting them to `text` was not ratified.
6. **PLAIN NAMES. Every new entity and column must pass the say-it-out-loud test** (BVG,
   2026-08-12). Full rule and the decided vocabulary: `.notes/vocabulary-lexicon.md` §0.
7. **VOCABULARY STORAGE — C2, 2026-08-13.** A vocabulary is a **table** when its members arrive
   at **runtime** (the scraper interns a word nobody enumerated) or carry data of their own.
   It is a **TS `as const`** when the set is closed at compile time and a member is nothing but
   its own name. Everything curated in this ERD is the second kind; `material` is the only one
   of the first, and it is **inherited**, not designed — it is the committed `materials` table
   (`scraper.ts:191`), declared here only so the FK resolves. `mechanisms` and `product_types`
   are scraper staging and are **not** ours to model. Full reasoning: answers file, C2.

---

## ⚠️ Rule 6 — the naming law

**The test:** *could someone shopping for a pen say this name out loud and mean roughly the right
thing?* If no, it is the wrong name. Apply it when a name is **created**, not in a later cleanup
pass — renaming later costs cross-references, which is why this rule exists.

**Banned outright**

- **Jargon borrowed from another domain.** `socket` (electrical), `edge`/`node` (graph theory),
  `bridge`, `topology`. These read as something else entirely to a layperson.
- **Compound schema nouns where a plain one exists.** `edge_required_part` → `part_needed`.

**Kept anyway — a technical word wins when the plain word is *also* wrong**

- `advance_mechanism` — JetPens' own live facet is `LEAD ADVANCE MECHANISM`. Plainer than any
  substitute.
- `medium` — "ink type" is *wrong*: graphite and marker are in scope as of Sitting 3.
- `polarity`, `observance`, `fit_quality` — the market has **no word at all** (lexicon §3). An
  invented-but-precise word beats a borrowed-but-wrong one.

**Three traps this rule does NOT let you fall into**

1. **Never collapse a distinction to get a shorter name.** `advance_mechanism` and `actuator` were
   split because `side_click` carried two facts in one value. A "simpler" merged name is a
   regression, not a simplification.
2. **Never adopt a brand-anchored word as an identifier.** The market's words for a refill's shape
   are all brand names — Parker-style, G2, Euro — and the G2 collision is documented confusion.
   Use a neutral plain word (`refill_style`) and put the brand words in `also_known_as`.
3. **When two things share one market word, qualify both — do not rename one into a second
   unsettled word.** "Tip" means the pen's front assembly (`tip_option`) *and* the refill's
   writing point (`tip_size`). Resolved by copy discipline — "pen tip", "tip size", "tip opening"
   — after `nose_option` was proposed and rejected. **A bare "tip" in UI copy is a bug.**

### Applied 2026-08-12 — five renames under this rule

`socket` → **`refill_style`** · `socket_alias` → **`also_known_as`** · `compat_edge` →
**`fit_check`** · `edge_required_part` → **`part_needed`** · `socket_bridge` →
**`style_adapter`**. FK columns followed: `socket_id` → `refill_style_id`, `edge_id` → `fit_id`,
`from_socket_id`/`to_socket_id` → `from_style_id`/`to_style_id`.

### Applied 2026-08-14 — a sixth rename, and trap 3 firing in our own schema again

`collection_item.variant_id` → **`product_variant_id`**. Forced by 5.3b(i) adding
`installed_refill_variant_id` to the same row: two columns, one word, two different things (the
**pen's finish** and the **refill's option**). That is trap 3 — *when two things share a word,
qualify both* — and it is the second time it has fired on our own schema rather than on the
market's vocabulary, after `source` (§0.2). Caught **at creation**, which is the whole point of
rule 6; renaming one of them a year from now is the bill the naming thread already paid once.

⚠️ **The numbered decisions in `.notes/data-model-answers.md` still use the old words** — 2.5,
F3′, 3.6 and Sitting 3 (c′) all say "socket". That file was deliberately **not** rewritten; the
audit trail is worth more than the consistency. Use the map above when reading it.

**Not renamed, and deliberately so:** `tip_option` (see trap 3), `product`, `product_family`,
`product_variant`, `collection_item`, `refill_dimension`. These are guessable; the five above were
not. Buyer-facing labels for all of them live in `data-model-erd-public*.eraser`, which are views,
never the schema of record.

---

## Diagram

```eraser
title machinedpens — refill compatibility model

// ══════════════════════════════════════════════════
// CATALOG — the pen side
// ══════════════════════════════════════════════════

maker [icon: factory] {
  id bigint pk
  slug text unique       // HOUSE
  name string
  root_url text unique   // HOUSE — the scraper's identity key, already load-bearing
  created_at timestamptz
  updated_at timestamptz
}

product [icon: pen-tool, color: blue] {
  id bigint pk
  maker_id bigint fk
  family_id bigint fk null // 3.2 — null when the maker doesn't size-segment (Autmog, Modern Fuel)
  slug text unique       // HOUSE
  name string
  advance_mechanism enum // 3.5 — none(capped)|ratchet|bolt|screw|cam. Brand words for
                         //   mechanisms (ClickShift, CamPen, Switch) are ALIASES, same law
                         //   as refill styles and part kinds; marketing name lives in `name`.
  actuator enum          // 3.5 — top_button|side_button|bolt_knob|clip|toggle|
                         //   body_rotation|n_a. PROVEN on one page: TT's toggle "deploys
                         //   the tip" AND ships in steel or bronze, so it is an actuator
                         //   here and a `part` in 3.3. Two axes, never a conflict.
                         //   WHY SPLIT: `side_click` = ratchet + side button, two facts in
                         //   one value, mixed before anyone noticed. BVG's "clip bolt" =
                         //   bolt + clip actuator. Flat enum needs clip_bolt, clip_click,
                         //   ... = N x M values instead of N + M.
                         //   Also resolves `toggle` appearing in BOTH 3.3's parts list and
                         //   3.5's action list: it is an actuator AND a physical part.
                         //   Retention is separate again — see radial_retention below.
                         // DERIVED: a pen CANNOT be clipless when actuator = clip (3.4).
  bore_class enum        // 2.7 — precision|standard|wide
  bore_mm decimal null   // 2.7 — derive bore_class from this where present
  axial_adjust enum      // 3.2b (b") — none|adjustable. COARSE + CURATED, the exact shape
                         //   of bore_class: the number below covers ~1 maker, the flag
                         //   covers every pen. Alpha states adjustability and publishes
                         //   no mm, so numbers alone could not express it.
  accepts_length_min_mm decimal null // 3.2b (b") — the AXIAL twin of bore_mm.
  accepts_length_max_mm decimal null //   Modern Fuel publishes 89-116. NEGATIVES ONLY:
                         //   98 mm Parker is inside the window and may still need a tip
                         //   swap (UNCONFIRMED - BVG to check). Refines axial_adjust where
                         //   present, exactly as bore_mm refines bore_class.
  radial_retention enum  // 3.2b (b") — fixed|collet. Coarse + curated; no maker publishes
                         //   a collet's grip range, so this one has no numeric twin.
  handedness enum        // 3.7 — right|left|either. A BROWSE FACET, never an axis: an L vs
                         //   J bolt path or a flipped mech position is a different BODY, so
                         //   L and R are separate products under 3.1. No bearing on fit.
                         // NO ships_with_refill_id — MOVED to tip_option by C4a/C4b,
                         //   2026-08-13. The fit it implies is tip-scoped, and F3' already
                         //   rules that anything refill-shaped lives on tip_option.
                         // NO category  — 3.1, derived from the refill's medium
                         // NO refill_style_id — F3', it lives on tip_option
  created_at timestamptz
  updated_at timestamptz
}

product_family [icon: layers] {
  id bigint pk           // 3.2 — a maker's size class, the unit makers publish scope in:
  maker_id bigint fk     //   "Standard", "Mini", "Slim", "Short", "Parker format bodies".
  slug text unique       // HOUSE
  name string            // ⚠️ SCOPES PART INTERCHANGEABILITY ONLY — never a fit claim.
                         //   TT Switch Standard takes a Pilot G2; TT Switch Short takes a
                         //   Schmidt EasyFlow 9000. Different REFILL STYLES inside one family.
                         //   Refill style lives on tip_option, per product (F3').
  created_at timestamptz
  updated_at timestamptz
}

tip_option [icon: git-merge, color: blue] {
  id bigint pk
  product_id bigint fk   // 3.2 knock-on — stays PER-PRODUCT. Duplication is what justified
                         //   family scoping and it doesn't exist at this grain; 3.6's
                         //   inheritance+exceptions already absorbs the fit_check duplication.
                         //   Mandatory even when 1:1 (Autmog) — collapsing it would put
                         //   refill_style_id back on the product and undo F3'.
  refill_style_id bigint fk
  name string            // "G2 Spring & Pen Tip", "Parker nose"
  toleranced_for_refill_id bigint fk null // 2.6 — Autmog's per-refill tolerancing (2.5 mm
                         //   +/-25 um). Named in Sitting 2, never carried here until now.
                         //   Placement follows F3'.
  axial_adjust enum null            // 3.2b override — null = inherit from product.
  accepts_length_min_mm decimal null //   RATIFIED 2026-08-13, sweep item S2.
  accepts_length_max_mm decimal null //   Alpha Executive is FIXED bare and ADJUSTABLE with
                         //   the Parker adapter fitted; product-only storage makes one of
                         //   those two configurations always wrong. And F3' had ALREADY
                         //   forced this grain: pass 6 classified Alpha's adapter as a TIP
                         //   OPTION (it sits in the pen), so the two configurations are
                         //   already two tip_option rows. Not a special case — it is where
                         //   the two configurations already lived.
                         //   No radial_retention override — no corpus case adds a collet.
  ships_with_refill_id bigint fk null // C4b — MOVED here from `product`, 2026-08-13.
                         //   THIRD application of F3': the refill in the box belongs to the
                         //   CONFIGURATION you bought, and a fit is tip-scoped. Karas sells
                         //   the Render K in Parker AND G2 tips; on `product` the column had
                         //   no answer that wasn't wrong.
                         //   Modern Fuel ships a G2 AND ships set-for-G2 — that setting is
                         //   the tip's, not the body's. NOT toleranced_for: default config vs
                         //   design intent, two different claims (that stays on tip_option
                         //   too, as toleranced_for_refill_id).
                         //   BilletSpin ships "one TRIMMED Energel refill" — the remedy can
                         //   already be applied in the box.
                         // 4.5 — still the SEEDER'S WORKLIST, not a free positive: the
                         //   shipped refill is the first fit_check a curator writes for each
                         //   pen, BY HAND. Not derived, and the 4.4 verdict rule still reads
                         //   fit_check only.
                         // REJECTED a 3.2b-style product default + tip override: that pattern
                         //   earned its place because a PEN really is fixed-or-collet and a
                         //   TIP can change it. Here there is no product-level fact to refine
                         //   — the box holds one refill, decided by the configuration.
  created_at timestamptz
  updated_at timestamptz
}

// slot_option MERGED INTO `part` — 3.3 (c'). RATIFIED 2026-08-13, sweep item S1.
// TT's "Short" spring is a purchase option AND a fit-required part; two tables meant two
// rows for one SKU that could drift. Purchase-option vs fit-required is NOT a column — it
// is which join points at the row: maker_id+family_id (3.2 a') vs part_needed (2.1).
// See `part` in the ASSERTIONS block.

material [icon: box] {
  id bigint pk           // C2 — INHERITED, not designed. This IS the committed
  slug text unique       //   `materials` table: packages/database/src/schema/scraper.ts:191.
  name string            //   Declared here so product_variant's FK resolves.
                         // WHY A TABLE when ~20 other vocabularies are TS `as const`: its
                         //   members arrive at RUNTIME. A maker ships an alloy nobody
                         //   enumerated (Timascus, mokume, zirc, whatever is next) and the
                         //   scraper must be able to intern the word without a code change.
                         //   Same standing as `maker`, which is already the committed
                         //   `makers` table (see root_url // HOUSE).
  created_at timestamptz
  updated_at timestamptz
}

product_variant [icon: droplet, color: blue] {
  id bigint pk                   // 3.7 (d') — surface-only differences. The body is
  product_id bigint fk           //   unchanged, so under 3.1 this is NOT a new product.
  finisher_maker_id bigint fk null // null = the base maker (TT's own DLC). Set for KVR and
                                 //   Dark Pines, who finish ANOTHER maker's stock body.
                                 //   Compat inherits from product — zero fit_checks duplicated.
                                 //   Dark Pines proves it: they restate TT's own split,
                                 //   "EasyFlow 9000 on Short, Pilot G2 0.7 on Standard".
  material_id bigint fk null     // C2 — was `material string null`, which was FREE TEXT:
                                 //   no fixed list AND no shared list, so Titanium/titanium/
                                 //   Ti become three things and fragment the browse facet.
                                 //   The one curated column whose vocabulary opens at runtime.
  finish string null             // Machined | Stonewashed | DLC | blackened + engraved
                                 // C2 — STAYS FREE TEXT, flagged. Half vocabulary, half prose
                                 //   ("a deep blackened finish" + laser engraving, Dark Pines).
                                 //   ERD rule 2: do not invent the field. Revisit when the
                                 //   corpus forces it.
  name string null               // marketing: "Golden Dragon", "Dragons Breath"
  one_off bool                   // "no two will be exactly alike" (Dark Pines);
                                 //   "a unique physical item" (BilletSpin).
                                 // NO edition_size — three makers, NONE number anything.
                                 // SEAM: a customizer who changes GEOMETRY makes a new
                                 //   product under 3.1 and inherits nothing (Rule 1's
                                 //   neighbour). Surface work stays a variant.
  created_at timestamptz
  updated_at timestamptz
}

// ══════════════════════════════════════════════════
// REFILL STYLES — flat, disjoint, many-to-many with pens (Sitting 1)
// ══════════════════════════════════════════════════

refill_style [icon: crosshair, color: purple] {
  id bigint pk
  slug text unique       // model-level ONLY, never brand-level: dsm-2006 not schmidt
                         //   HOUSE — was `slug string`; `text unique` matches the
                         //   committed mechanisms/materials/product_types tables.
  name string
  standard string null   // "ISO 12757-1:G2" | null when de facto
  observance enum        // well|partial|poor — sets granularity, Sitting 1
  variance_note text null
  created_at timestamptz
  updated_at timestamptz
}

also_known_as {
  id bigint pk
  refill_style_id bigint fk
  alias string           // "Signo UMR-85" — never bare "Signo"
  created_at timestamptz
  updated_at timestamptz
}

// ══════════════════════════════════════════════════
// REFILLS — the cartridge side: pen ink, pencil mech, marker
// ══════════════════════════════════════════════════

refill [icon: edit-3, color: green] {
  id bigint pk
  slug text unique       // HOUSE
  brand string
  model string
  refill_style_id bigint fk
  medium enum            // 5.1 widened in Sitting 3 — ballpoint|gel|hybrid|rollerball|
                         // pressurized|graphite|permanent_marker|highlighter
                         //   STAYS HERE — an EnerGel is gel in every colour and size.
  rear_topology enum     // 2.4, the ONLY axis — open|plugged|finned|flanged
                         // OPEN: values are a draft, need firming from real refills
  form enum              // sku | harvested — Charpie/Sharpie, UNCONFIRMED at source
                         // NO tip_size, NO colour — 5.2, MOVED to refill_variant.
                         //   THIS ROW IS A MODEL. Both were single-valued columns on a
                         //   row a Sarasa fills with 3 sizes x 20 colours: a column whose
                         //   CARDINALITY CONTRADICTS ITS ROW'S GRAIN. Five of the six FKs
                         //   pointing here want the model (fit_check, refill_dimension,
                         //   rebrand, toleranced_for, ships_with); only the collection's
                         //   installed_refill leaned SKU-ward — ANSWERED 5.3b(i), (c):
                         //   it names BOTH, the model here and the exact one on
                         //   refill_variant, as a constrained pair.
                         // ESCAPE HATCH (1.3's precedent): if a tip size ever changes the
                         //   PART, it becomes its own refill row — kept apart until proven
                         //   identical. The fit corpus never learns about variants.
  created_at timestamptz
  updated_at timestamptz
}

refill_variant [icon: layers, color: green] {
  id bigint pk           // 5.2 — NEW, 2026-08-14. What you actually BUY.
  refill_id bigint fk    //   The refill-side TWIN of product_variant, and it exists for
                         //   the identical reason 3.7 (d') gave: surface differences that
                         //   change NOTHING about fit must never duplicate the assertion
                         //   corpus. Second instance of that pattern, hence the matching
                         //   name. No slug, no name — product_variant has neither either.
  tip_size decimal null  // the WRITING POINT width. For medium = graphite this is the LEAD
                         //   DIAMETER THE MECHANISM ACCEPTS (0.5/0.7/0.9) — the refill row
                         //   there is the pencil MECHANISM (Schmidt DSM 2006, the seated
                         //   cartridge per Sitting 3), and the lead is a consumable one
                         //   level BELOW it, not modelled. So NO `hardness` column: a
                         //   graphite refill's variants differ by lead Ø alone.
  colour_name text null  // 5.2 — THE FULL LONG TAIL, the maker's own word ("Vintage
                         //   Vermillion"). FREE TEXT: the same call C2 made for
                         //   product_variant.finish, for the same reason — half vocabulary,
                         //   half prose, and unlike `material` there is no shared
                         //   vocabulary for it to converge on.
  colour_family enum null // 5.2 — black|blue|blue_black|red|green|other. BROWSE FACET.
                         // blue_black ADDED 2026-08-14 by R-A, and it is the flagged
                         //   claim being paid off rather than a guess: it is a first-class
                         //   colour at ALL THREE makers researched. He may overrule.
                         //   WHY BOTH: one `colour` column was carrying what it is CALLED
                         //   and what bucket it FILTERS INTO — naming-law trap 3, and the
                         //   NINTH axis-mix. The bucket CANNOT be derived: no code turns
                         //   "Vintage Vermillion" into red, so it is curated.
                         //   Same shape as bore_class + bore_mm, run the other way: a
                         //   coarse value covering EVERY row plus a precise one where the
                         //   maker bothered. C2: closed at compile time, a member is
                         //   nothing but its own name -> TS `as const` -> pgEnum.
                         //   STARTS COARSE AND GROWS (ALTER TYPE ADD VALUE is cheap;
                         //   removing a value is not). blue_black is the likely first add.
                         //   null = not applicable (a graphite mechanism).
                         // NO item/part code (LR7-A, BLS-VB5RT-BB) — ERD rule 2, not
                         //   invented. (refill_id, tip_size, colour_name) already keys it.
                         // CATALOG CORPUS (4.5, left column): the scraper stages, a human
                         //   promotes. This is where BigIDesign's ~800-row sheet lands, and
                         //   NOTHING IN THE FIT CORPUS POINTS HERE. That is the property
                         //   being protected. (collection_item points here as of 5.3b(i);
                         //   the collection is neither corpus, so the seam holds.)
                         // ⚠️ NEEDS UNIQUE (id, refill_id) — 5.3b(i). Not a column: the
                         //   key collection_item's two-column FK references, which is what
                         //   makes "the model and the exact one disagree" unstorable.
                         // R-A, 2026-08-14 — THE MATRIX IS RAGGED, AND THAT IS WHY THIS IS
                         //   A TABLE AND NOT A COMPUTED CROSS-PRODUCT. Measured on three
                         //   makers' own sites: uni's UMR-85E is 0.5-BLACK-ONLY while
                         //   UMR-85N is 0.5 in four colours; EnerGel runs 5 colours at
                         //   0.3/0.4, 15 at 0.5, 11-12 at 0.7/1.0. Colours do not survive
                         //   a size change, so size x colour cannot be generated.
                         // R-A also PAYS OFF the flagged value list (R-D): `blue_black` is
                         //   a first-class colour at ALL THREE makers (uni BB across six
                         //   codes, Pilot LP3RF-12S4-BB, Pentel at 0.3/0.4) — stronger
                         //   evidence than the unverified JetPens-facet claim it replaces.
                         //   ADDED to colour_family above. (lexicon §2.3)
  created_at timestamptz
  updated_at timestamptz
}

rebrand [icon: copy, color: green] {
  id bigint pk           // C1 — NEW, 2026-08-13. Closes lexicon §2.7.
  refill_id bigint fk    // the BRANDED SKU: Retro 51 REF5P, Baron Fig's Squire refill
  oem_refill_id bigint fk // what it ACTUALLY is: Schmidt P8126. Directed; the star's hub.
                         // WHY A ROW EACH SIDE, not an alias: the branded refill has its own
                         //   brand, slug, price and availability, and 4.5 makes `refill`
                         //   catalog data the scraper stages. also_known_as holds alternative
                         //   NAMES for one row; a rebrand is a second PRODUCT.
                         // WHY A TABLE, not refill.rebrand_of_refill_id: 3.3's refinement —
                         //   "aliases follow their target's storage" — a table when the link
                         //   carries data. It carries attribution, because the link is
                         //   CONTESTED in the wild (REF5P is called P8127 by one source and
                         //   P8126 by two others).
                         // ⚠️ SAME PART OFF THE SAME LINE — NEVER same style. Monteverde's
                         //   "compatible with Parker, Cross, Montblanc" refills are
                         //   style-mates; refill_style already covers those. Admitting them
                         //   here would propagate positives across different parts — the
                         //   EIGHTH axis-mix, caught before construction.
                         // RULE 3 SAFE for style_adapter's reason: DECLARED, never computed.
                         //   Identity cannot be inferred from matching dimensions (F6), and
                         //   refill_dimension coverage is sparse anyway.
  claimed_by enum        // 4.3's enum, reused whole — maker|retailer|community|owner|staff.
  citation_url text null //   CURATION RULE, verbatim from 4.3: maker or community REQUIRES
  citation_note text null //  a citation. Third table carrying the one attribution shape.
                         // NO disputed_note — 4.4b. Curated state; a bad link is DELETED.
                         //   P8126-vs-P8127 is resolved by the curator BEFORE the row is
                         //   written, the same first move 4.4b prescribed for Fisher PR.
                         // ✅ OPEN 5.2 CLOSED, 2026-08-14. The grain is no longer fuzzy: a
                         //   rebrand is MODEL -> MODEL, which is what Schmidt actually
                         //   sells Retro 51. tip_size and colour moved to refill_variant,
                         //   and a colour-specific relabel is handled by 1.3's escape hatch
                         //   (its own refill row), never by loosening this link.
  created_at timestamptz
  updated_at timestamptz
}

refill_dimension [icon: maximize-2] {
  id bigint pk
  refill_id bigint fk
  feature string         // R4 — "body_od"|"rear_cap_od"|"step_1_od". A bare number is
  value decimal          // MEANINGLESS without this. Explains, never matches (F6).
  unit string
  claimed_by enum        // 4.4b — the 4.3 enum REUSED WHOLE: maker|retailer|community|owner|staff.
                         // C4a — `retailer` is the FIFTH value, and it matters MOST here:
                         //   4.4b kept `evidence` off this table because claimed_by already
                         //   carries it, so claimed_by is THE ONLY TRUST SIGNAL a measurement
                         //   has. Merging "measured it" with "retyped it" would destroy it.
                         //   Fisher PR: Unsharpen 90x4.8 (community, calipers) vs Penstore
                         //   89x5.8 (retailer, spec sheet). Folding retail into `maker` would
                         //   OVERCLAIM — naming-law trap 2 — since Fisher may never have
                         //   published 5.8, and a reprint is exactly where 4.4's "typo or
                         //   copy-paste" enters.
                         //   Without it BVG's own caliper numbers (5.94/6.02/4.55/3.15/
                         //   2.46) were indistinguishable from an untraced web number,
                         //   and guard 3 below was unwritable. NOT `measured_by`: that
                         //   overclaims for a maker spec sheet (4.1's trap). `owner` is
                         //   currently unreachable — fit_report carries no numbers.
                         //   NO `evidence` here: claimed_by already carries it, and there
                         //   is no verdict for a second axis to feed.
  citation_url text null // 4.3 — was `source string`, the THIRD meaning of that word.
  citation_note text null //  Same two-column citation shape as fit_check; with claimed_by
                         //   this is now ONE ATTRIBUTION SHAPE across both tables that
                         //   carry outside assertions. Cross-source numbers are worthless
                         //   without a locator anyway (pass 3's methodological catch:
                         //   Sarasa's 6.09 may be a different FEATURE than Pilot's 5.94,
                         //   not a different number).
                         // NO `disputed_note` — 4.4b (c). A disputed NUMBER is noise, not
                         //   content (F5 sells the wrong fit CLAIM, not a retailer typo),
                         //   and a disputed-but-hidden row is the soft delete 4.4 banned.
                         //   The escape hatch is DELETE.
  created_at timestamptz
  updated_at timestamptz
}

// ══════════════════════════════════════════════════
// ASSERTIONS — the moat (F5). Relational, never jsonb (repo house rule).
// ══════════════════════════════════════════════════

fit_check [icon: link, color: orange] {
  id bigint pk
  refill_id bigint fk
  tip_option_id bigint fk null  // 2.5 scoping — most specific wins:
  refill_style_id bigint fk null      // tip_option > refill_style > refill_style inheritance
  polarity enum                 // positive | negative
  reason text null              // REQUIRED when polarity = negative
  fit_quality enum null         // 2.6 — toleranced | snug | loose
                                //   NULLABLE as of 4.1: a `declared` row has none.
                                //   Magnus never seated anything, so any value invented.
  trim_mm decimal null          // 2.3 — always captured, display deferred to the UI pass
  trim_reference string null    // "Parker ballpoint length" — beats the bare number
  trim_necessity enum           // required | recommended | optional — the SHARED necessity
                                //   enum, also on part_needed. First DISJUNCTION in
                                //   the corpus: aBAP x EnerGel can be trimmed to the G2
                                //   default OR adjusted with the bundled wrench.
                                //   CURATED, never derived — inferring it from the length
                                //   window would be geometry producing a positive (Rule 3).
                                //   "Drops in unmodified" is now
                                //   (trim_mm IS NULL OR trim_necessity != 'required')
                                //   AND no required non-included parts.
  functional_warning bool       // "fits but you shouldn't" — Ti2 magnet × hybrid ink
  claimed_by enum               // 4.3 (b) — maker | retailer | community | owner | staff.
                                //   RENAMED from `source`: that word meant THREE things
                                //   in one schema (this, part.source = who MADE it,
                                //   refill_dimension.source = a citation). Naming-law
                                //   trap 3 — qualify all of them. The public views had
                                //   already drafted `claimed_by`/`made_by`; §0.1 move.
                                //   `staff` is the 4th value, FORCED by 4.1's seed:
                                //   "our own knowledge" is neither maker nor forum.
                                //   Buyer label "Tested by machinedpens" — JetPens'
                                //   badge, "refills we've tested ourselves".
                                //   community = harvested from a forum/guide by a
                                //   curator. owner = arrived via fit_report. The two
                                //   ingest paths, and they are NOT the same standing.
  citation_url text null        // 4.3 (b) — traceability. BVG: "focus on accuracy".
  citation_note text null       //   A claim you cannot trace is one you cannot defend.
                                //   A coarse enum can only render "the maker says"; it
                                //   cannot name WHICH page, nor that Unsharpen
                                //   self-contradicts on the Sarasa WITHIN one article —
                                //   which is precisely 4.4's hardest display case.
                                //   Same two-column shape as refill_dimension. ONE
                                //   citation shape across the schema.
                                // CURATION RULE (not a constraint — stated, not invented):
                                //   claimed_by = maker or community REQUIRES a citation.
                                //   An untraceable community claim is indistinguishable
                                //   from an invention. `owner` needs none (it has a
                                //   fit_report); `staff` needs none (it is us).
                                // REJECTED (c) a source TABLE with per-source reliability:
                                //   prejudges the still-open lookup-table-vs-TS-enum
                                //   question (lexicon §5.4) and implies scoring that
                                //   nothing in the corpus supports yet.
  evidence enum                 // 4.1 — declared | tested. REPLACED `verified bool`.
                                //   ASSERTS: did anyone physically seat this refill, or
                                //   is the claim inferred from the style?
                                //   CUTS ACROSS source — Magnus's blanket "as long as
                                //   your refill is in the style below, it will fit!" and
                                //   TT's list with per-refill trim amounts in mm are BOTH
                                //   source=maker and are not the same kind of claim. You
                                //   cannot publish "2mm off the top" without doing it.
                                //   WHY NOT A BOOL: `verified` folded evidence together
                                //   with editorial vetting — two orthogonal facts, the
                                //   SIXTH axis-mix. Vetting moved to fit_report.
                                //   WHY 4.4 NEEDS IT: Bastion declares Parker and rejects
                                //   Parker refills. Resolving conflicts by AUTHORITY ranks
                                //   the maker above the owner and gets Bastion backwards;
                                //   resolving by EVIDENCE gets it right.
                                //   NOTHING CLEARS IT — evidence does not un-happen. A
                                //   contradicting fact is a NEW row; 4.4 displays it.
                                //   NOT corroboration — agreement is a count over rows,
                                //   which is DERIVED (demotion #8).
  disputed_note text null       // 4.4 (d) — THE STAFF OVERRIDE. BVG: "maker copy is not
                                //   always truth, they might have a typo or copy and
                                //   paste it from other products - we still need to have
                                //   the ability to override it."
                                //   NON-NULL IS THE FLAG. No bool+text pair; same pattern
                                //   as `reason`, same `_note` suffix as `citation_note`.
                                //   NOT A CLAIM ABOUT THE PEN — a claim about the
                                //   CITATION. That is why it is not expressible through
                                //   polarity/evidence: doing so would fold "does it fit"
                                //   together with "is this source trustworthy here", the
                                //   SEVENTH axis-mix.
                                //   WHY A COLUMN AND NOT A staff ROW: a copy-pasted maker
                                //   list is `declared` AND positive, and we usually have
                                //   no `tested` row to beat it with. Filing
                                //   staff|tested|negative to win would assert a physical
                                //   fact that never happened — and 4.1b makes `evidence`
                                //   the ONLY trust signal a buyer sees.
                                //   STILL RENDERS. Excluded from the VERDICT, shown with
                                //   the note. Hiding it loses the product: F5 says the gap
                                //   between the maker's chart and reality IS what we sell.
                                //   PER ROW, NEVER PER MAKER. A `maker.unreliable` flag is
                                //   the reliability scoring 4.3 rejected; BVG's words name
                                //   single events - A typo, A copy-paste.
                                // CURATION RULE: a disputed row REQUIRES a note.
                                // OPEN — no user model, so WHO disputed it is `updated_at`
                                //   and nothing more. Same OPEN as fit_report. Rule 2.
                                // NOTE — fit_check is MUTABLE curated state; fit_report is
                                //   the append-only log. So a RETRACTION (the halffull
                                //   author correcting an entry after community feedback)
                                //   is an edit or a delete, NOT a disputed_note. No
                                //   `retracted_at`, no soft delete.
  created_at timestamptz
  updated_at timestamptz
}

fit_report [icon: message-square, color: orange] {
  id bigint pk                  // 4.1 — user-submitted "does it work", NOT a claim.
  refill_id bigint fk           //   BVG: "i want user submitted feedback if it works but
  tip_option_id bigint fk       //   it will need to be eventually manually approved to
                                //   avoid false positives/negatives."
                                //   ALWAYS CONCRETE — a person owns one pen, so a report
                                //   names a tip_option. fit_check may be refill_style-
                                //   scoped (2.5); a report never is. Real asymmetry.
  fits bool                     // the ONE thing a submitter can reliably state.
                                //   NOT `works` — "works" collides with
                                //   functional_warning ("fits but you shouldn't", the Ti2
                                //   magnet x Jetstream case). NOT `polarity` — that is the
                                //   curated claim's word (lexicon §3, a term we teach);
                                //   jargon has no place on a submission form.
  note text null                // free text. The corpus shows reports arrive as PROSE:
                                //   FPN, "the tip of the Space Pen insert wiggles around
                                //   when I write". fit_quality, trim and parts are the
                                //   EDITOR's job at promotion — asking a user to fill the
                                //   curated vocabulary is 2.1's rejected "generic need
                                //   rows" error in a new place.
  review_state enum             // pending | approved | rejected. THE APPROVAL GATE.
                                //   Rejected rows are KEPT — so they are not re-reviewed,
                                //   and because a pattern of rejections is itself signal.
  fit_id bigint fk null         // set when folded into a curated claim. N reports > 1
                                //   fit_check — which is what preserves the COUNT. You
                                //   cannot tell a false positive from a true one by
                                //   looking at a single report.
                                // OPEN — no reporter/user model exists in this ERD yet.
                                //   Sitting 5 territory. Rule 2: do NOT invent the field.
                                // 4.1b ANSWERED (a) — an UNAPPROVED report has NO buyer read
                                //   path at all. BVG: "nothing shows until approved or added
                                //   manually by the devs, focus on accuracy not widespread
                                //   adoption." Every buyer-facing query reads fit_check ONLY.
                                //   Corroboration counts survive but filter to
                                //   review_state = approved.
  created_at timestamptz
  updated_at timestamptz
}

part_needed {
  fit_id bigint fk
  part_id bigint fk
  sourcing enum   // included_with_pen | included_with_refill | purchase_separately
  necessity enum  // required | recommended | optional — SHARED with trim_necessity.
                  //   Lives on the LINK, not on `part`: the spring is the first part whose
                  //   necessity is REFILL-dependent, not pen-dependent. Same spring is
                  //   required for one refill and merely "not optimal" for another. (BVG)
  created_at timestamptz
  updated_at timestamptz
}

part [icon: tool] {
  id bigint pk
  slug text unique         // HOUSE
  maker_id bigint fk null  // null = generic / third-party: a Schmidt spring, a plain o-ring
  family_id bigint fk null // 3.2 — null = maker-wide (TT's clips). NEVER a product-id list.
  kind enum       // 3.3 — clip|bolt|bolt_handle|top_cap|spring|o_ring|spacer|adapter
                  //   GLOBAL and coarse. Fellhoelter's bolt handle and NTI's are the same
                  //   KIND and different ROWS — per-maker rows, never a per-maker
                  //   vocabulary. Growing it is a TS edit (enums.ts = `as const`).
                  //   Brand words are a TS ALIAS MAP, not a table: {back_piece: top_cap}.
                  //   OUT: grip (BVG - it is milling, see 3.7); tip (= tip_option, F3');
                  //   conversion kit (pass 6 - it is a tip option).
  name string
  made_by enum    // oem | aftermarket | community — 4.2 dissolved into this row.
                  //   RENAMED from `source` in 4.3: this is who MANUFACTURED the part,
                  //   not who claims anything. Third of the three collisions.
                  // NOTE: being a purchase OPTION vs a fit-REQUIRED part is not a column.
                  //   It is which join points here: maker+family scoping makes it an
                  //   option, part_needed makes it required. The Short spring is
                  //   both, from one row. That is the whole argument for the merge.
  created_at timestamptz
  updated_at timestamptz
}

style_adapter [icon: shuffle, color: red] {
  id bigint pk                       // NEW — Sitting 3, (c')
  part_id bigint fk
  from_style_id bigint fk
  to_style_id bigint fk             // DIRECTED. The reverse is a separate row.
  result_quality enum null           // null when the adapter is adjustable
  scope_tip_option_id bigint fk null // null = refill_style-wide (TT's is Standard-only)
  created_at timestamptz
  updated_at timestamptz
}

// ══════════════════════════════════════════════════
// COLLECTION — web-only saved configs. 5.3a / 5.3b / 5.4 / 5.5 ALL ANSWERED.
//   ⚠️ WHAT THIS LAYER IS, in BVG's words (5.5, 2026-08-14): "we are just
//   recording THINGS OWNED — the actual refill is trivial at this point,
//   it's more about the actual PEN AND PARTS." The refill still matters
//   (it is the fit_report entry point) but it is not the centre.
//   NOTED, NOT BUILT — "later, specific ink in a fountain pen." Fountain
//   pens are OUT (Sitting 3: the boundary is "is there a seated cartridge").
//   And ink is the same CLASS as graphite lead, which 5.2 already ruled a
//   consumable one level BELOW the seated part and not in this model at all.
//   So it is a new entity in a later scope, never a refill row.
// ══════════════════════════════════════════════════
//   ⚠️ DIRECTION CHANGE 2026-08-13: field-log is dropped (already gone from
//   apps/ on origin/main) and there is no app integration. This is no longer
//   "Brownie's layer" — it is a LIMITED, web-only save. The collector-inventory
//   columns 5.3 posed (drop number, serial, price paid, current value,
//   condition, photos) are the shape being stepped away from.

user [icon: user] {
  id bigint pk           // INHERITED, not designed — the committed `users` table
  clerk_id text unique   //   (packages/database/src/schema/users.ts, PR #63).
                         //   Declared here only so collection_item's FK resolves.
                         //   Minimal on purpose: Clerk owns the identity.
  created_at timestamptz
  updated_at timestamptz
}

collection_item [icon: package, color: gray] {
  id bigint pk
  user_id bigint fk                   // 5.3a — FORCED, not invented: a row meaning
                                      //   "a pen you own" must name the owner, and
                                      //   `users` is committed. Shape follows
                                      //   user_settings (user_id FK, cascade delete).
                                      // 🔑 5.6a THE COMPLETENESS GATE — "we won't even
                                      //   offer items that aren't complete in the
                                      //   database to be added to your personal
                                      //   collection." IT NEEDS NO COLUMN: the required
                                      //   FKs below already say it. A pen is ownable only
                                      //   with a maker, a product, a finish, a pen tip,
                                      //   AND that tip declaring a refill_style (itself
                                      //   required, 4.5). Same bar 4.5 set from the other
                                      //   end when it made refill_style gate the catalog.
                                      //   No `published` flag either — under 4.5 the
                                      //   scraper STAGES in tmp_* and a human PROMOTES,
                                      //   so being in a curated table IS the promotion.
                                      //   A pen we don't have routes to a SUBMISSION
                                      //   (staff approve or amend, then the public gets
                                      //   it and owners customize from there). Out of
                                      //   scope and NOT modelled — but it is fit_report's
                                      //   pattern one corpus over, so reuse that shape.
  product_variant_id bigint fk        // 3.7 — points at the VARIANT, not the product.
                                      // RENAMED from `variant_id` by 5.3b(i), rule 6:
                                      //   the new column below put TWO different
                                      //   "variants" on one row — the pen's finish and
                                      //   the refill's option. Naming-law TRAP 3, live in
                                      //   our own schema for the second time (the first
                                      //   was `source`, §0.2). Qualify BOTH; do not
                                      //   rename one into a second unsettled word.
  tip_option_id bigint fk
  installed_refill_id bigint fk null  // ✅ OPEN 5.3b(i) ANSWERED (c), 2026-08-14 — BOTH.
                                      //   THE MODEL. Stays nullable: a saved pen with
                                      //   nothing loaded is a real state. This is the
                                      //   column every read path uses — fit_report (4.1
                                      //   wants refill + tip_option), the verdict rule,
                                      //   "what are people running in this pen".
  installed_refill_variant_id bigint fk null // 5.3b(i) — THE EXACT ONE, optional.
                                      //   Coarse + precise, the shape this schema already
                                      //   runs four times (bore_class + bore_mm;
                                      //   axial_adjust + accepts_length_*; colour_family
                                      //   + colour_name; observance + the measurements).
                                      // WHY NOT MODEL-ONLY: R-A killed the cold-start
                                      //   argument. Pentel, uni and Pilot each publish a
                                      //   COMPLETE size x colour matrix on their own site
                                      //   (Pilot runs pilot-refill.jp for exactly this),
                                      //   so the option table will not be thin. And the
                                      //   item code printed on the refill in your pen
                                      //   ALREADY names the size — LR7, UMR-85N,
                                      //   LP3RF-12S4 — so model-only cannot record what
                                      //   is written on the part.
                                      // WHY NOT EXACT-ONLY: `refill` is FORCED to exist
                                      //   by the fit corpus (fit_check requires it);
                                      //   NOTHING forces refill_variant to be populated.
                                      //   And the colour tail is genuinely unknowable —
                                      //   EnerGel 0.7 ships ~12 colours and an owner
                                      //   cannot always say whether their blue is Blue,
                                      //   Navy Blue or Turquoise.
                                      // ⚠️ THE TWO CANNOT DISAGREE — and I had said they
                                      //   could, which was wrong. Enforcement, stated so
                                      //   implementation does not guess:
                                      //     refill_variant needs UNIQUE (id, refill_id);
                                      //     FK (installed_refill_variant_id,
                                      //         installed_refill_id)
                                      //       -> refill_variant (id, refill_id);
                                      //     CHECK (installed_refill_variant_id IS NULL
                                      //            OR installed_refill_id IS NOT NULL).
                                      //   Default (MATCH SIMPLE) skips the pair check
                                      //   when either side is null, which is what allows
                                      //   model-only; the CHECK is what stops the
                                      //   reverse. MATCH FULL would be WRONG here — it
                                      //   forbids exactly the model-only case (c) exists
                                      //   for.
                                      // NOT a twelfth demotion: the model column is
                                      //   stored on every row. What is derived is the
                                      //   KEYSTROKE — the picker asks ONCE, and choosing
                                      //   the exact one fills the model column.
                                      // 4.5 SEAM INTACT: this is the collection reading
                                      //   refill_variant, and the collection is neither
                                      //   corpus. No FIT query points at the child, which
                                      //   is the property the identity/purchase-option
                                      //   split protects.
                                      // ✅ 5.5 ANSWERED — A FIELD, NOT A LOG. "Log from
                                      //   day one" was FIELD-LOG'S OWN PREMISE (a carry
                                      //   logger over generic log_entries) and field-log
                                      //   is dropped, so the argument came from a product
                                      //   that no longer exists. BVG: "we are just
                                      //   recording things owned — the actual refill is
                                      //   trivial at this point, it's more about the
                                      //   actual pen and parts."
                                      //   THE LOG'S ONE DURABLE USE IS ALREADY COVERED:
                                      //   knowing what was loaded WHEN SOMEONE SAID IT
                                      //   FITS is fit_report, which names the refill and
                                      //   the tip itself and is append-only by 4.1.
                                      //   And 4.4's line puts this row on the MUTABLE
                                      //   side: a pen you own is state you edit, which is
                                      //   what updated_at is for.
                                      //   IF A LOG EVER LANDS it is an append-only child
                                      //   table and installed_refill_id becomes "the
                                      //   newest row" — a clean twelfth demotion, no
                                      //   backfill. Cheap later, so not now.
                                      // 🔑 5.5 ALSO RE-CENTRED THE LAYER: the collection
                                      //   is PEN + PARTS first, refill second. That is
                                      //   why 5.4's part_fitted is the load-bearing
                                      //   addition here and the refill columns are not.
                                      // 5.3a ANSWERED — a saved config is A PEN YOU
                                      //   OWN: finish + pen tip + what's loaded, which
                                      //   is what this table already held. NOT "a setup
                                      //   you saved, owned or not" — reports would then
                                      //   arrive from people who never held the pen,
                                      //   the exact false positive 4.1/4.1b guard
                                      //   against. An owned/wanted flag is one
                                      //   defaulted boolean away if ever wanted.
                                      // 🔑 THIS IS THE fit_report ENTRY POINT. 4.1
                                      //   requires a report to name a tip_option; a
                                      //   saved config already does. "Pick your setup,
                                      //   tell us if it fits" — the moat gets what it
                                      //   asked for from the feature being kept.
                                      // ✅ 5.3b(ii) ANSWERED (a) — NOTHING MORE, AND LESS
                                      //   ENTRY. No nickname, no note, no columns. BVG:
                                      //   "they only need to have entered 'copper tibolt'
                                      //   — it's just the stock config, we can pre-fill
                                      //   the fields and they can change anything at
                                      //   will." Half of it was already true: this row
                                      //   stores ZERO specs, so every spec reads through
                                      //   to the catalog and is always current. What is
                                      //   new is that the four FKs arrive PRE-FILLED.
                                      // PRE-FILL RULE: fill what the catalog makes
                                      //   unambiguous, ASK ONLY WHERE IT BRANCHES —
                                      //   one tip_option on the product, fill it; more
                                      //   than one, ask ONE question then fill the rest.
                                      //   ("copper TiBolt" branches: Full Size TiBolt is
                                      //   Schmidt, G2 TiBolt is G2 Mini, TiNyBolt is
                                      //   fisher-pr. Autmog asks nothing.)
                                      // WRITTEN, NOT RESOLVED ON READ. The values are
                                      //   SAVED to the row. Rejected "store only what you
                                      //   changed" for three reasons: a curator editing
                                      //   ships_with_refill_id would silently change what
                                      //   is loaded in every saved pen (4.4's line —
                                      //   fit_check is mutable curated state, a pen you
                                      //   OWN is not); a report would then carry a value
                                      //   the owner never saw, which is 4.1's false
                                      //   positive through a side door; and null would
                                      //   have to mean BOTH "empty" and "stock", the
                                      //   defect class 5.2 named.
                                      //   NOT a demotion — written at save time, not
                                      //   derived at read time. Deliberately absent from
                                      //   the DERIVED list.
                                      // AND THE PRE-FILL ONLY EVER REACHES THE MODEL:
                                      //   ships_with_refill_id is model-level by C4b, so
                                      //   the catalog can fill "an EnerGel LR7" and can
                                      //   NEVER fill "the 0.7, Navy Blue". Confirms
                                      //   5.3b(i)(c) — catalog supplies the model, the
                                      //   owner supplies the exact one.
                                      // NO note column — "this one rattles" / "I trimmed
                                      //   it 2 mm" are facts about a PAIRING and 4.1
                                      //   already built their home (fit_report.note,
                                      //   where a curator can promote them). A note here
                                      //   routes what F5 SELLS into a private field.
                                      // NO nickname — the row renders a name it does not
                                      //   store (maker + pen + finish + pen tip + what's
                                      //   loaded). One nullable column away if 5.4 forces
                                      //   it; same standing as 5.3a's wishlist boolean.
                                      // ✅ 5.4 ANSWERED — SEPARATE ROWS, ALWAYS. Never a
                                      //   quantity field: a quantity cannot say WHICH
                                      //   refill is in the second one, cannot be the
                                      //   subject of a report (4.1 wants one pen), and
                                      //   counting what you own is the INVENTORY shape
                                      //   5.3a stepped away from.
                                      //   ⚠️ BVG CORRECTED MY REASON, and it mattered: I
                                      //   argued identical rows mean identical pens
                                      //   because a differing refill separates them. He
                                      //   pointed out the difference is more often a
                                      //   FINISH or a SMALL PART. Finish was already
                                      //   covered (product_variant_id); parts were not.
                                      //   Hence part_fitted below.
                                      // OPEN 5.x — owner-commissioned finishing: you send
                                      //   YOUR pen to KVR. Same finisher fact, but here,
                                      //   not on the catalogue. Noted, not built.
  created_at timestamptz
  updated_at timestamptz
}

part_fitted {
  collection_item_id bigint fk // 5.4 — NEW, 2026-08-14. WHICH PARTS ARE ON YOUR PEN.
  part_id bigint fk      //   Pure link table, exactly part_needed's shape (no `id`),
                         //   and named to rhyme with it — the same move `also_sold_as`
                         //   made against `also_known_as`.
                         // R-F CONFIRMED IT AND THE CATALOG NEEDED NOTHING. Tactile Turn
                         //   sells the Bolt Action Back Piece alone in Titanium, Copper,
                         //   Bronze and Zirconium — "materials can be MIXED AND MATCHED
                         //   between pens", you must only "select the correct diameter
                         //   (Standard, Slim, or Thick)". That last clause IS
                         //   part.family_id, decision 3.2 (a'), already built. A copper
                         //   back piece is a `part` row, kind = top_cap, family scoped.
                         //   Second instance: Fellhoelter's Dunce Cap, Copper/Titanium.
                         // 🔑 CURATION RULE (stated, not constrained — same standing as
                         //   fit_check's citation rule): PARTS THAT CHANGE HOW THE PEN
                         //   LOOKS ARE THE OWNER'S CHOICE AND BELONG HERE. PARTS THAT
                         //   CHANGE HOW IT FITS ARE NOT A CHOICE — they are dictated by
                         //   the refill and part_needed already holds them, reachable
                         //   through the fit_check for your refill x tip_option.
                         //   part.kind is the test: clip|bolt|bolt_handle|top_cap here;
                         //   spring|o_ring|spacer|adapter come from the fit corpus.
                         //   WHY IT MATTERS: a functional part fitted here would put a
                         //   configuration into a fit_report that the tip_option does not
                         //   describe — 4.1's false positive through a side door, for the
                         //   second time in this sitting. And a spacer nobody recorded is
                         //   a FIT REPORT (prose a curator promotes into part_needed), not
                         //   a checkbox. Rule 1's neighbour: a functional swap changes the
                         //   CONFIGURATION, and 2.2 already ruled a swapped tip is a
                         //   different tip_option.
                         // NO quantity, NO fitted_at, NO note — ERD rule 2.
  created_at timestamptz
  updated_at timestamptz
}

// ══════════════════════════════════════════════════
// RELATIONSHIPS
// ══════════════════════════════════════════════════

product.maker_id > maker.id
product.family_id > product_family.id
product_family.maker_id > maker.id
tip_option.product_id > product.id
tip_option.refill_style_id > refill_style.id
tip_option.toleranced_for_refill_id > refill.id
also_known_as.refill_style_id > refill_style.id

refill.refill_style_id > refill_style.id
refill_variant.refill_id > refill.id
refill_dimension.refill_id > refill.id
rebrand.refill_id > refill.id
rebrand.oem_refill_id > refill.id

fit_check.refill_id > refill.id
fit_check.tip_option_id > tip_option.id
fit_check.refill_style_id > refill_style.id

fit_report.refill_id > refill.id
fit_report.tip_option_id > tip_option.id
fit_report.fit_id > fit_check.id

part_needed.fit_id > fit_check.id
part_needed.part_id > part.id
part.maker_id > maker.id
part.family_id > product_family.id

style_adapter.part_id > part.id
style_adapter.from_style_id > refill_style.id
style_adapter.to_style_id > refill_style.id
style_adapter.scope_tip_option_id > tip_option.id

tip_option.ships_with_refill_id > refill.id

product_variant.product_id > product.id
product_variant.finisher_maker_id > maker.id
product_variant.material_id > material.id

collection_item.user_id > user.id
collection_item.product_variant_id > product_variant.id
collection_item.tip_option_id > tip_option.id
collection_item.installed_refill_id > refill.id
collection_item.installed_refill_variant_id > refill_variant.id

part_fitted.collection_item_id > collection_item.id
part_fitted.part_id > part.id
```

---

## DERIVED — deliberately not stored

Eleven demotions. Most were enums that mixed orthogonal axes; each is cheaper computed than
curated, and none can drift.

| Thing | Derived from | Decision |
|---|---|---|
| `archetype` (hyper-specific / semi-general / clamped / near-standard) | refill_style count on the fit_check set + `radial_retention` / `axial_adjust` — **inputs now stored, 3.2b** | **F3′** |
| "adjustable" | `axial_adjust`, refined by `accepts_length_*` where published | **3.2b** |
| "can this pen be clipless?" | `actuator = clip` → **no**; otherwise yes | **3.4** |
| the five-grade fit ladder | `fit_quality` × (has trim spec) × (has required part) | **2.6** |
| `category` (ballpoint / gel / rollerball …) | the installed **refill's** `medium` | **3.1** |
| rear-topology negatives | `refill.rear_topology` × what the pen's mechanism requires | **2.4** |
| `bore_class` where `bore_mm` exists | `bore_mm` | **2.7** |
| corroboration — "9 of 11 owners agree" | count over `fit_report` rows for one refill × tip_option, **filtered to `review_state = approved`** | **4.1 / 4.1b** |
| **the fit verdict** — what the buyer is told about one refill × one pen | the four-step rule below over the `fit_check` set | **4.4 (d)** |
| **the displayed measurement** — which number a buyer sees for one refill × one `feature` | `claimed_by = staff` if present, else **every** row with its citation. A `preferred`/`canonical` flag was declined | **4.4b (c)** |
| **coverage** — "how well checked is this pen" | `COUNT(fit_check)`. Declined **pre-emptively**: no `fit_coverage` enum, no `curated_at` stamp. A display state, never a launch gate | **4.5 (c)** |

### The verdict rule (demotion #9)

| Step | Rule | From |
|---|---|---|
| **−1** | expand the set to **R ∪ R's rebrand partners** — the row R points at, plus its siblings on the same `oem_refill_id`. **ONE HOP, no chains.** Propagated rows render **labelled** — *"via Schmidt P8126"* | **C1** |
| **0** | drop every row with `disputed_note IS NOT NULL` | **4.4 (d)** |
| **1** | scope: most specific wins — `tip_option` > `refill_style` | 2.5 |
| **2** | `evidence`: `tested` > `declared`. **`claimed_by` labels; it never ranks** | 4.1 / 4.3 |
| **3** | still tied and opposite → **no verdict.** "Sources disagree", both shown, both cited | 4.4 |

Step −1 must be **labelled, never silent**: 4.1b made `evidence` the only trust signal a buyer
sees, so an unlabelled propagated claim would be untraceable — exactly what 4.3's citation rule
exists to prevent.

Three display states: **agree** (one verdict, sources listed) · **split by evidence** (the
`tested` row wins; the `declared` row renders as a named, cited **counterclaim**, not a footnote
— this is F5 on the page) · **unresolved** (no verdict). Collapses to one word at list density,
expands to both claims on the detail page.

**4.5 adds a fourth: PRIOR ONLY** — zero `fit_check` rows. Not "empty": the pen still declares a
`tip_option.refill_style_id`, and `refill_style.observance` says how far to trust it
(*"Takes Parker-style — usually reliable"* vs *"Takes RB-style — varies by brand, check per
pen"*). Derived from a row count; **must never read as a negative**. This is what carries the
cold start, and it is why a blanket `refill_style`-scoped maker positive adds almost nothing.

Step 2 closes 4.3's deferral of per-source trust: **there isn't any.** Ranking by *who* is what
4.1 disproved on Bastion. Step 0 is what keeps state 3 from being a sticky shrug — with the
override, showing no verdict is a **choice**.

## The two corpora — 4.5 (c)

The entities below are **not one dataset**. They fill by different paths, at different rates,
against different quality bars — and planning them as one is what made "how do we seed" sound
like a volume question.

| | **Catalog** | **Fit checks** |
|---|---|---|
| Entities | `maker` · `product_family` · `product` · `tip_option` · `product_variant` · `refill` · **`refill_variant`** · `refill_style` | `fit_check` (+ `refill_dimension`, + **`rebrand`** — C1) |
| Bar | broad and cheap | narrow and deep |
| Path | `scraper.ts` **stages**, a human **promotes** | hand-curated, citation-gated (4.3) |
| Seed order | styles first (FK-required), then makers | negatives first: research corpus → own pens → maker lists **last** |

**Same shape as 4.1's report→check split, one level up** — ingested data staged separately from
curated data is already the repo house rule (`scraper.ts` jsonb vs every relational curated table).

⚠️ **5.2 made the seam a GRAIN seam too.** The catalog corpus is **SKU-shaped** (BigIDesign's
~800-row sheet is *brand + model + tip size + colour per row*); the fit corpus is **model-shaped**
(TT publishes "Pilot G2", never "Pilot G2 0.7 blue"). That is why `refill` is a model and
`refill_variant` is the thing you buy — and why **nothing in the fit corpus points at
`refill_variant`.** SKU-grained refills would have multiplied every hand-curated fit check,
measurement and rebrand by ~60 for zero added truth.

**The seam is principled, not administrative:** a maker is authoritative about **their own
aperture** (`tip_option.refill_style_id` — catalog) and unreliable about **third-party refills**
(`fit_check` — F5).

**"Broad and cheap" ≠ unattended.** `bore_class`, `advance_mechanism`, `actuator`,
`radial_retention`, `handedness` and `axial_adjust` are required and are all judgment calls off a
product page. Cheap *per row*; still a human.

⚠️ **`refill_style` gates the whole catalog.** `tip_option.refill_style_id` is required, so no pen
lands until its style exists — and the RB-space styles are deliberately unnamed pending
**measurement round 1**, which 4.5 therefore promotes to a **launch dependency**.

## The three rules the schema must not violate

1. **A need modifies the refill or adds a part. Nothing modifies the pen.**
2. **An axis exists only for a fact no measurement can express.** (Exactly one passed:
   `rear_topology`.)
3. **Geometry may produce a negative, never a positive.** — reinforced by the Fisher case:
   89 mm + 10 mm adapter = 99 mm, which geometry reads as in-band-ish for Parker; the real
   refill wiggles at the tip. `style_adapter` is safe because it is **declared, not computed**.
   `accepts_length_*` likewise yields a candidate, never a verdict — rear topology, bore and
   spring all still apply. *(The 111 mm EnerGel was briefly recorded as a second proof of this
   and is **withdrawn**: it fits the window; the trim is discretionary, not required.)*

   **Three guards on the negative:**
   1. it fires only when **both numbers carry a `feature` tag** (pass 3's methodological catch);
   2. the **Autmog 2.5 mm** dependency — if that number is the body bore rather than the tip
      aperture, an in-spec Parker refill at the top of ISO's 2.50–2.57 band fails it wrongly;
   3. **4.4b — the `feature` must be unconflicted, or the row must be `claimed_by = staff`.**
      Sources disagree → the screen does **not** fire and every row renders with its citation.
      You may only *exclude* a pen on a number you are sure of; the failure mode is now
      "we showed a pen we could have hidden," never "we hid a pen that fits."

## The backbone pattern — a general claim + scoped exceptions, most specific wins

Now at **five** grains. It is the spine of the schema, not a coincidence:

| Grain | Where | Decision |
|---|---|---|
| refill × refill_style vs refill × tip_option | `fit_check` scoping | **2.5** |
| base compat list vs variant exceptions | TT Standard → Slim `**` exclusions | **3.6** |
| refill_style-wide adapter vs pen-scoped adapter | `style_adapter.scope_tip_option_id` | **Sitting 3 (c′)** |
| maker-wide slot option vs family-scoped | TT "universally interchangeable" vs the Standard-only spring | **3.2 (a′)** |
| product-wide retention vs tip-option override | Alpha's adapter *adds* adjustability to a fixed pen | **3.2b (b″)** |

## A second pattern, now at two instances — identity vs purchase option

Not the backbone (there is no "most specific wins" here). A parent row is the **thing**, and a child
row is **which one you buy** — surface differences that change nothing about fit, held apart so they
cannot duplicate the assertion corpus.

| Thing | Which one you buy | Decision |
|---|---|---|
| `product` — the body | `product_variant` — material, finish, finisher | **3.7 (d′)** |
| `refill` — the model | `refill_variant` — tip size, colour | **5.2** |

Both children are pure leaves of the **catalog** corpus: `fit_check`, `refill_dimension`, `rebrand`
and `part_needed` point at the parent in every case. Dark Pines' finish inherits all of TT's fit
rows for free, and a blue 0.5 EnerGel inherits every EnerGel fit row for free, by the same
mechanism. **If a future column on either child ever needs to be read by a fit query, that is the
signal the split was drawn in the wrong place.**

⚠️ **5.3b(i) is the first FK into a child from outside the catalog, and it does not breach that
rule.** `collection_item` reads **both** levels — the model for every query that matters and the
option for detail — because the collection is *neither* corpus. The guard is about **fit** queries,
and no fit query gained a hop: the verdict rule, `fit_report` and the four display states all still
read `installed_refill_id`. Symmetry holds on the pen side too — `collection_item` already pointed
at `product_variant` **and** reaches `product` through it. The collection is where a buyer's own
object lives, so it is the one place that legitimately wants both grains at once.

## The defect class that keeps recurring — an enum mixing two orthogonal axes

**Ten** now, and the last five were caught *before* being built rather than after:

1. `archetype` — permissiveness × retention mechanism × declared-vs-actual gap (**F3′**)
2. the five-grade fit ladder (**2.6**)
3. `category` (**3.1**)
4. `adapter` (**pass 6**)
5. `action` — hid `advance_mechanism` + `actuator`; `side_click` had carried both facts in one
   value from the start (**3.5**)
6. `verified bool` — *what backs this claim* × *has an editor vetted this row*. Split into
   `evidence` + `fit_report.review_state` (**4.1**)
7. **avoided:** routing a staff override through `polarity`/`evidence` would have folded
   *does it fit* together with *is this source trustworthy here*. `disputed_note` instead —
   it is a claim about the **citation**, not about the pen (**4.4**)
8. **avoided:** letting `rebrand` mean *same style* as well as *same part*. Monteverde's
   "compatible with Parker, Cross, Montblanc" refills are style-mates, and `refill_style`
   already holds them; admitting them would propagate positives across genuinely different
   parts. Legislated in the entity comment **before** the table was built (**C1**)
9. `colour` — *what the maker calls it* × *what bucket it filters into*. No code turns "Vintage
   Vermillion" into `red`, so the two cannot be one column. Split into `colour_name` (free text,
   the long tail) + `colour_family` (curated coarse enum, the facet) (**5.2**)
10. **avoided:** letting `tip_option` carry *which refill style this front end takes* **and**
   *which alloy you bought*. BVG's *"copper tip on a titanium TiBolt"* looked like it forced a
   `tip_variant` — the identity-vs-purchase-option pattern's third instance — and making the
   copper tip its own `tip_option` instead would have **duplicated the fit corpus**, since
   `fit_check.tip_option_id` is the scope. **R-F declined to build either:** no maker in the
   corpus sells a tip alone in an alloy (TT machines *"the tip and body together"*; Fellhoelter's
   spare-parts kit is an o-ring, a spring and a refill), and every Fellhoelter tip that *is* a SKU
   sits in a conversion kit that **changes the style**, which pass 6 already filed as a
   `tip_option`. The case resolved into rows that already exist — a whole product (the CuTiBolt)
   or a `part` (a cap). **Revisit if a maker starts selling tips by alloy** (**5.4**)

## The two defect classes that are NOT axis-mixing

**3.2b — a derived field whose *input* got demoted along with it.** `clamped` sat in the derived
table with nothing in the schema able to compute it. **Fixed** by storing `radial_retention` +
`axial_adjust`. Worth auditing the other nine derivations for the same failure as each is
implemented.

**5.2 — a column whose *cardinality* contradicts its row's grain.** `tip_size decimal null` and
`colour string null` were single-valued columns on a row a Sarasa fills with three tip sizes and
twenty colours. The tell is that the columns had to be nullable to be writable at all. **Fixed** by
naming the grain (`refill` = model) and moving both to `refill_variant`. Worth checking any other
nullable column that exists only because the row is coarser than the fact.
