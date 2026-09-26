# Vocabulary lexicon — internal schema → buyer-facing label

**Written 2026-08-12.** Answers `.notes/vocabulary-research-prompt.md`. This is a *naming* thread,
not the data-model interview. **Nothing here advances Sittings 4–5.** Two things were applied to
`.notes/data-model-erd.md`: the **house-style patch** (§5.1) and **five renames** under the naming
law (§0.1). Everything else is *proposed and stopped*.

Read for rationale, in this order: `.notes/data-model-answers.md` (source of truth, has a
▶ RESUME HERE block) → `.notes/data-model-erd.md` (annotated, `//` comments carry decision
numbers) → `.notes/data-model-erd-clean.eraser` (the pastable artifact).

---

## §0. THE NAMING LAW — standing rule, ratified 2026-08-12

**Applies to every new entity, column and enum value from here on.** Mirrored as rule 6 in
`.notes/data-model-erd.md`. This file is the authority; add new decided vocabulary here in the
same sitting it lands.

> **The test: could someone shopping for a pen say this name out loud and mean roughly the right
> thing?** If no, it is the wrong name.

Apply it **when the name is created.** A rename later costs cross-references across the ERD, the
answers file's numbered decisions, and any code already written — which is exactly the bill this
thread had to pay.

**Banned**

| Ban | Why | Example |
|---|---|---|
| Jargon from another domain | Reads as something else entirely | `socket` (electrical), `edge`/`node` (graph theory), `bridge`, `topology` |
| Compound schema nouns where a plain one exists | Two jargon words is worse than one | `edge_required_part` → `part_needed` |
| Brand-anchored market words as identifiers | Every market word for refill shape is a brand name, and "G2" is documented confusion | not `parker_style`; use `refill_style` + `also_known_as` |

**Exempt — keep the technical word when the plain word is *also* wrong**

- `advance_mechanism` — JetPens' own facet reads `LEAD ADVANCE MECHANISM`.
- `medium` — "ink type" is **wrong**; graphite and marker are in scope.
- `polarity`, `observance`, `fit_quality`, `rear_topology`, `form` — **the market has no word at
  all** (§3). Precise-and-invented beats borrowed-and-wrong. Teach it in the UI instead.

**Three traps the rule must not cause**

1. **Never collapse a distinction for a shorter name.** `advance_mechanism` vs `actuator` were
   split because `side_click` carried two facts in one value. Merging them is a regression.
2. **Never let a plain name overclaim.** `compat_edge` → `fit_check`, *not* `refill_fit` — rows
   hold negatives, and "fit" alone implies every row is a yes.
3. **When two things share a market word, qualify both.** Do not rename one into a second
   unsettled word. "Tip" = the pen's front assembly *and* the refill's writing point; resolved by
   copy discipline ("pen tip" / "tip size" / "tip opening") after `nose_option` was rejected.

**Decided so far:** the five renames in §0.1 below, plus the display mappings in §2 and the entity
headers in §3b.

### §0.1 Applied to the schema of record, 2026-08-12

| Was | Now | Failed on |
|---|---|---|
| `socket` | **`refill_style`** | Domain jargon — reads as electrical |
| `socket_alias` | **`also_known_as`** | Compound jargon |
| `compat_edge` | **`fit_check`** | "Edge" is graph theory |
| `edge_required_part` | **`part_needed`** | Compound jargon, doubled |
| `socket_bridge` | **`style_adapter`** | "Bridge" is unguessable; "adapter" is the market's own word |

FKs followed: `socket_id` → `refill_style_id` · `edge_id` → `fit_id` ·
`from_socket_id`/`to_socket_id` → `from_style_id`/`to_style_id`.

⚠️ **`.notes/data-model-answers.md` was deliberately NOT rewritten.** Decisions 2.5, F3′, 3.6 and
Sitting 3 (c′) still say "socket". The audit trail is worth more than the consistency — read it
through the map above.

**Left alone on purpose:** `tip_option` (trap 3), `product`, `product_family`, `product_variant`,
`collection_item`, `refill_dimension` — all guessable. Their buyer labels live in §3b.

### §0.2 Applied 2026-08-12 — the `source` collision, decision 4.3

🔑 **A live instance of trap 3, caught in our own schema.** `source` had come to mean **three
different things** across three tables — the exact defect the naming law exists to prevent, and
the first one found *after* the law was ratified.

| Was | Now | Meant |
|---|---|---|
| `fit_check.source` | **`claimed_by`** enum | *who asserts this* — `maker \| retailer \| community \| owner \| staff` |
| `part.source` | **`made_by`** enum | *who manufactured it* — `oem \| aftermarket \| community` |
| `refill_dimension.source` string | **`citation_url` + `citation_note`** | *where the number came from* |

**The public views had already drafted `claimed_by` and `made_by` as display labels** — so the
right names existed before the collision was noticed. Promoting them is the same move §0.1 made.
`refill_dimension` converts to the **one citation shape** now shared with `fit_check`.

🔑 **4.4b completed the third row.** Splitting `source` left `refill_dimension` able to say
*where a number came from* but not *whose number it is* — so BVG's own caliper readings were
indistinguishable from an untraced web figure. **`claimed_by` was added there too, the same enum
reused whole**, making `claimed_by` + `citation_url` + `citation_note` **one attribution shape**
on both tables that carry outside assertions. Chosen explicitly, unlike the opt-out below.
**`measured_by` was rejected as an overclaim** — nobody measured a maker's spec sheet, which is
the same trap `evidence` exists to avoid. ✅ **CLOSED 2026-08-13, decision C4a — a fifth value,
`retailer`.** A retail listing reprinting a spec is neither: folding it into `maker` **overclaims**
(it renders *"the maker says 5.8"* when Fisher may never have published 5.8 — and a reprint is
exactly where 4.4's *"typo or copy-paste"* enters), while folding it into `community` collapses the
enthusiast-with-calipers into the shop-with-a-spec-sheet. On `refill_dimension` that distinction is
**the only trust signal there is**, because 4.4b deliberately kept `evidence` off that table.

**Why "source" could not simply be kept for one of the three:** it is the *buyer's* word for the
citation (*"Source: Unsharpen ↗"*). Spending it on the category would have made the plainest word
in the set unavailable where a buyer actually reads it.

⚠️ ~~Applied on opt-out, not on a chosen letter~~ — offered as "I'd do it; say if you'd rather
not", and BVG answered the citation fork. ✅ **RATIFIED 2026-08-13** as sweep item S3, alongside
3.2b's tip-option override (S2) and the `slot_option` → `part` merge (S1). All three were already
applied; the sweep changed no schema. **Zero soft decisions remain in the model.**

---

## RECOMMENDATION — ratified 2026-08-12

**(C): rename where the internal name fails the naming law; map everything else.**

**The route mattered and is worth recording, because it ended somewhere other than it started.**
Proposed as a narrow (C) resting on one rename, `tip_option` → `nose_option`. That rename was
**rejected** — collapsing the answer to (A). Then, reading the rendered diagram, BVG identified
**five different names** that fail on their own merits, and those were renamed instead. So the
final answer is (C) after all, reached through the opposite door: not the name I argued for, and
five names I had originally proposed only as display labels.

The lesson is now the standing rule in §0 — **apply the plain-name test when a name is created**,
because every one of these renames cost cross-references that would have been free on day one.

- **Rename only what fails §0's test.** Five did (§0.1). The rest keep their schema names, and
  the display lexicon in §2 carries the buyer's words for them.
- **`tip_option` → `nose_option` — REJECTED (BVG, 2026-08-12). `tip` stays, everywhere.** Asked
  twice and declined twice: first on cost, then on the word itself — *"I don't want nose, tip is
  still better."* The public views now say **`tip`** (shortened from `tip_option`, not renamed).
  Closed, not parked.

**The residual "tip" ambiguity is accepted, and must be managed in copy.** "Tip" now carries two
meanings inside one model — `tip_option` is the *pen's front assembly*, `tip_size` is the
*refill's writing point* — and JetPens facets refills by `TIP SIZE`/`TIP TYPE` in the second
sense. The mitigation is a **house copy rule, not a schema rule**:

> **Never write a bare "tip" in buyer-facing copy.** Always qualify: **"pen tip"** for the
> assembly, **"tip size"** for the writing point, **"tip opening"** for the bore.

If that rule ever proves unenforceable in the UI, `pen_tip` is the cheap escape hatch — it keeps
BVG's preferred word and removes the collision. Not proposed now.

- **Weaker candidates, NOT recommended for now:** `observance` → `adherence`, `form` →
  `availability`. Both are obscure, neither is *wrong*, and each rename costs more `//`
  cross-references than it buys.

### Why not (B) — and a correction to how I first argued it

(B) means adopting the **market's own words** as identifiers. That still fails, because the
market's words for a refill's shape are **brand names**: JetPens notes the Parker-style refill is
*"officially known as the G2 refill, but most people call it Parker-style due to its close
association with Parker Ballpoint Pens and to avoid confusion with the popular Pilot G2 Refill,
which is a completely different shape."* Unsharpen, on the same collision: *"This has caused
endless amount of confusion with pen refill buyers over the years."* An identifier like
`parker_style` or `g2` would bake that in. **That argument stands.**

⚠️ **But my original phrasing overstated it.** I wrote that renaming `socket` → `refill_style`
"would import that ambiguity into the schema layer," and used it to conclude "`socket` stays."
That conflated two different things: adopting a **brand** word (`parker_style` — genuinely bad)
with adopting the **generic** noun (`refill_style` — fine, and plainer). `refill_style` is not
brand-anchored; it is the neutral category word, with the brand names quarantined in
`also_known_as`. `socket` was never protected by the anti-brand rule — only by inertia.

That is why §0.1 renames it. The anti-brand principle and the plain-name rule agree here; they
only appeared to conflict because I stated the first one too broadly.

### Why the mapping half is nearly free here

This repo already ships the mechanism a display lexicon needs.
`packages/database/src/schema/descriptions.ts` gives every table and every column a `description`
and an `example`; `pnpm --filter @package/database db:generate:docs` renders them into
`docs/database-schema/*.md` with **Description** and **Example** columns. §2 below is authored so
its definitions transplant into that file verbatim. A display lexicon is not a new artifact type
in this codebase — it is an existing, generated one.

---

## 1. The four false friends, settled

| Trap | What the market does | What we do |
|---|---|---|
| **"refill type"** | JetPens' facet `REFILL TYPE` on the *Parker Style Refills* category means **the ink** (values: Ballpoint, Gel Ink). The *shape* is not a facet at all — it is the category you are standing in. | `medium` = ink/lead. `socket` = shape. Never label either one "refill type". |
| **"tip"** | JetPens facets refills by `TIP SIZE` and `TIP TYPE` = **the writing point**. Tactile Turn's *"needs enlarged tip hole"* = **the pen's opening**. Modern Fuel sells a *"Step Nose"*; BilletSpin a *"Soul Pen Nose Cap"*. | **The one false friend we chose to live with.** `tip_option` stays (BVG, 2026-08-12). Disambiguated by qualifier, never by rename: **"pen tip"** = the assembly · **"tip size"** = the writing point · **"tip opening"** = the bore. A bare "tip" is a copy bug. |
| **"standard" vs "format"** | Real ISO specs exist (DIN ISO 12757, 12757-1:2017, 12757-2) and Schmidt cites them. But Unsharpen on the G2: *"it's no more standard than anything else in this section."* | `standard` stays a **nullable citation field** — populated only when an actual spec applies, null when de facto. `observance` records how well reality tracks it. |
| **"size"** | Schmidt: *"in the large capacity refill size **G2** and the **D style** as per the standard DIN ISO 12757"* — "size" and "style" used for the same axis in one sentence. JetPens sorts proprietary refills by length ("8.9 cm: Zebra F-Refills"). Ti2 sizes *pens* ("Regular and Shorty length"). | Never use bare "size". Always qualify: **tip size**, **refill length**, **tip opening**, **pen size**. |

**Bonus trap, found in research:** an **adapter** and a **converter** are not the same thing.
Fisher ships *"a plastic adapter"* with the PR refill; Unsharpen calls that same piece a
"converter". But in pen vocabulary at large, a *converter* is a fountain-pen **filling device**.
Use **adapter** everywhere. Never "converter".

---

## 2. The lexicon

Recommended labels are what a buyer sees. **No internal name changes** — every row below is a
display mapping, and the schema of record is untouched.

### 2.1 The crux — `socket`

| | |
|---|---|
| **Internal** | `socket` |
| **Buyer label** | **Refill style** |
| **Definition** | The physical shape a refill must have to seat in a given pen tip. Model-level, never brand-level. |
| **Recommendation** | **Keep `socket`.** Label it "refill style" in every buyer-facing surface. |

**Candidates, who uses each, how settled:**

| Candidate | Who | Settled? | Risk |
|---|---|---|---|
| **style** | JetPens (*"refill styles"*, *"the most common refill styles"*); Well-Appointed Desk (*"Parker Style Refills"* as a heading); Tactile Turn (*"If the packaging says 'Parker style', this pen should take it!"*); **r/pens, overwhelmingly** | **Most settled.** 7 of 7 top r/pens hits for this concept say "Parker style" / "Parker G2 Style" | Values are brand names |
| **format** | Unsharpen (*"The D format"*, *"commonly known as the A2 format"*) | Reference-side only | **A r/pens search for "refill format" returns zero titles containing the word** — community says "kind", "type", "style" instead |
| **standard** | Unsharpen, Schmidt, ISO | True for some, false for most | Overclaims |
| **size** | Schmidt itself | No | Collides with three other axes |

**Verdict:** "refill style" is the buyer's word. It is also brand-anchored and ambiguous, which is
exactly why it must not become the schema identifier. `socket_alias` does the disambiguation work
JetPens does in prose — the Euro-style refill is *"also known as the Standard Rollerball, RB, and
Pilot G2-style refill."*

### 2.2 Catalog

| Internal | Buyer label | Definition | Evidence |
|---|---|---|---|
| `maker` | **Maker** | The shop that made the pen. | Community's own word for machined-pen builders; already a committed table (`docs/database-schema/makers.md`). |
| `product_family` | **Pen size** | A maker's size class — "Standard", "Short", "Mini", "Slim". **Scopes part interchangeability only, never a fit claim.** | Tactile Turn's per-length lineup; Ti2's *"Regular and Shorty length"* and "Super Shorty". Qualify the word "size" — never bare. |
| `product` | **Pen** | A distinct body. | Universal. |
| `tip_option` | **Pen tip** (`tip` in the views) | The pen's front assembly; what actually carries the refill style. | **Decision: keep `tip` (BVG, 2026-08-12).** The maker evidence points elsewhere and is recorded so the call stays reviewable: BilletSpin *"Soul Pen Nose Cap"*; Modern Fuel *"Titanium Step Nose Bolt Action Pen"*; this repo's `scraper.ts:36` `nose`; Ti2 *"refill kit"* (*"Each refill takes a specific refill kit. The refill kits are not interchangeable"*); Karas/JetPens *"Grip Section"*. **No maker word is settled** — which is the strongest argument for keeping the word we already have rather than adopting a second unsettled one. Always qualified as "pen tip". |
| `product_variant` | **Pen finish** | Surface-only difference — material, finish, marketing name. Body unchanged. | BilletSpin's mokume/zirc/Timascus treatments on one barrel design; retail convention (Shopify "variants"). |
| `one_off` | **One of a kind** | No two alike; not numbered. | BilletSpin *"a unique physical item"*; Dark Pines *"no two will be exactly alike"*. Community shorthand is "OOAK". |
| `advance_mechanism` | **Advance mechanism** | How the tip is driven out — ratchet, bolt, screw, cam, none. | **JetPens' own live facet is `LEAD ADVANCE MECHANISM`.** Borrow it verbatim; do not collapse into `actuator`. |
| `actuator` | **Control** | What you operate — top button, side button, bolt knob, clip, toggle, body rotation. | No settled market noun **for the axis**. Makers name the part ("bolt", "toggle", "clip") without naming the category. **We teach this one.** But one *value* has a settled community word: `top_button` is a **"knock"** in pencil circles — r/mechanicalpencils runs *"Nine knock-advance 2mm lead holders"* and *"Knurled Double Knocks"*. Use "knock" as a value alias, not as the axis name. Splitting this from `advance_mechanism` is what 3.5 fought for; keep both labels distinct. |
| `bore_class` / `bore_mm` | **Tip opening** (class / mm) | How wide the hole at the front is. | Tactile Turn: *"needs enlarged tip hole"*. JetPens: *"some broad refills (like those greater than 1.0 mm) have large tips that aren't able to fit through the openings of some pens."* Clean borrow. |
| `axial_adjust` | **Adjustable length** | Whether the pen tip can move to take different refill lengths. | Modern Fuel: pens *"hold ink refills from 89mm to 116mm"* and *"You can adjust the ink tip to extend closer or farther"*. |
| `accepts_length_min_mm` / `_max_mm` | **Fits refill length** | The published window. | Modern Fuel publishes 89–116 mm. |
| `radial_retention` | **Refill grip** (fixed / collet) | How the refill is held sideways. | **"Collet" is genuine market vocabulary** — BigIDesign: *"a self-adjusting collet grip"*, *"the clutch mechanism can hold virtually any refill"*. |
| `handedness` | **Handedness** | Browse facet. Never a fit axis. | Plain. |
| `ships_with_refill_id` | **Ships with** | The refill in the box. Not a design-intent claim. | Tactile Turn: *"Schmidt EasyFlow 9000 Pen Refill (Medium) *Comes with this refill*"*. |

### 2.3 Refills

| Internal | Buyer label | Definition | Evidence |
|---|---|---|---|
| `refill` | **Refill** | The cartridge. | Universal. Note JetPens distinguishes refill vs cartridge in its FAQ; for our scope "refill" is right. |
| `medium` | **Ink / lead type** | Ballpoint, gel, hybrid, rollerball, pressurized, graphite, permanent marker, highlighter. | **`medium` survives on merit.** JetPens' word for this axis is `REFILL TYPE` — the false friend. And since Sitting 3 widened scope to pencil and marker, "ink type" would be *wrong*. "Ink / lead type" is the honest label. |
| `tip_size` *(on `refill_variant` as of 5.2)* | **Tip size** — but **"lead size"** for graphite | Ball/needle width in mm; lead Ø for graphite. | JetPens facet `TIP SIZE`, exact match, for pens. **The label must switch on `medium`:** r/mechanicalpencils says *"lead size"* consistently (4 of 7 top hits: *"favorite lead size"*, *"Lead size and type options"*, *"opinions around lead sizes"*), never "tip size". One column, two labels. |
| `refill_variant` | **Refill option** | Which tip size and colour you actually buy. **The refill-side twin of `product_variant`** — and it is on the catalog side of 4.5's seam only: nothing in the fit corpus points at it. **Settled 5.2.** | The market sells at this grain and claims fit at the other: BigIDesign's ~800-row sheet is *brand + model + tip size + colour per row*, while Tactile Turn's fit list says *"Pilot G2"* and never names a colour. Retailers say "options"; Pentel says "item". |
| `colour_name` | **Ink colour** | The maker's own word — "Vintage Vermillion". Free text, the full long tail. | JetPens facet `INK COLOR`, whose *values* are maker-invented and unbounded. Same call as `product_variant.finish` (C2): half vocabulary, half prose. |
| `colour_family` | **Colour** (the filter) | `black` \| `blue` \| **`blue_black`** \| `red` \| `green` \| `other`. The coarse browse bucket. Starts coarse and grows. | **Two columns, because no code turns "Vintage Vermillion" into `red`** — naming-law trap 3, and the ninth axis-mix. ✅ **R-D CLOSED 2026-08-14 (research pass 9), and by better evidence than it asked for:** rather than JetPens' facet, `blue_black` is sourced at **all three makers** — uni ships BB across six refill codes, Pilot as `LP3RF-12S4-BB`, Pentel in the 0.3/0.4 set. **Added.** The rest of the list stays reasoned-not-sourced, which is safe: `ALTER TYPE ADD VALUE` is cheap, removing one is not. |
| `rear_topology` | **Back-end shape** | open / plugged / finned / flanged. The one axis no measurement can express (Rule 2). | Described everywhere, named nowhere. JetPens: *"a plastic end piece embedded with ratchet-like grooves"*, *"crimped … to create a spring stop"*, *"tapered ends that can affect compatibility"*. Unsharpen: *"pronounced steps made out of black plastic"*, *"pressed 'wings'"*. **NO settled word — we teach one.** |
| `form` | **Availability** (`sku` \| `harvested`) | Whether you can buy the refill on its own, or must gut a pen for it. | **NO market word.** JetPens describes it in sentences: the Hi-Tec-C refill *"is not available on its own, so you'll have to purchase a Pilot Hi-Tec-C Gel Pen"*; the G2 Mini *"isn't available for sale on its own"*. Weak rename candidate `form` → `availability`. |
| `refill_dimension` | **Measurement** | A named, **attributed**, sourced number. Explains, never matches (F6). **4.4b:** `claimed_by = staff` renders *"Measured by machinedpens"*; two rows disagreeing on one `feature` render **both, with citations**, and fire no geometry screen. | Unsharpen's per-refill spec lists ("98 mm long, 6 mm max width, 2.5 mm max width at the tip"; *"spring shoulder 33.4mm from the tip"*). |
| `standard` | **ISO spec** | Populated only when a real spec applies. | DIN ISO 12757 / 12757-1:2017 / 12757-2, cited by Schmidt and Unsharpen. |
| `observance` | **Interchangeability** (`well`\|`partial`\|`poor` → "reliable" / "varies by brand" / "check per pen") | How well real refills honour the style. **4.5 promoted this to launch-critical copy:** on a pen with zero fit checks it *is* the compatibility answer — *"Takes Parker-style — usually reliable"* vs *"Takes RB-style — varies by brand, check per pen."* Never phrase the empty state as a negative. | **NO settled word.** Unsharpen: rollerball refills *"might loosely adhere to the RB standard, but there is still an unfortunate amount of variation"*. JetPens: *"Some refills can even be the same style but vary slightly between brands."* Weak rename candidate `observance` → `adherence`. |
| `socket_alias` | **Also known as** | | JetPens: the Euro-style refill is *"also known as the Standard Rollerball, RB, and Pilot G2-style refill."* |
| `rebrand` | **Also sold as** | The branded refill in your box and the OEM part it actually is. **Same part off the same line — never merely the same style.** Fit claims propagate one hop and render labelled: *"via Schmidt P8126"*. **Settled C1 (a).** | **The market's own word is "rebranded"** — FPN: *"The branded Retro 51 refill is a rebranded short Schmidt refill."* Unsharpen's Schmidt guide describes the supply arrangement directly; Premec advertises white-label manufacture (*"all refills can be customised"*). The label rhymes with **also known as** on purpose, and unlike the schema's directed `rebrand` it reads correctly both ways. |

### 2.4 Assertions — the moat

| Internal | Buyer label | Definition | Evidence |
|---|---|---|---|
| `compat_edge` | **Fit check** | One claim: this refill, in this pen tip (or this style). | JetPens ships both directions as buttons: *"Recommended Refills/Parts"* on a pen page, *"Compatible Products"* on a refill page. Tactile Turn calls the page a *"Refill List"*. Ti2 titles theirs *"Which refill do I have?"* — the buyer's actual question. |
| `polarity` | **Fits / Doesn't fit** | positive \| negative. | **NO market noun.** Retail encodes negatives as footnotes: Tactile Turn marks *"items with ** will not work"*. Keep `polarity` internally; the buyer only ever sees the two words. |
| `reason` | **Why not** | Required when negative. | Tactile Turn: *"Schneider Express 735 (needs enlarged tip hole)"*. |
| `fit_quality` | **Fit quality** (`toleranced`\|`snug`\|`loose`) | | Only adjectives in the wild: BigIDesign *"no wiggling or rattling"*; Machine Era's Field Pen Bolt *"no tip wobble"*. Label the values **"precision" / "snug" / "loose"** — "toleranced" is ours alone. |
| `trim_necessity` + `trim_mm` + `trim_reference` | **Trimming** | required \| recommended \| optional, with how much and against what. | **Best-borrowed term in the set.** Tactile Turn's heading: *"Requires Trimming - Required amount in Millimeters"*, and *"trimming them to the same length with a sharp Exacto knife … will allow these to fit"*. Ti2: *"*Tail trimming needed"*. JetPens: *"you can try cutting the extra 1-2 mm off of the end"*. |
| `functional_warning` | **Works, but not advised** | Fits; you shouldn't. | Ti2 TechLiner × Jetstream: reports of *"ink flow problems attributed to the magnet not playing nicely with the hybrid ink"*. **NO market word** — retail simply omits such refills. This is a genuine gap we fill. |
| `claimed_by` *(was `source`)* | **Claimed by** | `maker \| retailer \| community \| owner \| staff`. **Settled 4.3 (b)**, and **promoted into the schema** — see §0.2. `staff` = "Tested by machinedpens"; `retailer` = "Listed by Penstore" (**C4a**, the fifth value). | JetPens distinguishes its own testing: refills *"we've tested ourselves to confirm that they work in that pen."* And the Fisher PR conflict is a **guide with calipers** (Unsharpen, 90 × 4.8) against a **shop reprinting a spec** (Penstore, 89 × 5.8) — two different kinds of claim, which is why they need two different labels. |
| `citation_url` / `citation_note` | **Source** ("Source: Unsharpen ↗") | Where the claim came from. **4.3 (b).** Required by curation rule when `claimed_by` is `maker` or `community`. | 🔑 **The buyer's own word for this is "source"** — which is exactly why the schema must not spend `source` on the category. Every research pass in `data-model-answers.md` already ends in a source list; this is that habit, stored. |
| `disputed_note` | **Disputed by machinedpens** | Non-null = staff has overruled this row, and the text says why. **A claim about the CITATION, not about the pen** — which is why it is not `polarity`/`evidence`. Dropped from the derived verdict; still rendered. **Settled 4.4 (d).** | **NO market word — a ninth term we teach.** Retail never contradicts a maker, so there is nothing to borrow. BVG: *"maker copy is not always truth, they might have a typo or copy and paste it from other products."* "Disputed" passes §0 out loud; `override_note` names the internal mechanic, and §0 tests the **outward** word. |
| `evidence` | **Tested** / **Says it fits** | `declared \| tested` — was anything physically seated, or is the claim inferred from the style? **Settled 4.1**, replacing `verified bool`. | **NO market word — an eighth term we teach.** JetPens gets closest: refills *"we've tested ourselves"*. The distinction is invisible in retail: Magnus's *"as long as your refill is in the style below — it will fit!"* and TT's list with per-refill trim amounts in mm look identical on the page and are not the same claim. |
| `fit_report` | **Report** ("Does it fit? Tell us") | A user's *"I put this in my pen and here's what happened"*. N reports → 1 `fit_check`. **4.1**. | Retail has no analogue — nobody collects fit reports. Amazon-style "reviews" are the nearest UI convention and the wrong word: a report is about a **pairing**, not a product. |
| `fit_report.fits` | **Does it fit?** | The one thing a submitter can reliably state. | BVG's own words: *"user submitted feedback if it works"*. Labelled as a question, never as `polarity` — jargon has no place on a submission form. |
| `fit_report.review_state` | *(never shown)* | `pending \| approved \| rejected`. Editor-facing only. | — |
| `part` | **Part** | | Universal. |
| `part.kind` | clip · bolt · bolt handle · top cap · **spring** · o-ring · **spacer** · **adapter** | | JetPens: *"some pens require spacers or adapters that help hold the refill in place"*; *"if your pen has a spring in the tip … hold onto that spring"*. Gentleman Stationer: *"you can add a short spacer, such as a small wad of paper or a piece of plastic tubing"*. **Ti2 calls its tip insert a "stabilizer"** — a brand word; alias it, don't add a kind. |
| `part.made_by` *(was `part.source`)* | **Made by** (oem \| aftermarket \| community) | Who **manufactured** it — not who claims anything. **Promoted into the schema, 4.3.** | Standard retail vocabulary. |
| `edge_required_part.sourcing` | **How to get it** | included with pen \| included with refill \| buy separately | Fisher PR refills *"include an adapter"*; Karas' G2 Render K *"ships with a narrow spring, extra plastic plug, and length of tube"*. |
| `edge_required_part.necessity` | **Necessity** | Shared enum with `trim_necessity`. | — |
| `socket_bridge` | **Style adapter** | A part that makes a refill of style A seat in a pen built for style B. Directed. | Fisher: *"Using an included plastic converter the refill can be made to exactly fit the G2 standard"* — **but call it an adapter**; "converter" means a fountain-pen filler. |

### 2.5 Collection

| Internal | Buyer label | Definition |
|---|---|---|
| `collection_item` | **My pen** | An owned pen: a finish, a pen tip, and whatever refill is in it right now. 5.3a and 5.3b(i) settled; 5.3b(ii)/5.4/5.5 OPEN. |
| `installed_refill_id` | **Currently loaded** | Which refill — *"an EnerGel LR7"*. Always recordable, and the column every read path uses. **Settled 5.3b(i) (c)**; **5.5** made it a **field, not a log** — swap the refill and the row updates. |
| `installed_refill_variant_id` | **Exactly which one** | The size and colour actually loaded — *"the 0.7, Navy Blue"*. **Optional**, and the two can never contradict each other. **One picker, not two:** choosing the exact one fills "currently loaded" for you. **Added 5.3b(i).** |
| `part_fitted` | **Parts fitted** | Which parts are on *your* pen — the bronze clip, the copper back piece. **Settled 5.4.** ⚠️ **LOOKS, NOT FITS:** a spring or spacer is not a choice you made — the refill dictated it, and `part_needed` already holds it. `part.kind` is the test. Evidence: Tactile Turn sells the Bolt Action Back Piece alone in Titanium/Copper/Bronze/Zirconium — *"materials can be mixed and matched between pens"*, matching only *"the correct diameter (Standard, Slim, or Thick)"*, which is `part.family_id` (3.2 a′) exactly. |
| `product_variant_id` *(was `variant_id`)* | **Pen finish** | ⚠️ **Renamed 2026-08-14** — `installed_refill_variant_id` put two different *variants* on one row (the pen's finish, the refill's option). Naming-law **trap 3**, fired inside our own schema for the second time after `source` (§0.2). Qualify both. |

### 2.6 Community pass — FPN and r/mechanicalpencils (added 2026-08-12)

Both sources were reached on a second attempt, through the Chrome extension. They **confirm** the
recommendations above rather than change them, with three refinements and one model-level flag.

**"Style" wins outright, and "type" is its loose synonym.** Fountain Pen Network returns 982 hits
for "parker style refill". Members write *"Parker style refill"*, *"Parker G2 style refill"*,
*"Euro style rollerball refill"*, *"cross style refills"*, and *"Uni makes several styles of the
Jetstream refill"* — while the same threads slip into *"cross type refills"* and *"gel type
refills"* for the same axis. **Nobody says "format".** That matches r/pens exactly, and it is why
the buyer label is "refill style" while the schema keeps `socket`.

**Refinements:**

1. **A new alias for the Parker-style socket: "DIN".** FPN: *"The Taranis bp used the DIN/Parker
   style refill."* Also **"G1"** turns up as a sibling ISO class (Paper Mate Lubriglide, Schneider
   Express 225) alongside G2 — worth a `socket` row when the corpus reaches it.
2. **"Standard vs proprietary" is live community vocabulary, not just JetPens' editorial split.**
   FPN: *"It is not a proprietary refill, it is a Parker style refill"*; *"Sheaffer … was moving
   away from the proprietary cartridges."* This is a real buyer-facing badge, derivable from
   `socket.standard IS NOT NULL`.
3. **"Adapter" is confirmed over "converter" by community usage** — FPN describes a Fisher
   pressurized refill usable elsewhere *"if it is fitted with a 'Parker-style' adapter."*
4. **Pencil-side:** the axis word is **"advance"** (r/mechanicalpencils: *"Auto Lead Advancing
   Pencils"*, *"automatic lead advancing mechanisms"*, *"knock-advance"*, *"incremental
   advance"*), corroborating JetPens' `LEAD ADVANCE MECHANISM` facet from a second, independent
   direction. The pencil analogue of our pen-tip/bore is the **"sleeve"**, and it has its own
   fixed-vs-moving axis: *"Sliding cushion vs fixed sleeve"*, *"sliding lead sleeve"*. JetPens
   facets it as `SLEEVE TYPE`. **Not modelled today** — noted for whenever pencils get their own
   pass.

### ✅ 2.7 CLOSED 2026-08-13 — decision **C1**: a `rebrand` table, buyer label **"Also sold as"**

`rebrand { refill_id → oem_refill_id, claimed_by, citation_url, citation_note }`. The branded SKU
points at the part it actually is. Both stay full `refill` rows.

**What the research added to the note below** (research pass 8, `data-model-answers.md` C1):
rebranding is an **industry structure**, not a Retro 51 oddity — Schmidt supplies Retro 51, Baron
Fig and Diplomat, and Premec advertises white-label manufacture as its business model. And the
first mapping checked is **already contested** (REF5P = P8127 by one source, P8126 by two), which
is why the link carries the 4.3 attribution shape rather than being a bare FK.

**Storage was decided by 3.3's own refinement** — *"aliases follow their target's storage"*: a
table when the link carries data, a TS map when it does not. This one carries attribution → table.
**A `refill_alias` was rejected** because it deletes the SKU: the branded refill has its own brand,
slug, price and availability, and 4.5 makes `refill` catalog data the scraper stages.

⚠️ **The rule that must survive implementation: `rebrand` means *same part off the same line*,
never *same style*.** Monteverde's "compatible with Parker, Cross, Montblanc" refills are
style-mates and belong to `refill_style`; admitting them here propagates positives across
genuinely different parts. Logged as the **eighth axis-mix**, caught before construction.

**Buyer label: "Also sold as"** — `also_sold_as` in the views, deliberately rhyming with
`also_known_as`. It reads out loud correctly in both directions (*"the Retro 51 refill is also sold
as the Schmidt P8126"*), which the schema's directed `rebrand` does not need to. Propagated fit
claims render **labelled** — *"via Schmidt P8126"* — never silently.

<details><summary>The original flag, kept for the audit trail</summary>

#### ⚠️ 2.7 One model-level gap this research exposed — FLAGGED, NOT SETTLED

**Rebranded refills have no representation.** FPN, repeatedly and confidently: the Retro 51
Tornado *"come supplied with a self-branded refill that is actually a Schmidt short capless
rollerball refill"* — *"The branded Retro 51 refill is a rebranded short Schmidt refill."*

Under the current model that is **two `refill` rows** (brand "Retro 51" and brand "Schmidt") with
identical geometry, identical `socket_id`, and **no link between them**. Every compat edge would
have to be curated twice, and they could silently drift — which is exactly the failure mode the
model has been designed against everywhere else.

This is not a naming problem and this file does not solve it. It is a **structural question for
the interview**: is a rebrand a `refill_alias` (cheap, mirrors `socket_alias`), a nullable
`same_as_refill_id` self-reference, or a `refill_identity` the way `socket` groups shapes? Note it
interacts with `form = sku | harvested` and with 4.5 (seeding). **Carry it into Sitting 4.**

*(Answered 2026-08-13 as C1 — none of the three: a `rebrand` link table with attribution.)*

</details>

---

## 3. Where the market has no word (findings, not failures)

Nine concepts we must **teach**, because nobody has named them:

1. **`rear_topology`** — everyone describes back-end shape, nobody names the axis.
2. **`observance`** — "loosely adhere" is as close as the market gets.
3. **`functional_warning`** — retail omits bad-idea refills rather than flagging them. Naming this
   is a differentiator, not a gap.
4. **`form = harvested`** — JetPens spends a paragraph on the concept each time it recurs.
5. **`actuator`** — parts are named; the axis is not.
6. **`polarity`** — negatives exist only as asterisked footnotes.
7. **`fit_quality`** — adjectives ("wobble", "rattle", "snug"), no scale.
8. **`evidence`** *(added 4.1, 2026-08-12)* — the declared-vs-tested split is invisible in
   retail. A maker's blanket style claim and a maker's tested-and-measured list render
   identically on the page.
9. **`disputed_note`** *(added 4.4, 2026-08-12)* — **retail never contradicts a maker**, so there
   is nothing to borrow. Saying *"the maker published this and we think it's wrong"* out loud is
   the whole differentiator.

That is **nine** of ~19 high-value terms with **no borrowable word**. It is the strongest
argument against (B): there is no buyer vocabulary to rename *into* for nearly half the model.

🔑 Terms 3, 6 and 9 share a cause: **retail's incentive is to sell the pen**, so it has no
vocabulary for *doesn't fit*, *fits but don't*, or *the maker is wrong*. Every one of those is a
buyer's actual question, which is why the gap is the product (**F5**).

---

## 3b. Entity headers — the box titles, settled 2026-08-12

These are the 16 headers a reader meets first in the rendered diagram. Ordered by how often a
buyer meets them.

**Five of these are no longer "views only" — they were promoted into the schema on 2026-08-12**
(§0.1) and are marked ✅ below. For those, the schema and the views now say the same word. The
rest remain view-only labels.

| Schema header | View header | What it holds |
|---|---|---|
| `product` | **pen** | One pen body. |
| `maker` | **maker** | The shop that made it. |
| `refill` | **refill** | The cartridge. |
| `socket` ✅ | **refill_style** | The shape a refill must be — "Parker style". |
| `tip_option` | **tip** | The pen's front end; decides which style fits. |
| `compat_edge` ✅ | **fit_check** | One tested combination. **Holds negatives too** — which is why it is not `refill_fit`. |
| `fit_report` | **report** | A user's "does it fit". Added by **4.1**; awaits approval before it becomes a fit_check. |
| `product_variant` | **pen_finish** | Same body, different material/finish/colourway. |
| `refill_variant` | **refill_option** | Same refill model, different tip size / colour. Added by **5.2**. |
| `product_family` | **pen_size** | The maker's size class: Standard, Short, Mini, Slim. |
| `part` | **part** | Spring, spacer, adapter, clip, bolt. |
| `socket_bridge` ✅ | **style_adapter** | A part that makes one style fit a pen built for another. |
| `edge_required_part` ✅ | **part_needed** | Which part a fit requires, and how you get it. |
| `socket_alias` ✅ | **also_known_as** | The other names a style goes by — "RB", "Euro", "DIN". |
| `rebrand` | **also_sold_as** | The same physical refill under a second brand. Added by **C1**. |
| `material` | **material** | The alloy list — Titanium, Zirc, Mokume, Timascus. **Inherited, not designed:** it is the committed `materials` table. Added by **C2**. |
| `refill_dimension` | **refill_measurement** | One named, sourced number. |
| `collection_item` | **my_pen** | A pen you own, tip fitted, refill loaded. |
| `part_fitted` | **part_fitted** | Which parts are on your pen. Added by **5.4**; rhymes with `part_needed` on purpose. |
| ~~`open_4_provenance`~~ | *(retired)* | Empty shell, deliberately left ugly — scaffolding should not look finished. Removed by the 2026-08-13 sweep. |
| ~~`open_5_carry_log`~~ | *(retired)* | **Gone 2026-08-14** — 5.5 answered it (a field, not a log). No shells remain in the model. |

Four of these replaced earlier, worse choices of mine: `refill_fit` → `fit_check` (the old name
implied every row was a yes), `size_family` → `pen_size`, `finish_variant` → `pen_finish`,
`fit_required_part` → `part_needed`, `refill_style_alias` → `also_known_as`.

---

## 4. Readability — the 16-entity hairball

**Verified against the renderer, not assumed:** Eraser's ERD entity properties are
`icon, color, colorMode, styleMode, typeface`. **There is no `label` property** — `label` appears
only under Legends. So a friendly view *cannot* be an annotation layer over the existing file; it
must be a separate file with renamed identifiers, exactly as the brief suspected.
(`https://docs.eraser.io/docs/erd-syntax`)

**Recommendation: three audience-scoped files** (ratified), plus the combined one for continuity:

| File | Entities | Edges | Answers |
|---|---|---|---|
| **`docs/data-model/fit.eraser`** | **5** | **8** | **"Will this refill fit?" — the moat. Review this one first.** |
| `data-model-erd-public-catalog.eraser` | **9** | **11** | "What is this pen, and what does it come as?" |
| **`docs/data-model/remedies.eraser`** | **10** | **10** | **"It doesn't drop straight in. Now what?"** |
| `data-model-erd-public-compatibility.eraser` | **11** | **18** | "Will this refill work in my pen?" — **fit + remedies combined**; prefer the two above |
| `docs/data-model/collection.eraser` | **10** *(+1 shell)* | **12** | "What do I own, and what's loaded?" |
| `data-model-erd-public.eraser` | **20** *(+1 shell)* | **37** | Everything, buyer-labelled. |

*(Counts updated 2026-08-12 — **4.1** added `fit_report` / `report` to the full and compatibility
views. 2026-08-13 — **C1** added `rebrand` / `also_sold_as` to the same two, and the
ratification-sweep shell came out of the full view. 2026-08-14 — **5.2** added `refill_option` to
catalog and full; **5.3b(i)** added it to collection too, plus one edge in each of collection and
full. **These are now machine-checked** — `python3 .notes/validate-eraser.py` prints every count and
resolves every endpoint; stop hand-maintaining them.)*

**On entity order:** it helps, but bounded. Eraser auto-layouts and **reorders columns within an
entity on render** (verified 2026-08-12 — relationship-participating columns migrate toward the
edge they connect to). Declaration order still biases placement, so each file below declares
parents before children along the main chain: `maker → pen_size → pen → tip → refill_style →
refill → fit → part`. The real crossing reduction comes from **splitting**, not ordering — the
compatibility view alone drops from 26 edges to 14.

---

## 5. Inheriting from the committed schema (ratified 2026-08-12)

The screenshot reviewed alongside this work is this repo's own `product_pens` draft — the render
control sample from `.notes/eraser-integration-findings.md` — sitting on the committed tables
`makers`, `materials`, `mechanisms`, `product_types` (`docs/database-schema/`).

### 5.1 ADOPT — house style

**APPLIED 2026-08-12** to both `data-model-erd.md` and `data-model-erd-clean.eraser`, ratified by
BVG. Affected columns carry a `// HOUSE` marker, and rule 5 was added to the maintenance rules at
the top of `data-model-erd.md` to explain why they trace to no numbered decision. 39 id/FK type
references converted, 14/14 entities timestamped; all 22 numbered decision references verified
intact afterwards. The missing FK edge `socket_bridge.scope_tip_option_id > tip_option.id` was
patched in the same pass.

```
// every entity
id          bigint pk           // not `string` — matches makers/materials/mechanisms
created_at  timestamptz         // default now()
updated_at  timestamptz         // default now()

// every canonical entity (maker, product_family, product, socket, refill, part)
slug        text unique         // we currently have slug ONLY on socket

// maker
root_url    text unique         // the scraper's identity key, already load-bearing
```

Our ERD currently has **no timestamps at all** and `string` ids. Both are gaps against a shipped
convention, not design choices.

### 5.2 ADOPT — the lexicon's real home

§2 is authored to transplant into `packages/database/src/schema/descriptions.ts`
(`{ description, example }` per column) and render through
`pnpm --filter @package/database db:generate:docs`. **That pipeline is option (A)'s machinery,
already built and already generating `docs/database-schema/*.md`.**

### ✅ 5.3 ANSWERED 2026-08-13 — decision **C3**: neither is corrected, neither is used

⚠️ **Both "collisions" were misreadings, and the second one was mine.** Tracing how the tables are
*populated* settles it:

1. **`mechanisms.name = "click"` is a QUOTE, not a modelling claim.** Rows are interned from
   scraped free text — `drizzle/0008_silly_carnage.sql:44` matches `slugify(tmp_autmog_pens.mechanism)`
   against `mechanisms.slug`. "click" is the word **Autmog printed on their page**. Storing it is
   the ingest working correctly; 3.5's split is about what *we* do with it.
2. **`product_types` is not 3.1's demoted category.** `getProductTypes()`
   (`apps/scraper/src/autmog/normalize.ts:181`) passes **Autmog's own Shopify `category`/`product_type`**
   straight through. 3.1 demoted *ballpoint/gel/rollerball*, which comes off the **refill**. This is
   a maker's shop taxonomy — the same machinery that separates pens from the Grimsmo knives in the
   same scraper.

🔑 **The real finding: promotion is a SPLIT, not a rename.** Autmog's *"click"* has to become
`advance_mechanism = ratchet` **and** `actuator = top_button` — one scraped word into two curated
columns — and it **does not determine them**, because a side-click pen prints "click" too. So the
promotion step is judgment, not a lookup, which confirms 4.5's *"cheap per row, still a human."*

<details><summary>The original flag, kept for the audit trail</summary>

#### 5.3 FLAG — two collisions. Do NOT inherit. Interview territory.

1. **`mechanisms` table, `name: "click"`** — "click" is exactly the mixed-axis value that decision
   3.5 split into `advance_mechanism` + `actuator` (*"side_click = ratchet + side button, two
   facts in one value, mixed before anyone noticed"*). The committed table has already made the
   mistake the interview diagnosed. Inheriting its values is a **regression**.
2. **`product_types` + `tmp_product_product_types`** — stores a classification, many-per-product,
   that decision 3.1 **demoted to derived** (from the installed refill's `medium`). Adopting it
   would restore a field the model deliberately removed.

</details>

### ✅ 5.4 ANSWERED 2026-08-13 — decision **C2**

> **A vocabulary is a TABLE when its members arrive at RUNTIME, or carry data of their own. It is
> a TS `as const` when the set is closed at compile time and a member is nothing but its own name.**

⚠️ **The question below was posed on a false premise, and the repo says so.** `materials`,
`mechanisms` and `product_types` are defined in **`packages/database/src/schema/scraper.ts:191–247`**
and **every consumer is a `tmp_*` staging table.** They are the scraper's string-interning tables —
the *ingested* side of the repo house rule, and the *catalog-staging* side of 4.5's two corpora —
not the committed schema's opinion on curated vocabulary. There were never incompatible answers to
one question; there were two questions.

They also carry **no data** (`id`, `name`, `slug`, timestamps). By §3.3's own refinement they would
be `as const` *if they were ours*. They are tables for exactly one reason: **a scraper must intern
words nobody enumerated**, which a compile-time union cannot do.

**Result:** all ~20 curated vocabularies stay TS `as const` — 3.3 ratified, not revisited. The one
change is **`product_variant.material` → `material_id`**, pointing at the existing `materials`
table: it was free text, i.e. neither a fixed list nor a shared one, so `Titanium`/`titanium`/`Ti`
would fragment the browse facet. Precedent is `maker`, which is already the committed `makers`
table. **`finish` stays free text, flagged** (half vocabulary, half prose).

<details><summary>The original question, kept for the audit trail</summary>

#### 5.4 OPEN QUESTION — recorded, not settled

**Lookup tables vs TypeScript enums.** The committed schema makes open vocabularies into TABLES
(`mechanisms`, `materials`, `product_types` — each `id` / `name` / `slug unique`). Our ERD makes
them `enum`, and 3.3 states plainly that growing `part.kind` is *"a TS edit (enums.ts = `as
const`)"* with brand words as *"a TS ALIAS MAP, not a table"*.

These are incompatible answers to one question. It affects at minimum `advance_mechanism`,
`actuator`, `part.kind`, `product_variant.material`, `refill.medium`, and `socket`'s alias
handling. **Carry it into Sitting 4** — it is a curation-and-provenance question, which is exactly
what Sitting 4 covers. Nothing here settles it.

</details>

---

## 6. Research gaps, stated plainly

- **CLOSED 2026-08-12: Fountain Pen Network and r/mechanicalpencils were reached** on a second
  attempt via the Chrome extension. See §2.6 — both confirm "style", neither uses "format", and
  the pencil-side gap is closed ("advance" corroborated; graphite takes **"lead size"**, not "tip
  size"). Access note for next time: use the Chrome extension for Reddit and FPN.
  `old.reddit.com` is blocked to WebFetch and plain web search returns retail spam for every
  community query.
- **Goulet and Drop were not consulted.** Goulet is fountain-pen-centric and fountain pens are out
  of scope as of Sitting 3; Drop's listing titles are maker-supplied copy, already sampled through
  the makers themselves.
- **JetPens and Unsharpen both 403 WebFetch.** Both were read through the Chrome extension. If
  these need re-verification later, use the extension, not WebFetch.

---

## Sources

Retail / reference: [JetPens — The Ultimate Guide to Pen
Refills](https://www.jetpens.com/blog/The-Ultimate-Guide-to-Pen-Refills/pt/231) ·
[JetPens — Parker Style Refills category
facets](https://www.jetpens.com/Parker-Style-Refills/ct/5505) ·
[JetPens — Mechanical Pencils category facets](https://www.jetpens.com/Mechanical-Pencils/ct/45) ·
[Unsharpen — Pen Refills Guide](https://unsharpen.com/pen-refill-guide/) ·
[The Well-Appointed Desk — The Epic Refill Reference
Guide](https://www.wellappointeddesk.com/2014/06/epic-refill-guide-rollerball-gel-and-ballpoints/)

Refill makers: [Schmidt Technology —
Refills](https://www.schmidttechnology.de/en/products/writing-instruments-technology-2/refills/)

Pen makers: [Tactile Turn — Slider Refill List](https://tactileturn.com/pages/slider-refill-list) ·
[Tactile Turn — Ink Refill Guide](https://tactileturn.com/pages/ink-refills) ·
[Ti2 Design — Which refill do I have?](https://ti2design.com/pages/what-refill-do-i-have) ·
[Ti2 Design — BoltLiner Refills](https://ti2design.com/pages/boltliner-refills) ·
[BigIDesign — Ti Arto](https://bigidesign.com/products/ti-arto-pen) ·
[BigIDesign — Ti Arto EDC](https://bigidesign.com/products/ti-arto-edc-pen) ·
[Modern Fuel — The Bolt Action Pen](https://modernfuel.com/pages/mf-bolt-action-pen) ·
[BilletSpin — Soul Pens](https://www.billetspin.com/machined-metal-soul-pens) ·
[Karas Render K Grip Section
(JetPens)](https://www.jetpens.com/Karas-Kustoms-Render-K-Grip-Section-Aluminum-Silver/pd/18415)

Community: [r/pens — "parker style refill"
search](https://www.reddit.com/r/pens/search/?q=parker+style+refill&restrict_sr=1) ·
[Fountain Pen Network — "parker style refill" (982
results)](https://www.fountainpennetwork.com/forum/index.php?/search/&q=parker%20style%20refill&quick=1) ·
[r/mechanicalpencils — lead advance
mechanisms](https://www.reddit.com/r/mechanicalpencils/search/?q=lead+advance+mechanism&restrict_sr=1) ·
[r/mechanicalpencils — sleeve / knock / lead
size](https://www.reddit.com/r/mechanicalpencils/search/?q=sleeve+OR+knock+OR+%22lead+size%22&restrict_sr=1) ·
[r/pens — "refill format" search (the negative
result)](https://www.reddit.com/r/pens/search/?q=refill+format&restrict_sr=1) ·
[The Gentleman Stationer — Pilot G2 Update: Pen Bodies and Alternative
Refills](https://www.gentlemanstationer.com/blog/2021/4/21/pilot-g2-update-pen-bodies-and-alternative-refills) ·
[Pens and Planes — Pen Hacks](https://pensandplanes.com/pen-hacks/) ·
[Goldspot — What Are Fountain Pen
Converters](https://goldspot.com/blogs/magazine/what-is-a-fountain-pen-converter)

Renderer: [Eraser — ERD syntax](https://docs.eraser.io/docs/erd-syntax)

In-repo: `packages/database/src/schema/scraper.ts:36` · `packages/database/src/schema/descriptions.ts` ·
`docs/database-schema/{makers,mechanisms,materials,product-types}.md`
