# The pen/refill compatibility model

**Status: complete and current as of 2026-08-15.** 20 entities · 37 relationships · zero open
structural questions. **This file is the source of truth — read and implement from it.** It is the
outcome of a six-sitting design interview, distilled. The working corpus that produced it (9,784
lines) is archived at [`docs/archive/data-model-corpus/`](../archive/data-model-corpus/) and is
**superseded**: where it and this file disagree, this file wins.

[`schema.eraser`](./schema.eraser) is this file's **structural expression** — the machine-checkable
form that [`validate.py`](./validate.py) and [`verify-model-doc.py`](./verify-model-doc.py)
enforce. It is not a second opinion: where the two disagree, this file wins and `schema.eraser` is
the thing to correct. What the model deliberately does *not* carry is in
[`DROPPED.md`](./DROPPED.md).

**How to read this.** Section 3 is the entity reference — that is the model. Everything around it
exists to stop the model being un-made by accident: what is deliberately **derived** (§4), what was
deliberately **rejected** (§6), and the rules that are enforced by convention rather than by the
schema (§5). Decision ids like *(4.1)* and *(F3′)* point into the archive if you want the argument.

**Diagrams:** [`fit.eraser`](./fit.eraser) · [`remedies.eraser`](./remedies.eraser) ·
[`collection.eraser`](./collection.eraser). See [README](./README.md).

---

## 1. What this models, and why it is worth building

A buyer asks one question: **"will this refill work in my pen?"** Nobody answers it well. Maker
charts are partial and occasionally wrong, retail has no vocabulary for *doesn't fit* (its
incentive is to sell the pen), and the community knowledge is scattered across forum posts and one
blog's hack list. **That gap is the product** *(F5)*.

There is one existing dimensional matcher — `tools.incoherency.co.uk`. It scores refills against pens by measurement, and it
cannot know about back-end shape or magnets or a maker's undocumented tolerance — which is decent
evidence that the differentiator is **the assertion corpus, not the idea**.

So the model is built around a curated corpus of claims, with three properties:

- **it holds negatives**, first-class and with reasons;
- **every claim is attributed and citable**, and says whether anyone physically seated the refill;
- **the verdict a buyer sees is derived from the claims**, never stored.

### The three rules the schema must not violate

1. **A need modifies the refill or adds a part. Nothing modifies the pen.** Drilling a tip hole is
   out of scope and is not "it fits" — at that point it is a different pen tip, and nobody sells it.
2. **An axis exists only for a fact no measurement can express.** Exactly one passed:
   `refill.rear_topology`. Everything else that looked like an axis reduced to *a diameter at a
   named location*.
3. **Geometry may produce a negative, never a positive.** With three guards — both numbers must
   carry a `feature` tag; the Autmog 2.5 mm question must be settled first; and the feature must be
   unconflicted or the row must be `claimed_by = staff`.

---

## 2. The shape

Five layers. Colour in the diagrams follows them.

| Layer | Entities | Fills by |
|---|---|---|
| **Catalog — the pen side** | `maker` · `product_family` · `product` · `tip_option` · `product_variant` · `material` | scraper stages, a human promotes |
| **Refill styles** | `refill_style` · `also_known_as` | hand-curated; **gates everything** |
| **Refills** | `refill` · `refill_variant` · `rebrand` · `refill_dimension` | catalog corpus, except `rebrand` |
| **Assertions — the moat** | `fit_check` · `fit_report` · `part` · `part_needed` · `style_adapter` | hand-curated, citation-gated, **negatives first** |
| **Collection** | `user` · `collection_item` · `part_fitted` | user-entered, catalog-gated |

### 🔑 The two corpora, and why the seam matters

The catalog is **broad and cheap**; the fit corpus is **narrow and deep**. Planning them as one
dataset is what made *"how do we seed this"* sound like a volume question.

The seam is **principled, not administrative**: a maker is authoritative about **their own
aperture** — which refill style their pen tip takes — and unreliable about **third-party refills**.

It is also a **grain** seam. The catalog is SKU-shaped (BigIDesign's public refill sheet runs ~800 rows of
*brand + model + tip size + colour*); the fit corpus is model-shaped (a maker publishes *"Pilot
G2"*, never *"Pilot G2 0.7 blue"*). That is why `refill` is a **model** and `refill_variant` is
**what you buy** — SKU-grained refills would have multiplied every hand-curated fit check,
measurement and rebrand by ~60 **for zero added truth**, because colour never affects fit *(5.2)*.

### House style

Every entity carries `id bigint pk`, `created_at timestamptz`, `updated_at timestamptz`. Canonical
entities also carry `slug text unique`. These are **inherited from the committed schema**, not
designed, and are omitted from the tables below. `maker.root_url text unique` is the scraper's
identity key and is already load-bearing.

---

## 3. Entity reference

### 3.1 Catalog — the pen side

#### `maker`
The shop that made the pen. Already a committed table.

| Column | Type | |
|---|---|---|
| `name` | string | |
| `root_url` | text unique | the scraper's identity key |

#### `product_family`
A maker's **size class** — "Standard", "Short", "Mini", "Slim". The unit makers publish scope in.

| Column | Type | |
|---|---|---|
| `maker_id` | bigint fk | |
| `name` | string | ⚠️ **Scopes part interchangeability only — never a fit claim.** Two pens in one family can take different refill styles: Tactile Turn's Switch **Standard** takes a Pilot G2 while the **Short** takes a Schmidt EasyFlow 9000 *(3.2)* |

#### `product`
One distinct pen body.

| Column | Type | |
|---|---|---|
| `maker_id` | bigint fk | |
| `family_id` | bigint fk null | null when the maker doesn't size-segment |
| `name` | string | |
| `advance_mechanism` | enum | `none(capped)｜ratchet｜bolt｜screw｜cam` — how the tip is driven out. Brand words (ClickShift, CamPen) are aliases *(3.5)* |
| `actuator` | enum | `top_button｜side_button｜bolt_knob｜clip｜toggle｜body_rotation｜n_a` — **what you operate.** Split from the above because `side_click` carried two facts in one value; flat, it would need N×M members instead of N+M *(3.5)* |
| `bore_class` | enum | `precision｜standard｜wide` — the hole at the front *(2.7)* |
| `bore_mm` | decimal null | the precise twin; `bore_class` derives from it where present |
| `axial_adjust` | enum | `none｜adjustable` — coarse and curated, because Alpha states adjustability and publishes no number *(3.2b)* |
| `accepts_length_min_mm` / `accepts_length_max_mm` | decimal null | the published window — Modern Fuel publishes **89–116 mm**. **Negatives only** |
| `radial_retention` | enum | `fixed｜collet` — no maker publishes a collet's grip range, so this one has no numeric twin |
| `handedness` | enum | `right｜left｜either` — **a browse facet, never a fit axis.** An L vs J bolt path is a different body |

**Not here, deliberately:** `refill_style_id` (it lives on `tip_option` — *F3′*) · `category`
(derived from the refill's `medium` — *3.1*) · `ships_with_refill_id` (moved to `tip_option` —
*C4b*) · a clipless flag (derivable: a pen cannot be clipless when `actuator = clip` — *3.4*).

#### `tip_option`
The pen's **front assembly** — and the thing that actually decides which refill style fits.

| Column | Type | |
|---|---|---|
| `product_id` | bigint fk | per-product, and mandatory even when 1:1 — collapsing it would put `refill_style_id` back on the product |
| `refill_style_id` | bigint fk | 🔑 **the style lives here.** Karas sells the Render K in Parker **and** G2 tips *(F3′)* |
| `name` | string | "G2 Spring & Pen Tip", "Parker nose" |
| `toleranced_for_refill_id` | bigint fk null | design intent — the refill the tip was cut for. **Autmog publishes a 2.5 mm bore ±25 µm** *(2.6)* |
| `axial_adjust` / `accepts_length_min_mm` / `accepts_length_max_mm` | null | **overrides** the product; null = inherit. The Alpha Executive is fixed bare and adjustable with the Parker adapter fitted, so product-only storage makes one configuration always wrong. No `radial_retention` override — no corpus case adds a collet *(3.2b)* |
| `ships_with_refill_id` | bigint fk null | what's in the box — BilletSpin's ships **pre-trimmed**. **Not a design-intent claim**, and **not a free fit positive** — it is the first `fit_check` a curator writes per pen, by hand *(C4b, 4.5)* |

#### `product_variant`
**Surface-only** difference — material, finish, marketing name. The body is unchanged, so this is
not a new product *(3.7)*.

| Column | Type | |
|---|---|---|
| `product_id` | bigint fk | |
| `finisher_maker_id` | bigint fk null | null = the base maker's own work; set for KVR and Dark Pines, who finish **another maker's** stock body |
| `material_id` | bigint fk null | → the committed `materials` table. Was free text, which made *Titanium / titanium / Ti* three things *(C2)* |
| `finish` | string null | "Machined", "Stonewashed", "DLC". **Stays free text** — half vocabulary, half prose |
| `name` | string null | marketing name |
| `one_off` | bool | "no two will be exactly alike". **No `edition_size`** — no maker in the corpus numbers anything |

🔑 **Compat inherits from `product`.** A finisher's variant inherits every fit claim for free; zero
rows are duplicated. **A customizer who changes geometry makes a new `product` and inherits
nothing.**

#### `material`
**Inherited, not designed** — the committed `materials` table, declared so the FK resolves. It is a
table rather than a TS constant for one reason: **its members arrive at runtime**, because makers
keep shipping alloys nobody enumerated *(C2)*.

### 3.2 Refill styles

#### `refill_style`
The physical shape a refill must have to seat in a given pen tip. Flat and disjoint — no nesting,
no overlap; a pen that accepts more than one declares more than one tip option.

| Column | Type | |
|---|---|---|
| `name`, `slug` | string / text unique | ⚠️ **model-level, never brand-level.** `dsm-2006`, not `schmidt` |
| `standard` | string null | "ISO 12757-1:G2", or null when de facto |
| `observance` | enum | `well｜partial｜poor` → *"reliable" / "varies by brand" / "check per pen"* |
| `variance_note` | text null | "D1 has two legal widths"; "the Parker-style front contour changed after 2015" |

🔑 **Granularity is set by `observance`, not by whether a standard exists.** A style is a **prior**,
not an answer. If the nominal predicts fit, keep the style whole and carry deviation as variance;
if it does not, **fragment** to the clusters that do. That is why one ISO family stays a single
style with 50+ conforming refills while the ~110 mm RB space fragments — ISO G2 is observed and ISO RB is
not.

#### `also_known_as`
The other names a style goes by.

| Column | Type | |
|---|---|---|
| `refill_style_id` | bigint fk | |
| `alias` | string | "RB", "Euro", "DIN", "Standard Rollerball", "Pilot G2-style" — all naming one shape |

⚠️ **Aliases are model-level too.** A bare "Signo" spans two different shapes, "Schmidt" spans
five, and **"G2" means both the ISO Parker standard and the Pilot gel refill** — twelve millimetres
apart in length, near-identical in cross-section. That collision is the single most documented
confusion in the domain, which is why the schema keeps a neutral word and quarantines the brand
words here.

### 3.3 Refills

#### `refill`
**The model** — "a Sarasa", never "a blue 0.5 Sarasa" *(5.2)*.

| Column | Type | |
|---|---|---|
| `brand`, `model` | string | |
| `refill_style_id` | bigint fk | |
| `medium` | enum | `ballpoint｜gel｜hybrid｜rollerball｜pressurized｜graphite｜permanent_marker｜highlighter`. **Functional, not cosmetic** — hybrid ink is what broke the Ti2 TechLiner's magnet. Stays at model grain: a gel refill is gel in every colour |
| `rear_topology` | enum | `open｜plugged｜finned｜flanged` — **the only axis in the model**, because it is the only fit fact no measurement can express. ⚠️ **values are still a draft** |
| `form` | enum | `sku｜harvested` — buyable on its own, or you gut a pen for it |

**Not here:** `tip_size`, `colour`. Both were single-valued columns on a row that a real refill
fills with three sizes × twenty colours — **a column whose cardinality contradicts its row's
grain**, and the tell was that both had to be nullable to be writable at all. Moved to
`refill_variant` *(5.2)*.

**Escape hatch:** if a tip size ever turns out to change the physical part, that size becomes **its
own `refill` row** — kept apart until proven identical. The fit corpus never learns about variants.

#### `refill_variant`
**What you actually buy.** The refill-side twin of `product_variant`, for the identical reason:
surface differences that change nothing about fit must never duplicate the assertion corpus.

| Column | Type | |
|---|---|---|
| `refill_id` | bigint fk | ⚠️ needs **`UNIQUE (id, refill_id)`** — see §8 |
| `tip_size` | decimal null | the writing-point width. For `medium = graphite` this is the **lead diameter the mechanism accepts** — the lead itself is a consumable one level below and is not modelled, which is why there is no `hardness` column |
| `colour_name` | text null | the maker's own word — "Vintage Vermillion". **Free text, the full long tail** |
| `colour_family` | enum null | `black｜blue｜blue_black｜red｜green｜other` — **the browse facet.** Two columns because **no code turns "Vintage Vermillion" into `red`**; the bucket has to be curated. Starts coarse and grows |

**Pure catalog leaf: nothing in the fit corpus points here.** That is the property being protected.
No slug, no name, and no item code — `(refill_id, tip_size, colour_name)` is already a natural key.

#### `rebrand`
The branded SKU and the OEM part it actually is. Rebranding is an **industry structure**: **Schmidt** supplies Retro 51, Baron Fig and Diplomat, and
**Premec** advertises white-label manufacture as its business model.

| Column | Type | |
|---|---|---|
| `refill_id` | bigint fk | the branded SKU |
| `oem_refill_id` | bigint fk | what it actually is. Directed |
| `claimed_by` + `citation_url` + `citation_note` | | **attributed, because the mapping is contested in the wild** — Retro 51's REF5P is called a P8127 by one source and a P8126 by two others |

⚠️ **Same part off the same line — never merely the same style.** "Compatible with Parker, Cross,
Montblanc" refills are style-mates and `refill_style` already holds them; admitting them here would
propagate fit claims across genuinely different parts *(C1)*.

#### `refill_dimension`
One named, attributed, sourced number.

| Column | Type | |
|---|---|---|
| `feature` | string | ⚠️ **a bare number is meaningless** — `body_od`, `rear_cap_od`, `step_1_od`. Unsharpen's 6.09 for a Sarasa may be a different *feature* than the 5.94 measured on a Pilot G2 rather than a different number |
| `value`, `unit` | decimal / string | |
| `claimed_by` | enum | **the only trust signal a number has** *(4.4b)* |
| `citation_url`, `citation_note` | text null | |

**Explains, never matches.** These numbers tell a buyer *why* something failed; they never decide
whether it fits. **A bad number is deleted, not annotated** — there is no disputed flag here,
because a disputed *number* is noise, not content.

### 3.4 Assertions — the moat

#### `fit_check`
One curated claim: this refill, in this pen tip (or across this style).

| Column | Type | |
|---|---|---|
| `refill_id` | bigint fk | |
| `tip_option_id` | bigint fk null | **scoped, most specific wins:** tip > style. One row can say *"this refill doesn't drop into any G2 pen"* (a fact about the refill) or *"EnerGel works across the style **except** the Ti2 TechLiner"*. Neither is expressible at the other grain *(2.5)* |
| `refill_style_id` | bigint fk null | |
| `polarity` | enum | `positive｜negative`. **Negatives are first-class and are seeded first** |
| `reason` | text null | **required when negative** |
| `fit_quality` | enum null | `toleranced｜snug｜loose`. Null on a declared row — nobody seated anything, so any value would be invented |
| `trim_mm` | decimal null | always captured; display deferred |
| `trim_reference` | string null | **reference beats amount** — *"trim to Parker ballpoint length"* survives a change of pen, *"trim 2 mm"* does not. The real range is 1–13 mm |
| `trim_necessity` | enum | `required｜recommended｜optional`, shared with `part_needed`. **Curated, never derived** — inferring it from a length window would be geometry producing a positive |
| `functional_warning` | bool | fits, and you shouldn't |
| `claimed_by` | enum | `maker｜retailer｜community｜owner｜staff`. ⚠️ **it labels, it never ranks** |
| `evidence` | enum | `declared｜tested` — **did anyone physically seat this?** Magnus's blanket *"as long as your refill is in the style below, it will fit!"* and Tactile Turn's list with per-refill trim amounts look identical on the page and are not the same claim. **Nothing clears it**; a contradiction is a new row |
| `citation_url`, `citation_note` | text null | |
| `disputed_note` | text null | **the staff override**, for maker copy that is a typo or a copy-paste. Non-null is the flag. **A claim about the citation, not about the pen.** Excluded from the verdict, **still rendered** |

**`fit_check` is mutable curated state; `fit_report` is the append-only log.** That is why there is
no `retracted_at` and no soft delete — a retraction is an edit or a delete.

#### `fit_report`
A user's *"I put this in my pen and here's what happened"*. Not a claim — an observation awaiting
review.

| Column | Type | |
|---|---|---|
| `refill_id`, `tip_option_id` | bigint fk | **always concrete** — a person owns one pen, so a report names a tip. A `fit_check` may be style-scoped; a report never is |
| `fits` | bool | the one thing a submitter can reliably state. Not "works" (collides with `functional_warning`), not "polarity" (jargon has no place on a form) |
| `note` | text null | free text, because reports arrive as prose. Fit quality, trims and parts are the **editor's** job at promotion |
| `review_state` | enum | `pending｜approved｜rejected`. **Nothing renders until approved** — an unapproved report has no buyer read path at all. Rejected rows are **kept**: so they are not re-reviewed, and because a pattern of rejections is itself signal |
| `fit_id` | bigint fk null | set when folded into a curated claim. **N reports → 1 `fit_check`**, which preserves the count |

#### `part`
A physical component — and the same row serves two jobs.

| Column | Type | |
|---|---|---|
| `maker_id` | bigint fk null | null = generic / third-party |
| `family_id` | bigint fk null | null = maker-wide. **Never a product-id list** |
| `kind` | enum | `clip｜bolt｜bolt_handle｜top_cap｜spring｜o_ring｜spacer｜adapter`. Global and coarse; brand words are an alias map. **Out:** `tip` (that is a `tip_option`) and `grip` (that is milling, i.e. a finish) |
| `name` | string | |
| `made_by` | enum | `oem｜aftermarket｜community` |

🔑 **Being a purchase option vs a fit-required part is not a column — it is which join points
here.** Maker+family scoping makes it an option; `part_needed` makes it required. One spring is
both, from one row *(S1)*.

#### `part_needed`
Which part a fit requires, and how you get it. *(link table)*

| Column | Type | |
|---|---|---|
| `fit_id`, `part_id` | bigint fk | |
| `sourcing` | enum | `included_with_pen｜included_with_refill｜purchase_separately`. Fisher's adapter ships with the **refill**; Karas' Retrakt spacer ships with the **pen** — same kind, opposite answer, and it is the difference between "drops in" and "buy something" |
| `necessity` | enum | ⚠️ **lives on the link, not on the part.** The same spring is *required* for one refill and merely *not optimal* for another. Necessity is a fact about the pairing |

> **"Drops in unmodified"** = `(trim_mm IS NULL OR trim_necessity != 'required')` **and** no
> required part you don't already own.

#### `style_adapter`
A part that makes a refill of style A seat in a pen built for style B.

| Column | Type | |
|---|---|---|
| `part_id` | bigint fk | |
| `from_style_id`, `to_style_id` | bigint fk | **directed** — the reverse is a separate row and is not automatic |
| `result_quality` | enum null | null when the adapter is adjustable |
| `scope_tip_option_id` | bigint fk null | null = style-wide; Tactile Turn's Parker adapter is **Standard-only** |

⚠️ **Declared, never computed.** The Fisher PR at 89 mm plus its 10 mm adapter reads as 99 mm,
which arithmetic calls in-band for Parker — and the real refill wiggles at the tip.

### 3.5 Collection

#### `user`
**Inherited** — the committed `users` table, declared here only so the collection's FK resolves.

| Column | Type | |
|---|---|---|
| `clerk_id` | text unique | Clerk owns the identity; this row is deliberately minimal |

#### `collection_item`
A pen you own: a finish, a pen tip, and whatever refill is in it. **Not a wishlist and not an
inventory** *(5.3a)*.

| Column | Type | |
|---|---|---|
| `user_id` | bigint fk | |
| `product_variant_id` | bigint fk | points at the **finish**, not the product — what you own is a specific object |
| `tip_option_id` | bigint fk | |
| `installed_refill_id` | bigint fk null | **the model.** Always recordable, and the column every read path uses |
| `installed_refill_variant_id` | bigint fk null | **the exact one** — size and colour — optional. Coarse + precise, the shape this schema runs five times. **One picker, not two:** choosing the exact one fills the model column *(5.3b)* |

**This row stores zero specs.** Every spec reads through to the catalog and is therefore always
current.

🔑 **It is the `fit_report` entry point.** A report must name a pen tip; a saved pen already does —
*"pick your setup, tell us if it fits."*

#### `part_fitted`
Which parts are on your pen — the bronze clip, the copper back piece. *(link table)*

| Column | Type | |
|---|---|---|
| `collection_item_id` | bigint fk | |
| `part_id` | bigint fk | evidence it is real: Tactile Turn sells the Bolt Action Back Piece alone in Titanium, Copper, Bronze and Zirconium and says materials can be **mixed and matched**, matching only the diameter — which is `part.family_id` |

⚠️ **Looks, not fits.** Parts that change how the pen **looks** are the owner's choice and belong
here. Parts that change how it **fits** are not a choice — the refill dictated them and
`part_needed` already holds them. `part.kind` is the test. A functional part recorded here would
put a configuration into a report that the named `tip_option` does not describe.

---

## 4. Derived — deliberately not stored

**Eleven demotions.** Most were enums that mixed orthogonal axes. Each is cheaper computed than
curated, and none can drift. **Check this list before adding any column.**

| Thing | Derived from |
|---|---|
| `archetype` (hyper-specific / semi-general / clamped / near-standard) | the style count on the fit set + `radial_retention` / `axial_adjust` |
| "adjustable" | `axial_adjust`, refined by `accepts_length_*` |
| "can this pen be clipless?" | `actuator = clip` → no |
| the five-grade fit ladder | `fit_quality` × has-trim × has-required-part |
| `category` (ballpoint / gel / rollerball) | the installed refill's `medium` |
| rear-topology negatives | `refill.rear_topology` × what the mechanism requires |
| `bore_class` where `bore_mm` exists | `bore_mm` |
| corroboration — "9 of 11 owners agree" | count over approved `fit_report` rows |
| **the fit verdict** | the rule below |
| the displayed measurement | `claimed_by = staff` if present, else every row with its citation |
| coverage — "how well checked is this pen" | `COUNT(fit_check)`. Declined pre-emptively |

### The verdict rule

What a buyer is told about one refill × one pen, computed from the `fit_check` set:

| Step | Rule |
|---|---|
| **−1** | expand to the refill **plus its rebrand partners** — one hop, no chains. Propagated rows render **labelled**: *"via Schmidt P8126"* |
| **0** | drop every row with a `disputed_note` |
| **1** | scope: most specific wins — tip > style |
| **2** | `evidence`: `tested` > `declared`. **`claimed_by` labels; it never ranks** |
| **3** | still tied and opposite → **no verdict.** "Sources disagree", both shown, both cited |

**Four display states:** *agree* · *split by evidence* (the tested row wins; the declared row
renders as a named, cited **counterclaim**, not a footnote) · *unresolved* · and **prior only** —
zero fit rows, which renders `refill_style` + `observance` and **must never read as a negative**.
That fourth state carries the cold start and at launch it is **the most common one**.

Ranking by *who* is what the evidence disproved: **Bastion** declares Parker and rejects some Parker
refills, and authority-ranking gets it exactly backwards.

---

## 5. Rules enforced by convention, not by the schema

State these in review and in the app; they are not DDL.

1. **Citation required** when `claimed_by` is `maker` or `community`. An untraceable community claim
   is indistinguishable from an invention. `owner` needs none (it has a report); `staff` needs none.
2. **A disputed row requires a note.**
3. **`part_fitted` is cosmetic parts only** — `part.kind` is the test.
4. **The completeness gate:** a pen can be **owned** only when it has a maker, a product, a finish,
   a pen tip, and that tip declares a refill style. No flag needed — the required FKs say it. A pen
   we lack routes to a **submission** *(not modelled — see §9)*.
5. **The catalog pre-fills a saved pen, and the values are written at save time, never resolved on
   read.** Otherwise the day a curator corrects what a pen ships with, every saved pen silently
   changes what is loaded in it. Fill what the catalog makes unambiguous; **ask only where it
   branches** — one tip option, fill it; more than one, ask once.
6. **Never write a bare "tip" in buyer copy.** *"Pen tip"* = the assembly, *"tip size"* = the
   writing point, *"tip opening"* = the bore. A bare "tip" is a copy bug.

---

## 6. What was rejected, and why

**Ten enum designs that mixed two orthogonal axes** — the last five caught *before* being built.
This is the model's most repeated failure mode; assume the next one is yours.

| | Rejected | Because it mixed |
|---|---|---|
| 1 | `archetype` | permissiveness × retention mechanism × declared-vs-actual gap |
| 2 | the five-grade fit ladder | quality × modification × parts |
| 3 | `category` on the product | the pen × what's loaded in it |
| 4 | `adapter` as a need | a part × a style change |
| 5 | `action` | `advance_mechanism` × `actuator` — `side_click` carried both from the start |
| 6 | `verified bool` | what backs the claim × has an editor vetted the row |
| 7 | routing a staff override through `polarity`/`evidence` | does it fit × is this source trustworthy here |
| 8 | letting `rebrand` mean *same style* | same part × same shape |
| 9 | one `colour` column | what the maker calls it × what bucket it filters into |
| 10 | a tip's alloy on `tip_option` | which style it takes × which one you bought |

**Two further defect classes, each seen once:**

- **A derived field whose input got demoted with it.** "Clamped" sat in the derived list with
  nothing able to compute it. Fixed by storing `radial_retention` + `axial_adjust`. **Worth
  auditing the other derivations for the same failure as each is implemented.**
- **A column whose cardinality contradicts its row's grain.** `tip_size` and `colour` on `refill`.
  **The tell was that both had to be nullable to be writable at all** — worth checking any other
  nullable column that exists only because the row is coarser than the fact.

**And there is no `needs` vocabulary.** It started at five values and landed at **zero**, because
every candidate decomposed: adapter and spacer are **parts**; a spring swap ships as one SKU with
the tip, so it is a **different pen tip**; a socket conversion by snapping a refill is a **trim**;
tape to stop rattling is not a need at all but a **loose fit**; and drilling modifies the pen, so it
is out of scope. **The vocabulary closes on a principle, which is why the next candidate is testable
rather than debatable.**

---

## 7. Two patterns worth knowing

**A general claim plus scoped exceptions, most specific wins** — the spine of the schema, at
**five** grains: `fit_check` scoping (tip > style) · base compat list vs variant exceptions ·
style-wide vs pen-scoped adapters · maker-wide vs family-scoped parts · product-wide retention vs
tip-option override.

**Identity vs purchase option** — a parent row is the **thing**, a child is **which one you buy**;
surface differences that change nothing about fit, held apart so they cannot duplicate the
assertion corpus. Two instances: `product` / `product_variant` and `refill` / `refill_variant`.

⚠️ **If a column on either child ever needs to be read by a fit query, the split was drawn in the
wrong place.**

---

## 7b. Schema name → buyer-facing label

The diagrams use buyer words; this document uses schema names. **This is the map**, and without it
the two cannot be read side by side. Renaming happened once, on 2026-08-12, under one test: *could
someone shopping for a pen say this name out loud and mean roughly the right thing?*

| Schema | Buyer label | Note |
|---|---|---|
| `product` | **pen** | |
| `product_family` | **pen size** | qualify it — never a bare "size" |
| `product_variant` | **pen finish** | |
| `tip_option` | **pen tip** (`tip` in diagrams) | ⚠️ a bare "tip" is a copy bug |
| `refill_style` | **refill style** | the market's own words for this are all **brand names** — which is why the schema keeps a neutral one |
| `also_known_as` | **also known as** | |
| `rebrand` | **also sold as** | reads correctly in both directions, unlike the directed schema link |
| `refill_variant` | **refill option** | |
| `refill_dimension` | **measurement** | |
| `fit_check` | **fit check** | not "refill fit" — rows hold **negatives**, and "fit" alone implies every row is a yes |
| `fit_report` | **report** ("Does it fit? Tell us") | |
| `part_needed` | **part needed** | |
| `style_adapter` | **style adapter** | call it an adapter, **never a converter** — that word means a fountain-pen filler |
| `collection_item` | **my pen** | |
| `part_fitted` | **parts fitted** | |
| `medium` | **ink / lead type** | "ink type" would be *wrong* — pencil and marker are in scope |
| `tip_size` | **tip size**, but **"lead size"** for graphite | one column, two labels, switched on `medium` |
| `colour_name` / `colour_family` | **ink colour** / **colour** | |
| `bore_class` / `bore_mm` | **tip opening** | |
| `axial_adjust`, `accepts_length_*` | **adjustable length**, **fits refill length** | |
| `radial_retention` | **refill grip** | "collet" is genuine market vocabulary |
| `observance` | **interchangeability** | |
| `polarity` | *(never shown)* — the buyer sees **Fits / Doesn't fit** | |
| `evidence` | **Tested** / **Says it fits** | |
| `claimed_by` | **claimed by** | `staff` renders "Tested by us" |
| `citation_url` / `citation_note` | **Source** | 🔑 the buyer's own word for this is "source", which is exactly why the schema must not spend `source` on anything else |
| `disputed_note` | **Disputed by us** | |
| `functional_warning` | **Works, but not advised** | |
| `form` | **availability** | |
| `made_by` | **made by** | |
| `sourcing` | **how to get it** | |

**Nine of these concepts have no market word at all** — `rear_topology`, `observance`,
`functional_warning`, `form = harvested`, `actuator`, `polarity`, `fit_quality`, `evidence` and
`disputed_note`. That is nearly half the high-value vocabulary, and it is the strongest evidence
that this is a real gap rather than a crowded space. Three of them share a cause: **retail's
incentive is to sell the pen**, so it has no words for *doesn't fit*, *fits but don't*, or *the
maker is wrong*.

---

## 8. Implementation notes

Things that are easy to get wrong at the keyboard and are not visible in a diagram.

1. **The saved pen's two refill columns must not be able to disagree.** `refill_variant` needs
   **`UNIQUE (id, refill_id)`**; `collection_item` takes a **two-column FK**
   `(installed_refill_variant_id, installed_refill_id) → refill_variant (id, refill_id)` **plus**
   `CHECK (installed_refill_variant_id IS NULL OR installed_refill_id IS NOT NULL)`.
   ⚠️ **`MATCH FULL` would be wrong** — it forbids the model-only row the design exists for.
2. **Growing an enum costs a TS edit *and* a generated migration** — every domain vocabulary is
   `as const` → `pgEnum` at the column. `ALTER TYPE ADD VALUE` is cheap; **removing a value is
   not** — which is what makes *"start coarse and grow"* the right counsel.
3. **`material` and `user` are inherited**, not designed. Do not re-model them.
4. **`mechanisms` and `product_types` in the committed schema are scraper staging** — interned from
   scraped strings, not corrected, and not used by this model. A scraped *"click"* has to become
   `advance_mechanism = ratchet` **and** `actuator = top_button`, and it does not determine them —
   so promotion is judgment, not a lookup.
5. **Storage is relational, never `jsonb`.** The repo reserves `jsonb` for scraper output; curated
   data is the moat.

---

## 9. Known gaps

Full register with triggers and blockers: [`open-items.md`](./open-items.md). The three that matter
most:

1. 🔴 **Measurement round 1** — the ~110 mm refill styles are deliberately **unnamed** pending real
   caliper numbers, and `tip_option.refill_style_id` is required, so **no pen in that space can
   enter the catalog at all** until it lands.
2. 🔴 **Autmog's published 2.5 mm** — tip aperture or body bore? Rule 3's geometry negative
   cannot fire on that maker until it is settled.
3. ⚪️ **The submission path** is not modelled, deliberately. When it is built it should reuse
   `fit_report`'s shape — `pending｜approved｜rejected`, rejected rows kept — rather than invent a
   second one.

---

## 10. Where this model changed its mind

Eight conclusions reversed on evidence. They are listed because **each one is now settled and the
argument is in the archive** — if you are tempted to re-open one, read that first.

| Reversed | What changed it |
|---|---|
| *"D1's two legal widths vindicate keeping the ~110 mm space whole"* | Wrong: D1's nominal **is** observed, RB's is not. The precedent supports D1 and implies nothing about RB. The question **dissolved** rather than being answered |
| *"Fit has four or five independent axes"* — proposed off published sources | Applying the test killed all but one. Those sources list what **varies**, not what needs modelling apart from measurement |
| *"The committed schema stores vocabularies as tables, so ours should too"* | **The repo disproved it.** Those tables are the scraper's string-interning, and serve only staging |
| *"The committed schema already made two modelling mistakes we must not inherit"* | **Both were misreadings.** A scraped `"click"` is a *quote from a maker's page*, not a modelling claim |
| `tip_size` and `colour` on `refill` | Sat in the ERD **for three sittings** before anyone noticed a single-valued column on a row that a real refill fills with 3 sizes × 20 colours |
| *"The saved pen should name the refill model only, because the variant catalogue will be thin"* | **Research killed it in one pass** — all three makers checked publish a complete size × colour matrix, and the code printed on the refill already names the size |
| *"Two identical collection rows mean two identical pens"* | Wrong: what separates two copies is usually a **finish or a small part**, neither of which the row could record. That is why `part_fitted` exists |
| *"A copper pen tip forces a `tip_variant` entity"* | **Withdrawn after research** — no maker sells a tip alone by alloy; one machines the tip and body together. The case resolved into rows that already existed |

Two patterns worth noticing: **the answer changed most often when someone checked a claim against
the outside world**, and **twice the right move was to dissolve a question rather than answer it.**

---

## Appendix A — primary data

**Not reasoning. Measured or transcribed, and expensive to re-create.**

### A1 · Pilot G2 (BLS-G2), from a dimensioned drawing

| Feature | in | **mm** |
|---|---|---|
| Overall length | 4.346″ | **110.39** |
| Rear cap OD × thickness | 0.237″ × 0.050″ | **6.02 × 1.27** |
| Body OD | 0.234″ | **5.94** |
| Body run (rear → step 1) | 3.573″ | **90.75** |
| Step 1 / step 2 / tip OD | 0.179″ / 0.124″ / 0.097″ | **4.55 / 3.15 / 2.46** |
| Front cone assembly | 0.773″ | **19.63** |
| Spring OD / free / compressed | 0.218″ / 0.75″ / 0.25″ | **5.54 / 19.05 / 6.35** |

Internally consistent: 3.573 + 0.185 + 0.229 + 0.229 + 0.130 = 4.346.

### A2 · ISO 12757 tolerance bands, mm — from the standard (not freely available, ~$65)

**Type G2** (= Parker-style): a overall length 98,1 +0,40/−0,35 → **97.75–98.50** · b rear Ø
**5.80–6.10** · c tip Ø **2.50–2.57** · d tip length 6.00–6.40 · e front section 22.20–24.20 ·
f body Ø **5.70–5.90** · g cone Ø 2.30–2.50 · h rear feature 0.40–0.80.

**Type G1:** a 106,8 ± 0,2 · b 3,2 0/−0,05 · c 1,6 ± 0,02 · d 7,5 +0,5/0 · e 30,5 ± 0,25 ·
f 5 ± 0,05 · g 3,3 0/−0,1 · h 13,8 ± 0,5. Structurally different — the rear Ø is **narrower** than
the body with a long tail, the opposite of G2's rear flange.

⚠️ **A refill at 99 mm is out of spec, not at the edge of it.** The band is 0.75 mm wide. The
correct reading is not *"the standard is loose"* but **"the standard is tight and some refills sold
as Parker-style don't conform."**

**Pilot G2 vs ISO G2:** they differ **almost entirely in length** — +12.3 mm, while every diameter
sits within ~0.05 mm and the rear Ø is dead inside the band. The collision is geometric, not merely
linguistic: they genuinely look like the same part.

### A3 · ISO types with published dimensions

| Type | Length | Ø | Notes |
|---|---|---|---|
| D1 | 67 mm | **2.1 or 2.35** | two legal widths |
| A2 (≈ G1) | 106.8 mm | 3.2 | obsolete |
| B3 | 128 mm | — | |
| C1 | 117 mm | 3.05 | screw-type |
| G2 (Parker) | 98 mm | 6 max, 2.5 max at tip | |
| X10 / X20 | ~106.8 / 107 mm | 3.05 / — | separate on tip Ø alone |
| **RB** | 110 mm | **6.3** | **poorly observed — see A4** |
| Fisher PR | 90 mm | 4.8 | front + spring shoulder match G2 exactly |
| Pilot BRF | 87 mm | 6.0 | proprietary |
| Schmidt P8126 / 8120 | 97.6 / ~110 mm | — / 6.81 | |

### A4 · The ~110 mm space — measured spread against a 6.3 mm nominal

**5.94** (Pilot G2, drawing) · **6.09** (Sarasa) · **6.81** (Schmidt 8120). A 0.87 mm spread, none
on nominal. **This is why that space fragments and Parker-style does not.**

### A5 · Refill catalogues are published and complete, per maker

Verified on three makers' own sites: full tip-size × colour matrices, **ragged** — colours do not
survive a size change (uni's UMR-85N ships four colours at 0.5 mm while UMR-85E ships black
only, and Pentel's EnerGel runs 5 colours at 0.4 mm and 15 at 0.5 mm). **The matrix must be stored as rows, never generated.**
Tip size is encoded in the maker's item code; **colour is a suffix**.

### A6 · Who publishes fit data

**~13–15 makers publish a usable refill or compatibility list; ~8–10 are deep enough to seed from.**
The best-shaped sources publish per-length lists **with trim amounts in millimetres**, or an
accept-list that differs per body. One publishes an ~800-row sheet at SKU grain. Several publish a
list *with a required part*. Two directed `style_adapter` rows are sourced and ready.

---

## Appendix B — decision index

One line each, for anyone wondering *"was this considered?"* Full argument in the archive.

**Findings.** F3′ style is a property of the configured body, not the maker · F5 the gap between
maker charts and reality is the product · F6 never infer fit from dimensions.

**Sitting 1 — styles.** Keep buyer-facing names · flat and disjoint, many-to-many · keep near-miss
styles apart until proven identical · granularity set by observance.

**Sitting 2 — fit vocabulary.** 2.1 a trim spec + required parts, not a `needs` enum · 2.3 amount
*and* reference, both nullable · 2.4 exactly one axis · 2.5 scoped negatives, most specific wins ·
2.6 `fit_quality` carries radial slop · 2.7 `bore_mm`, negatives only.

**Sitting 3 — identity.** 3.1 category derived · 3.2 family scopes parts only · 3.2b tip-option
overrides · 3.3 `part` merged with slot options · 3.4 clipless derived · 3.5 mechanism split from
actuator · 3.6 inheritance + exceptions · 3.7 surface variants inherit compat.

**Sitting 4 — curation.** 4.1 `evidence` replaces `verified`; `fit_report` gates on review ·
4.1b nothing renders until approved · 4.3 `source` split three ways · 4.4 the verdict is derived;
`disputed_note` is the staff override · 4.4b no disputed note on a measurement; a bad number is
deleted · 4.5 two corpora, seeded negatives-first.

**Sitting 5 — refills, collection, launch.** 5.1 five browse facets at two grains · 5.2 `refill` is
a model; `refill_variant` holds size and colour; colour splits in two · 5.3a a saved config is a pen
you own · 5.3b the collection names both the model and the exact one · 5.4 multiples are separate
rows, plus `part_fitted` · 5.5 a field, not a log · 5.6 the front door is a lookup · 5.6a the
completeness gate · 5.7 pens plus refill pages · 5.8 launch size deferred as a non-schema question.

**Carried structural items.** C1 `rebrand`, attributed · C2 a vocabulary is a table only when its
members arrive at runtime · C3 the scraper's staging tables are not ours to model · C4a `retailer`
is the fifth `claimed_by` value · C4b what ships in the box belongs to the tip option.
