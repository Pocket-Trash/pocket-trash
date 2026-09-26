# Pen/refill data model — answers

Running record of decisions against `.notes/data-model-questions.md`.
Local scratch, git-excluded (`.git/info/exclude`). Started: 2026-08-10.

---

## ▶ RESUME HERE — read this first in a new session

### ⚠️ VOCABULARY CHANGED 2026-08-12 — this file was NOT rewritten

Five entities were renamed under the new **naming law** (`.notes/vocabulary-lexicon.md` §0:
*could someone shopping for a pen say this name out loud and mean roughly the right thing?*).
**Every numbered decision below still uses the OLD words on purpose** — the audit trail is worth
more than the consistency. Translate as you read:

| This file says | The schema now says |
|---|---|
| `socket` | **`refill_style`** (and `socket_id` → `refill_style_id`) |
| `socket_alias` | **`also_known_as`** |
| `compat_edge` | **`fit_check`** (and `edge_id` → `fit_id`) |
| `edge_required_part` | **`part_needed`** |
| `socket_bridge` | **`style_adapter`** (`from_socket_id`/`to_socket_id` → `from_style_id`/`to_style_id`) |

Affects at least **2.5, F3′, 3.6, 3.2, Sitting 3 (c′)**. `tip_option` was proposed for rename and
**rejected** — it stays. New names from here on must pass the §0 test **when created**, not in a
later cleanup pass.

**Status: Sittings 0–4 are ALL DONE, and so are the ratification sweep and the four carried
structural items** (2026-08-13). Sitting 3 closed 2026-08-12 — 3.1 through 3.7, plus socket
bridges (c′) and the new 3.2b. Sitting 4 closed 2026-08-12 — 4.1, 4.1b, 4.3, 4.4, 4.4b, 4.5;
**4.2 dissolved** by 2.1.

**2026-08-13 — the sweep and the carried items, all closed. ZERO soft decisions remain.**

| | Outcome |
|---|---|
| **S1** `slot_option` → `part` merge | RATIFIED as applied. Purchase-option vs fit-required is *which join points at the row*, not a column. |
| **S2** 3.2b's tip-option override | RATIFIED as applied. F3′ had already put Alpha's two configurations at that grain. |
| **S3** 4.3's `source` split | RATIFIED as applied. `claimed_by` / `made_by` / `citation_*`. |
| **C1** rebranded refills | **NEW `rebrand` table**, attributed. Rebranding is an industry structure (Schmidt → Retro 51, Baron Fig, Diplomat; Premec white-labels), and the mapping is **contested in the wild**. Verdict rule gains **step −1**: expand the fit set one hop, labelled. ⚠️ *same part, never same style.* |
| **C2** lookup tables vs TS enums | **Table when members arrive at runtime or carry data; TS `as const` otherwise.** §5.4's premise was false — the committed vocabulary tables live in `scraper.ts` and serve only `tmp_*`. One change: `product_variant.material` → `material_id`. |
| **C3** the two committed-schema collisions | **Both were misreadings, one of them mine.** `mechanisms.name = "click"` is a *quote* from Autmog's page; `product_types` is Autmog's shop taxonomy, not 3.1's demoted category. Not corrected, not used. |
| **C4a** the retailer gap | **Fifth `claimed_by` value: `retailer`.** On `refill_dimension` `claimed_by` is the only trust signal there is (4.4b kept `evidence` off), so *measured it* must not merge with *retyped it*. |
| **C4b** `ships_with_refill_id` scope | **MOVED to `tip_option`.** F3′ a third time — the refill in the box belongs to the configuration you bought. |

**Schema delta for the day:** +2 entities (`rebrand`, `material`) · +1 enum value (`retailer`) ·
1 column moved · 1 column retyped. **18 entities / 32 edges**, all five `.eraser` files in sync and
every relationship endpoint validated against a declared entity and an existing column.

**2026-08-14 — SITTING 5 in progress.** The ownership question is **moot** (field-log dropped;
5.3/5.4/5.5 are BVG's — the questions file's owner index is stale). Answered so far: **5.3a** a
saved config is a pen you own · **5.2 + the refill grain** `refill` is a MODEL, and a new
`refill_variant` holds tip size and colour · **5.3b(i)** (c) BOTH — the collection names the
refill **model** always and the **exact one** optionally, with the pair constrained so they cannot
disagree (research pass 9 / **R-A** killed the cold-start argument for model-only) ·
**5.3b(ii)** (a) **nothing more, and LESS ENTRY** — no nickname, no note, no columns; the four FKs
**pre-fill from the stock config** and are **written**, not resolved on read · **5.4** **separate
rows, always**, plus a new **`part_fitted`** (the 20th entity) because what separates two copies is
usually a finish or a small part, not the refill · **5.5** a **FIELD, not a log** — and the layer is
**re-centred on pen + parts**, with the refill secondary · **5.6a** the **completeness gate**
(you cannot own what the catalog does not fully have; a miss routes to a submission) · **5.6** (a)
the front door is a **LOOKUP**, not a browse · **5.7** (a) pens + refill **pages**, faceted browse
later · **5.8** **DEFERRED — not a schema question.**

# ✅ **SITTING 5 IS COMPLETE, AND WITH IT THE DATA-MODEL INTERVIEW.** 2026-08-14.
**20 entities · 37 edges · zero shells · zero soft decisions.** All open work — corrections owed to
these notes, unverified claims, the nine things deliberately not built and what would trigger each,
the measurement queue, naming, seeding and implementation notes — is now tracked in
**`.notes/open-items.md`**. Read that first if you are picking this up to *do* something; read this
file if you need to know *why* something is the way it is.
**`.notes/sitting-5c-prompt.md` holds the agenda and a research brief** — **R-A, R-C and R-D are
now DONE** (research pass 9); **R-B** (which makers publish a compat list) still blocks 5.8.

⚠️ **`BLS-VB5RT` IS MIS-ATTRIBUTED THROUGHOUT THIS FILE.** It is the **V Ball RT / Precise V5 RT**
refill, **not** the Juice Up's (that is `LP3RF-12S3/S4/S5`). Affects the `pilot-g2` membership
table in research pass 1 and **measurement round 1**, which names one refill twice. Left in place
per the audit-trail rule; **read it through this note**. Full detail in research pass 9.

⚠️ **COUNTS.** **20 modelled entities / 37 edges**, and as of 5.5 **there are no shells left** —
`open_5_carry_log` was retired with the answer, so declared blocks and modelled entities are now
the same number in every file. (Earlier counts in this file silently included shells, which is why
they looked off by one.) **`python3 .notes/validate-eraser.py`** prints both figures for all six
ERD sources and checks that every relationship endpoint resolves.

**4.1 landed two things:** `fit_check.verified bool` → **`evidence enum`** (`declared | tested`)
and a new **`fit_report`** table carrying the approval gate. `fit_quality` became nullable.
**4.1b** then closed the read model: *nothing renders until approved* — `fit_report` has no
buyer read path at all, and every buyer-facing query reads `fit_check` only.
**4.3** split the overloaded `source` word three ways — **`claimed_by`** (`maker | community |
owner | staff`), **`made_by`** on `part`, and a shared **`citation_url`/`citation_note`** pair on
both `fit_check` and `refill_dimension`.
**4.4** made the fit verdict **derived** (demotion #9: disputed-out → scope → evidence → tie =
no verdict) and added the one thing a derived rule could not do — **`disputed_note text null`**
on `fit_check`, BVG's staff override for maker copy that is a typo or a copy-paste. It also
established that **`fit_check` is mutable curated state while `fit_report` is the append-only
log**, which is why there is no `retracted_at`.
**4.4b** then refused to mirror that column onto `refill_dimension` — a disputed *number* is
noise, not content, and a disputed-but-hidden row is the soft delete 4.4 just banned. Instead:
**`claimed_by` on `refill_dimension`** (the 4.3 enum, reused whole — BVG's own caliper numbers
were previously indistinguishable from untraced web numbers) and **guard 3 on Rule 3 — a geometry
negative fires only on an unconflicted `feature`, or on a `staff` row.** Displayed measurement is
**demotion #10**; the escape hatch for a bad number is `DELETE`.
**4.5** split the launch corpus in two — **catalog broad and cheap** (scraper stages, a human
promotes) vs **fit checks narrow and deep** (hand-curated, citation-gated), seeded
**negatives-first**: research corpus → BVG's own pens → maker lists last. Its two real findings:
a pen with zero fit rows is **not empty**, it renders the **prior** (`refill_style` +
`observance`), a **fourth display state**; and `ships_with_refill_id` is a **curation worklist,
not a free positive** (product-scoped, and BilletSpin's in-box refill is pre-trimmed). Coverage
is **demotion #11**. **Measurement round 1 is now a launch dependency** — no pen enters the
catalog before its `refill_style` exists, and the RB-space styles are still unnamed.

✅ ~~TWO SOFT DECISIONS — applied to the ERD, never explicitly ratified.~~ **Both were ratified
2026-08-13 as sweep items S1 and S2, along with a third (S3, 4.3's `source` split). Nothing in
the model is now carried on assent alone.**

**Scope was cut and revised in Sitting 3:** fountain pens are **out** (separate structure);
**pencil and marker/highlighter are IN** — the boundary is *"is there a seated cartridge,"*
not the writing medium. See the Sitting 3 section.

**Read order:**
1. **This file** — every decision. Source of truth; it overrides the others.
2. **`.notes/data-model-erd.md`** — the schema so far as an **eraser.io ERD**. BVG
   2026-08-11: *"the closer to an Entity Relationship Diagram (what eraser.io is using) the
   better."* **Update it in the same sitting a decision lands.** Decided material only;
   open forks stay as `// OPEN n.n` comments.
3. `.notes/data-model-questions.md` — the question set being worked through.
4. `.notes/data-model-research-findings.md` — background research. ⚠️ **Three known errors:**
   its **F4** is wrong (the ISO G2 band is **97.75–98.50**, not "98–99"); its per-maker
   **archetype table in §A is superseded** by F3′; and its claim that NTI's Parker Mid-Size
   converts to a pencil **via a kit** is wrong — the LeadSlinger is a **separate body** on a
   shared envelope (research pass 6).

Also relevant, older and partly superseded: `.notes/data-model-refills-and-products.md`
(its compat-edge sketch at lines 193–202 was rewritten by Sitting 2) and
`.notes/data-model-question-sketch.md` (scaffold; holds the original five fit grades).

**How this interview runs** — BVG asks for it this way:
- Ask one question at a time; he picks a letter or writes a third option.
- **Before each question, say what the accumulated evidence already implies and give a
  recommendation.** Don't relay the file back at him.
- **Flag tensions between his answers** instead of recording contradictions silently. This has
  now caught several real problems, including two of his own leans being wrong.
- Research a claim when it would change an answer. WebSearch/WebFetch work; **unsharpen.com
  403s WebFetch** — use the Chrome extension for that one.
- Record every decision here as you go, including knock-ons.

### The three rules Sitting 2 produced (they keep deciding things)

1. **A need modifies the refill or adds a part. Nothing modifies the pen.**
2. **An axis exists only for a fact no measurement can express.**
3. **Geometry may produce a negative, never a positive.**

### Highest-value open item

**Measurement round 1** — Juice Up BLS-VB5RT + Precise V5 RT, then EnerGel/Signo/Sarasa. BVG has
the pens. It places the provisional socket fracture line and unblocks naming the RB-space
sockets. Sitting 3 does **not** depend on it.

---

## Sitting 0 — Findings

### F3 — REVISED → **F3′**  *(BVG, 2026-08-10)*

Original F3 ("archetype is per-body, not per-maker") conflated two claims. Split:

**F3′ — Socket is a property of the configured body (body + tip option), not the maker.**

- **Curated / structural:** `socket_id` lives on the **tip option**, not the maker and not
  the product body. Evidence is overwhelming: Fellhoelter TiBolt (Schmidt) vs G2 TiBolt
  (G2 Mini), Karas Render K sold in Parker *and* G2 tip variants, Tactile Turn's whole
  per-length lineup.
- **Derived / display:** `archetype` is **not a stored column**. It's a badge computed
  from the compat edges plus the retention mechanism:

  | Signal | Badge |
  |---|---|
  | 1 refill on the edge set | hyper-specific |
  | N refills within one socket | semi-general |
  | collet / continuously-adjusting mechanism | clamped |
  | declares a socket + carries negative edges | near-standard |

**Why:** the original enum mixed three axes — permissiveness (hyper-specific →
semi-general → universal), retention mechanism (clamped is *why* BigIDesign and Modern
Fuel are universal), and declared-vs-actual gap (Bastion's near-standard is really 2.5's
negative edges wearing a hat). Deriving it means nothing to curate and nothing to drift.

**Evidence corrections rolled in:**
- NTI Parker Mid-Size vs G2 — withdrawn (BVG: NTI's G2 pen is full size, not Mini).
- Fellhoelter is **no longer** archetype evidence. Both TiBolts are hyper-specific; they
  point at different *sockets*. Same archetype, different socket.
- Tactile Turn (Standard semi-general vs Mini G2-Mini-only) is the only clean within-maker
  archetype flip, and under F3′ it falls out of the derivation for free.

**Knock-ons:**
- **F2** survives, but demoted — `clamped` and `near-standard` are outputs of the
  derivation rule, not schema enum members.
- **2.5** (negative assertions) gets more load-bearing: `near-standard` can't be derived
  at all without negative edges. Leaning (a)/(b) is now near-forced.
- **3.6** (compat-list storage) shares this seam — the tip option is the unit that owns a
  compat list, so inheritance+exceptions applies at that level.
- Working-notes per-maker archetype table (research findings §A) is **superseded** — drop
  the Archetype column, keep the refill-posture column as prose evidence.

### F1, F2, F4, F5, F6 — CONFIRMED as written  *(BVG, 2026-08-10)*

Reviewed without correction. F2 stands but is **demoted by F3′**: `clamped` and
`near-standard` are outputs of the archetype derivation rule, not schema enum members.

---

## Sitting 1 — Sockets  *(BVG, 2026-08-10)*

| # | Decision | Note |
|---|---|---|
| 1.1 | **Keep `pilot-g2`** (b) | Buyer-facing name wins; alias list carries the rest. Rejected `euro-rollerball-110`. |
| 1.2 | **Keep `energel` as a socket** (b) | Rejected the research lean. Enough pens target it. |
| 1.3 | **Add all three, Fisher + M22 separate** (a) | `hi-tec-c`, `fisher-pr`, `lamy-m22`. Kept apart until proven identical. |
| 1.4 | **One socket + `variance_note`** (b) | JP/EU clearance issue rides on the edges, not on structure. *See knock-on — largely moot now.* |
| 1.5 | **Distinct socket** (a) | `pilot-g2-mini` earns its row: TT Mini + Fellhoelter G2 TiBolt take it and nothing else. |

### Socket shape — **flat and disjoint** (siblings, not a tree)

Forced by 1.1 + 1.2 both landing on "keep". Sockets are a flat enum with no nesting and
no overlap. **A pen that accepts more than one socket declares multiple socket edges** —
pen→socket is many-to-many.

### Knock-ons from flat + disjoint

1. **`pilot-g2` no longer means the ~110 mm family.** It narrows to Pilot G2 and close kin.
   The family becomes a *dimensional* grouping (a display/browse concept), not a socket.
2. **1.4 mostly resolves itself.** If Japanese and European refills sit in different
   brand-level sockets anyway, the JP/EU boundary is already structural. `variance_note`
   is left covering only within-socket spread.
3. **The F3′ archetype derivation rule needs a rewrite.** "N refills within one socket"
   was written against a family-sized socket. Under flat sockets it becomes
   *"N refills across M sockets"* — semi-general now reads off the socket **count**, not
   the refill count.
4. **Open: does Schmidt earn a row?** Under the stated rule it should — Fellhoelter's Full
   Size TiBolt is Schmidt-only. Same question for Signo. See below.

### Sitting 1 addendum — what a socket *is*  *(BVG, 2026-08-10)*

BVG: *"Pilot G2 and EnerGel take different tip bore diameters and have different refill
geometry… not interchangeable unless the maker intends it or does it by accident with
sloppy tolerances… this is all pen dependent and this is why we will use user input to
refine."*

**The rule changed.** Not *"a socket earns a row when pens are built around it"* but:

> **A socket earns a row when it is geometrically distinct** — length, body OD, tip/cone
> profile, rear-cap geometry. Evidence of a dedicated body is corroboration, not the test.

**Architecture, stated plainly:** the socket join produces **candidates**; assertions
(maker + owner) produce **verdicts**. Socket is a *prior*, not an answer — so a socket drawn
slightly wrong is cheap, because reports override it. **This forces 2.5 to (a) or (b);
(c) "unlisted ≠ incompatible" makes the prior un-overridable and kills the refine loop.**

**No `euro-110` / family parent socket.** Grouping Pilot G2 + EnerGel + Signo + Sarasa by
nominal length is the derive-from-dimensions fallacy F6 exists to reject. If a ~110 mm
browse grouping is ever wanted it is display-only and must be marked "not a fit claim."

**`pilot-g2` is safely brand-named** because Pilot genuinely owns that envelope — the trap
only bites when a socket spans brands and one brand names it.

---

## Research pass — 110 mm gel refills  *(2026-08-10)*

### Measured: Pilot G2 (BLS-G2) — from BVG's dimensioned drawing

| Feature | in | **mm** |
|---|---|---|
| Overall length | 4.346″ | **110.39** |
| Rear cap OD × thick | 0.237″ × 0.050″ | **6.02 × 1.27** |
| Body OD | 0.234″ | **5.94** |
| Body run (rear → step 1) | 3.573″ | **90.75** |
| Step 1 / 2 / tip OD | 0.179″ / 0.124″ / 0.097″ | **4.55 / 3.15 / 2.46** |
| Front cone assembly | 0.773″ | **19.63** |
| Spring OD / free / compressed | 0.218″ / 0.75″ / 0.25″ | **5.54 / 19.05 / 6.35** |

Internally consistent (3.573 + 0.185 + 0.229 + 0.229 + 0.130 = 4.346).

### Verdicts on BVG's three claims

| Claim | Verdict |
|---|---|
| **1. G2 has a tip step / wider tip; Signo + Sarasa don't** | ✅ **Confirmed for G2** — and it's *three* steps (5.94→4.55→3.15→2.46 mm), not one. Trio not yet measured. Mechanism independently corroborated: BladeForums *"the wider refill hits the metal tension ring inside the barrel and that this is what stops it."* |
| **2. G2 slightly shorter; Signo/Sarasa/EnerGel uniform** | ✅ **Confirmed.** G2 = 110.39 mm measured. Sarasa JF / Signo UMR-85 / EnerGel LRN5 all published at **111 mm**. JetPens: EnerGel + Signo run "1–2 mm longer than other Euro-style refills." thepenbridge's 111 mm for G2 is **wrong**. |
| **3. G2 jams in Signo/Sarasa/EnerGel bodies; trio fits G2 bodies with wiggle** | ⚠️ **Mechanism confirmed, pairing unverified.** Front-end interference is well documented; this specific direction isn't. Asymmetry is structurally inherent — 111→110 needs a *trim*, 110→111 needs a *spacer*. |

### Socket list revision — **two envelopes, not four**

BVG's data **de-fragments** the earlier proposal. `signo` and `sarasa` get **no rows**.

| Socket | Members | Basis |
|---|---|---|
| `pilot-g2` | Pilot G2, Juice Up (BLS-VB5RT/VB7RT), Precise V5 RT | 110.39 mm, 3-step cone, Pilot's envelope |
| `energel` *(name TBD)* | Pentel EnerGel, Uni Signo, Zebra Sarasa | uniform 111 mm, no G2 tip step |

⚠️ **Open — naming the second socket.** It spans three brands with no owner, so `energel`
*is* the 1.1 trap pointed at Pentel. Options: keep `energel` with Signo/Sarasa as first-class
aliases, or a neutral name (`jp-gel-111`). Dimensional *naming* is fine; F6 objects to
dimensional *matching*.

Also unresolved: `schmidt-888` (~110 mm rollerball) — **never** `schmidt`, which spans two
sockets (P900 / EasyFlow 9000 are Parker-style, per Grimsmo Saga).

### Incidental findings

1. **An independent source names our exact axes.** thepenbridge: *"Compatibility can vary by
   pen body, **tip opening**, **spring placement**, and **rear plug design**."* → **2.4 must be
   generalised from "rear/nock geometry" to end geometry, front *and* rear.**
2. **2.4 undercounts.** The drawing shows **nine dimensions across five axes** — length, body
   OD, rear cap (OD + thickness), multi-step front cone, spring spec. Not "a third axis."
3. **The spring is part of the refill spec**, not an accessory (BVG drew it inline; NTI and
   Fellhoelter ship tip+spring as one kit).
4. **The "back plastic plug" now has a number** — 6.02 mm OD, *wider* than the 5.94 mm body,
   1.27 mm thick. The 2.4/2.5 failure cause is measurable, not qualitative.
5. **Dimensions explain, edges decide.** Refills carry a sparse dimension record for evidence
   and for explaining failures to users — never as the matcher. → strongest argument yet for
   the flexible side of **R4** (JSONB / separate dimensions table, not columns).
6. **Worst naming collision in the domain, documented in the wild.** thepenbridge repeatedly
   warns Pilot G2 is "not interchangeable" with Parker-Style G2 "despite the naming
   similarity." Two sockets, both called **G2** — visible in R2's scrape (`Pilot G2` 44 vs
   `ISO G2 (Parker)` 42). A bare "G2" must never resolve ambiguously, and `parker-style`
   should never surface as "G2" in the UI.
7. **Spacers are as mainstream as trimming** (F1's mirror). Two real trim-to-reference cases:
   Signo DX *"trimmed to match the Pilot Hi-Tec-C length"* (Karas Render K); EnerGel *"trimmed
   to Schmidt P8126/8127 length"* (Retro 51). → **2.3(a) confirmed in the wild.**

### Measurement queue (BVG has the pens)

1. **Juice Up BLS-VB5RT + Precise V5 RT** — tests the `pilot-g2` membership claim. If the rear
   cap or cone profile differs from G2's, that *is* the machined-pen failure cause, identified.
2. **EnerGel, Signo, Sarasa** — tests claims 1 and 3 directly.

**Sources:** [thepenbridge — Pilot G2](https://thepenbridge.com/refill/pilot-g2-refill/) ·
[thepenbridge — EnerGel](https://thepenbridge.com/refill/pentel-energel-refill/) ·
[Pens and Planes — Pen Hacks](https://pensandplanes.com/pen-hacks-2) ·
[JetPens — Ultimate Guide to Pen Refills](https://www.jetpens.com/blog/The-Ultimate-Guide-to-Pen-Refills/pt/231) ·
[JetPens — Zebra JF-0.5](https://www.jetpens.com/Zebra-JF-0.5-Sarasa-Gel-Pen-Refill-0.5-mm-Black/pd/3141) ·
[Cult Pens — Uni UMR-85](https://cultpens.com/en-us/products/uni-umr-85-gel-roller-refill) ·
[Cult Pens — Pilot BLSG2](https://cultpens.com/en-us/products/pilot-blsg2-gel-rollerball-pen-refill) ·
[BladeForums — metal pens for G2](https://www.bladeforums.com/threads/metal-pens-for-pilot-g2-gel-refills.1800285/) ·
[Penturners — Pilot G2 conversion](https://www.penturners.org/threads/pilot-g2-conversion.164921/)

---

---

## ISO 12757 spec — types G1 and G2  *(BVG supplied Table 3 + Figure 4, 2026-08-10)*

### Type G2 (= our `parker-style`), tolerance bands in mm

| Dim | Feature | Nominal | **Band** |
|---|---|---|---|
| a | overall length | 98,1 +0,40/−0,35 | **97.75 – 98.50** |
| b | rear Ø | 6 +0,1/−0,2 | **5.80 – 6.10** |
| c | tip Ø | 2,54 +0,03/−0,04 | **2.50 – 2.57** |
| d | tip length | 6,2 ± 0,2 | 6.00 – 6.40 |
| e | front section | 23,2 ± 1 | 22.20 – 24.20 |
| f | body Ø | 5,8 ± 0,1 | **5.70 – 5.90** |
| g | cone Ø | 2,4 ± 0,1 | 2.30 – 2.50 |
| h | rear feature | 0,6 ± 0,2 | 0.40 – 0.80 |

### Type G1 — **a socket we have not modelled**

a 106,8 ± 0,2 · b 3,2 0/−0,05 · c 1,6 ± 0,02 · d 7,5 +0,5/0 · e 30,5 ± 0,25 ·
f 5 ± 0,05 · g 3,3 0/−0,1 · h 13,8 ± 0,5

Structurally different: rear Ø (3.2) is **narrower** than body Ø (5), with a long 13.8 mm
tail. G2 and Pilot G2 both do the opposite — a rear flange *wider* than the body, which is
what a click mechanism grabs. Different retention strategy. **TODO: does any maker target G1?**

### ⚠️ **F4 is WRONG — correct it**

F4 says *"Parker-style really does span 98–99 mm."* The spec band is **97.75–98.50** —
0.75 mm wide. **A refill at 99 mm is out of spec, not at the edge of it.**

Reframes the finding: not *"the standard is loose, so tolerancing is fuzzy"* but
**"the standard is tight and some refills sold as Parker-style don't conform."** That is the
refill-side mirror of F2's `near-standard` — Bastion declares Parker and rejects some Parker
refills; some *refills* declare Parker and miss the band.

### Pilot G2 (measured) vs ISO G2 (spec)

| | Pilot G2 | ISO G2 band | Δ |
|---|---|---|---|
| Length | **110.39** | 97.75 – 98.50 | **+12.3 mm** |
| Body Ø | 5.94 | 5.70 – 5.90 | +0.04 over |
| Rear Ø | 6.02 | 5.80 – 6.10 | **in band** |
| Tip Ø | 2.46 | 2.50 – 2.57 | 0.04 under |

**They differ almost entirely in LENGTH.** Every diameter sits within ~0.05 mm of the ISO
band; the rear Ø is dead inside it. Independently validates the BladeForums claim to a tenth
— *"the Pilot G2 refills are 12mm longer than Parker style cartridges and very slightly
wider"* → 12.3 mm and 0.14 mm. That poster was measuring.

**So the G2/G2 collision is geometric, not merely linguistic** — the two refills are
near-identical in cross-section and 12 mm apart in length. They genuinely look like the same
part. Strong explanatory content for the site; see incidental finding #6.

### 🔑 De jure vs de facto sockets — the answer to the Sitting 1 arc

Sockets are **not all the same kind of thing**. Put `standard` on the socket row:

| Kind | `standard` | Dimensions are | Conformance |
|---|---|---|---|
| **De jure** — `parker-style` (ISO 12757:G2), `G1`, `d1` | set | authoritative, with tolerance | **checkable** |
| **De facto** — `pilot-g2`, `energel` | null | descriptive; the reference refill *is* the spec | not meaningful |

This is *why* `parker-style` is a clean socket with 50+ conforming refills while the ~110 mm
space is a mess of near-misses: **one has a standard and the other doesn't.** One field, and
it tells the UI how far to trust the numbers.

**Conformance checking does NOT violate F6.** F6 forbids *inferring fit* from dimensions.
Testing "does this refill meet the standard it claims" evaluates a declaration against the
spec that defines the term. Legitimate, and nobody else is doing it.

### TODO — Autmog against the `c` band

Autmog publishes a 2.5 mm bore ±25 µm. ISO G2 tip `c` = **2.50–2.57**. If Autmog's 2.5 mm is
the *tip aperture*, an **in-spec** Parker refill at the top of the band will not pass it —
a quantified explanation of why Autmog toleranaces per-refill and nobody else has to.
**Confirm what Autmog's 2.5 mm actually measures before leaning on this.**

---

---

## Research pass 2 — Unsharpen refill guide  *(2026-08-10)*

Source: <https://unsharpen.com/pen-refill-guide/> — **WebFetch 403s** (site-wide) and the
Chrome extension was not connected. Content below mined via search result summaries.
**Worth re-reading in full if the extension comes back** — it is likely the best single
seeding source for 4.5.

### 🔑 D1 has the same asymmetry — inside a *de jure* socket

> Unsharpen: D1 comes in **two widths** — "most Japanese manufacturers using the thinner
> design while German manufacturers tend to use the thicker one."
>
> "Zebra D1 refills are a fraction of a millimetre wider than most other brands. This doesn't
> stop Zebra refills fitting in other brands' pens, **but it can often stop other brands'
> refills fitting in Zebra pens.**" Workaround: wrap tape around the refill.

**BVG's claim #3 pattern — fit is directional, direction set by which part is wider — now
confirmed in a socket he didn't raise it about.** It is how the domain behaves, not a Pilot
quirk.

1. **Refines de jure vs de facto (correction).** D1 *is* ISO 12757-2 standardized and still
   has two incompatible widths. A standard makes the **nominal authoritative**, not fit
   guaranteed. The earlier framing overstated it.
2. **Vindicates 1.4(b).** BVG chose "one socket + variance_note" for the JP/EU split. The
   identical Japanese-vs-German split exists in D1 and the whole industry keeps D1 as **one
   socket with known variance**. Precedent for the call.
3. **The remedy is a RADIAL shim (tape), not a length fix.** 2.2's `needs` vocabulary
   (spacer, trim) is entirely length-oriented. Radial slop is a separate axis with a separate
   remedy. → **2.2 needs a radial value.**

### Lamy M22 — 1.3 open item CLOSED ✅

**60 mm × 5.8 mm**, proprietary to a small range of Lamy pens (notably the Pico). Fisher PR is
*"essentially a shortened, thinned down G2 refill with a metal body."* Shortened-and-thinned
vs shortened-only, **38 mm apart**. Not the same socket — **1.3(a) confirmed correct.**

(Aside: M22's 5.8 mm body Ø is exactly ISO G2's `f`. A stubby Parker, diametrically.)

### Fisher PR belongs to two sockets by design

Ships with *"a small plastic converter that can be placed on the back"* making it
Parker-compatible. Native to `fisher-pr` (Fellhoelter TiNyBolt, KeySmart Tactiv) **and**
reaches `parker-style` via an **OEM-bundled** adapter.
→ **2.2's `adapter` ("changes socket, not length") confirmed in the wild.**
→ **4.2:** the part's source here is OEM, not aftermarket — so source-on-the-part has at
least two values in practice.

**Fisher Universal:** 96 mm, with an indent at **67 mm** where you *snap it* to become a D1,
costing ~30% of the ink. A manufacturer-designed conversion between two sockets by breaking
the refill. Maker-supported → in scope by BVG's own premise. **No `needs` value covers it.**

### Hi-Tec-C

*"Long cylindrical plastic barrel and a disc-shaped collar between the barrel and the thin,
needle-point tip."* Similar to but **generally not interchangeable with Uni-ball Signo UMR-1**
— another near-miss pair. The disc-shaped collar is the distinguishing feature.

### 🔑 RULE — socket names and aliases must be **model-level, never brand-level**

Four instances, so this is a law, not an anecdote:

| Brand word | Sockets it spans |
|---|---|
| **"G2"** | ISO 12757 G2 (Parker) · Pilot G2 |
| **"Schmidt"** | 888/5888 (~110 mm) · P900 / EasyFlow 9000 (Parker) · EasyFlow 6000 (D1) |
| **"Signo"** | UMR-1 (Hi-Tec-C-ish) · UMR-85 (111 mm) |
| **"Fisher"** | PR (own socket + Parker adapter) · Universal (96 mm, snaps to D1) |

**Settles the pending naming question:** the second 110 mm envelope **cannot** carry a bare
"Signo" alias. Aliases must be `Signo UMR-85`, `EnerGel LR/LRN`, `Sarasa JF`. Same reason
`schmidt-888` is required over `schmidt`.

**Sources:** [Unsharpen — Pen Refills Guide](https://unsharpen.com/pen-refill-guide/) ·
[Unsharpen — Fisher PR](https://unsharpen.com/refill/fisher-space-pen-pr-series-pressurized-ballpoint-pen-refill/) ·
[Unsharpen — Schmidt EasyFlow 6000](https://unsharpen.com/refill/schmidt-easyflow-6000-hybrid-refill/) ·
[JetPens — Guide to D1 Pen Refills](https://www.jetpens.com/blog/Guide-to-D1-Pen-Refills/pt/249) ·
[Pen Heaven — Refill Guide](https://www.penheaven.com/blog/pen-refill-finder-and-guide)

---

---

## Research pass 3 — Unsharpen guide, FULL TEXT  *(2026-08-10, via Chrome)*

Read in full at <https://unsharpen.com/pen-refill-guide/>. Supersedes the search-fragment
notes in pass 2 (those remain correct; this adds numbers).

### 🔑 The ~110 mm family HAS an ISO standard — **ISO "RB", 110 mm × 6.3 mm** — and nobody follows it

| Refill | Body Ø | vs RB nominal 6.3 |
|---|---|---|
| Pilot G2 (BVG's drawing) | **5.94** | −0.36 |
| Zebra Sarasa | **6.09** | −0.21 |
| Schmidt 8120 | **6.81** | **+0.51** |

0.87 mm spread, none on nominal. The article even self-contradicts — claims the Sarasa "fits
the exact dimensions set in the ISO standard for the RB size," then measures it at 6.09.
*(Good concrete example for 4.4 conflict-display and 4.5 seed-as-unverified.)*

**→ Correction: the de jure / de facto split needs a THIRD tier.** "Does a standard exist"
and "is it observed" are separate questions, and only the second predicts behaviour:

| Socket | Standard | Observance |
|---|---|---|
| `parker-style` (ISO G2) | yes | **well observed** — 50+ conforming refills |
| `d1` | yes | observed, but **two legal widths** (2.1 / 2.35 mm) |
| ~110 mm rollerball (ISO **RB**) | yes | **poorly observed** — 5.94–6.81 against 6.3 |

### 1.1 naming = established community convention ✅ (with a tension)

> "people who review pens will often call the ISO standard the **'Parker-style G2'** while
> calling the rollerball size the **'Pilot G2.'**"

Exactly BVG's 1.1 call. **⚠️ But the convention uses "Pilot G2" for the WHOLE Japanese
rollerball size — Sarasa included** — while BVG's model wants `pilot-g2` narrow (Pilot's own
envelope only). Same words, different scope. **Decide deliberately, don't inherit.**

Root cause, per the article: "the G2 is an ISO ballpoint standard, but also the name of a
mega-popular pen. More people know about the pen than the ISO 12757 standard."

### 🔑 Fisher PR — fit decomposed, axis by axis

> "Using an included plastic converter the refill can be made to exactly fit the G2 standard.
> **Critically, the design of the front of the refill and the shoulder that holds the spring
> is exactly the same as the G2 specification.**"

Fisher PR = **90 mm × 4.8 mm**. Against ISO G2: front geometry ✅ · spring shoulder ✅ ·
length ❌ (90 vs 98) · body Ø ❌ (4.8 vs 6) · **converter fixes length only.**

**Fit is four independent comparisons, not one.** A part can pass some and fail others.
→ **2.4 settled by demonstration.**

### Third confirmation that the TIP is the discriminator

The ~106–107 mm × ~3.05–3.2 mm cluster — **A2 / X10 / X20** — separates purely on tip Ø:
*"The X20 has a thicker writing tip than the A2 so the two are not interchangeable"*; X10 is
*"a variant of the X20 but it has a narrower tip."*

**Pilot BRF** (87 mm × 6.0 mm): *"similar to the Parker-style G2 refills, but they are shorter
and have different contours near the writing tip."* → BVG's "contour near the tip" is the
domain's recurring failure mode, seen now in three independent size classes.

### Open items RESOLVED

- **G1 ≈ A2 → skip the row.** Unsharpen's A2 = 106.8 mm × 3.2 mm, exactly BVG's spec-sheet G1
  `a` and `b`. A2 is *"rarely seen any more, largely replaced with proprietary refills."*
  Machined-pen relevance ≈ zero. **Recommend no `G1` socket row.**
- **"Schmidt" spans ≥5 sockets** — 888/5888 · P900 & EasyFlow 9000 (Parker) · EasyFlow 6000
  (D1) · 8120 (110 mm, 6.81 mm) · 8126 / **P8126 (97.6 mm — "P" = short version)**.
  The brand is unusable as an identifier. Model-level naming rule **confirmed hard**.
- **Trim amounts span 1–13 mm.** "EnerGel trimmed to Schmidt P8126 length" = 111 → 97.6 =
  a **13.4 mm** trim. → **2.3's amount field is not optional.**

### ⚠️ Methodological catch — measurements need a LOCATION

BVG's drawing dimensions *named features* (body OD, rear cap OD, step 1). Web sources say
only "diameter." Sarasa's 6.09 may be its widest step — comparable to Pilot's **rear cap
6.02** (0.07 mm apart) rather than its **body 5.94** (0.15 mm apart). **Cross-source numbers
are meaningless without a measurement location.** The dimension record needs a `feature` per
value, not a bare number. Reinforces R4-flexible.

### Seed table — ISO types with published dimensions

| Type | Length | Ø | Notes / examples |
|---|---|---|---|
| **D1** | 67 mm | **2.1 *or* 2.35** | two legal widths. Schmidt EasyFlow 6000, Uni SXR-200, Kaweco Soul |
| **A2** (=G1?) | 106.8 mm | 3.2 | spring shoulder 33.4 mm from tip. Schneider Express 75 M. Obsolete |
| **B3** | 128 mm (varies) | — | Bic Cristal, Pokka Pen |
| **C1** (Cross) | 117 mm | 3.05 | screw-type, twist retractables |
| **G2** (Parker) | 98 mm | 6 max, **2.5 max at tip** | Schmidt EasyFlow 9000, Parker QuinkFlow, Itoya Quick Dry Gel |
| **X10** | ~106.8 mm | 3.05 | narrower tip than X20. Aurora Hastil, Thesi |
| **X20** | 107 mm | — | 27 mm tip→spring wings. Schneider Office 765, Express 740/775 |
| **RB** | 110 mm | 6.3 | poorly observed — see above |
| **Fisher PR** | 90 mm | 4.8 | proprietary; front + spring shoulder match G2 exactly |
| **Pilot BRF** | 87 mm | 6.0 | proprietary. BRFN-10 (Dr. Grip), BRFN-30 (S20), BRF-25-BB |
| **Schmidt P8126** | 97.6 mm | — | short version of 8126 |
| **Schmidt 8120** | ~110 mm | 6.81 | "pronounced steps" + recessed spring holder |

**Note:** ISO 12757-1 (general) and 12757-2 (stricter, "documentary use") both define types.
The standard is **not freely available** — ~$65. BVG's G1/G2 table is therefore a real asset.

---

---

## 🔑 DECISION — socket granularity is set by **observance**  *(BVG, 2026-08-10)*

Resolves the `pilot-g2` scope fork. Chosen over "narrow, geometry rules" and "broad, follow
the community" because it **explains** the difference instead of picking a side.

> **Socket granularity is set by observance, not by whether a standard exists.**
> A socket exists to be a useful **prior**. If the nominal predicts fit, keep the socket whole
> and carry deviation as variance. If the nominal does not predict fit, **fragment** down to
> the clusters that do.

### Applied

| Space | Standard | Observance | Result |
|---|---|---|---|
| `parker-style` | ISO 12757 G2 | well observed (50+ conforming) | **one socket**; non-conformers get negative edges / a conformance flag |
| `d1` | ISO 12757-2 | observed, two legal widths | **one socket + `variance_note`** (JP-thin 2.1 / DE-thick 2.35, Zebra asymmetry) |
| ~110 mm rollerball | ISO RB (110 × 6.3) | **poorly observed** (5.94–6.81) | **fragments** — no `RB` socket in our model |

### ⚠️ This overturns 1.4(b) — and a claim I made

Pass 2 said the D1 precedent "vindicated" 1.4(b) *one socket + variance*. **Wrong.** D1's
precedent supports keeping **D1** whole, because D1's nominal is observed. It implies nothing
about RB, whose nominal isn't. Under this rule the 110 mm space fragments and the
Japanese/European boundary is a fracture line — so **1.4 is dissolved, not answered (b)**:
the two groups land in different sockets before the question can be asked.

### Fracture lines the evidence supports

| Cluster | Body Ø | Confidence |
|---|---|---|
| Pilot G2 (+ Juice Up, Precise V5 RT) | 5.94 | **provisional** |
| EnerGel / Signo UMR-85 / Sarasa JF | ~6.09 | **provisional** |
| European rollerball (Schmidt 8120) | **6.81** | **confirmed** — 0.72 mm clear of both |

- **JP/EU split: unambiguous.**
- **Pilot-vs-trio split: NOT independently confirmed.** 0.15 mm apart, and BVG's 5.94 (body
  OD) may not be the same feature as Unsharpen's 6.09. BVG's claims (tip step, 110.39 vs 111,
  the jam) support it; the numbers in hand don't. **→ measurement round 1 is now the
  highest-value open item.**
- **`schmidt-888` is live again** — same cluster as 8120 (6.81), or a fourth?

### Socket row gets two fields, not one

- `standard` — what it claims, e.g. `ISO 12757-1:G2`, or **`ISO RB (nominal only,
  non-conforming)`** for `pilot-g2`.
- `observance` — whether that claim predicts anything. Curated now; **derivable** later from
  the dimension records once enough exist.

RB therefore survives in the model as a **standard our sockets reference but none conform
to** — honest, and good site content ("all loosely called RB; here's the actual spread").

---

## Sitting 2 — Fit vocabulary & failure modes  *(BVG, 2026-08-10)*

### Research pass 4 — need-count distribution in the real corpora

Fetched NTI's ink guide, Tactile Turn's refill lists, Pens and Planes' hack list, and
Fellhoelter's G2 Adapter Kit page to measure needs-per-edge instead of arguing it.

| Source | Entries | 0 needs | 1 need | **≥2 needs** |
|---|---|---|---|---|
| NTI ink guide | ~17 | 15 | 1 (Fisher PR4 adapter) | **1** (G2-in-Parker) |
| Tactile Turn (Standard + Short) | ~70 | ~43 | ~27 — all trims, with amounts | **0** |
| Pens and Planes hack list | 11 | 0 | 6 | **5** |

🔑 **Cardinality is a function of the source.** Maker charts publish the clean path (0–1 op,
essentially never compound). The community hack corpus is **45% compound**. F5 says the
community knowledge is the gap and the gap is the product — so the model must hold the shape
of the *hack corpus*, not the maker charts.

After BVG's scoping — and after the tip-option correction below — most compounds collapse,
but not all:

| Case | Final reading |
|---|---|
| **NTI, G2 in a Parker body** | **1.** *"swap the spring and tip for our G2 Spring & Pen Tip"* is choosing a **different tip option**, not a need. The only need on that option's edge is **trim**. |
| **Karas Retrakt** | **2 — survives.** *"trim... to the length of a Parker Ballpoint"* **and** *"use the black plastic spacer."* Both refill-side. |
| Fisher Space Pen + Hi-Tec-C | **1.** spring swap → tip option; tape → radial, re-filed to 2.6. |

🔑 **The Retrakt case is a pattern, not a one-off: "trim to X length" makes the refill inherit
X's spacer.** That is the general shape of a genuine two-need edge, and it's why cardinality
> 1 has to be supported even though the observed rate is now low.

**Kit-atomicity — measured, not assumed.** Fellhoelter's kit is *"a new titanium tip, a new
spring, a mini G2 refill, and a titanium adapter"* — **4 parts, 1 operation, no trimming.**
NTI's tip+spring is **one SKU**; the trim is not in it. So NTI's "three needs" is really **two**.

### ⚠️ New: `adapter` is modelled three incompatible ways in the wild

Same part (Fisher PR4's bundled converter), three treatments:
- **NTI** — an edge note, zero needs: *"Includes a Parker-style adapter — drops into any Mid-Size NTI pen."*
- **Tactile Turn** — folded into the **refill's identity**: "Fisher Space w/ PR4 Adapter" is
  its own entry in the without-modification list.
- **Us** — a required part on the edge (below).

Good 4.4 material; also a warning that seeded rows from different makers won't agree on shape.

---

### 2.2 — **ANSWERED: there is no `needs` enum**

BVG: *"we shouldn't be needing to do more than swap a tip (which should come with a spring),
trim to length or add a spacer."* Started at three values, landed at **zero** — the three
decomposed into a modification and a part.

Supersedes the pass-2 lean of five-plus-radial-plus-conversion.

**What the three absorbed** (not lost, re-filed):

| Candidate | Goes to | Why |
|---|---|---|
| `adapter` | **spacer** | Fisher's PR4 converter, TT's Parker-Style Refill Adapter, the 3D-printed D1 sleeve are all "a part added behind or around the refill" |
| socket conversion (Fisher Universal snaps at 67 mm → D1) | **trim** | snapping at the indent *is* trimming to length; the socket change is a consequence |
| `spring swap` | **tip kit** → then **tip option** | ships as one SKU at Fellhoelter and NTI; then removed entirely, below |
| **`tip kit`** | **the tip-option slot (Sitting 3)** | see the correction below |
| `spacer` | **a required part ref** | it was never a vocabulary value, just "a part is required" |

**What genuinely drops:**
- **Pen modification** (Schneider "needs enlarged tip hole") — see the rule below.
- **Radial shim / tape** — not a need at all. A machined pen that needs tape to stop rattle is a
  **loose fit**. → re-filed to **2.6**, and it makes `loose` load-bearing rather than cosmetic.

### 🔑 CORRECTION — `tip kit` is not a need, it's a tip option

Caught by applying BVG's own drilling rule to a value we'd just adopted. Swapping the tip is
**literally a different tip**, and under **F3′** `socket_id` lives on the tip option. So NTI's
*"swap the spring and tip for our G2 Spring & Pen Tip"* = **choose a different tip option** —
a SKU NTI sells, already modelled by 3.2/3.3 as a slot.

The only difference from drilling: a swapped tip is **purchasable**, so its edges exist; a
drilled tip isn't a product, so its edges don't.

| Act on the pen | Is | Edges |
|---|---|---|
| Swap to a maker-sold tip | a **tip option** | exist, under that option |
| Drill the tip hole | not a product | none — negative edge with a reason (**2.5**) |

### 🔑 RULE — needs act on the refill, never on the pen

> **A need modifies the refill or adds a part. Nothing modifies the pen.**
> The configured body + tip option *is* the identity — anything that changes it changes the
> **Product**, not the edge.

BVG: *"drilling a hole is out of scope and not included in 'they fit' — that's a totally
different tip at that point."* Under **F3′** `socket_id` lives on the tip option, so a drilled
pen is simply a *different tip option* with its own socket and edges. The model already
expresses it; nobody sells it.

**Knock-ons:**
1. **We diverge from Tactile Turn's published chart.** TT lists Schneider Express 735 and
   Slider 755 under "Without Modification *(needs enlarged tip hole)*" — TT's binary is
   refill-centric. For us those are **negative edges with a reason** → feeds **2.5**.
2. The vocabulary now closes on a principle, not a list, so future candidates are testable
   rather than debatable.

### 🔑 THE SHAPE — `needs` = an optional trim spec + a set of required parts

No enum. One modification and one parts list:

| # | Decision | Note |
|---|---|---|
| **2.1** | **(a″)** — a **set**, as a trim spec on the edge **+ required part refs** | Rejected (a) generic need rows (invents a vocabulary layer over things that aren't alike) and (b) single enum + note (loses Karas Retrakt and the parts query). Cardinality > 1 confirmed by Retrakt. |
| **2.2** | **No `needs` enum** — see above | |
| **2.3** | **Amount + reference, both nullable, neither required** | Trimming is irreversible and the real range is **1–13 mm**, so "needs trimming" alone is thin. BVG: *"fine with keeping trim length and we can hide it if it does not produce value to the consumer"* → **captured always, display deferred to the UI pass.** |
| **2.3b** | **`from_which_end` dropped — it's a constant** | Physically forced, not merely observed: the front end carries the ball and the seating cone. TT's *"2mm off the top"*, P&P's *"off the back"*, and the Fisher Universal's 67 mm snap are all the rear. |
| **new** | **`sourcing` on the edge→part link** — `included_with_pen` · `included_with_refill` · `purchase_separately` | Started as BVG's `included_with_refill` boolean; widened because Karas Retrakt's spacer ships **with the pen** and Fisher's converter ships **with the refill**. |

> **"Drops in unmodified" = no trim, and every required part is already in a box you own.**
> That is NTI's own sentence (*"Includes a Parker-style adapter — drops into any Mid-Size NTI
> pen"*) expressed as a query.

**Reference beats amount.** *"Trim to Parker ballpoint length"* is stable across pens;
*"trim 2 mm"* is not — which is exactly BVG's stickout objection, and the reason both fields
exist rather than just the number.

Falls out free:
1. **4.2 dissolves** — OEM vs aftermarket is a property of the *part row*, not a value on the
   edge. Fellhoelter's kit and the 3D-printed D1 sleeve differ because the parts differ.
2. **No new machinery** — 3.2/3.3 already require parts as first-class SKUs.
3. **Hot query stays trivial** — `trim_mm IS NULL` and no non-included required parts.

**Storage: relational, not JSONB** — per the repo convention below. Curated data is the moat;
JSONB in this codebase is reserved for scraper output.

### 2.4 — **ANSWERED (a″): ONE axis, rear-end topology**  🔴

The refill declares the rear it has (`open` / `plugged` / `finned` — values TBD); the pen
declares what its mechanism requires. A **second prior** refining the socket prior, and the
structured `reason` on negative edges (**2.5**).

### 🔑 The test that admits an axis

> **An axis exists only for a fact no measurement can express.**

Arrived at by BVG rejecting tip contour: *"I don't care what the tip is like as long as it fits
the pen and works correctly — tip shape is just a function of manufacturer specs and variable
choices."* Checking it against the corpus proved him right, and then proved it goes further.

**Rear plug passes.** No number distinguishes a closed-plug rear from an open tube. It's
topology — which is exactly why BVG's Juice Up case is invisible to every dimensional tool,
including incoherency.co.uk.

**Everything else fails.** Research pass 4 had proposed five or six axes off thepenbridge
(*"pen body, tip opening, spring placement, rear plug design"*) and Unsharpen's Fisher PR
decomposition. Applying the test kills all but one:

| Proposed axis | Killed because |
|---|---|
| tip contour | every corpus failure reduces to **a Ø at a named location** — A2 vs X20 tip Ø, Pilot BRF's *"different contours near the writing tip"*, G2's steps hitting the *"metal tension ring"*, Hi-Tec-C's *"disc-shaped collar"*, Jetstream's collar. Cone shape also isn't enumerable. |
| spring shoulder | measurable and published as a position — A2's *"33.4 mm from tip"*, X20's *"27 mm"*. thepenbridge's "spring placement" is a coordinate. |
| length, body Ø | continuous; **F6** forbids matching on them |

⚠️ **Correction to research pass 4.** Those sources list what *varies*, not what needs modelling
apart from measurement. "Fit is four independent comparisons" was right as *explanation* and
wrong as a schema instruction.

**Nothing is lost — tip re-files three ways:**

| Aspect | Goes to |
|---|---|
| tip **aperture** pass/no-pass (Autmog 2.5 mm ±25 µm) | **2.7**, as `bore_mm` |
| tip **contour** | the dimension record — explanatory only, never matched |
| tip **style** (needle / conical) | **5.1**, a writing property |

**Knock-on:** the axis is a *prior*, not a verdict — same standing as the socket join per the
Sitting 1 addendum. Continuous dimensions keep their pass-3 role: sparse, `feature`-tagged,
explain-only.

### 2.5 — **ANSWERED (a′): scoped negatives, most specific wins**  🔴

Negatives are first-class, carry a **scope** (refill × socket, or refill × tip-option) and a
required **reason**. Specificity beats generality; both beat socket inheritance.

**(c) was already dead** — the Sitting 1 addendum ruled that "unlisted ≠ incompatible" makes the
socket prior un-overridable and kills the refine loop, and F3′ can't derive `near-standard`
without negatives.

**2.4 shrank the question first.** Rear-topology mismatches now **derive** from the join — Juice
Up declares `plugged`, a general G2 mech declares it needs `open`, negative falls out unstored.
Stored negatives are for causes that aren't topological:

| Case | Why it must be stored |
|---|---|
| **Bastion** declares Parker, rejects some Parker refills | cause never published |
| **Schneider Express 735** in a TT Short | cause is a tip-hole Ø neither party publishes |
| Owner reports | "doesn't fit," no cause known |

**Why scoped rather than (a) or (b):** each alone loses real data.

| Fact | (a) per-edge | (b) refill-level socket-wide |
|---|---|---|
| *"Juice Up doesn't drop into general G2 pens"* | N rows that drift | **one row — and it's the truth**, a fact about the refill |
| *"EnerGel works across the socket **except** the Ti2 TechLiner"* | **one row** | inexpressible — no socket-wide claim to except from |

### 🔑 KNOCK-ON — this settles **3.6** (Roy's) as a by-product

2.5 and 3.6 are **one mechanism**: a resolution order over assertions at different grains.
Tactile Turn's published list is the proof — *"the Slim... have much the same compatibility, but
items with `**` will not work"* is a scoped exclusion set against an inherited list.
→ **3.6 = (a), inheritance + exceptions.** Roy owns both; answering 2.5 hands him 3.6 decided.

### 2.6 — **ANSWERED (a): `loose` is a warning tier** — and the grade enum collapses

**(a).** Styled apart from the passes. The market treats wiggle as a defect, not a shrug:
BigIDesign markets *"no refill tip-wiggle"*, Autmog markets 25 µm, halffull credits the collet
with solving rattle. Radial slop was re-filed here out of `needs` (2.2), so this is now its only
home — `loose` is load-bearing, not cosmetic.

### 🔑 The five-grade ladder becomes DERIVED — F3′ a second time

The ladder was `designed_for / native / maker_part / trim / loose`
(`.notes/data-model-refills-and-products.md:195–224`). Sitting 2 made most of it redundant:

| Grade | Now |
|---|---|
| `designed_for` | already its own field — `toleranced_for` |
| `maker_part` | **derived** — has a required part (2.1) |
| `trim` | **derived** — has a trim spec (2.1/2.3) |
| `native` | **derived** — neither |
| **`loose`** | **the only member that stores anything** |

⚠️ **And it mixed orthogonal axes — the exact defect F3′ found in `archetype`.** Trim fixes
**length**; loose is **radial** clearance. Independent by construction, and 2.4 confirmed radial
is its own thing. A trimmed refill in a wide bore is **trimmed *and* loose**; one enum forces a
false choice. **Second occurrence of this pattern in the project** — expect a third.

**Stored, then:**

| Field | Values |
|---|---|
| fit quality | `toleranced` · `snug` · **`loose`** |
| needs | trim spec + required parts *(2.1)* |

Display ladder = a function of both. Nothing to curate, nothing to drift.

### NEW — functional-warning flag: "fits but you shouldn't"

Answers the question the sketch asked and never got
(`data-model-question-sketch.md:98`), now with evidence: **Ti2 TechLiner + Jetstream fits
perfectly, but the magnet causes ink-flow problems with hybrid ink.** A physical pass with a
functional fail. Orthogonal to fit quality *and* to needs → a **flag**, not a grade.

Second instance on record: sanding a Jetstream collar works but *"seems to affect how the refill
writes."* (Out of scope as a technique, still valid as evidence the class is real.)

**Knock-on:** confirms **5.1** — ink type is a functional facet, not cosmetic, because
`ink_type` × pen mechanism is what produces this warning. Both sides are categorical, so the
flag can be **derived** for the magnet case and curated otherwise.

⚠️ **Supersedes the compat-edge sketch** at `data-model-refills-and-products.md:193–202`
(`fit native|loose`, `needs none|spacer|extender|trim`). Both fields changed shape in Sitting 2.

### 2.7 — **ANSWERED (b′): add `bore_mm`, negatives only**

Keep the 3-way `precision/standard/wide`, add numeric `bore_mm`.

⚠️ **The pass-1 lean was wrong as recorded** — *"`bore_mm` defines socket boundaries"* conflates
a **pen-side** aperture with a **refill-side** clustering. Socket boundaries come from
**observance** (Sitting 1's decision). Defining them from dimensions is what **F6** forbids and
what incoherency.co.uk does badly. Right answer, wrong reason.

### 🔑 RULE — geometry may produce a negative, never a positive

A refill tip wider than the hole is a hard impossibility — the same F6-safe class as conformance
checking. A hole *wide enough* proves nothing: length, rear topology and spring still apply.
Same asymmetry as 2.4's derived negatives, so no new mechanism.

**Two guards:**
1. Fires only when **both numbers carry a `feature` tag** (pass 3's methodological catch).
2. **The Autmog TODO is now a dependency, not a curiosity** — if Autmog's 2.5 mm is the tip
   aperture, an **in-spec** Parker refill at the top of ISO's 2.50–2.57 band won't pass it.
   Best content on the site if true; wrong if guessed.

**Coverage inversion — the two fields aren't redundant.** `precision/standard/wide` is curatable
for every pen; `bore_mm` exists for almost none (essentially Autmog). → **Derive the 3-way from
`bore_mm` where present, curate it where absent.**

### Sitting 2 pattern — questions keep dissolving into other questions

Five so far, all in one sitting: **4.2** → 2.1 (part rows) · **radial slop** → 2.6 · **tip
contour/style** → 2.7 + 5.1 · **topology negatives** → derived by 2.4 · **3.6** → 2.5.
The question set treats these as independent; they aren't. Worth expecting more in Sittings 3–5.

### Repo constraints found (bear on storage)

- **Postgres + Drizzle** (`dialect: "postgresql"`).
- ~~`enums.ts` uses **`as const` string arrays, not `pgEnum`** — vocabularies are already
  app-level, so adding a value costs a TS edit, not a migration.~~ Vocabulary churn is *not* an
  argument for JSONB here.

  ⚠️ **CORRECTED 2026-08-13 — the `pgEnum` half is out of date.** PR **#63** (*feat: sync user
  settings to db*, merged 2026-08-12) established the opposite pattern, and it is now universal
  in the committed schema: a vocabulary is declared `as const` in `enums.ts` **and then wrapped
  in a `pgEnum` at the column** — `user-settings.ts:10–13` and `feature-flags.ts:14–18`, six of
  six domain vocabularies. **So growing one costs a TS edit AND a generated migration.**

  **Nothing decided flips, and the advice gets stronger.** In Postgres `ALTER TYPE … ADD VALUE`
  is cheap and non-blocking; **removing or reordering** a value is the expensive one. So *"start
  coarse and grow"* — 3.3's lexicon call, 3.1's widening of `medium`, and C2's whole answer — is
  now better advice than when it was made, not worse. What weakens is only the phrase *"it's
  free"*: it is cheap, not free. Affected claims: **2.2's repo-constraints note (here), 3.1,
  3.3, C2.**

  **And it hands the implementer the concrete shape**, which C2 left open: our ~20 curated
  vocabularies are `as const` in `enums.ts` → `pgEnum` on the column. Not a lookup table, and not
  a bare TS union either.
- **`jsonb` appears in exactly one file — `scraper.ts`** (`bodyDetails`, `variants`,
  `normalizedData`, `bullets`). Every curated table is relational. House rule already exists:
  **JSONB for ingested data, relational for curated data.** Compat edges are the most curated
  data in the product.

---

## Research pass 5 — pencil / marker machined pens  *(2026-08-11, BVG supplied 6 URLs)*

Triggered by BVG scoping pencils + fountain pens out, then immediately naming five pencil
makers and a marker. Fetched all six. **The scope cut is right for fountain and wrong for
pencil**, for a reason nobody had stated: the boundary isn't the writing medium, it's
**whether a seated cartridge exists**.

### 🔑 The Schmidt Feinminen pencil mechanism is a `parker-style` CARTRIDGE

Schmidt sells **DSM 2005 / 2006 / 2007 / 2008** as commodity third-party pencil mechanisms
(0.5 / 0.7 / 0.9 mm). Two of BVG's five makers build on it — **Studio Neat Mark Three**
(DSM 2005) and **Fellhoelter TiBolt ReLeaded** ("Schmidt Feinminen-System"). eBay lists the
part as *"DSM 2006 Feinminen System Mechanical Pencil **Converter for Parker Style**."*

> Penturners: *"The Schmidt pencil mechanism is **the same operational length as a
> parker-style refill, and can be actuated by the same transmission**."*

**It fails exactly the way our model already predicts:**

| Observed | Our mechanism |
|---|---|
| *"the DSM2005, 2006, and 2008 all have an **annoying little flange at the top** of the refill that prevents it from being used in some mechanisms"* | **2.4 rear topology** — verbatim the Juice Up case |
| *"the nib has to have the right internal geometry… Some pen kits have the correct nib shape… Some do not"* | **2.5 stored negative** — cause unpublished by either party, like Schneider Express 735 in a TT Short |
| *"…but can be modified to work"* | **out of scope** — Rule 1, nothing modifies the pen |

**Zero new machinery.** A pencil mechanism is a refill in a socket we already have.

### The five makers split into two, not one

| Maker | Mechanism | Socket |
|---|---|---|
| Studio Neat Mark Three · Fellhoelter TiBolt ReLeaded | Schmidt Feinminen | **`parker-style`** |
| BigIDesign Bolt Action Pencil | *"0.5, 0.7 and 0.9 mm mechanical pencil **systems**"* — Schmidt's own word; **unconfirmed** | probably `parker-style` |
| Modern Fuel Click Pencil | proprietary; sells 0.5/0.9 mm **mechanisms as SKUs** | maker-proprietary, 1 row |
| NTI LeadSlinger | *"shares the same diameter and length as our Parker format pen **bodies**, making it easy to convert any of our Parker pens into a mechanical pencil, and vice-versa"* | **body-level swap**, not an internal kit |

⚠️ **Corrects the research findings.** F4's note said NTI's Parker Mid-Size *"converts to a
mechanical pencil and back"* via a kit. It's a **separate body** matched to the same envelope
so the maker's slot parts interchange — which is a **3.2** fact (maker-scoped options), not a
tip option.

Modern Fuel selling lead Ø as a swappable mechanism SKU is **F3′ again**: lead Ø lives on the
option, not on the pen.

### ⚠️ The Charpie breaks something nothing else has

Fellhoelter **Mark 22 "Charpie"** — felt-tip marker. Retailer copy: it ships with *"3D printed
tools to assist in **gutting a Sharpie** for a refill."* Fellhoelter's own page says only
*"Will Include Tools For assembly and Disassembly"* — **the cartridge is unconfirmed at
source; confirm before leaning on it.**

If it holds, it's the first consumable in the corpus that is **not a purchasable row** — you
destroy a retail marker to harvest it. Every refill so far has a SKU to point an edge at.
Maker-supported (Fellhoelter ships the tools), so it's in scope by BVG's own premise — the
same premise that admitted trimming.

### 🔑 CONSEQUENCE — no `writing_system`; widen the refill's `medium` instead

The two-level finding from 3.1 gets stronger, not weaker. Pencil mechanisms, marker
cartridges and pen refills are **all seated cartridges** — structurally one thing. What
differs is what's inside, which is a **refill facet 5.1 already stores**.

→ **5.1's `ink_type` widens to `medium`**: ballpoint · gel · hybrid · rollerball ·
pressurized · **graphite** · **permanent marker** · **highlighter**.

Per the repo constraint (`enums.ts` = `as const` arrays, not `pgEnum`) that is a **TS edit,
not a migration.** The pen still has no category; the cartridge does.

**Sources:** [BigIDesign Bolt Action Pencil](https://bigidesign.com/products/bolt-action-pencil) ·
[Studio Neat Mark Three](https://www.studioneat.com/products/markthree) ·
[Modern Fuel Click Pencil](https://modernfuel.com/products/the-click-pencil) ·
[ITS Tactical — TiBolt ReLeaded](https://www.itstactical.com/gearcom/edc/tibolt-releaded-an-american-made-bolt-action-titanium-pencil-from-brian-fellhoelter-available-now/) ·
[NTI LeadSlinger](https://nottinghamtactical.com/products/leadslinger) ·
[Penturners — DSM 2006](https://www.penturners.org/threads/schmidt-dsm-2006-pencil-mechanisms.83065/) ·
[Schmidt Pen Parts — DSM 2005](https://www.schmidtpenparts.com/products/schmidt-dsm-2005-feinminen-pencil-system) ·
[Fellhoelter Mark 22](https://fellhoelter.com/products/mark-22)

---

## Research pass 6 — the adapter corpus  *(2026-08-11)*

Triggered by BVG's correction: *"not all tips are setup for the parker style since it needs to
screw in — it can fit but it needs to be planned for, you need an adapter setup for most pens
so its not a 1:1 swap."* He was right; pass 5 overstated. Fetched six adapter products plus
the competitor.

### ⚠️ Correction to pass 5

The DSM is **not** a `parker-style` member. Schmidt's own copy: *"a plastic barrel and can be
used for **plug in or screw in** assembly"* — it's an **OEM component for pen builders**, which
is why penturners discuss it. Same operational length ≠ same socket. **Retention differs.**

**Correct placement: its own socket (`dsm-feinminen`), bridging to `parker-style` via a part —
the Fisher PR pattern**, already in the model.

### 🔑 "Adapter" is TWO things — and **F3′ already cuts them apart**

Fourth occurrence of the mixing-orthogonal-axes pattern (`archetype` → fit ladder →
`category` → **`adapter`**). The discriminator is **where the part sits**:

| Product | Sits on | Scope | Extra parts | Our model |
|---|---|---|---|---|
| Fisher PR4 converter | **refill** rear | any Parker pen | bundled | **bridge** |
| Tinkerforce D1→Parker | **refill** (sleeve + O-rings) | any Parker pen | O-rings | **bridge** |
| TT Parker-Style Adapter | **refill** rear (nub) | TT Standard only | **+ "Short" spring** | **bridge**, pen-scoped |
| Alpha Pen Parker Adapter | **pen** | Alpha Executive only | adjustable screw | **tip option** |
| Fellhoelter G2 Adapter Kit | **pen** + new tip | full-size TiBolt | tip, spring, refill | **tip option** |

Fellhoelter's instructions settle it: *"**Pull the old tip off the pen**, ink too. Then drop the
adapter in the pen, small end first… and **screw on the new tip**."* That is a pen conversion →
a **tip option**, not an edge adapter. Zero new machinery.

### 🔑 A bridge is PARTIAL — and the residual is exactly `loose`

Fisher PR: **89 mm × 5.8 mm** bare, **99 mm with the adapter** (Penstore).
**ISO G2 band = 97.75–98.50.** → **the bridged refill lands 0.5 mm OUT of the band it bridges
into.** The adapter overshoots.

And the failure is at the other end entirely — FPN, Fisher in a Parker Jotter:

> *"the tip of the Space Pen insert **wiggles around when I write** because the Space Pen refill
> has a **slightly smaller diameter at the tip** than the standard Quink refill."*

The converter is a **rear** part. It fixes length and rear Ø; the **front is untouched, and
that's where it fails.** Remedies offered: aluminium foil tape, clear tape, a stronger spring,
or a sleeve cut from a dead Parker refill.

→ **2.6 `loose` + radial remedy, third independent instance** (D1/Zebra tape · Hi-Tec-C/UMR-1 ·
now Fisher/Parker). Sitting 2's call to re-file radial slop out of `needs` into `loose` is
validated hard.

### 🔑 This PROVES Rule 3 rather than testing it

I flagged that a positive bridge might brush Rule 3 (*geometry may produce a negative, never a
positive*). The Fisher numbers settle it in Rule 3's favour: **89 + 10 = 99 — geometry would
have said "fits Parker."** It doesn't; it wiggles at the tip. A **declared** mapping on a
**declared** part is safe precisely because it computes nothing. **Rule 3 stands, reinforced.**

### Four more properties a bridge row needs

1. **Directional.** *"the Fisher refill is compatible with Parker pens, but **Parker refills are
   not compatible with standard Fisher pens**."* Fourth instance of directional fit
   (Pilot/trio · D1/Zebra · Hi-Tec-C/UMR-1 · Fisher/Parker). **Directionality is a law of this
   domain.** A reverse bridge is a separate row.
2. **A set of parts, not one.** TT ships a **"Short" spring** — *"the springs that come on the
   Standard pens do not work with the Parker-style refills."* Matches **2.1**'s shape exactly.
3. **Some bridges are continuously adjustable** — Alpha's *"adjustable stainless steel screw
   that lets you set the exact refill stick-out length"*; Tinkerforce's *"**1 or two** O-rings
   depending on how much retention you prefer."* That is the **`clamped`** archetype on the
   *part* side. An adjustable bridge has **no fixed output geometry** → `result_quality` must be
   nullable.
4. **Pen-scoped bridges exist.** TT's works only on Bolt Action / Side Click **Standard**.
   So scope mirrors **2.5**: socket-wide by default, narrowable.

### Competitor check — nobody models any of this

incoherency.co.uk filters on *"pen style, ink type, tip profile, and rough dimensions."*
**No adapters, no bridges, no negatives.** **F6 confirmed and sharpened: the adapter corpus is
unmodelled by anyone.** Note it independently reached our 1.1 conclusion — it ships
*"Parker-vs-Pilot warnings."*

### Incidental

- **New socket sighted:** Alpha converts *from* **Montblanc threaded cartridges** — and threaded
  retention is the same class as the DSM. Not modelled; note it.
- **4.4 conflict, live:** Fisher PR is **90 mm × 4.8 mm** (Unsharpen) vs **89 mm × 5.8 mm**
  (Penstore) — 1 mm apart on *both*. 5.8 is exactly ISO G2's body band `f`. Good conflict-display
  case, and it means the wiggle is at the **tip**, not the body — as FPN says precisely.

**Sources:** [Fellhoelter G2 Adapter Kit](https://fellhoelter.com/products/tibolt-g2-adapter-kit) ·
[Tactile Turn Parker-Style Refill Adapter](https://tactileturn.com/products/adapter-to-be-able-to-use-parker-style-refills) ·
[Tinkerforce D1→Parker](https://tinker-force.com/products/d1-to-parker-refill-adapter) ·
[darksucks Alpha Pen Parker Adapter](https://darksucks.com/products/alpha-pen-parker-adapter) ·
[Penstore — Fisher pressurized refill](https://penstore.com/en/fisher-space-pen/pressurized-refill-for-space-pen-parker) ·
[FPN — Space Pen insert wiggling in a Parker Jotter](https://www.fountainpennetwork.com/forum/topic/332129-space-pen-insert-wiggling-around-at-the-tip-in-parker-jotter/) ·
[incoherency — Pen Refill Compatibility Finder](https://tools.incoherency.co.uk/pen-refill-compatibility-finder)

---

## Sitting 3 — Product identity & slots  *(BVG, 2026-08-11)*

### 🔑 SCOPE — the boundary is "is there a seated cartridge", not the writing medium

BVG first cut pencils **and** fountain pens to a separate session with a separate table
structure, then supplied five pencil makers and a marker. Research pass 5 + 6 says the cut is
**right for fountain, wrong for pencil**:

| Class | Consumable | Decision |
|---|---|---|
| Refill pens — ballpoint · gel · hybrid · rollerball · pressurized | seated cartridge | **in** (current model) |
| **Pencil** — Schmidt Feinminen, proprietary mechanisms | seated cartridge | **in** — own sockets, bridge to `parker-style` |
| **Marker / highlighter** — Fellhoelter Charpie et al. | seated cartridge | **in** — new sockets |
| **Fountain** | nib + feed + converter, **no seated cartridge** | **out** — separate structure, BVG's cut stands |

**Cost of admitting pencil + marker:** ~3 socket rows, one rear-topology value (`flanged`), and
a widened `medium` vocabulary. No new tables.

⚠️ **"ballpoint" is read as the whole refill-based space**, not ballpoint ink only — the narrow
reading would delete most of Sittings 1–2 (EnerGel, Signo, Sarasa, Juice Up are all gel).
Stated as an assumption; not contradicted.

### 3.1 — **ANSWERED (a): Product = the body**  🔴

Category is **derived**, not stored. The Schon/pencil cases were never load-bearing — **F3′
forces it on in-scope evidence alone**: Karas Render K sells in Parker *and* G2 tip variants,
NTI's Parker Mid-Size takes the G2 Spring & Pen Tip. One body, two sockets. The body cannot be
the compat unit.

**🔑 `category` was hiding two levels** — the third occurrence of the F3′ pattern:

| Level | Source | Status |
|---|---|---|
| **Writing system** (refill / pencil / marker) | the tip option | **not modelled** — one structural class in scope |
| **Medium** (ballpoint · gel · hybrid · rollerball · pressurized · **graphite** · **permanent marker** · **highlighter**) | the **refill** | **5.1 already stores it** |

→ **No `category` column and no `writing_system` field.** A Parker-socket pen browses under
"ballpoint" and "gel" because refills exist in both — a join. Widening `medium` is a TS edit
(`enums.ts` = `as const`), not a migration.

⚠️ **Caution:** TT offering Parker *and* G2 tips is one writing system, two sockets — **not two
categories.** The derivation reads off writing system, never tip-option count.

**Schon seam:** falls out of "fountain out" — catalogue the Machined Pen v2 in the refill
schema with its rollerball section as the tip option, and record *"also accepts Pocket Six
fountain sections"* as a **note, not structure**. The fountain session decides later whether to
promote `body` to a shared row. Deliberately not paying for it now.

### 3.6 — **ANSWERED (a)** by 2.5's knock-on. Not re-asked.

### NEW — **socket bridges** *(BVG: "(c′) approve as suggested")*

Opened by BVG's correction that a DSM is not a 1:1 Parker swap. **A part may declare a directed
socket→socket mapping**; one row serves every refill in the source socket. Replaces N
per-edge rows that drift — the same objection 2.5 raised for negatives, now answered for
positives.

| Property | Forced by |
|---|---|
| **Directed** — reverse is a separate row | *"Fisher refill is compatible with Parker pens, but Parker refills are not compatible with standard Fisher pens"* — 4th instance of directional fit |
| **A set of required parts** | TT ships adapter **+ "Short" spring** — 2.1's shape |
| **`result_quality` nullable** | adjustable bridges (Alpha's screw, Tinkerforce's 1-or-2 O-rings) have no fixed output geometry |
| **Socket-wide by default, narrowable** | TT's works only on Bolt Action / Side Click Standard — mirrors **2.5**'s scoping |
| **Yields a CANDIDATE, not a verdict** | Fisher + adapter = 99 mm, **outside** ISO G2's 97.75–98.50, and wiggles at the tip |

**Half the "adapters" in the corpus need no bridge at all** — Alpha's and Fellhoelter's sit *in
the pen* and are **tip options** under F3′. `adapter` split on where the part sits: the
**fourth** occurrence of the mixing-orthogonal-axes pattern.

**Rule 3 reinforced, not threatened:** 89 + 10 = 99 — geometry would have said "fits Parker."
It doesn't. A declared mapping on a declared part is safe *because it computes nothing*.

### 3.2 — **ANSWERED (a′): maker-scoped slot options + a family scope**  🔴

BVG: *"i think this is the right call… we need to be flexible by brands."*

`slot_option` carries `maker_id` + a nullable `family_id`; `product_family` is a maker-scoped
size/envelope class; `product.family_id` points at it. **Null family = maker-wide.**

Rejected **(a)** flat maker-scoped — it asserts a Standard spring fits a Mini, which is TT's own
marketing and already disproved — and **(b)** per-product, which duplicates every clip ~30× and
makes each new body re-enter its whole parts list.

**Scope is keyed to a family, never to a product-id list.** A list is exhaustive today and
silently wrong tomorrow: a new TT Standard body would inherit nothing. Families also match how
makers publish scope (*"Standard sizes"*, *"Parker format bodies"*, full-size vs Mini), so
seeding is transcription rather than inference.

**Fifth instance of the backbone pattern** — general claim + scoped exceptions, most specific
wins.

#### 🔑 The clincher — four makers express variation at four different grains

Autmog and Modern Fuel supplied by BVG; NTI and Fellhoelter already on file.

| Maker | Sells parts? | Families? | Variation is expressed as |
|---|---|---|---|
| **Tactile Turn** | many, cross-line | **yes** — Standard / Mini / Slim / Short | slot options + family scope |
| **NTI / Fellhoelter** | some | yes — "Parker format bodies"; full-size vs Mini | tip options on a shared envelope |
| **Modern Fuel** | some — tips, springs, pencil mechanisms | **no** — one adjustable platform | tip options **+ an adjustment** |
| **Autmog** | **none** | none | **a separate Product per refill / refill class** |

(a′) absorbs all four with no maker-specific shape: Modern Fuel and Autmog carry a null
`family_id`, and Autmog simply has **zero `slot_option` rows**. (a′) is a strict superset of
(a), not a tax on the simple case.

#### Knock-on — `tip_option` stays **per-product**; the ERD's `// OPEN 3.2` there is resolved

The ERD flagged the same fork on `tip_option`. It resolves the **other way**, for the same
reason that decided 3.2: **duplication cost is what justified family scoping, and it doesn't
exist at this grain.** A body has 1–3 tip options; a maker has dozens of clips, bolts and
springs. The one real cost — edge duplication across body variants — is **already answered by
3.6** (inheritance + exceptions), which exists for precisely that (*"flat per-tip-option edges
duplicate ~40 rows per body variant"*). Keeping `tip_option` concrete also keeps the identity
unit (3.1) and the edge anchor (2.5) concrete.

#### Autmog — "a Product per refill" is a maker strategy, not a schema shape

It **confirms** 3.1(a) rather than straining it: Autmog's bodies genuinely are separate
products, each with exactly **one** tip option. `tip_option` therefore stays mandatory even
when it is 1:1 — collapsing it for Autmog's convenience would put `socket_id` back on the
product and undo **F3′**.

Two consequences:

1. **`toleranced_for` finally has a home.** 2.6 named it (*"`designed_for` — already its own
   field, `toleranced_for`"*) but the ERD never carried it. Autmog is exactly the maker that
   needs it — 2.5 mm ±25 µm, toleranced per refill, no parts to fall back on. Added as
   `tip_option.toleranced_for_refill_id`; **placement follows F3′** and is the one inferred bit.
2. **Display caution:** browsing by socket must not privilege makers who fragment their
   catalogue. Autmog yields N product cards where Karas yields one with two tip options.

### NEW — **3.2b: ANSWERED (b″) + tip-option override**  🔴  *(BVG: "seems logical", 2026-08-11)*

**Stored on `product`:** `radial_retention` (`fixed` | `collet`) · `axial_adjust`
(`none` | `adjustable`) · `accepts_length_min_mm` / `max_mm` (nullable).
**Overridable on `tip_option`:** `axial_adjust` + the two length columns, all nullable —
**three columns, no `radial_retention` override** (zero corpus evidence for a tip option that
adds a collet; ERD rule 1 forbids inventing it).

`clamped` now derives from `radial_retention = collet` **OR** `axial_adjust = adjustable`.
The 3.2b gap is closed.

⚠️ **The sub-fork was approved by assent to my stated lean, not chosen explicitly.** BVG said
*"seems logical"* to a message recommending the override. Recorded as decided; **cheap to
reverse** — dropping three nullable columns — if he meant only (b″) itself. The Alpha case is
the whole justification: sold bare it is fixed, with the Parker adapter fitted it gains an
adjustable stick-out screw, and product-only storage makes **one of those two configurations
always wrong.**

**Also accepted in the same breath:** `trim_necessity` (`required` | `discretionary`) on
`compat_edge`, fixing the "drops in unmodified" query that the aBAP × EnerGel disjunction broke.

### The question that opened 3.2b (kept for the reasoning)

Opened by BVG's Modern Fuel evidence: *"the universal aBAP which comes as a G2 size but can be
adjusted for others and can take a spring/tip swap to use a trimmed EnerGel or a Parker with
adjusting the internal space."*

**The gap.** F3′ derives the `clamped` badge from *"collet / continuously-adjusting
mechanism."* **Nothing stores that.** `product.action` is **actuation** (click / bolt / twist);
`bore_class` / `bore_mm` is **aperture size**. One of the four archetype badges is currently
underivable.

🔑 **A new defect class — a derived field whose input was never stored.** The four prior
defects were all enums *mixing* orthogonal axes (`archetype` → fit ladder → `category` →
`adapter`). This one is the mirror image: the demotion to derived was right, but the input got
demoted with it.

**What the aBAP proves, independent of how 3.2b lands:**

- **Adjustment does not violate Rule 1.** Using a maker-built adjustment is using the pen as
  designed, not modifying it — the same standing pass 6 gave Alpha's screw and Tinkerforce's
  1-or-2 O-rings.
- **Adjustment is bounded.** The aBAP still needs the EnerGel **trimmed**. It reduces length
  needs; it does not absorb them. So edges keep their trim specs, and adjustability can **not**
  be back-derived from "this pen has many socket edges."
- **First product in the corpus spanning sockets by two mechanisms at once** — a spring/tip
  swap (a **tip option**, per the 2.2 correction) *and* an internal-space adjustment. They are
  independent and both are needed to reach Parker.
- ⚠️ **Radial and axial are about to get mixed again.** A collet clamps **radially**
  (BigIDesign, halffull's rattle claim); the aBAP's internal space and Alpha's stick-out screw
  are **axial**. 2.6 already proved these independent — trim fixes length, `loose` is radial.
  A single `retention` enum would be the **fifth** occurrence of the mixing pattern. Recommend
  two fields, not one.

#### ⚠️ SELF-CORRECTION — the axial half of my (b) fails **Rule 2**  *(BVG supplied Modern Fuel's product copy, 2026-08-11)*

> *"It can hold ink refills from **89 mm to 116 mm** in length, which includes the overwhelming
> majority of full-size refills on the market. This includes popular ink refills like Fisher
> Space Pen, Pilot G-2, and many more."*
> *"You can adjust the ink tip to extend closer or farther from the pen's tip."*

**A published number exists, so `axial_adjust` cannot be an enum.** Rule 2: *an axis exists
only for a fact no measurement can express.* Adjustability **is** expressed by a measurement —
a **27 mm acceptance window**.

**Revised recommendation (b′): a length window, not an axial enum.**

| Field | Kind | Precedent |
|---|---|---|
| `accepts_length_min_mm` / `accepts_length_max_mm` | pen-side aperture, **negatives only** | **2.7's `bore_mm`, exactly** — same class, other axis |
| `radial_retention` (`fixed` \| `collet`) | stays an **axis** | no measurement expresses it — nobody publishes a collet's grip range |

⚠️ **(b′) SUPERSEDED by (b″).** It was right about the numbers and **wrong to delete the flag.**
BigIDesign's collet and Alpha's screw are **stated but never measured**, so a numbers-only
design cannot express them at all.

**2.7 already solved this exact coverage inversion** — `bore_class` is curatable for every pen,
`bore_mm` exists for essentially Autmog alone — and its answer was *keep both; derive the coarse
one from the number where present, curate it where absent.*

**FINAL recommendation (b″) — coarse curated flags + precise numbers where published:**

| Field | Kind | Coverage | Precedent |
|---|---|---|---|
| `radial_retention` (`fixed` \| `collet`) | coarse, curated | every pen | none — no maker publishes a collet's grip range, so no numeric twin exists |
| `axial_adjust` (`none` \| `adjustable`) | coarse, curated | every pen | **`bore_class`** |
| `accepts_length_min_mm` / `max_mm` | precise, **negatives only** | ~1 maker | **`bore_mm`** |

Rule 2 is not violated: these are **facets with a numeric twin**, the same standing as
`bore_class`. Matching (negatives) fires only off the numbers, never off the flags.

`clamped` derives from `radial_retention = collet` **OR** `axial_adjust = adjustable` — so it
works for BigIDesign, which publishes no numbers at all, as well as for Modern Fuel.

#### ⚠️ WITHDRAWN — the 111 mm EnerGel is **not** a Rule 3 counterexample  *(BVG, same day)*

I recorded it as one an hour earlier. It isn't. BVG: *"trim because the default config is set
for G2, so if you trim you don't need to adjust internally with tools, just pick one."*

**The window was right and the trim was never required.** 111 mm does fit; you turn the set
screw. The trim exists only to reach the **factory default (G2, 110.39 mm)** without opening
the wrench.

- **Rule 3 stands**, on the Fisher case alone. The EnerGel case is struck as evidence for it.
- **`accepts_length_*` still yields a candidate, not a verdict** — rear topology, bore and
  spring all still apply. That was always true on general grounds; this case just doesn't
  prove it.
- The measurement question I raised (*"why does 111 need trimming inside a 27 mm window"*) is
  **closed, not open.** It rested on a false premise.

#### 🔑 NEW — the first **disjunction** in the corpus, and it breaks 2.1's headline query

Two remedies, **either one sufficient**, and the user picks:

| Remedy | Acts on | Reversible | Cost |
|---|---|---|---|
| Trim EnerGel 111 → G2's 110.39 | the **refill** | **no** | permanent, no tools |
| Turn the set screw | the **pen's setting** | yes | needs the bundled wrench |

**2.1 modelled conjunction only.** Its shape is *a trim spec **and** a set of required parts* —
Karas Retrakt (trim **and** spacer) is the case that forced cardinality > 1. Nothing in the
corpus had offered **alternative** remedies until now. Tinkerforce's *"1 or two O-rings"* is a
disjunction of **quantity** driven by preference, not two routes to the same fit.

⚠️ **The hot query is now wrong.** 2.1 defined *"drops in unmodified"* as
`trim_mm IS NULL` + no non-included required parts. The aBAP × EnerGel edge **carries a
`trim_mm` and drops in unmodified anyway** — turning a maker-supplied screw is using the pen as
designed, which Rule 1 already established is not a modification.

**Recommended fix — one field, not a new structure:** `trim_necessity` on `compat_edge`,
`required | discretionary`. The hot query becomes
`(trim_mm IS NULL OR trim_necessity = 'discretionary')`.

#### ⚠️ WIDENED — necessity is a property of **every remedy**, not of trimming  *(BVG, 2026-08-12)*

I scoped it to the trim spec. BVG's spring answer shows that was too narrow:

> *"springs are almost always tied to refills — while you can use many different ones, you do
> often need to swap springs for refills. However it could potentially still work with the same
> one, it just might not be optimal or have the same feel."*

**A required part can be optional too, and for a different reason than the trim was.** Two
distinct kinds of not-required, so the field needs **three** values, not two:

| Value | Means | Case |
|---|---|---|
| `required` | won't work without it | Karas Retrakt's trim **and** spacer; Fisher's PR4 converter |
| `recommended` | works, but **degraded** — feel or performance | **the spring swap** — BVG's *"not optimal, not the same feel"* |
| `optional` | works **identically**; equivalent remedies, user picks | aBAP × EnerGel — trim to the G2 default *or* turn the screw |

`recommended` and `optional` are genuinely different: the aBAP's two routes reach the same
result, the un-swapped spring doesn't. Collapsing them loses the only thing a buyer wants to
know.

**Shape:** one shared `necessity` enum, on **both** `compat_edge.trim_necessity` and
`edge_required_part.necessity`. Supersedes the 2-value `required | discretionary` recorded above.

🔑 **And it confirms `necessity` belongs on the LINK, not the part row.** The spring is the
first part whose necessity is **refill-dependent rather than pen-dependent** — the same spring
is required for one refill and merely recommended for another. A property of the pairing.

**No new machinery for springs otherwise.** A spring already appears in all three places the
model supports: inside the refill's drawn spec (dimensions, research finding #3), bundled into
a tip option (NTI's "G2 Spring & Pen Tip", Fellhoelter's kit), and standalone as a part (TT's
"Short" spring, Modern Fuel's spare).

**Do NOT derive it.** "This pen's window is wide enough, so the trim must be optional" is
geometry producing a **positive** — Rule 3. It gets curated.

**Display value:** *"No mods needed — adjust the screw. Or trim 0.6 mm if you'd rather not."*
Nobody models this; incoherency.co.uk cannot express it at all.

#### The general shape — an adjustable pen has a **default setting**, and it is per-socket

Modern Fuel ships set for G2 *and* ships a G2 in the box, so `ships_with_refill_id` carries
both facts here. **They are separable** — a maker could ship set-for-Parker with a G2 loose in
the box — but no corpus case does, so **one field, revisit if it splits.**

The default setting is *why* the disjunction exists: trimming to the default's length is what
lets you skip the tool. Any adjustable pen will have the same structure.

#### Incidental from the same copy

- **Ships with:** *"Titanium Clip (Already installed) · Pilot G-2 Refill (Already installed) ·
  Additional set screw · Extra spring · Custom wrench."* The adjustment is a **set screw driven
  by a bundled wrench** — a maker-supplied tool, so Rule 1 is untouched.
- ⚠️ **`ships_with_refill` ≠ `toleranced_for`.** Modern Fuel ships a G2 and accepts 89–116;
  Autmog's bore is *cut for* one refill. Default config vs design intent — two claims. Merging
  them into one field would be the fifth axis-mix. Keep separate.
- **3.3 evidence:** an *"extra spring"* in the box is a **spare**, not a purchase-time choice.
  Supports **3.3(b)**. ⚠️ Unconfirmed whether it is the swap spring BVG referenced or a spare.
- **3.4 evidence:** the clip is installed, material-specified and edition-defining →
  **clip is a slot option, 3.4(a).**
- **3.7 evidence:** *"This edition features a … titanium clip"* — an edition that differs
  **only by an installed slot option**. If that generalises, **3.7(a)** suffices.
- **Stick-out has two purposes on one mechanism** — writing-angle preference (*"slanted"* vs
  *"vertical"*) and length accommodation. Same screw, one is a 5.x comfort facet and one is
  fit. Note only; no fork.

### 3.3 — **PARTIALLY ANSWERED: the vocabulary is ruled, the structure is not**  *(BVG, 2026-08-12)*

**Membership, decided:**

| Kind | In? | BVG |
|---|---|---|
| `spring` | **IN, and load-bearing** | *"important to capture — springs are almost always tied to refills"* |
| `clip` · `bolt` · **`bolt_handle`** · **`top_cap`** | **IN** | *"a lot of makers offer custom options for clip, bolt, bolt handle, top cap, etc."* |
| `o_ring` | in, but **rare** | *"orings are less common"* |
| `back_piece` | **OUT** | *"not really parts"* |
| `grip` | **OUT → reclassified** | *"Grip might be more like the milling itself"* — a **surface treatment of the body**, so it joins finish + material + milling and goes to **3.7** |
| `tip` | **OUT** — it is `tip_option`, which owns `socket_id` (**F3′**) | — |
| `adapter` / `conversion kit` | **OUT** — split by where the part sits (pass 6) | — |

**Grip's reclassification is the fifth mixing-pattern instance landing correctly**: the posed
list held separable objects *and* body properties, and BVG cut on exactly that line unprompted.

#### 🔑 Maker-specific parts lists — the lexicon and the rows are two different things

> BVG: *"fellhoelter and nti are like this but have slightly different parts so we need to once
> again build out some specific parts lists for brands that may or may not share those across
> other brands… we can work on the lexicon now or later."*

Two questions wearing one coat, and **3.2 already answered the second:**

| | What it is | Where it lives |
|---|---|---|
| **Lexicon** | *what kind of object this is* — clip, bolt, bolt_handle, top_cap, spring | a **global** `kind` vocabulary, coarse |
| **Parts list** | *whose it is and what it fits* | **`part.maker_id` + `family_id`** — 3.2 (a′), already decided |

Fellhoelter's bolt handle and NTI's bolt handle are the **same kind** and **different rows**.
Nothing needs a per-maker vocabulary; it needs per-maker *rows*, which exist.

**Cross-brand parts are already expressible** — `part.maker_id` is nullable, so a Schmidt
spring or a generic O-ring is a maker-less row usable by anyone.

**Recommend building the lexicon NOW, coarse.** The repo constraint makes it cheap: `enums.ts`
is `as const` string arrays, **not `pgEnum`**, so a new kind is a TS edit rather than a
migration. Starting narrow and growing costs nothing; guessing the full list costs a wrong
abstraction.

#### ✅ CLOSED — `top_cap` is the kind, "back piece" is a TT alias  *(BVG, 2026-08-12)*

> *"I have not seen back piece used anywhere else but top cap seems like a generalized item
> across many makers."*

**The Sitting 1 socket-naming law now applies to parts too** — model-level name, brand words as
aliases. Third domain it holds in (sockets, socket members, part kinds).

🔑 **Refinement — aliases follow their target's storage, not a single pattern:**

| | Target is | So aliases are |
|---|---|---|
| **Sockets** | **rows** — they carry `standard`, `observance`, `variance_note` | a **table** (`socket_alias`) |
| **Part kinds** | a **TS `as const` vocabulary** — no per-kind data exists | a **TS map**, `{ back_piece: 'top_cap' }` |

No table, no migration. The alias's job here is **seed-time normalisation** — when TT's catalogue
says "back piece," it lands on `top_cap` — plus search. Both are pure lookup.

Also worth noting the asymmetry with sockets: *"back piece" vs "top cap" is a **synonym**, not an
ambiguous collision.* Nothing like "G2" (two sockets) or "Schmidt" (five). Synonyms are cheap;
collisions are what forced socket aliases to be first-class.

### 3.4 — **ANSWERED (a′): clip is a part; `clipless` is not an action sub-type**  *(BVG, 2026-08-12)*

Asked three times in the question set. **3.3 pre-answered it** — the way 2.5 arrived at 3.6
pre-answered — once `clip` was ruled into the parts lexicon.

`none` is not an enum value; it is the **absence of a clip in a configuration**. Autmog's
*"36 Clipless Click Pen"* survives verbatim in `product.name` under 3.1, so (a′) costs nothing.

**Two different things wear the word "clipless":**

| | What it means |
|---|---|
| **TT** | one body, clip attaches and detaches → a **configuration** |
| **Autmog** | *if* the body has no clip provision machined in → a **different product** under 3.1 |

Both expressible today, no new field. *(Still unconfirmed which Autmog is — asked, unanswered.)*

#### ⚠️ CORRECTION — I claimed "a clip has nothing to do with actuation." Wrong.

> BVG: *"a clip can be a mech in the sense that there are clip bolts where the clip moves to
> actuate the pen. but clipless pens typically refer to pens that have a separate mech and can
> or can not have a clip."*

**Verified.** US Patent 5,651,626 is literally *"Retractable clip actuated pen"* — *"when the
pressure member is turned outwards, the actuating member is forced downwards to push the refill
out of the barrel."* And US 11,535,049 (bolt action) has the clip **coupled** to the carrier:
*"the clip slides with the refill."*

So the clip has **three** possible relationships to the mechanism — independent · coupled ·
**actuator** — and only the third makes a pen un-clipless-able.

⚠️ **Resist a three-value clip-relationship enum.** The corpus is thin (patents, not machined-EDC
products), and the fact that actually matters — *can this pen exist without its clip* — falls out
of the actuator axis in **3.5** for free. Don't pay twice.

#### 🔑 The real consequence — `product.action` is mixing axes, and `side_click` already proved it

BVG's clip-bolt is the third data point; the first was sitting in the question set unnoticed.

| Observed value | Advance mechanism | Actuator |
|---|---|---|
| `click` | ratchet | top button |
| **`side_click`** | ratchet | **side button** ← already two facts in one value |
| `bolt` | bolt | bolt knob |
| **"clip bolt"** | bolt | **clip** ← BVG |
| `twist` | screw | body rotation |
| `toggle` | ? | toggle |
| `capped` | **none** | n/a ← a third axis entirely |

A flat enum needs `clip_bolt`, then `clip_click`, then every other pairing: **N × M values
instead of N + M.** Split it and the explosion never starts.

**It also resolves the `toggle` double-listing** flagged two turns ago — `toggle` appears in
3.3's parts list *and* 3.5's action list because it is **both**: an actuator (3.5) and the
physical part you actuate (3.3). Two axes, two homes, no conflict.

**Incidental:** [Modern Fuel sells a **Bolt Action Pen Clip Kit**](https://modernfuel.com/products/bolt-action-pen-clip-kit)
— more 3.3 evidence that a clip is a maker-scoped part, and from the maker with no families.

## Research pass 7 — the toggle/switch corpus  *(2026-08-12, BVG supplied 4 URLs)*

Fetched TT Switch, Magnus ClickShift, two BilletSpin CamPen listings, plus the CamPen index.

### 3.5 — the toggle is an actuator **and** a part, proven on one page

> TT: *"**Deploy the tip with a flip of the toggle switch**, our take on the mechanism rebuilt
> for a smoother action."*

And the actuator ships in **stainless steel or C63000 bronze** — a material choice. So the same
object is an **actuator** (3.5) and a **part with variants** (3.3), exactly as the split
predicted. The double-listing I flagged was never a conflict; it was two axes.

### 🔑 A maker publishes a NEGATIVE, scoped to the tip option, in caps

BilletSpin CamPen (Energel):

> *"**ONLY takes an Energel refill**" · "**WILL NEED TO BE TRIMMED TO FIT THE BARREL**" ·
> "One trimmed Energel refill is included in this barrel" · "**THIS NOSE CAP WILL NOT FIT A
> PARKER STYLE REFILL**"*

Three decisions confirmed verbatim by a maker, unprompted:

| Copy | Confirms |
|---|---|
| *"**THIS NOSE CAP** will not fit a Parker style refill"* | **2.5** — negatives scoped to the **tip option**, with a reason. The maker scopes it to the part, not the pen. |
| *"will need to be trimmed"* | **`trim_necessity = required`** — first maker-sourced instance. The aBAP gave us `optional`; both values now have real rows. |
| *"one **trimmed** Energel refill is included"* | `ships_with_refill_id` where the **remedy is already applied in the box** |

### 🔑 BilletSpin is Autmog's strategy, taken further — and it explodes

> *"a **longer barrel** and a **larger nose cap hole** to accommodate the Energel refill"*

The **body** differs per refill, so this is the second maker building a product per refill.
But the listing index shows the catalogue is split three ways at once:

> Verbatim title: **"Trimmed Energel Right Hand Thunderstorm Titanium CamPen"**

| Axis | Values seen | Changes the body? |
|---|---|---|
| **Refill** | Energel · Parker (V3 Gelion) | **yes** — longer barrel, larger nose hole |
| **Handedness** | Right Hand · Left Hand · unmarked | **presumably** — new axis, nobody predicted it |
| **Material** | Titanium · Zirc · Mokume · Timascus · "full mithril" | **no** — same geometry |

Materials are **separate listings, not options within one** — *"each listing represents a unique
physical item."* No "limited edition" or "one of one" language; only `Sold Out` /
`Selling Out SOON`.

**Under 3.1 (Product = the body) our model collapses this**: only body-changing axes make a
Product. BilletSpin's ~30 listings become a handful of products × a material attribute — and the
site can then say *"the CamPen comes in Energel and Parker, left and right hand, in 8
materials,"* **which BilletSpin's own site cannot say.** F5's curation moat, applied to the
catalogue side instead of the compat side.

### ⚠️ A family shares PARTS, not sockets — correction to how I described 3.2

TT Switch: **Standard takes a Pilot G2 0.7 mm; Short takes a Schmidt EasyFlow 9000.** Different
**sockets** inside one line.

I called `product_family` a "size/envelope class," which invites reading it as a fit claim.
It is not. **A family scopes part interchangeability and nothing else** — socket lives on
`tip_option` (**F3′**), per product. This is also independent confirmation that `tip_option`
was right to stay per-product (3.2's knock-on).

### 🔑 The naming law reaches MECHANISMS — fourth domain

`ClickShift`™ (Magnus) · `CamPen` (BilletSpin) · `Switch` (TT) are **brand words for
mechanisms**. Magnus never describes what ClickShift actually does; BilletSpin credits
*"a completely new and revolutionary type of mechanism, created by **Rich Stadler**."*

Same treatment as sockets and part kinds, and by the same rule: **generic `advance_mechanism`
value + the brand word as an alias**, with the marketing name living in `product.name`.
Decided by precedent — not a new fork.

### Incidental

- **Magnus publishes a blanket positive:** *"As long as your refill is in the style below — it
  will fit!"* over a long Parker-style list. That is the **Bastion pattern** — a socket-wide
  maker claim with no negatives. Good **4.1 / 4.4** material; expect owner reports to contradict it.
- **TT Switch finishes:** Machined · Stonewashed · DLC → 3.7 material.
- **Custom clip engraving (+$10)** → personalisation, not a slot option. Note for 3.7.
- **Rich Stadler credited as mechanism designer** → attribution is a real facet; feeds 3.7's
  collab half.

**Sources:** [Tactile Turn Switch](https://tactileturn.com/products/switch?variant=52409951945072) ·
[Magnus ClickShift](https://magnuspens.com/pages/clickshift) ·
[BilletSpin CamPen — Thunderstorm Titanium](https://www.billetspin.com/campen/p/thunderstorm-titanium) ·
[BilletSpin CamPen — full mithril / Timascus clip](https://www.billetspin.com/campen/p/full-mithril-dragons-breath-timascus-bljd3-td2wz-wmzm6-9akhp-l6ez4-afrgt-ztj3w) ·
[BilletSpin CamPen index](https://www.billetspin.com/campen)

### 3.5 — **ANSWERED: split the flat `action` enum**

`advance_mechanism` (`none`/capped · `ratchet` · `bolt` · `screw` · `cam`) +
`actuator` (`top_button` · `side_button` · `bolt_knob` · `clip` · `toggle` · `body_rotation` ·
`n_a`). Rejected (a) the flat list — `side_click` already carried two facts — and (b) dropping
cam/toggle as rare: **toggle isn't rare, it was mis-filed**, and under the split it costs one
value. `capped` folds in as `advance_mechanism = none`; no third `retractable` boolean.

*(Recorded as decided on the evidence above; BVG supplied the corpus rather than a letter.)*

### 3.7 — **ANSWERED (d′): a `product_variant` layer + a finisher**  *(BVG, 2026-08-12)*

Rejected all three posed options. **(a)** finish-as-slot-option died in 3.3, which ruled finish
and grip out of the parts lexicon. **(b)** separate Product mirrors the maker's listing
structure and explodes — BilletSpin alone would be ~30 rows. **(c)** edition-on-collection-item
covers *owning* one but cannot render a catalogue you don't own.

#### 🔑 Handedness IS a body change → its own Product

> BVG: *"left and right hand can change the mech, usually for bolts that is an **L or J path**,
> and with the CamPen they **flip which side of the body the mech is on** — some other makers
> have options like this but it is not super common."*

The bolt's track geometry or the mech's position in the body. Under **3.1** that is a different
body, so **Left and Right are two Products**, not one with an attribute.

Add `product.handedness` (`right` | `left` | `either`) as a **browse facet** — not an axis. It
is genuinely un-derivable and left-handed buyers are an underserved segment, but it has no
bearing on refill fit, so it never enters the matcher.

#### 🔑 The finisher pattern — a third party's product on another maker's body

> BVG: *"Autmog + KVR is a **finished Autmog pen** — usually a model that was already sold, then
> sent off to KVR for anodizing… **they just do color**. Some other makers do custom designs in
> existing pens… they take a **Tactile Turn pen and customize it from the stock body**."*

Dark Pines says it outright:

> *"**Built on Tactile Turn's proven titanium Side Click platform** — precision-machined in
> Dallas with the signature tactile ridges, deep-carry milled clip, and the addictive two-piece
> all-metal click mechanism."*
> Work done: *"a deep blackened finish"*, *"laser engraving"* on barrel and clip, *"the plunger
> is elevated with a finely milled checkered texture."* **Surface only — no geometry change.**

**3.1's own test decides it: the body is unchanged, so it is NOT a new Product.** It is a
**variant with a different vendor** — `product_variant.finisher_maker_id`, null meaning the base
maker (TT's own DLC), set for KVR and Dark Pines.

🔑 **And the payoff is proven on their own page.** Dark Pines restates TT's compat *exactly*:

> *"Schmidt EasyFlow 9000 on Short, **Pilot G2 0.7 mm on Standard**."*

Identical to the TT Switch split. **Compat inherits from the base product with zero edges
duplicated** — model it as a separate Product instead and you copy ~40 edges per finisher, which
is precisely the duplication 3.6 exists to prevent.

**The seam, stated:** a customizer who changes *geometry* — drills a nose, re-cuts a bore —
produces a new Product under 3.1 and inherits nothing. That is Rule 1's neighbour: a modified
pen is a different pen. Dark Pines explicitly stays on the safe side of it.

#### ⚠️ No `edition_size` column — three makers, none of them number anything

| Maker | Edition language |
|---|---|
| BilletSpin | *"each listing represents a unique physical item"*; only `Sold Out` / `Selling Out SOON` |
| Dark Pines | *"these pens are **inherently limited** and individual in character. **No two will be exactly alike**"* |
| Autmog × KVR | a colour drop; no run size published |

"Limited" is real and **never numbered**. An `edition_size` column would be null everywhere.
Store `one_off bool` instead — *"no two alike"* is a property of the finishing process, and it
is the fact a collector actually wants.

**Shape:** `product_variant` = `product_id` · `finisher_maker_id` null · `material` · `finish` ·
`name` (marketing: "Golden Dragon", "Dragons Breath") · `one_off`. `collection_item` points at
the **variant**.

⚠️ **Open for Sitting 5:** BVG's KVR description has an owner-commissioned reading — *you* send
your pen off to be anodised. That is the same finisher fact on `collection_item`, not on the
catalogue. Note it; don't build it.

### ✅ Sitting 3 COMPLETE — 3.1 through 3.7, plus socket bridges and 3.2b.

---

## Sitting 4 — Provenance & curation  *(BVG, 2026-08-12)*

### 4.1 — **ANSWERED: `verified bool` → `evidence enum`, and approval moves to a new table**  🔴

> BVG: *"i want user submitted feedback if it works but it will need to be eventually manually
> approved to avoid false positives/negatives. so we use the manu specs plus our own knowledge
> to seed the DB to start."*

**What `verified` could not mean.** `source` already stores *who said it*. And it cannot mean
*corroborated* — under **2.5** a row is one claim from one party, so agreement is a count over
rows. That is **derived, demotion #8**, not a column.

**What it does mean — `evidence`: `declared | tested`.** Was anything physically seated, or is
the claim inferred from the style? The axis cuts **across** `source`: Magnus's blanket *"as long
as your refill is in the style below — it will fit!"* and Tactile Turn's list carrying per-refill
trim amounts in millimetres are both `source = maker` and are not the same kind of claim. You
cannot publish *"2 mm off the top"* without having done it.

**Bastion is the clincher, and it is why 4.4 depends on this.** Bastion declares Parker and
rejects some Parker refills. A conflict resolved by **authority** ranks the maker above the owner
and gets Bastion exactly backwards. Resolved by **evidence**, it comes out right.

🔑 **A `verified bool` would have been the SIXTH axis-mix** — it folds *what backs this claim*
together with *has an editor vetted this row*, two orthogonal facts. Prior five: `archetype` →
the fit ladder → `category` → `adapter` → `action`.

**"Who clears it" dissolves.** Evidence does not un-happen. Nothing clears it; a contradicting
fact is a **new row**, and displaying the disagreement is 4.4's job.

**Knock-on: `fit_quality` becomes NULLABLE.** A `declared` row has none — Magnus never seated
anything, so `toleranced | snug | loose` would be invented. The ERD had it required.

### 🔑 NEW — `fit_report`, because a report and a claim are different objects

BVG's approval requirement does **not** put an editorial column on `fit_check`. It forces a
second table.

| | `fit_report` | `fit_check` |
|---|---|---|
| Is | *"I put this in my pen and here's what happened"* | a curated claim in a controlled vocabulary |
| Scope | **always concrete** — a person owns one pen, so it names a `tip_option` | may be `refill_style`-scoped (2.5) |
| Cardinality | **N reports → 1 claim** | one row per source |
| Shape | `fits bool` + free-text `note` | the full 2.1–2.6 vocabulary |

**Three reasons the merge fails:**

1. **It would turn the moat table into a submissions inbox** — every curated column nullable.
2. **It destroys the count.** You cannot tell a false positive from a true one by looking at a
   single report; you need the aggregate, which only survives if N reports fold into 1 claim.
   That is *precisely* the failure BVG named.
3. **It is the repo's own house rule, one level up** — ingested data separate from curated data
   (`scraper.ts` vs every curated table). Reports are ingested; fit checks are curated.

**Approval is not a state of the claim — it is the act of creating one.** `review_state`
(`pending | approved | rejected`) lives on the report; `fit_id` is set when it is folded in.
Rejected rows are **kept**, so they are not re-reviewed and because a pattern of rejections is
itself signal.

**Naming, under §0.** `fits bool`, **not** `works` — "works" collides with `functional_warning`
("fits but you shouldn't", the Ti2 magnet × Jetstream case). **Not** `polarity` either: that is
the curated claim's word, one of lexicon §3's seven terms we *teach*, and jargon has no place on
a submission form. Free text is right for the rest — the corpus shows reports arrive as prose
(FPN: *"the tip of the Space Pen insert wiggles around when I write"*), and asking a submitter to
fill the curated vocabulary is **2.1's rejected "generic need rows" error in a new place**.

### ⚠️ TENSION FLAGGED — the seed is biased toward exactly the failure BVG named

Seeding from maker specs is unavoidable — it is the only structured data that exists at scale
(pass 3 confirmed 4.5's lean (a)). But the project's founding finding is that **maker claims are
wrong**: Bastion, Magnus's blanket positive, and **F5** itself, which says the gap between maker
charts and reality *is* the product. So the seed corpus skews toward **false positives**.

**Not a contradiction — the two halves of BVG's answer are complementary.** `evidence = declared`
on every seeded maker row is what makes the bias visible, and user reports are what correct it.
Approval promotes `tested` over `declared`.

### Knock-ons into the rest of Sitting 4

- **4.3 is now partly pre-answered and partly forced open.** *"Our own knowledge"* is a source
  `source` cannot express — it is not the maker and not a forum. And BVG's seed is really **two**
  sources: transcribed maker specs (`declared`) and his own hands-on experience (`tested`).
  Ask the residual; don't slide it in.
- **4.5 partly answered** — the first corpus is maker specs + BVG's own knowledge.
- **Sixth question to dissolve into another** (Sitting 2 produced five): 4.1's *"who clears it"*
  → 4.4.

### 4.1b — **ANSWERED (a): nothing renders until approved**  🔴  *(BVG, 2026-08-12)*

> BVG: *"nothing shows until approved or added manually by the devs, **focus on accuracy not
> widespread adoption**."*

**Two write paths, both human-gated:**

| Path | Produces | Gate |
|---|---|---|
| A dev curates directly (the seed) | a `fit_check` row | the dev |
| A user submits | a `fit_report` row → folded in | `review_state = approved` |

**The read model collapses to one sentence:** *every buyer-facing query reads `fit_check` only.*
`fit_report` has **no buyer read path at all** — it is an editorial inbox that feeds the moat
table and is never itself rendered.

**Corroboration survives, gated.** Approved reports keep their `fit_id`, so *"11 owners confirm"*
is still derivable — the derivation just filters to `review_state = approved`. Nothing is lost
except the pre-approval display.

🔑 **This makes `evidence` the ONLY trust signal a buyer sees**, which raises its value rather
than lowering it. With unconfirmed reports invisible, `declared` vs `tested` is the entire
difference between "the maker says so" and "someone actually did it."

### ⚠️ The cost, stated plainly — accepted, not argued

Under (a) the launch corpus is maker specs (`declared`) plus BVG's own pens (`tested`). Maker
specs are what makers already publish, so for most pens **day one shows roughly what the maker's
own page shows**, and F5's gap only opens as reports get cleared. BVG chose this knowingly —
accuracy over adoption. Recorded, not re-argued.

🔑 **But the cold start is smaller than it looks, and 4.5 should know why.** A **third** seed
source already exists and nobody has counted it: **the research corpus in this file**. FPN's
Fisher-in-a-Jotter tip wiggle · Unsharpen's D1/Zebra directional asymmetry · penturners' DSM
top flange · Pens and Planes' 11-entry hack list (45% compound) · BilletSpin's and Tactile
Turn's published negatives. Those are `source = community`, `evidence = tested`, curatable by a
dev **today**, requiring no user — and they are **where the negatives live**, which is exactly
what maker specs never carry. Carry this into 4.5.

### 4.3 — **ANSWERED (b): coarse enum + a nullable citation**  🔴  *(BVG, 2026-08-12)*

**`claimed_by enum` = `maker | community | owner | staff` + `citation_url` / `citation_note`.**

**The fourth value was forced, not chosen.** 4.1's seed is *"manu specs plus our own knowledge"*
— and "our own knowledge" is neither the maker nor a forum. `staff` carries it; buyer label
**"Tested by machinedpens"**, which is JetPens' badge (*"refills we've tested ourselves"*).

🔑 **`community` and `owner` now split along the two ingest paths**, and they are not the same
standing:

| Value | Means | Arrives via |
|---|---|---|
| `maker` | the maker's own published claim | transcription |
| `community` | harvested from a forum/guide **by a curator** | transcription + citation |
| `owner` | someone who **has** the pen | `fit_report` → approval (4.1b) |
| `staff` | we seated it ourselves | direct curation |

**Why the citation, and why it isn't decoration.** A coarse enum can only ever render *"the maker
says."* It cannot name **which** page, on what date, or that **Unsharpen self-contradicts on the
Sarasa inside one article** — claiming it *"fits the exact dimensions set in the ISO standard for
the RB size"* and then measuring it at 6.09 against a 6.3 nominal. That is 4.4's hardest display
case and it is unrenderable without a locator. BVG chose accuracy over adoption in 4.1b; this is
the mechanism that cashes it.

**CURATION RULE — stated, not invented as a constraint:** `claimed_by = maker` or `community`
**requires** a citation. An untraceable community claim is indistinguishable from an invention.
`owner` needs none (it has a `fit_report` behind it); `staff` needs none (it is us).

**Rejected (c), a `source` table with per-source reliability.** It prejudges the still-open
lookup-tables-vs-TS-enums question (lexicon §5.4) and implies reliability scoring that nothing in
the corpus supports yet. Per-source trust is a **4.4 display** concern; the citation carries it.

### 🔑 KNOCK-ON — `source` meant THREE things, and the views had already fixed two

Found while wiring 4.3. The **first naming-law violation caught after the law was ratified**, and
it was in our own schema:

| Was | Now | Meant |
|---|---|---|
| `fit_check.source` | **`claimed_by`** | who asserts it |
| `part.source` | **`made_by`** | who manufactured it |
| `refill_dimension.source string` | **`citation_url` + `citation_note`** | where the number came from |

`data-model-erd-public*.eraser` had **already been rendering `claimed_by` and `made_by`** as
display labels — the right names existed before the collision was noticed. Promoting them is
exactly the §0.1 move. `refill_dimension` converts to the same two-column citation shape, so
there is now **one citation shape** in the schema.

**Why `source` couldn't just be kept for one of the three:** it is the *buyer's* word for the
citation (*"Source: Unsharpen ↗"*). Spending it on the category would burn the plainest word in
the set at the one place a buyer reads it.

⚠️ **Applied on OPT-OUT, not a chosen letter.** Offered as *"I'd do it; say if you'd rather
not"*; BVG answered the citation fork. **Queued for the ratification sweep** with the other two
softs.

### ⚠️ NEW OPEN — running changes

A maker revises a body mid-production and existing fit checks silently become wrong for the new
run. Nothing in the model expresses this, and it is not `evidence`'s job. Interacts with **3.1**
(is a revised body a new product?). **Logged, not asked.**

### ⚠️ NEW OPEN — approval is an unbounded queue

*"Eventually manually approved"* has no throughput model. At launch volume is zero, so this is
premature — but if reports outpace the reviewer the design needs auto-promotion thresholds
(N concurring reports promote automatically), which would contradict *"manually approved"*.
**Logged, not asked.**

### 4.4 — **ANSWERED (d): the verdict is DERIVED; the staff override is a column**  🔴  *(BVG, 2026-08-12)*

> BVG: *"maker copy is not always truth, they might have a typo or copy and paste it from other
> products - we still need to have the ability to override it."* → **"confirm"** on (d).

#### 🔑 First: the three "live conflicts on file" were not what 4.4 is about

Checked before asking. **None of them is two `fit_check` rows disagreeing at the same scope:**

| Cited conflict | What it actually is | Already resolved by |
|---|---|---|
| **Bastion** — declares Parker, rejects some Parker refills | a `refill_style`-scoped positive vs `tip_option`-scoped negatives | **2.5.** Most specific wins. Not a conflict at all — a general claim with exceptions, the schema's spine. |
| **Fisher PR** — 90 × 4.8 (Unsharpen) vs 89 × 5.8 (Penstore) | two `refill_dimension` rows, same feature, different numbers | nothing — **different table, different question** → 4.4b |
| **Unsharpen / Sarasa** — *"fits ISO RB exactly"*, then measures 6.09 against 6.30 | a *claim* vs a *measurement*, not two claims | **Rule 3** + the curation gate. Geometry cannot produce the positive, and 6.09 undersize reads `loose`, not negative. The curator declines to transcribe the blanket claim. |

And **4.1b removes the last class**: two owners reporting opposite things never reach a buyer —
they are `fit_report` rows that fold N→1 at approval. *The editor resolves it, not the page.*

So the conflicts that can actually render are narrow: two **curated** rows, **same scope**,
opposite `polarity`. 4.4 therefore had to answer a question the agenda never wrote down —
*what does a buyer see when two **measurements** disagree?* — which is now **4.4b**.

#### The display rule — DERIVED, demotion #9

| Step | Rule | From |
|---|---|---|
| **0** | drop every row with `disputed_note IS NOT NULL` from the verdict set | **4.4 (d)** — BVG |
| **1** | scope: most specific wins (`tip_option` > `refill_style`) | 2.5 |
| **2** | `evidence`: `tested` > `declared`. **`claimed_by` labels, it never ranks** | 4.1 / 4.3 |
| **3** | still tied and opposite → **no verdict.** "Sources disagree", both shown, both cited | 4.4 |

Three display states fall out: **agree** (one verdict, sources listed) · **split by evidence**
(the `tested` row is the verdict; the `declared` row renders as a *named, cited counterclaim*,
not a footnote) · **unresolved** (no verdict).

State 2 is the money shot — it is **F5 rendered**: *"Bastion lists this as Parker-compatible.
We seated it; it doesn't hold."*

🔑 **Step 2 closes 4.3's explicit deferral.** 4.3 rejected a per-source reliability table and
pushed per-source trust here. The answer is that there is no per-source trust: `evidence` ranks,
`claimed_by` only labels. Ranking by *who* is what 4.1 already disproved on Bastion.

**Rejected (b), "owner reports win once verified; maker demoted to a footnote":** it ranks by
*who*; its *"once verified"* clause is already spent by 4.1b (no unapproved report is visible);
and it would footnote **Tactile Turn's per-refill trim amounts in millimetres**, a `maker` claim
that is the highest-evidence data in the corpus.

**Rejected plain (a), "always show both, never pick":** right about the display, silent about the
order. *"Maker says X, owners say Y"* is unreadable as a list cell. The verdict collapses to one
word at list density and expands to both claims on the detail page.

#### 🔑 NEW COLUMN — `disputed_note text null` on `fit_check`

BVG's case is the one thing the derived rule could not do. A maker typo or a copy-pasted list is
`declared` **and positive**, and we usually have **no `tested` row to beat it with** — we simply
know the list is junk.

**The tempting fix is a lie.** Filing `staff | tested | negative` to win the argument asserts a
physical fact that never happened. 4.1 defines `evidence` as *did anyone actually seat this*, and
4.1b makes it **the only trust signal a buyer sees**. Faking it corrupts the very thing the
approval gate exists to protect.

🔑 **And it would have been the SEVENTH axis-mix.** *"They copy-pasted it from another product"*
is **not a claim about the pen — it is a claim about the citation.** Forcing it through
`polarity`/`evidence` folds *does it fit* together with *is this source trustworthy here*.
Prior six: `archetype` → the fit ladder → `category` → `adapter` → `action` → `verified bool`.

| Property | Decision |
|---|---|
| Shape | **non-null is the flag** — no `bool` + `text` pair. Same pattern as `reason` (required when negative); `_note` is the established free-text suffix (`citation_note`). |
| Renders? | **Yes.** Excluded from the *verdict*, still **shown with the note.** Hiding it loses the product: **F5** says the gap between the maker's chart and reality *is* what we sell. A buyer arriving from Karas's page needs *"Karas lists this — we don't think it's right"*, not silence. |
| Grain | **Per row, never per maker.** A maker can be right on forty rows and fumble one. A `maker.unreliable` flag is the reliability scoring **4.3 already rejected**, and BVG's own words name single events — *a* typo, *a* copy-paste. |
| Naming (§0) | **"Disputed"** passes the say-it-out-loud test; `override_note` describes the internal mechanic, and §0 tests the *outward* word. Buyer label: **"Disputed by machinedpens"**. |

**CURATION RULE — extended:** a disputed row **requires** a note. Same shape as 4.3's
citation-required-for-`maker`/`community`.

**This does not remove staff claims.** When we have seated it, that is still an ordinary
`staff | tested` row competing on evidence. `disputed_note` is for when we have **not** and still
know better.

🔑 **It repairs (a″) rather than replacing it.** Without step 0 the "sources disagree" shrug is
sticky and common; with it, a shrug becomes a **choice** — shown only where we genuinely do not
know.

**Rejected (e), no column — express overrides as ordinary `staff` rows with a `staff` tie-break
at equal evidence.** Cheaper, but it cannot touch a `maker | tested` row without seating one
first, and it quietly re-opens the invitation to misuse the `evidence` axis.

#### Knock-ons

- **Demotion #9 — the fit verdict itself.** Derived from the `fit_check` set by the four-step
  rule above. Nothing about conflict resolution is stored except the override.
- **`fit_check` rows are MUTABLE curated state; `fit_report` is the append-only log.** Already
  implied (rejected reports are *kept*; fit checks are the curated moat) but never said. This is
  what handles the **halffull author correcting an entry after community feedback** — that is a
  *retraction*, not a conflict, and a retraction is an edit or a delete. **No `retracted_at`, no
  soft delete**, and the audit trail lives in `fit_report`.
- **No user model still.** *Who* disputed a row is `updated_at` and nothing more — the same OPEN
  already logged on `fit_report`. **Rule 2: do not invent the field.**
- **Feeds "approval is an unbounded queue."** Every tie is now an editorial decision someone must
  make.

### 4.4b — **ANSWERED (c): no dispute column; `claimed_by` lands, and a conflict SUPPRESSES the negative**  🔴  *(BVG, 2026-08-12)*

**`disputed_note` does NOT mirror onto `refill_dimension`.** Three asymmetries with 4.4, all
pointing the same way:

| | `fit_check` | `refill_dimension` |
|---|---|---|
| What a dispute does | step 0 of the verdict rule — drop from the verdict set, **keep rendering** | there is **no verdict** to drop out of |
| Where a bad row bites | a wrong word on a page the buyer can read and argue with | **Rule 3's negative** — a pen silently **vanishes** from a list. Invisible, unappealable |
| Is the dispute content? | **yes — F5.** *"Karas lists this; we don't think it's right"* is the product | **no.** Nobody comes here to learn a retailer's spec table has a typo |

🔑 **And a disputed-but-not-rendered row is a soft delete with a comment attached** — which 4.4
had *just* refused (*"no `retracted_at`, no soft delete"*, `fit_check` is mutable curated state).
`refill_dimension` is the same kind of curated state. **A bad number gets corrected or deleted.**

#### The two halves of (c)

**1. `claimed_by enum` on `refill_dimension`** — the 4.3 enum, reused whole
(`maker | community | owner | staff`).

The gap this closes: 4.3 gave the table `citation_url`/`citation_note` but **no attribution**, so
BVG's own caliper drawing — *5.94 / 6.02 / 4.55 / 3.15 / 2.46*, the highest-quality dimension data
in the entire corpus — was **indistinguishable from an untraced web number**. Any resolution rule
saying "ours wins" was literally unwritable.

- **Naming (§0):** `claimed_by`, not `measured_by`. *"Measured by"* **overclaims** — a maker
  spec-sheet number was never measured by anyone we can name, which is the same trap `evidence`
  was invented to avoid in 4.1. Reusing the word also gives the schema **one attribution shape**
  (`claimed_by` + `citation_url` + `citation_note`) travelling together on both tables that carry
  outside assertions — the natural extension of 4.3's *one citation shape*.
- **The enum is reused whole, not narrowed.** `owner` is currently **unreachable** here: 4.1b's
  `fit_report` carries `fits bool` + free text, never a number. A narrower three-value enum would
  be a **second vocabulary for one word** — worse than one unused value. If §5.4 later turns these
  into lookup tables, one table serves both.
- **4.3's curation rule extends verbatim:** `claimed_by = maker | community` **requires** a
  citation. `staff` does not — it is us.

**2. A geometry negative fires only on an UNCONFLICTED feature, or on a `staff` row.**

This is Rule 3 taken to its conclusion: geometry may only ever *exclude*, so **you may only
exclude on a number you are sure of.** Sources disagree at the same `feature` → the screen does
**not** fire, and every row renders with its citation. Conservative by construction: the failure
mode of a wrong measurement is now "we showed you a pen we could have hidden," never "we hid a
pen that fits."

**Guard 3 on Rule 3.** It already had two (both numbers must carry a `feature` tag; the Autmog
2.5 mm dependency). This is the third and it is now the binding one.

#### 🔑 Demotion #10 — the displayed measurement

The obvious storable was a `preferred`/`canonical` flag per (refill × feature). Declined, exactly
as 4.4 declined a stored verdict: **`staff` if present, else render every row with its citation.**
Nothing about measurement resolution is stored — and unlike 4.4 there is **no override column at
all**, because the escape hatch here is `DELETE`.

#### Fisher PR, resolved

**90 × 4.8** (Unsharpen) vs **89 × 5.8** (Penstore). Pass 3's methodological catch says these may
not even be the same **feature** — 1 mm of length is where you stop the caliper, but 1.0 mm of
diameter across a 4.8 mm refill is a different location or a copy-paste. Under (c) the curator's
first move is *"is this the same location?"* — an **R4 `feature` fix, not a schema feature** — and
until it is settled, **neither number screens anything out.** No column was needed to hold this.

#### ⚠️ TENSION FLAGGED — this cuts against BVG's own 4.4 instinct

*"They might have a typo or copy and paste it from other products"* applies **word for word** to
Penstore's 5.8, and in 4.4 that reasoning bought a column. It does not buy one here, and the
difference is **F5**: a wrong maker *fit claim* is content we sell; a wrong retailer *number* is
noise we delete. Recorded so the inconsistency is deliberate and visible.

#### ⚠️ NEW OPEN — the retailer gap in `claimed_by`

The Fisher case is a **guide** (Unsharpen, who publish caliper numbers) against a **retail
listing** (Penstore, reprinting a spec). 4.3's enum has no value for a retailer: `community` is
defined as *"harvested from a forum/guide by a curator"* and `maker` is the maker's own page.
Candidates: fold retail into `maker` (it is the maker's number travelling down a chain), fold it
into `community`, or a fifth value.

**Does not block 4.4b** — neither row is `staff`, so they conflict, the screen is suppressed and
both render either way. It is a **labelling** question, not a resolution one. **Logged.**

#### Knock-ons

- **`evidence` does NOT come to this table.** It was tempting — a maker spec number is `declared`
  and a caliper number is `tested` — but `claimed_by` already carries it here (`maker` = published,
  `staff` = we measured), and adding both would be the **eighth axis-mix** in a table that has no
  verdict for the axis to feed.
- **Strengthens ratification-sweep item 3.** 4.3's `source` split was applied on opt-out;
  `claimed_by` on `refill_dimension` is now **explicitly chosen**, so the shape has real assent
  even if the sweep still owes the other two columns a letter.
- **`fit_report` still cannot carry a number** — and after this it clearly shouldn't. An owner
  measurement would need `evidence` and an approval path, i.e. the whole 4.1 apparatus, for data
  a curator can just measure.
- **Feeds 4.5.** Seeded dimensions are `maker` or `community` with citations; BVG's drawings are
  the first `staff` rows in the schema, and they are the only rows that can fire a screen alone.

### 4.5 — **ANSWERED (c): two corpora, not one. Catalog broad, fit checks narrow and deep**  🔴  *(BVG, 2026-08-12)*

**The launch corpus is two things with different ingest paths, different quality bars and
different growth rates.** They were being planned as one, which is why "how do we seed" kept
sounding like a volume question.

| | **Catalog** | **Fit checks** |
|---|---|---|
| Entities | `maker`, `product_family`, `product`, `tip_option`, `product_variant`, `refill`, `refill_style` | `fit_check` (+ `refill_dimension`) |
| Bar | broad and cheap | narrow and deep |
| Path | `scraper.ts` stages it, a human promotes it | hand-curated, citation-gated (4.3) |
| Grows by | adding makers | seating refills |

🔑 **The split is 4.1's report→check pattern one level up.** Ingested data staged separately from
curated data is already the repo's house rule (`scraper.ts` jsonb vs every relational curated
table). 4.1 applied it to assertions; 4.5 applies it to the catalog. **Same shape, third time.**

#### Seed order for `fit_check` — negatives first

1. **The research corpus in this file** (`community | tested` + citation) — FPN's Fisher-in-a-Jotter
   tip wiggle · Unsharpen's D1/Zebra directional asymmetry · the penturners' DSM top flange ·
   Pens and Planes' 11-entry hack list · BilletSpin's and Tactile Turn's published negatives.
   **Free, already gathered, and it is where the negatives live.**
2. **BVG's own pens** (`staff | tested`) — and after **4.4b** his caliper readings are the only
   `refill_dimension` rows that can fire a geometry screen on their own.
3. **Maker lists** (`maker | declared`) — **last**, and only for pens already in the catalog.

**Blanket style-wide claims are last of the last.** Magnus's *"as long as your refill is in the
style below — it will fit!"* is one `refill_style`-scoped positive covering N refills: the
cheapest coverage available and precisely F5's false-positive skew. It also **adds almost nothing
over `tip_option.refill_style_id`, which already says the same thing** — see the prior, below.

#### 🔑 The cold start is not empty — the PRIOR is already in the schema

*"Not checked yet"* undersells what a pen with zero `fit_check` rows can say. Sitting 1 settled
that **a style exists to be a useful prior**, and 2.7 stored how far to trust it:

| Zero fit rows, but we know | Buyer sees |
|---|---|
| `refill_style = parker-style`, `observance = well` | **"Takes Parker-style — usually reliable"** |
| `refill_style = rb-space`, `observance = poor` + `variance_note` | **"Takes RB-style — varies by brand, check per pen"** |

So the launch read model has **four** display states, not 4.4's three: *agree · split by evidence ·
unresolved · **prior only***. The fourth is derived from a row count and must never read as a
negative, and it is genuinely useful on day one with no curation at all.

**This is also the seam between the two corpora, and it is principled:** a maker is authoritative
about **their own aperture** (catalog — *what style did you cut?*) and unreliable about **third-party
refills** (fit checks — F5). `tip_option.refill_style_id` is catalog data; a positive for a
specific refill is a claim.

#### 🔑 Demotion #11 — coverage

*"How well covered is this pen"* is `COUNT(fit_check)`, not a `fit_coverage` enum or a
`curated_at` stamp. **Caught pre-emptively** — nobody proposed the column yet, and seeding is
exactly when someone would. Coverage is a display state, never a launch gate.

#### `ships_with_refill_id` is the seeder's WORKLIST, not a free positive

Tempting: every catalogued pen ships with something, so every pen gets one guaranteed positive
for nothing. **It does not work, for two reasons** — both already in the file:

1. **Scope.** It lives on `product`; a fit is `tip_option`-scoped. For a two-tip product (Parker
   *and* G2) the column cannot say which configuration ships. → **new OPEN.**
2. **BilletSpin ships "one TRIMMED EnerGel refill."** The in-box refill may be **pre-modified**,
   so the implied claim carries a `trim_mm` the column cannot express.

**Therefore:** the shipped refill is the **first `fit_check` a curator writes for each pen**, by
hand, with the trim question answered. A worklist generator, not a derivation — and **no
amendment to the 4.4 verdict rule**, which keeps reading `fit_check` only.

#### ⚠️ The cost, stated plainly — same as 4.1b's

Negatives-first means the pens we know best show **more "doesn't fit" than "fits"** on day one.
That is F5 rendered, and it is a strange first impression for a compatibility site. Two things
soften it and neither is a compromise: the **prior** carries every uncurated pen, and the
**ships-with worklist** puts a real positive on each pen early. Recorded, not argued.

#### Knock-ons

- **The catalog is not fully automatable.** `bore_class`, `advance_mechanism`, `actuator`,
  `radial_retention`, `handedness` and `axial_adjust` are all required and all judgment calls off
  a product page. "Broad and cheap" means **cheap per row**, not unattended. The scraper stages;
  a human promotes. (2.7's coverage inversion already said this for `bore_class` vs `bore_mm`.)
- **`refill_style` must be seeded before anything else** — `tip_option.refill_style_id` is
  required, so no pen enters the catalog until its style exists. And the RB-space styles are
  **still unnamed**, deliberately, pending measurement round 1. **Measurement round 1 is now a
  launch dependency, not just the highest-value open item.**
- **4.1b's approval queue stays empty at launch by construction** — both seed paths are dev
  curation. `fit_report` only starts filling when there are buyers.

### ✅ SITTING 4 COMPLETE — 4.1 · 4.1b · 4.3 · 4.4 · 4.4b · 4.5. 4.2 dissolved.

---

## Ratification sweep  *(BVG, 2026-08-13)*

Three things were applied to the ERD without an explicit choice. Asked bare, one at a time.

### S1 — **RATIFIED: the `slot_option` → `part` merge stands**  ✅  *(Sitting 3, c′)*

Asked a third time and finally answered as a bare yes/no, with no vocabulary question attached —
the two previous dodges both happened because it was embedded in one.

**One `part` table.** Being a *purchase option* versus a *fit-required part* is **not a column**;
it is **which join points at the row**:

| Join | Makes it |
|---|---|
| `part.maker_id` + `part.family_id` (3.2 a′) | a purchase option — "TT sells this clip for Standard bodies" |
| `part_needed.part_id` (2.1) | fit-required — "this fit needs this spring" |

Tactile Turn's **"Short" spring is both, from one row.** Two tables meant two rows for one SKU,
which could drift — the same objection 2.5 raised against per-edge negatives and Sitting 3 (c′)
raised against per-edge adapters. Third instance of that argument, now ratified.

**Knock-ons:** none — the ERD has carried the merged shape since Sitting 3, so nothing changes in
`data-model-erd.md` or the five `.eraser` files except removing the "SOFT" marker on the merge
comment. `made_by` (4.3) and `kind` (3.3) stay exactly as they are.

### S2 — **RATIFIED: 3.2b's tip-option override stands**  ✅

Three nullable columns on `tip_option` — `axial_adjust`, `accepts_length_min_mm`,
`accepts_length_max_mm`. **Null = inherit from `product`.** No `radial_retention` override
(zero corpus evidence for a tip option that *adds* a collet; ERD rule 1 forbids inventing it).

🔑 **The clincher was not new evidence — it was that F3′ had already forced the grain.** Research
pass 6 classified the **Alpha Pen Parker Adapter as a tip option**, not an edge adapter, because
it sits *in the pen*. So Alpha-bare and Alpha-with-adapter are **already two `tip_option` rows**,
and the only thing separating them is adjustability: bare it is fixed, adapted it gains the
stick-out screw. Product-only storage makes one of those two rows **always wrong**. The override
is not a special case bolted onto 3.2b; it is where F3′ had already put the two configurations.

Previously carried as a SOFT decision on *"seems logical"* (2026-08-11). Now has a letter.

### S3 — **RATIFIED: 4.3's `source` split stands**  ✅

`fit_check.claimed_by` (who asserts) · `part.made_by` (who manufactured) ·
`citation_url` + `citation_note` (where it came from), on both `fit_check` and
`refill_dimension`.

**Two-thirds of it already had explicit assent** — 4.4b chose `claimed_by` on `refill_dimension`
outright, and that pulled the citation pair onto that table with it. What was never lettered was
the *split itself*, applied on opt-out while BVG answered the citation fork.

The reasons that survived re-asking, unchanged: `source` had come to mean **three different
things** across three tables (the first naming-law violation found *after* the law was ratified,
and in our own schema); the public views had **already drafted `claimed_by` and `made_by`** as
display labels before the collision was noticed, so the split adopts names arrived at
independently; and `source` is the **buyer's** word for the citation (*"Source: Unsharpen ↗"*) —
spending it on the category burns the plainest word in the set at the one place a buyer reads it.

**Result: one attribution shape** — `claimed_by` + `citation_url` + `citation_note` — travelling
together on both tables that carry outside assertions.

### ✅ RATIFICATION SWEEP COMPLETE — S1 · S2 · S3, all confirmed as applied.

**No schema changed.** All three were already in the ERD; the sweep bought certainty, not
columns. The `// SOFT` markers come off. **Zero soft decisions remain in the model.**

---

## Carried structural items  *(BVG, 2026-08-13)*

The four items the Sitting 4 prompt kept on the table, taken in order.

### C1 — **ANSWERED (a): a `rebrand` table, attributed**  🔴  *(lexicon §2.7, closed)*

`rebrand { refill_id → oem_refill_id, claimed_by, citation_url, citation_note }`. The branded SKU
points at the part it actually is. **Seventeenth entity.**

#### Research pass 8 — rebranding is an industry structure  *(2026-08-13)*

The lexicon flagged this off **one** case (FPN: the Retro 51 Tornado's refill *"is a rebranded
short Schmidt refill"*). Three findings changed the answer:

1. **It is a pattern, not an oddity.** Schmidt sells components for other brands to relabel — the
   Retro 51 **REF5P**, the **Baron Fig Squire**, and **Diplomat** all come off Schmidt's line.
   Premec advertises white-label manufacture as its *business model*: *"all refills can be
   customised… R&D can work with customers to define characteristics and features."* The shape is
   a **star** — one OEM part, N branded SKUs — and it recurs by design.
2. 🔑 **The first mapping checked is already CONTESTED.** One source has the REF5P as a Schmidt
   **P8127**; Gentleman Stationer and FPN have the Tornado and the Squire sharing the **P8126**.
   A rebrand link is therefore a **claim**, not a transcription — the same standing as a
   `fit_check`, and it needs the same attribution.
3. 🔑 **It is a POSITIVE-producing mechanism.** The link propagates fit claims across brands, so a
   wrong one manufactures a wrong positive silently and at scale. It survives **Rule 3** for
   exactly the reason `style_adapter` does — **declared, never computed**. And it cannot be
   derived at all: inferring identity from matching dimensions is the **F6** fallacy, and
   `refill_dimension` coverage is sparse besides.

#### Why the other two candidates die

| Candidate | Dies on |
|---|---|
| **`refill_alias`** (mirrors `also_known_as`) | **Loses the SKU.** The Retro 51 refill has its own brand, slug, price and availability, and **4.5** makes `refill` catalog data the scraper stages. It needs a *row*, not a string on someone else's row. `also_known_as` holds alternative **names** for one row; a rebrand is a second **product**. |
| **`refill_identity`** (a grouping row, the way `refill_style` groups shapes) | Symmetric and canonical-free, but the group row has to **name the OEM part anyway** — so it duplicates the Schmidt `refill` row it is grouping. And the direction is the interesting fact: *"it's a Schmidt."* |

#### 🔑 3.3's own refinement picked the storage

> *"Aliases follow their target's storage, not a single pattern"* — a **table** when the link
> carries data (sockets, which hold `standard`/`observance`), a **TS map** when it does not
> (part kinds, which hold nothing per-kind).

Applied here: the link carries `claimed_by` + a citation, because finding 2 says it is contested.
**Therefore a table.** Not a new rule — an existing one, reused.

#### ⚠️ THE EIGHTH AXIS-MIX, caught before construction

**`rebrand` means SAME PART OFF THE SAME LINE. It never means same style.**

Monteverde markets refills *"compatible with Parker, Cross, Montblanc"* — those are **style-mates,
not rebrands**, and `refill_style` already covers them. Letting them into this table would
propagate positives across genuinely different parts, which is precisely the harm Rule 3 exists to
prevent. The distinction is the whole value of the table; collapsing it would be trap 1 of the
naming law (*never collapse a distinction*).

#### Knock-ons

- **The verdict rule gains a step −1.** Before step 0, expand the `fit_check` set for refill R to
  **R ∪ R's rebrand partners** — the row it points at, plus its siblings pointing at the same OEM
  row. **ONE HOP, no chains.** Everything downstream (dispute drop, scope, evidence, tie) is
  unchanged.
- **Propagated rows must be LABELLED** — *"via Schmidt P8126"*. 4.1b made `evidence` the only trust
  signal a buyer sees; a silently propagated claim would be untraceable, which is the one thing
  4.3's citation rule exists to stop.
- **4.3's curation rule extends verbatim:** `claimed_by = maker | community` **requires** a
  citation. Third table to carry the one attribution shape.
- **The OEM row must exist.** Not a burden in practice — Schmidt and Premec both sell retail, so
  the parent is a catalogable `refill` like any other.
- **No `disputed_note` here**, per **4.4b**: this is curated state, and a bad link is **deleted**,
  not annotated. The P8126-vs-P8127 disagreement is resolved by the curator *before* the row is
  written — the same first move 4.4b prescribed for the Fisher PR numbers.
- **⚠️ TENSION FLAGGED, for 5.2 — the `refill` grain is fuzzy and this link inherits the fuzz.**
  `tip_size` and `colour` are both nullable, so a `refill` row is currently a **model**, not a SKU.
  If Retro 51 relabels only one size or colour of an OEM model, this link is coarser than reality.
  **Does not block C1** — the link is right at the grain we have. Resolve it when 5.2 settles
  whether a `refill` row is a model or a SKU.

### C2 — **ANSWERED (a): closed vocabularies stay TS `as const`; `material` becomes a lookup**  🔴  *(lexicon §5.4, closed)*

#### 🔑 FIRST — §5.4's premise does not survive reading the repo

The lexicon framed this as *"the committed schema makes open vocabularies into TABLES; our ERD
makes them `enum`; incompatible answers to one question."* **It is not one question.**

`materials`, `mechanisms` and `product_types` are defined in
**`packages/database/src/schema/scraper.ts:191–247`**, and **every consumer is a `tmp_*` staging
table** — `tmp_autmog_pen_materials`, `tmp_product_product_types`, `tmp_autmog_pens`. They sit on
the **ingested** side of the repo house rule found in Sitting 2 (*jsonb for ingested, relational
for curated*), and on the **catalog-staging** side of **4.5**'s two corpora. They are the
scraper's string-interning tables, not the committed schema's opinion about curated vocabulary.

**And they carry no data** — `id`, `name`, `slug`, `created_at`, `updated_at`, nothing else. By
**3.3's own refinement** (*"aliases follow their target's storage"* — a table when the row carries
data, a TS map when it does not) these would be `as const` **if they were ours**. They are tables
for exactly one reason: **a scraper must intern strings it discovers at runtime**, which a
compile-time union cannot do.

#### The rule

> **A vocabulary is a TABLE when its members arrive at RUNTIME, or carry data of their own.
> It is a TS `as const` when the set is closed at compile time and a member is nothing but its
> own name.**

Not a new principle — the runtime/compile-time seam is what was actually separating the two sides
all along, and naming it ratifies 3.3 rather than revisiting it.

| Storage | Vocabularies |
|---|---|
| **TS `as const`** (~20, all curated) | `advance_mechanism` · `actuator` · `part.kind` · `medium` · `claimed_by` · `evidence` · `polarity` · `fit_quality` · `necessity` · `sourcing` · `made_by` · `observance` · `rear_topology` · `form` · `handedness` · `bore_class` · `radial_retention` · `axial_adjust` · `review_state` · `result_quality` |
| **Table** (scraper-side, not ours to change) | `mechanisms` · `product_types` |
| **Table** (shared with the scraper, like `maker`) | **`material`** |
| **Free text, flagged** | `product_variant.finish` |

Every entry in column 1 is closed, data-free and **human-promoted** (4.5: the scraper stages, a
person promotes), so growing one stays a TS edit rather than a migration. That is the Sitting 2
repo constraint, unchanged.

#### 🔑 The one thing it changes — `product_variant.material` was neither

`material string null` is **free text**: no fixed list *and* no shared list. It is the one curated
column whose vocabulary genuinely opens at runtime — Timascus, mokume, zirc, and whatever alloy a
maker ships next — and it is a real browse facet. Free text guarantees `Titanium` / `titanium` /
`Ti` become three things and fragment that facet.

→ **`product_variant.material_id bigint fk null > material.id`.**

**Precedent, not a new pattern:** our `maker` entity is already the committed `makers` table —
`root_url text unique` was inherited as `// HOUSE` precisely because it is *"the scraper's
identity key, already load-bearing."* The model already shares a table with the scraper side where
the entity is genuinely the same thing. `material` is the second, and `material` is now a declared
entity in the ERD so the FK resolves.

**`finish` stays `string null`, flagged.** Corpus values are half vocabulary (Machined,
Stonewashed, DLC) and half prose (*"a deep blackened finish"* + laser engraving, per Dark Pines).
**ERD rule 2** — do not invent the field. Revisit when the corpus forces it.

#### Knock-ons

- **C3 largely dissolves** — see below. If `mechanisms` and `product_types` are scraper staging
  rather than curated vocabulary, then `mechanisms.name = "click"` is not a schema that
  contradicts 3.5; it is raw scraped vocabulary awaiting exactly the human promotion 4.5
  specified. **Seventh question to dissolve into another.**
- **`claimed_by` stays one TS vocabulary across three tables** (`fit_check`, `refill_dimension`,
  `rebrand`), which is what 4.4b anticipated when it said *"if §5.4 later turns these into lookup
  tables, one table serves both."* It did not.
- **Entity count 17 → 18**, edges 31 → 32.

**Sources (C1):** [Unsharpen — Schmidt Pen Refill Buying Guide](https://unsharpen.com/schmidt-pen-refill-buying-guide/) ·
[The Gentleman Stationer — Baron Fig Squire / Schmidt P8126](https://www.gentlemanstationer.com/blog/tag/Schmidt+P8126) ·
[Pen Savings — Retro 51 Capless Rollerball Refills by Schmidt](https://pensavings.com/products/retro51-rollerball-refill) ·
[Premec — Writing / refills](https://www.premec.ch/refills/) ·
[Monteverde — ballpoint refills for Parker, Cross, Montblanc](https://www.monteverdepens.com/collections/ballpoint-refills) ·
[The Well-Appointed Desk — Epic Refill Reference Guide](https://www.wellappointeddesk.com/2014/06/epic-refill-guide-rollerball-gel-and-ballpoints/)

### C3 — **ANSWERED (a): neither table is corrected and neither is used. They are INPUTS**  🔴  *(lexicon §5.3, closed)*

**Seventh question to dissolve into another** — C2 had already done most of the work by placing
these tables on the ingested side. Tracing how they are *populated* finished it.

#### Both "collisions" were misreadings, and one of them was mine

| §5.3 claimed | What the code says |
|---|---|
| *"`mechanisms.name = "click"` — the committed table has already made the mistake the interview diagnosed. Inheriting its values is a regression."* | `mechanisms` rows are **interned from scraped free text**: `drizzle/0008_silly_carnage.sql:44` matches `slugify(tmp_autmog_pens.mechanism)` against `mechanisms.slug`. **"click" is a QUOTE**, not a modelling claim — it is the word Autmog printed. Recording it is the ingest working correctly. |
| *"`product_types` stores a classification 3.1 demoted to derived."* | ⚠️ **Wrong, and it was my error in the lexicon.** `getProductTypes()` (`apps/scraper/src/autmog/normalize.ts:181`) passes **Autmog's own Shopify `category`/`product_type`** straight through. 3.1 demoted *ballpoint/gel/rollerball*, which comes off the **refill**. This is a maker's shop taxonomy — the same machinery that separates pens from the Grimsmo knives in the same scraper. Related-looking, different thing. |

#### 🔑 The real finding — promotion is a SPLIT, not a rename

Every mapping decided so far is one-to-one: `back_piece → top_cap` (3.3), `ClickShift/CamPen/Switch
→ a generic `advance_mechanism` value` (pass 7). **This one is not.**

> Autmog says **"click"** → our model needs **`advance_mechanism = ratchet`** *and*
> **`actuator = top_button`** — one scraped word landing in **two** curated columns.

**And it does not determine them.** A side-click pen and a top-click pen may both print "click";
only looking at the pen settles it. So the promotion step cannot be a lookup table — it is
**judgment**, which is independent confirmation of 4.5's *"broad and cheap means cheap per row,
not unattended."* It also means (b), correcting the scraped tables, is impossible in principle:
the scraper would have to decide at scrape time, with no pen in hand, a fact the maker's page does
not contain.

#### Rejected

- **(b) correct the committed tables** — makes the scraper store *our conclusions* instead of the
  maker's words, re-merging the two corpora 4.5 just split, and discards the maker's actual
  wording, which is **evidence** (4.3's whole citation apparatus depends on it).
- **(c) v2 adopts them** — reinstates the mixed-axis `click` that 3.5 split and the classification
  3.1 removed.

#### Knock-ons

- **No schema change.** v2 reads `mechanisms` and `product_types` never; they keep serving `tmp_*`.
- **`material` is the exception and stays one** — C2 admitted it because a *material* is the same
  thing on both sides of the promotion, whereas a *mechanism word* is not.
- **The promotion map is a real deliverable, not a lookup** — it belongs to whoever builds the
  promote step (Roy's side, with R2/R3), and it is where `bore_class`, `advance_mechanism`,
  `actuator`, `radial_retention`, `handedness` and `axial_adjust` all get decided by a person.

### C4a — **ANSWERED: a fifth `claimed_by` value, `retailer`**  🔴  *(closes the 4.4b OPEN)*

**`claimed_by` = `maker | retailer | community | owner | staff`**, on all three tables that carry
it (`fit_check`, `refill_dimension`, `rebrand`). Buyer label: **"Listed by Penstore"**. The 4.3
curation rule extends to it — a `retailer` row **requires** a citation.

#### The case that raised the gap argues for the answer

Fisher PR: **Unsharpen 90 × 4.8** vs **Penstore 89 × 5.8**. Unsharpen publishes caliper numbers;
Penstore reprints a spec sheet. **Not the same kind of source**, and that difference is the whole
reason the row is contested.

| Rejected | Because |
|---|---|
| fold into **`maker`** | **Overclaims** — naming-law trap 2. It renders as *"the maker says 5.8"* when Fisher may never have published 5.8. A retailer reprint is precisely where 4.4's *"typo or copy-paste"* enters, so this labels the wrong party and would point `disputed_note` at the maker for a shop's slip. |
| fold into **`community`** | Collapses the enthusiast-with-calipers into the shop-with-a-spec-sheet. The two Fisher rows become **identical in kind** on the page, with nothing saying one was measured and the other retyped. |

#### 🔑 Why it matters more on `refill_dimension` than on `fit_check`

**4.4b deliberately kept `evidence` off `refill_dimension`** — *"`claimed_by` already carries it,
and there is no verdict for a second axis to feed."* So on that table `claimed_by` is the **only
trust signal that exists**, and a value merging *measured it* with *copied it* destroys the one
signal the table has. On `fit_check`, `evidence` would have recovered the difference; here nothing
would.

**Not a reversal of 4.3's rejection of per-source reliability.** That rejected *scoring*.
This is labelling, and 4.4's rule holds unchanged: **`claimed_by` labels, `evidence` ranks.**
Adding a value to one axis is not a second axis — no ninth axis-mix.

#### Knock-ons

- **Guard 3 on Rule 3 is unaffected.** A geometry negative still fires only on an unconflicted
  `feature` or a `staff` row. Fisher's two rows still conflict, still suppress the screen, still
  both render — the buyer can now just see *why* they differ.
- **`owner` remains unreachable on `refill_dimension`** (4.4b); `retailer` is reachable on all
  three tables.
- One TS `as const` vocabulary, five values, three tables — C2's rule, unchanged.

### C4b — **ANSWERED: `ships_with_refill_id` MOVES to `tip_option`**  🔴  *(closes the 4.5 OPEN)*

#### 🔑 It is F3′ for the third time, not a new rule

F3′ put `refill_style_id` on the tip option and kept it off the product. 3.1's knock-on made
`tip_option` **mandatory even at 1:1** (Autmog) so it could never slide back. `ships_with_refill_id`
**implies a fit**, and a fit is tip-scoped — so it belongs at the same grain, for the same reason.

Every corpus case is tip-scoped once examined:

| Case | Why |
|---|---|
| **Karas Render K** — sold in Parker *and* G2 tips | what is in the box depends on which you bought. On `product` there was **no answer that wasn't wrong**. |
| **Modern Fuel** — ships a G2 *and* ships set-for-G2 | that **setting** is the tip's, not the body's (3.2b already put `axial_adjust` overrides there) |
| **BilletSpin** — "one **trimmed** EnerGel included" | trimmed to fit **that nose cap**, which the maker scoped in caps: *"THIS NOSE CAP will not fit a Parker style refill"* |

#### Rejected — a 3.2b-style product default with a tip override

That pattern earned its place because a pen **genuinely is** fixed-or-collet and a tip can *change*
it. Here there is no product-level fact for a tip to refine: the box holds one refill, decided by
the configuration. A product-level value would be a **guess about which configuration is "normal"**
— something no maker publishes. **One fact, one grain.**

#### Knock-ons

- **Nothing changes for single-tip products** (Autmog, BilletSpin) — same row, different table.
- For a maker shipping the same refill with every tip variant it becomes one row per tip. **3.2's
  knock-on already priced this as cheap** — a body has one to three tips, versus a maker's dozens
  of clips and springs, which is what justified family-scoping `part` and not `tip_option`.
- **4.5 is untouched:** still the **seeder's worklist**, not a free positive. A curator writes the
  first `fit_check` for each pen by hand, because the in-box refill may already be trimmed. The
  4.4 verdict rule still reads `fit_check` only.
- **`toleranced_for_refill_id` was already on `tip_option`**, so the two claims 3.2b insisted on
  keeping apart — *default config* vs *design intent* — now sit side by side at the same grain,
  which makes the distinction easier to hold, not harder.

### ✅ CARRIED STRUCTURAL ITEMS COMPLETE — C1 · C2 · C3 · C4a · C4b.

---

## Sitting 5 — ⚠️ DIRECTION CHANGE FIRST  *(BVG, 2026-08-13)*

> BVG: *"we are actually dropping field-log and going a different direction to build a database
> only for the web right now and not integrate with the app, we will allow users to save their own
> configs but it will be more limited."*

**Already true in the repo, and further along than the sentence suggests** (verified against
`origin/main`, which the local branch is 23 commits behind):

| Fact | Evidence |
|---|---|
| **`apps/field-log` is GONE** | `git ls-tree origin/main apps/` → `api · mobile · scraper · web`. Removed upstream already. |
| **The project is renamed "Pocket Trash"** | PR **#78** (Roy, 2026-08-12) — brand, domain, worker, secrets, mobile identity, CDN, Railway and web persistence names. `package.json` name is now `pocket-trash.app`. The git remote is still `Field-Log/field-log`. |
| **`apps/mobile` still exists** | So *"not integrate with the app"* is a **direction**, not a deletion. |
| **A real user model landed** | PR **#63** — `users` = `id` + `clerk_id` (Clerk-backed, minimal); `user_settings` = one row per user, `user_id` PK, `ON DELETE cascade`. |

### 🔑 What this does to the Sitting 5 agenda

1. **The OWNERSHIP question is MOOT.** 5.3/5.4/5.5 were flagged as Brownie's because the collection
   layer was his app's centre of gravity. There is no app to integrate with. **They are BVG's**, and
   the questions file's owner index is stale.
2. ⚠️ **I overstated a blocker and am correcting it.** I called *"no user model"* the reason to defer
   the collection layer. Too strong: `users` and `user_settings` are committed and Clerk auth is
   merged. What was missing was only **wiring into our ERD** — one FK. The real blocker was that the
   layer was being designed for someone else's app, and that is gone.
3. **5.5 is nearly pre-answered.** *"Log from day one — consumption history is a feature"* was
   **field-log's own premise** (a carry logger over generic `log_entries`). Web-only and
   deliberately limited points at a **field**, not a log. Confirm rather than assume.
4. **5.3's list shrinks hard.** Drop number · serial · acquisition date · price paid · current
   value · condition · photos is **collector-inventory** — the shape being stepped away from.

### 5.3a — **ANSWERED: a saved config is a PEN YOU OWN**  🔴

Not "a setup you've saved, owned or not," and not both-with-a-flag.

**The row is:** a finish (`product_variant`) + a pen tip (`tip_option`) + whatever refill is loaded
— which is **exactly what `collection_item` already holds.** No price, no serial, no condition.

🔑 **And it makes `fit_report` cheap and well-formed.** 4.1 requires a report to be **concrete** —
*"a person owns one pen, so a report names a `tip_option`."* A saved config **already names one**.
So report submission becomes *pick your setup, tell us if it fits*, and the thing 4.1 demanded
arrives for free. The feature being kept is the one the moat wanted.

**Why not "setups, owned or not":** reports would arrive from people who have never held the pen —
precisely the false-positive risk 4.1 was written against and 4.1b's *"accuracy not widespread
adoption"* chose against. **Why not the owned/wanted flag:** it is one boolean away if a wishlist is
ever wanted, and adding a defaulted boolean later is genuinely cheap — unlike most schema changes.

**Knock-on — `collection_item` gains `user_id`.** Forced, not invented: a row that means *a pen you
own* must name the owner, and `users` is committed. `user_settings` sets the precedent for shape
(`user_id` FK, cascade on delete).

### 5.2 + the refill grain — **ANSWERED (a): `refill` is a MODEL; a new `refill_variant` holds what you actually buy**  🔴  *(BVG, 2026-08-14)*

Asked as **one** question, because they were one question.

**THE DEFECT THAT FORCED IT — a NEW class, not axis-mixing.** `tip_size decimal null` and
`colour string null` were *single-valued* columns on a row that every join treats as a **model**. A
Sarasa comes in three tip sizes and twenty colours; one decimal and one string cannot say that. **A
column whose cardinality contradicts its row's grain** is a third named defect class in this model,
alongside axis-mixing (eight) and 3.2b's derived-field-with-demoted-input (one).

**What decided the grain: count the joins.** Six things point at `refill`, and **five want the
model** —

| Join | Wants | Why |
|---|---|---|
| `fit_check.refill_id` | **model** | Tactile Turn publishes "Pilot G2", never "Pilot G2 0.7 blue" |
| `refill_dimension.refill_id` | **model** | Unsharpen measured *the Fisher PR*, not the blue one |
| `rebrand.refill_id` / `oem_refill_id` | **model** | Retro 51 REF5P ≡ Schmidt P8126 is a model-to-model claim |
| `tip_option.toleranced_for_refill_id` | **model** | Autmog's ±25 µm is against a body OD |
| `tip_option.ships_with_refill_id` | **model** | "ships with a G2"; BilletSpin's is *trimmed*, which is also model-level |
| `collection_item.installed_refill_id` | *maybe the exact one* | the only one that leans SKU-ward — deferred, see knock-on 3 |

🔑 **And 4.5's split already drew this line one level up.** The **catalog** corpus is
SKU-shaped — BigIDesign's ~800-row sheet is *brand + model + tip size + colour per row* — while the
**fit** corpus is model-shaped. Same seam, one level down. SKU-grained `refill` rows would multiply
every hand-curated fit check, measurement and rebrand by ~60 for **zero added truth**, because
colour never affects fit. That is the opposite of "narrow and deep".

**THE ANSWER**

1. **`refill` stays the model.** `tip_size` and `colour` come **off** it.
2. **NEW entity `refill_variant`** — `refill_id` · `tip_size` · `colour_name` · `colour_family`.
   The **19th** modelled entity, 34th edge. No `slug` and no `name`, exactly like
   `product_variant`.
3. **5.2's own fork is answered BOTH ways, because it was two columns wearing one name:**
   - `colour_name text null` — **the full long tail**, the maker's own word ("Vintage Vermillion").
     Free text. **The same call C2 made for `product_variant.finish`**, for the same reason: half
     vocabulary, half prose, and unnormalisable.
   - `colour_family enum null` — **the coarse browse bucket** that actually drives the filter.
     `black | blue | red | green | other`. Starts coarse and grows; `blue_black` is the likely
     first addition (JetPens carries it as its own facet value).

**Why the split is not optional — naming-law trap 3, and the NINTH axis-mix.** One `colour` column
was carrying *what it is called* and *what bucket it filters into*, two orthogonal facts. The bucket
**cannot be derived** from the name — no code turns "Vintage Vermillion" into `red` — so the coarse
value has to be curated. This is the exact `bore_class` + `bore_mm` / `axial_adjust` +
`accepts_length_*` shape, run in the other direction: a coarse value that covers **every** row, plus
a precise one where the maker bothered to publish it.

**C2 applied cleanly, both halves.** `colour_family` is closed at compile time and a member is
nothing but its own name → **TS `as const`** (→ `pgEnum` at the column, per the 2026-08-13
correction; `ALTER TYPE ADD VALUE` is cheap, which is what makes "start coarse" safe). `colour_name`
arrives at runtime and carries prose → **free text**, not a table, because unlike `material` it has
no shared vocabulary to converge on.

**Why a variant table rather than SKU-grained refills:** it is the **refill-side twin of
`product_variant`**, and it exists for the identical reason 3.7 (d′) gave — *surface differences
that change nothing about fit must never duplicate the assertion corpus.* `product_variant` proved
the pattern on the pen side (Dark Pines' finish inherits every one of TT's fit rows). This is that
pattern's **second instance**, which is why it is named to match.

**Naming law.** `refill_variant` inherits `product_variant`'s standing — rule 6 lists that one under
*not renamed, deliberately so; guessable*. The parallel is the argument: a reader who has met one
has met the other. Buyer-facing label is **`refill_option`** (lexicon §2), which is what a shop
actually calls it.

**THE ESCAPE HATCH — decision 1.3's precedent.** If a tip size ever turns out to change the physical
part (a needle tip that seats differently in Autmog's 2.5 mm aperture is the plausible case), that
size becomes **its own `refill` row** — *kept apart until proven identical*, exactly how 1.3 handled
`fisher-pr` vs `lamy-m22`. The fit corpus never has to learn about variants.

**Knock-ons**

1. ✅ **CLOSES C1's `OPEN 5.2` on `rebrand`.** The link was flagged as "coarser than reality" only
   because the `refill` grain was fuzzy. It is not fuzzy now: a rebrand is **model → model**, which
   is what Schmidt actually sells Retro 51. A colour-specific relabel is handled by the escape hatch
   above, not by the link.
2. **`refill_variant` is CATALOG corpus** (4.5's left column): scraper stages, a human promotes.
   It is where BigIDesign's 800-row sheet lands. **Nothing in the fit corpus points at it** — that
   is the property worth protecting, and it is the whole point of the split.
3. ⚠️ **DEFERRED to 5.3b — does `collection_item.installed_refill_id` name the model or the exact
   one?** Real tension, both sides have force: `collection_item.variant_id` already points at
   `product_variant` rather than `product` (you own a *specific finish*), which argues by symmetry
   for the variant. Against it: a finish is permanent and is *why* you saved the row, while the
   loaded refill is a status field that changes weekly, and `fit_report` joins through
   `tip_option` + `refill` regardless. **Not decided here.**
4. **5.1 is confirmed and complete.** `medium` stays on `refill` (an EnerGel is gel in every
   colour); `tip_size` and `colour` move to `refill_variant`, so the browse facets read the variant
   table. All five of 5.1's facets survive — they just live at two grains.
5. **Graphite needs no `hardness` column, and this is why.** A `medium = graphite` refill row is the
   **pencil mechanism** (Schmidt DSM 2006 — the seated cartridge, per Sitting 3's boundary), and
   `tip_size` is the **lead diameter it accepts** (0.5 / 0.7 / 0.9). The lead itself is a consumable
   one level *below* the mechanism and is not in this model at all. So a graphite refill's variants
   differ by lead Ø only, and `colour_family` is null there. Checked before assuming.
6. **No item/part code column** (`LR7-A`, `BLS-VB5RT-BB`). ERD rule 2 — not invented. `(refill_id,
   tip_size, colour_name)` is already a natural key, so nothing is blocked. Flagged, not built.

---

## Research pass 9 — **R-A**: can `refill_variant` actually be populated at launch?  *(2026-08-14)*

Run **before** 5.3b(i), because the recommendation I was carrying rested on *"the variant table
will be thin at launch."* **Tested rather than assumed, and it did not survive.**

### The three models in the corpus, against the makers' own sites

| Model | Complete size × colour matrix published? | What is there |
|---|---|---|
| **Pentel EnerGel** | ✅ | `pentel.co.jp` lists XLRN3 / XLRN4 / XLRN5 / XLR7 / XLR10 = 0.3 / 0.4 / 0.5 / 0.7 / 1.0 mm with per-size colour sets — **5** colours at 0.3–0.4, **15** at 0.5, **11–12** at 0.7 and 1.0. JetPens carries **51** colour × size combinations for the family. |
| **Uni-ball Signo** | ✅ | `mpuni.co.jp` publishes **one table of every gel refill**: UMR-85N 0.5 (4 colours) · UMR-85E 0.5 (**black only**) · UMR-87E 0.7 (black only) · UMR-83 0.38 (4) · UMR-1 0.38 (4) · UMR-1-05 0.5 (3) · UMR-5 · UMR-10 · URR-100-38/05… |
| **Pilot Juice Up** | ✅ | Pilot runs **`pilot-refill.jp`, a dedicated refill site** — LP3RF-12S3 / S4 / S5 = 0.3 / 0.4 / 0.5, colours B · R · L · **BB** · O — *and it maps every refill to the pens it fits.* |

### 🔑 Three findings, and the first one kills my own argument

1. **THE COLD-START ARGUMENT IS DEAD.** Three of three are trivially enumerable, from the maker,
   one page each. Under 4.5 the catalog corpus is *"scraper stages, a human promotes"* — and this
   is the cheapest possible instance of that. **`refill_variant` will not be thin.** Reported
   against my own recommendation, per the brief.
2. ⚠️ **THE ITEM CODE ON THE REFILL IN YOUR PEN ALREADY NAMES THE SIZE.** `LR7` *is* the 0.7;
   `UMR-85N` *is* the 0.5; `LP3RF-12S`**`4`** *is* the 0.4. Colour is a **suffix on the box**
   (`XLR7-A` black, `-B` red, `-C` blue; `LP3RF-12S4-BB`). So all three makers draw the line in
   the same place — **size is part of the identifier, colour is an option on it** — and a
   model-only FK cannot record what is literally printed on the part. A new argument, and it
   points the *other* way from finding 1.
3. ✅ **THE MATRIX IS RAGGED, WHICH RE-PROVES 5.2's TABLE.** Colours do not survive a size change:
   UMR-85E is 0.5-black-only while UMR-85N is 0.5 in four; EnerGel runs 5 colours at 0.4 and 15 at
   0.5. **Size × colour can never be generated** — it has to be stored as rows. (Also answers
   **R-C** early: a browsable refill catalog needs **no new column**; ERD rule 2 holds.)

### ✅ **R-D paid off as a by-product** — `blue_black` is sourced now, not reasoned

The flagged claim was JetPens' facet, which was never read. It no longer matters: **blue_black is
first-class at all three makers** — uni ships BB across six item codes, Pilot as `-BB`, Pentel in
the 0.3/0.4 set. **Added to `colour_family`** (`black|blue|blue_black|red|green|other`) in all four
ERD files. Lexicon §2.3's ⚠️ can come off. *(BVG may overrule; "start coarse and grow" made this
the cheap direction.)*

### ⚠️ A DEFECT IN THE CORPUS, found while doing this — **`BLS-VB5RT` is not the Juice Up refill**

It is the **V Ball RT** refill — which is the **Precise V5 RT**. Four retailers and Pilot's own
refill site agree; the Juice Up takes **LP3RF-12S3/S4/S5** (gel), the V Ball takes BLS-VB5RT
(liquid ink). Two different parts, and this file has been treating them as one. Consequences:

- **The `pilot-g2` membership table** (research pass 1) reads *"Pilot G2, Juice Up (BLS-VB5RT/
  VB7RT), Precise V5 RT"* — **two of those three names are the same part**, and the Juice Up's
  actual refill has never been named anywhere in the corpus.
- **Measurement round 1** — *"Juice Up BLS-VB5RT + Precise V5 RT"* — is **one refill written
  twice**, so the launch dependency 4.5 promoted under-covers by one. It should read
  *Juice Up **LP3RF-12S4** + Precise V5 RT **(BLS-VB5RT)***.
- **2.4's `rear_topology`** rests on BVG's Juice Up case, and its draft values are to be firmed
  from these measurements. **BVG has the pens — confirm which refill was actually in hand before
  those numbers are taken.** Flagged, not acted on.

**Sources:** [Pentel — refills](https://www.pentel.co.jp/products/refill-ballpointpen/) ·
[Mitsubishi Pencil — gel refills](https://www.mpuni.co.jp/products/ballpoint_pens/refill_gel.html) ·
[Pilot — refill site, Juice Up 0.4](https://www.pilot-refill.jp/gel/lp3rf12s4) ·
[Penstore — BLS-VB5RT "V Ball 05 RT Refill"](https://www.penstore.nl/pens/refills/pilot-refills/pilot-bls-vb5rt-v-ball-05-rt-refill-extra-fine-black) ·
[JetPens — EnerGel LR7 colours](https://www.jetpens.com/Pentel-EnerGel-LR7-Gel-Pen-Refill-0.7-mm-Black/pd/5344)

---

### 5.3b(i) — **ANSWERED (c): BOTH — the model always, the exact one when you know it**  🔴  *(BVG, 2026-08-14)*

`collection_item` keeps **`installed_refill_id`** (the model) and gains
**`installed_refill_variant_id`** (the exact one, optional). Both nullable — a saved pen with
nothing loaded is a real state.

**What moved the recommendation.** I came in recommending **(a) the model**, on three legs.
Research pass 9 broke two of them and BVG asked for the third to be spelled out:

| The leg | After R-A |
|---|---|
| *"the variant table will be thin at launch"* | **Dead.** All three makers publish the whole matrix. |
| *"a fit report needs a downgrade join"* | **Dead as a cost.** It is one FK hop, not a burden. |
| *"`refill` is FORCED to exist by `fit_check`; nothing forces `refill_variant`"* | **Survives** — and it is the whole case against exact-only. |
| *(new)* the item code names the size | **Against model-only.** You cannot record `LR7` on a row that only knows "EnerGel". |

**⚠️ AND I HAD TO CORRECT MY OWN OBJECTION TO (c).** Last session I ruled (c) *"stores one fact in
two FKs that can disagree."* **That is wrong — they can be made unable to disagree**, and the
mechanism is stated here so implementation does not have to guess:

```
refill_variant   UNIQUE (id, refill_id)
collection_item  FOREIGN KEY (installed_refill_variant_id, installed_refill_id)
                   REFERENCES refill_variant (id, refill_id)
                 CHECK (installed_refill_variant_id IS NULL
                        OR installed_refill_id IS NOT NULL)
```

Postgres' default `MATCH SIMPLE` skips the pair check when either column is null — **which is
exactly what permits the model-only row** — and the `CHECK` stops the reverse (an exact refill with
no model). **`MATCH FULL` would be wrong**: it forbids the very case (c) exists for.

**What (c) buys, in the cases that will actually occur:**

| Situation | (a) model only | (b) exact only | **(c)** |
|---|---|---|---|
| Blue EnerGel out of a multipack; barrel says **LR7**, but 0.7 ships ~12 colours and you cannot tell Blue from Navy Blue | ✅ coarse | ❌ guess or leave blank | ✅ record now, colour later |
| A single **Juice Up 0.4 black**, box in the drawer | ❌ loses both facts | ✅ | ✅ |
| A **0.7 lead** pencil mechanism when you also own the 0.5 | ❌ indistinguishable | ✅ | ✅ |
| A limited-edition colour not yet catalogued | ✅ | ❌ blocked | ✅ |
| *"Does it fit? Tell us"* (**4.1**) | ✅ direct | needs a lookup | ✅ direct |
| *"Buy this one again"* | model page | ✅ exact | ✅ exact when known |

**Knock-ons**

1. 🔑 **RENAME — `collection_item.variant_id` → `product_variant_id`.** Forced by the new column:
   two columns on one row both saying *variant*, meaning the **pen's finish** and the **refill's
   option**. **Naming-law trap 3**, and the **second time it has fired inside our own schema**
   after `source` (§0.2). Caught at creation, which is the entire point of rule 6.
2. **`refill_variant` needs `UNIQUE (id, refill_id)`.** A key, not a column — it is what the
   two-column FK references. Recorded in the ERD.
3. **NOT a twelfth demotion.** The model column is stored on **every** row; what is derived is the
   **keystroke** — the picker asks **once**, and choosing the exact one fills the model for you.
   That also disposes of the "two columns to keep straight in the UI" cost I raised.
4. **The 4.5 seam holds.** This is the **first FK into a purchase-option child from outside the
   catalog**, and the guard in the identity-vs-purchase-option section is about **fit** queries.
   None gained a hop: the verdict rule, `fit_report` and all four display states still read
   `installed_refill_id`. The collection is neither corpus — it is the one place that legitimately
   wants both grains, exactly as it already reaches `product` *through* `product_variant`.
5. **5.2 is not reopened.** Finding 2 (the maker's code names the size) is a fact about **catalog
   identifiers**, not about fit: TT still publishes *"Pilot G2"*, never *"Pilot G2 0.7 blue"*. If a
   size ever turns out to change the **part**, 1.3's escape hatch — its own `refill` row — is still
   the answer, unchanged.

**19 entities · 35 edges.** All five `.eraser` files updated in the same sitting; the collection
view gained `refill_option`. `python3 .notes/validate-eraser.py` → **exit 0**.

### 5.3b(ii) — **ANSWERED (a): nothing more — and LESS ENTRY. The catalog fills the row; you correct it**  🔴  *(BVG, 2026-08-14)*

> BVG: *"I don't think that they even need the refill, I think the base specs from the manufacturer
> or from the database that we have built out in general are enough and should semi auto populate —
> they only need to have entered 'copper tibolt' and that should be enough. It's just the stock
> config; if they want to tweak more parameters that's fine but we can pre-fill the fields with
> data and they can change anything at will."*

**No new columns.** The question was *"what else does a saved pen need"* and the answer came back
from the opposite direction: **not "keep it minimal" but "stop asking the user for what we already
know."** Nickname and note both declined — the note for the reason below, the nickname because the
row already renders a name it does not store (`maker` + `pen` + finish + pen tip + what's loaded).

**Half of it was already built.** `collection_item` stores **zero specs** — it is four FKs, and
every spec (tip opening, length window, refill grip, which style it takes) is read through to the
catalog and is therefore always current. What BVG added is that **the four FKs themselves should
arrive pre-filled**, not typed.

**⚠️ THE FORK THAT MATTERED — pre-fill is not one idea, and the two diverge a year in.**

| | Behaviour |
|---|---|
| **(a) CHOSEN — fill it in and save it** | The form arrives pre-filled from the catalog; the values are **written to the row**; the owner changes anything. Blank still means **nothing loaded**. |
| (b) rejected — store only the changes | Blank means *"whatever it ships with"*, resolved on every read. |

Three reasons, and the first is the model's own precedent:

1. **A pen you own must not change because a curator edited a catalog row.** Under (b), the day
   someone corrects what Fellhoelter ships in the box, every saved TiBolt silently changes what is
   loaded in it. **4.4 already drew this line** — `fit_check` is mutable curated state, `fit_report`
   is the append-only record — and a saved pen belongs on the second side of it.
2. **It protects the report (4.1 / 4.1b).** Under (a) a report carries a value the owner **was
   shown and left alone**; under (b) it carries one they **never saw**. That is the false positive
   4.1 exists to prevent, arriving through a side door.
3. **Blank keeps meaning blank.** Under (b) *"the pen is empty"* becomes unsayable, because null
   has been spent on *"stock"* — a nullable column carrying a second meaning, which is the defect
   class 5.2 just named.

**🔑 THE PRE-FILL RULE — fill what the catalog makes unambiguous, ask only where it branches.**
Mechanical, and checkable straight off the schema: **one `tip_option` on the product → fill it;
more than one → ask exactly one question, then fill the rest.** BVG's own example is the branching
case — *"copper TiBolt"* is Fellhoelter's **Full Size TiBolt (Schmidt)** or the **G2 TiBolt (G2
Mini)**, and the TiNyBolt is `fisher-pr` again — three different answers to *"what's loaded"*. A
single-tip maker (Autmog, Modern Fuel) asks nothing at all.

**🔑 AND THE PRE-FILL CAN ONLY EVER REACH THE MODEL.** The stock refill comes from
`tip_option.ships_with_refill_id`, which **C4b deliberately keeps at model level** (*"ships with a
G2"*; BilletSpin's is pre-trimmed). So the catalog fills *"an EnerGel LR7"* and **can never** fill
*"the 0.7, Navy Blue"*. That is a clean division of labour and it **confirms 5.3b(i) (c) rather
than disturbing it**: the catalog supplies the model, the owner optionally supplies the exact one.

**WHY NO NOTE FIELD — it is where fit knowledge would go to die.** *"This one rattles"*, *"I had to
trim it 2 mm"* are facts about a **pairing**, and 4.1 already built their home: `fit_report.note`,
where a curator sees the prose and can promote it into a `fit_check`. A note on the collection row
routes exactly the content **F5 says we sell** into a private field nobody reads.

**Knock-ons**

1. **The resolver is new work, not new schema.** Free text → `product_variant` (*"copper"* is
   `material_id`, C2; *"TiBolt"* is the product). It is a **catalog-completeness** dependency:
   a pen with no `product_variant` row cannot be saved. Feeds **5.7** and the launch-scope
   question, and it is the strongest argument yet that variants must be seeded, not just products.
2. **Nickname deferred, not refused.** One nullable text column, additive, no backfill — the same
   *"one column away"* standing as 5.3a's wishlist boolean. The case that would force it is **two
   identical copies you want to tell apart**, which is **5.4**.
3. **Not a demotion.** The stock refill is **written at save time**, not derived at read time. It
   is deliberately *not* in the DERIVED list, and (b) is the version that would have put it there.

---

## Research pass 10 — **R-F**: does anyone sell a pen tip in an alloy?  *(2026-08-14)*

Run because BVG's *"a copper tip on a titanium TiBolt"* looked like it forced a new entity, and one
maker does not earn a table.

| Claim | Verdict |
|---|---|
| **Swappable cosmetic components in alloys are a real, maker-endorsed pattern** | ✅ **CONFIRMED, twice.** Tactile Turn sells the **Bolt Action Back Piece** on its own in **Titanium, Copper, Bronze and Zirconium**, stating *"materials can be mixed and matched between pens"* and *"you must select the correct diameter (Standard, Slim, or Thick) as they are not interchangeable."* Fellhoelter's **Dunce Cap** ships Copper/Titanium. |
| **A TIP sold alone in an alloy** | ❌ **NOT FOUND, and impossible at one maker.** TT: *"the tip and body of the pens are machined together."* Fellhoelter's **TiBolt Spare Parts** kit is an **o-ring, a spring and a Schmidt EasyFlow 9000** — no tip, no alloy options. |
| **Fellhoelter's tips that DO exist as SKUs** | Inside the **G2 Adapter Kit** and the **Mini G2 Conversion Kit** — both **change the refill style**, which pass 6 already classified as **tip options**, not parts. |

🔑 **TT described our own schema back to us.** *"Mixed and matched … select the correct diameter
(Standard, Slim, or Thick)"* **is `part.family_id`** — decision **3.2 (a′)**, family-scoped parts,
built and ratified three sittings ago. A copper back piece is a `part` row, `kind = top_cap`,
`family_id` set. **The catalog needed nothing.**

🔑 **And BVG's example decomposed into rows that already exist.** A copper tip on a titanium TiBolt
is either the **CuTiBolt** — copper body, tip *and* cap, i.e. a whole product (`product` /
`product_variant`) — or a **cap** (`part`). **The `tip_variant` entity I was about to recommend is
withdrawn**, logged as the **tenth axis-mix, *avoided***. Revisit only if a maker starts selling
tips by alloy.

**Sources:** [Tactile Turn — Bolt Action Back Piece](https://tactileturn.com/products/bolt-action-back-piece) ·
[Tactile Turn — Materials](https://tactileturn.com/pages/materials) ·
[Fellhoelter — TiBolt Spare Parts](https://fellhoelter.com/products/tibolt-spare-parts) ·
[Fellhoelter — TiBolt G2 Adapter Kit](https://fellhoelter.com/products/tibolt-g2-adapter-kit) ·
[Monkey Edge — TiBolt Dunce Cap, Copper/Titanium](https://www.monkeyedge.com/fellhoelter-tibolt-dunce-cap-copper-titanium)

### 5.4 — **ANSWERED: SEPARATE ROWS, ALWAYS — and a new `part_fitted`**  🔴  *(BVG, 2026-08-14)*

**Never a quantity field.** A count cannot say **which refill is in the second one**, cannot be the
subject of a report (**4.1** requires one pen), and *how many you own* is the **inventory** shape
**5.3a** stepped away from. 5.3a had already made each row *a specific configuration*, so this is a
confirmation, not a derivation.

**⚠️ BVG CORRECTED MY REASON, AND THE CORRECTION IS THE DECISION.** I argued the nickname was
unnecessary because *"identical rows mean identical pens — the loaded refill separates them."* He
answered: *"refill might not be the thing that sets them apart — it could easily be a different
finish, small part like a copper tip on a titanium tibolt, etc."* Checked against the schema:

| What tells two copies apart | Could the row say it? |
|---|---|
| a different **finish** | ✅ `product_variant_id` |
| a different **pen tip** taking a different refill | ✅ `tip_option_id` |
| **a bronze clip, a copper back piece** | ❌ **nothing in the model could record it** |

**THE ANSWER — `part_fitted`, the 20th entity.** A pure link table, `collection_item` × `part`,
shaped exactly like `part_needed` (no `id`) and **named to rhyme with it**, the same move
`also_sold_as` made against `also_known_as`.

**🔑 THE CURATION RULE THAT MAKES IT SAFE — stated, not constrained, like 4.3's citation rule:**

> **Parts that change how the pen LOOKS are the owner's choice and belong here. Parts that change
> how it FITS are not a choice — the refill dictated them, and `part_needed` already holds them.**

`part.kind` is the test: `clip | bolt | bolt_handle | top_cap` here; `spring | o_ring | spacer |
adapter` come from the fit corpus, reachable through the `fit_check` for your refill × tip option.
**Why it matters:** a functional part recorded here would put a configuration into a `fit_report`
that the named `tip_option` does not describe — **4.1's false positive through a side door, for the
second time in this sitting** (the first was 5.3b(ii)'s rejected read-through pre-fill). And a
spacer nobody has recorded is a **fit report** — prose a curator promotes into `part_needed` — not
a checkbox. Rule 1's neighbour: **2.2 already ruled that a functional swap is a different
configuration**, not an annotation on the same one.

**Knock-ons**

1. **No `tip_variant`, and no `tip` in `part.kind`.** R-F found neither warranted; the second
   would have put one SKU in two tables, which is the defect **S1's merge** was ratified to remove.
   **Tenth axis-mix, avoided.**
2. **No nickname.** The parts list closes the gap that had just made it structural. It stays *one
   nullable column away* — and it is now a **UI-pass question** (does the collection need a
   user-supplied label?), not a schema one.
3. **No `quantity`, no `fitted_at`, no note on the link.** ERD rule 2.
4. **20 entities · 37 edges.** All five `.eraser` files updated in the same sitting; the collection
   view gained `part_fitted` and `part`. `validate-eraser.py` → **exit 0**.

### 5.5 — **ANSWERED (a): a FIELD, not a log — and the layer got re-centred**  🔴  *(BVG, 2026-08-14)*

> BVG: *"We aren't building field-log anymore — we are just recording things owned, so the actual
> refill is trivial at this point. It's more about the actual pen and parts. Refill, and later
> specific ink in a fountain pen, is important but it's not the core of the system."*

**The argument for the log came from a product that no longer exists.** *"Log from day one —
consumption history is a feature"* was **field-log's own premise**: a carry logger built over
generic `log_entries`. Inherited, never re-earned. Two things kill it independently:

- **The log's one durable use is already covered.** Its real value is not *"you've gone through six
  EnerGels"* — it is **knowing what was loaded when someone said it fits**, and `fit_report`
  already names the refill and the tip option itself and is **append-only by 4.1**. The history
  that matters is written where it is checkable.
- **4.4's line puts the collection on the mutable side.** `fit_check` is mutable curated state,
  `fit_report` is the append-only record. A pen you own is state you **edit** — swap the refill and
  the row updates. That is what `updated_at` is for.

**Cheap later, which is why it is not now:** a log arrives as an **append-only child table**, at
which point `installed_refill_id` becomes *"the newest row"* — a clean **twelfth demotion**, no
backfill, nothing to unpick.

**🔑 THE RE-CENTRING IS THE BIGGER HALF OF THIS ANSWER.** The collection layer is **pen + parts
first, refill second**. It lands the right way round: **5.4's `part_fitted` is the load-bearing
addition to this layer**, and the two refill columns are the periphery. Recorded because it should
govern how the collection UI is built, not just what the schema holds.

**⚠️ AND IT PUTS ONE THING UNDER MILD TENSION, FLAGGED NOT SILENTLY RECORDED.** 5.3a made the saved
pen the **`fit_report` entry point** — *"pick your setup, tell us if it fits"* — and that depends on
a saved pen naming a refill. If owners treat the refill as an afterthought, the entry point yields
little. **It survives, for two reasons that were decided before the tension appeared:**
`installed_refill_id` **arrives pre-filled** from `ships_with_refill_id` (5.3b(ii)), so even an
indifferent owner has a plausible refill on the row; and **`fit_report` carries its own
`refill_id`** (4.1) rather than reading the collection's, so the report is a fresh statement, not a
snapshot of a field nobody maintained. The collection **seeds** the form; it does not **speak for**
the owner.

**⚠️ SCOPE SIGNAL — "later, specific ink in a fountain pen." NOTED, NOT BUILT.** Fountain pens are
**out** (Sitting 3: the boundary is *"is there a seated cartridge"*, not the writing medium). And
when they arrive, **ink is the same class of thing as graphite lead**, which **5.2 already ruled**:
a consumable **one level below** the seated part, *not in this model at all*. So *"which ink is in
my fountain pen"* is a **new entity in a later scope**, never a `refill` row and never a
`refill_variant`. The precedent is set; nothing is owed today.

**Knock-on: the `open_5_carry_log` shell is RETIRED** from all three files that carried it — the
same treatment the ratification-sweep shell got on 2026-08-13. **Zero shells remain in the model**,
and all six ERD sources now agree at **20 entities / 37 edges**.

### 5.6a — **THE COMPLETENESS GATE: the catalog gates the collection, and a submission is how you get in**  🔴  *(BVG, 2026-08-14)*

> BVG: *"We won't even offer items that aren't complete in the database to be added to your personal
> collection. Users can submit a form (outside of this scope) to request new ones be added and share
> their info so we can approve and seed the database — or amend the submission — for the public, and
> let users customize from there."*

**🔑 THE GATE IS ALREADY ENFORCED, AND IT COSTS NOTHING TO ADD — it is the FK set.** *"Complete
enough to own"* needs no `published` flag, no `status` enum and no new column, because
`collection_item` already **requires** `product_variant_id` and `tip_option_id`, and
`tip_option.refill_style_id` is **itself required** (4.5). Read forward, that chain says:

> A pen can be owned only when it has a **maker**, a **product**, at least one **finish**, at least
> one **pen tip**, and that pen tip **declares a refill style**.

Which is precisely the catalog-readiness bar **4.5 already set** when it made `refill_style` gate
the catalog and promoted **measurement round 1** to a launch dependency. BVG's rule and 4.5's
seeding order are **the same rule seen from opposite ends**. ERD rule 2 holds: nothing invented.

**AND THERE IS NO DRAFT STATE TO ADD, EITHER.** Under 4.5 the scraper **stages** in `tmp_*` and a
human **promotes**; a row existing in a curated table **is** the promotion. So *"complete in the
database"* and *"present in the curated schema"* are already the same condition.

**THE SUBMISSION PATH IS `fit_report`'S PATTERN, ONE CORPUS OVER.** *Submit → staff approve or
amend → it becomes public → users customize from there* is exactly **4.1**'s shape
(`review_state` = `pending | approved | rejected`, rejected rows **kept**), applied to the
**catalog** corpus instead of the **fit** corpus. **Out of scope by BVG's own words and NOT
modelled** — but the precedent is set, so whoever builds it should reuse the shape rather than
invent a second one. Same standing as 4.5's *"broad and cheap ≠ unattended"*.

**Knock-ons**

1. **`part_fitted` is gated too.** A bronze clip nobody has catalogued cannot be recorded on your
   pen. Consistent, and it means the parts catalog carries collection weight it did not before.
2. **The collection can never be a growth engine, deliberately.** Users cannot add arbitrary pens
   to make the site look bigger. That is **4.1b's "accuracy, not widespread adoption"** applied to
   the catalog, and it is a quality choice with a real cost — see 5.8.
3. **It disposes of 5.6's one objection.** A lookup that cannot find your pen no longer dead-ends;
   it **routes to the submission**, and the submission **carries seed data**. The failure mode
   becomes an acquisition path. ⚠️ **But it makes launch coverage load-bearing for the front door**
   — which is **5.8**, and **R-B** is the research that answers it.
4. **"Customize from there" is already built** — 5.3b(ii)'s pre-fill (the catalog fills the stock
   config) plus 5.4's `part_fitted` (the owner deviates). Nothing owed.

### 5.6 — **ANSWERED (a): the front door is a LOOKUP — "name your pen, get what fits"**  🔴  *(BVG, 2026-08-14)*

Not a browsable catalog. **F5** says the gap between the maker's chart and reality is the product,
and **4.1b** chose *"accuracy, not widespread adoption"* — a browse page is what every other pen
site already is. The catalog exists and is browsable underneath; **the box is the product.**

**The one objection was killed by 5.6a.** A lookup that cannot find your pen no longer dead-ends —
it **routes to the submission**, which arrives carrying seed data. The failure mode became an
acquisition path.

**🔑 AND THE READ MODEL FOR IT ALREADY EXISTS — this is Sitting 1's addendum, cashed in.** *"The
socket join produces CANDIDATES; assertions produce VERDICTS."* So the day-one answer to *"what
fits my TiBolt"* is, with **zero new machinery**:

| Layer | Source | Available at launch? |
|---|---|---|
| **candidates** — every refill in the pen tip's style | `tip_option.refill_style_id` → `refill.refill_style_id` | ✅ always, it is a join |
| **how far to trust that** | `refill_style.observance` → *"usually reliable"* / *"varies by brand"* | ✅ always |
| **what it ships with** | `tip_option.ships_with_refill_id` (**C4b**) | ✅ where curated |
| **verdicts, positive and negative** | `fit_check` + the 4.4 verdict rule | ⚠️ sparse — **4.5 seeds negatives first** |

**⚠️ Which means the front page's most common day-one answer is 4.5's FOURTH display state, the
PRIOR — and that is now the primary path, not an edge case.** It was designed for exactly this and
it must never render as a negative. Worth restating because the emphasis has moved: at launch the
lookup mostly says *"it takes Parker-style, which is usually reliable — here are those refills"*,
annotated with the handful of hard-won verdicts we have. That is an honest answer nobody else
gives, and it degrades gracefully as the fit corpus fills.

**Knock-ons**

1. **ONE RESOLVER, TWO USES.** The free-text box from 5.3b(ii) (*"copper TiBolt"* → the catalog) is
   the same box. One build.
2. **ONE COMPLETENESS BAR, TWO SURFACES.** A pen needs a `tip_option` declaring a `refill_style`
   before the lookup can answer *or* before it can be owned (5.6a). Same FK chain, same gate.
3. **⚠️ LAUNCH COVERAGE IS NOW LOAD-BEARING FOR THE FRONT PAGE.** A lookup that misses often reads
   as an empty product. That is **5.8**, and **R-B** is the research that answers it.

### 5.7 — **ANSWERED (a): pens + refill PAGES; the faceted refill browse waits**  🔴  *(BVG, 2026-08-14)*

**"Pens only" was already off the table, and 5.6 is what removed it** — the lookup's answer *is* a
list of refills, so refills must exist, be named and render on day one regardless. The residue was
only ever *do refills get pages and a browse of their own.*

**Refill pages earn day one on content already in the schema and published nowhere else:**

- **the REVERSE LOOKUP** — *"what machined pens take this refill?"* — the same joins run backwards,
  a genuine second entry point for someone holding a G2, and JetPens' own two-direction pattern
  (*"Recommended Refills"* on a pen page, *"Compatible Products"* on a refill page, lexicon §2.4);
- **also-sold-as** (**C1**) — *"your Retro 51 refill is a Schmidt P8126"*, labelled *via*;
- **`also_known_as`** and the attributed **measurements** (4.3 / 4.4b).

**What waits: the faceted browse** (colour family, tip size, medium). It reads `refill_variant` —
**the one table nothing else forces anyone to populate**, which is the very argument that saved the
model column in 5.3b(i). **R-A** proved the data is one maker page away *per model*; that is
obtainable, not seeded, and seeding effort is **5.8**. Nothing changes when it lands — **R-C**
already confirmed no new column is implied.

**Knock-on:** `refill_variant` now has **two** consumers waiting on it — the optional exact-refill
on a saved pen (5.3b(i)) and the eventual browse. Neither blocks launch; both reward bulk seeding
of a few high-traffic models first. That is a **curation-order** finding, not a schema one.

---

## Research pass 11 — **R-B**: which makers publish a refill / compat list?  *(2026-08-14)*

The brief said **eight**. It is **more than that**, three of the good ones are makers this corpus
never covered, and one of them publishes better-shaped data than most of the original eight.

### The roster, re-scored

| Maker | Publishes? | Shape of what they publish |
|---|---|---|
| Tactile Turn | ✅ known | per-length lists, **trim amounts in mm**, `**` exceptions — still the best |
| Nottingham Tactical | ✅ known | per-body chart, **OEM vs also-compatible**, with needs |
| BigIDesign | ✅ known | ~800-row public sheet, **SKU-grained** (brand + model + size + colour) |
| Fellhoelter · Karas · Grimsmo · Spoke · Autmog | ✅ known | per-body; Autmog's is **prose, inconsistent listing-to-listing** (R3) |
| **Studio Neat — Mark One** | 🆕 **NOT IN THE CORPUS** | **A dedicated "Mark One Refill Guide": 14 refills across rollerball / gel / ballpoint, plus a trim instruction** (*"Parker refills are ever-so-slightly longer than a Schmidt… slice off that little nub"*) **and a spring caveat.** Shaped almost exactly like our `fit_check` + `trim_reference` + `part_needed`. |
| **Everyman — Grafton** | 🆕 **NOT IN THE CORPUS** | An explicit accept-list (Parker G2, Pilot G2, Fisher **with adapter**, Monteverde, Schmidt EasyFlow 9000, Jetstream, Rite in the Rain) **and a different list for the Mini Twist** — F3′ in the wild again. |
| **Sunderland Machine Works — mk1** | 🆕 **NOT IN THE CORPUS** | *"Any Pilot G2 size refill will work."* A **blanket declared** claim — Magnus-shaped, `evidence = declared`. |
| **Bastion** | ✅ **upgraded** | Two pages: a *Refill Compatibility Guide* and an *Aluminum Pen Refill Guide*. See the correction below. |
| **CW&T** | ✅ **upgraded, and §A had it wrong** | FAQ: Pen Type-A/B fit **all Hi-Tec-C and G-Tec** cartridges, and *"with a small spacer"* **10 more** (Coleto, Frixion, Signo UMR-82). A published list **with a required part**. §A's catch-all row files CW&T under *"mostly Parker or G2, single socket"*; §B had it right (Hi-Tec-C). |
| **Schon DSGN** | ✅ **upgraded** | v2 takes Parker; the originals take **Fisher PR**; anything else needs their **D1 adapter** (JetPens stocks it as its own SKU). |
| Ti2 Design | ⚠️ **thin** | *"Which refill do I have?"* identifies refills **by the part number stamped on them** (SXR-7, UMR-85N, BLS-G2-7) and maps bodies (Regular / Shorty / **Super Shorty = G2 Mini only**) — but it is an **identification** page. No trims, no exclusions. |
| Modern Fuel | ⚠️ **not a list** | Publishes the **89–116 mm window**. That is `accepts_length_*` and the prior, not a fit corpus. |

**So the seedable roster is ~13–15, not 8 — and the deep ones are ~8–10.** Two `style_adapter`
rows fell out for free (**Schon's D1 adapter**, **CW&T's spacer path**), from makers, directed,
which is the hardest kind of row to source.

### 🔑 CORRECTION — **Bastion's cause IS published. This file says it is not.**

Decision **2.5**'s stored-negatives table reads *"Bastion declares Parker, rejects some Parker
refills — **cause never published**."* Bastion publishes it:

> *"Parker has changed the style on some Parker G2 ISO cartridges to have a **wider body that
> continues all the way down to the point**, but Bastion pens require the 'classic' Parker G2 style
> with the **tapered end toward the point**. Wider Parker cartridge versions made **after 2015** may
> not seat properly inside a precision-machined bolt action barrel."*

**Two consequences, and the first one is a win for a decision that was taken on thinner evidence:**

1. ✅ **2.4 SURVIVES ITS HARDEST PUBLISHED CASE.** The cause is a **front-cone contour** — and 2.4
   ruled contour is *not* an axis precisely because *"every corpus failure reduces to a Ø at a
   named location."* This one does too: body Ø near the tip. It stores as a `refill_dimension` with
   a `feature` tag plus a negative `fit_check` carrying the reason. **No new structure**, and the
   negative is now **citable** (4.3), where 2.5 had assumed it never could be.
2. ⚠️ **IT INTRODUCES A TEMPORAL BOUNDARY INSIDE ONE REFILL MODEL** — *"versions made after 2015"*.
   `refill` is a model and has no revision concept, and **ERD rule 2 says do not invent one.**
   **1.3's escape hatch already covers it**: the post-2015 part becomes **its own `refill` row**,
   kept apart until proven identical — same move as `fisher-pr` vs `lamy-m22`. The style-wide fact
   (*"Parker-style now has two front contours"*) belongs in **`refill_style.variance_note`**, which
   is exactly what that column was created for. Flagged for the curator; nothing to build.

### What this does to 5.8

**It splits the launch number in two, the same way 4.5 split the corpus.** *"How many makers"* is
not one dial:

- **CATALOG BREADTH** — how many pens the lookup can *find*. Cheap (scraper stages, human
  promotes), and after **5.6a** it also decides what anyone can *own*.
- **FIT DEPTH** — how many makers have curated `fit_check` rows. Expensive, hand-curated,
  citation-gated, **negatives first**.

⚠️ **AND BREADTH IS GATED BY SOMETHING OTHER THAN EFFORT.** `tip_option.refill_style_id` is
required, so **a pen cannot enter the catalog until its style exists** — and **the RB-space styles
are still deliberately unnamed pending measurement round 1**. So:

| Space | Style ready? | Pens |
|---|---|---|
| **Parker-style** | ✅ named, ISO-specified, **well observed** | Bastion · Schon v2 · Everyman · **Studio Neat** · Grimsmo · Karas (Parker) · NTI Parker Mid-Size · Modern Fuel |
| **Hi-Tec-C · Fisher PR · D1 · Lamy M22** | ✅ named (1.3) | CW&T · Schon originals · Fellhoelter TiNyBolt |
| **~110 mm RB space** | ❌ **fracture line provisional** | Autmog · TT Standard · Fellhoelter G2 · Ti2 · **Sunderland** |

**Launch order is therefore decided by `refill_style` readiness, not by maker popularity** — and
the Parker-space cohort is both unblocked *and* where the newly-found publishers cluster.

**Sources:** [Studio Neat — Mark One Refill Guide](https://www.studioneat.com/blogs/main/mark-one-refill-guide) ·
[Bastion — Refill Compatibility Guide](https://bastionboltactionpen.com/blogs/news/bolt-action-pen-refill-compatibility-guide) ·
[CW&T — FAQ](https://cwandt.com/pages/faq) ·
[Schon DSGN — FAQ](https://www.schondsgn.com/pages/faq) ·
[JetPens — Schon DSGN D1 Adapter](https://www.jetpens.com/Schon-DSGN-Pen-D1-Adapter/pd/24406) ·
[Everyman — Grafton](https://everyman.co/collections/grafton) ·
[Ti2 — Which refill do I have?](https://ti2design.com/pages/what-refill-do-i-have) ·
[Pen Addict — Sunderland mk1](https://www.penaddict.com/blog/2020/9/2/sunderland-machine-works-mk1-review)

### 5.8 — **DEFERRED, and deliberately: it is not a schema question**  *(BVG, 2026-08-14)*

> BVG: *"Let's not worry about what we ship now. We are going to do a deep dive into the holes we
> have and build a whole document to track the work later. This whole process is just to flush out
> the database and tables and how everything connects together."*

**Correct, and it should have been caught earlier.** 5.6 and 5.7 both earned their place because
each changed a **read model** — 5.6 settled what the front door queries (candidates from the style
join, annotated by verdicts) and 5.7 settled which entities need public pages. **5.8 changes no
table, no column and no join.** It is a curation-effort question wearing a sequencing hat.

**Its input is preserved:** **R-B** (research pass 11) re-scored the publisher roster from 8 to
**~13–15**, found **three makers this corpus never covered**, and established that **launch order
is set by `refill_style` readiness, not maker popularity** — with the gate landing **per pen tip**,
so most makers ship partially. That is the raw material for the launch plan whenever it is picked
up. Nothing is lost by not answering it here.

**Knock-on: `.notes/open-items.md` — NEW, the tracking document.** Every hole in the model in one
place: corrections owed to our own notes, unverified claims, the nine things deliberately not built
and the trigger that would build each, BVG's measurement queue, naming still open, curation and
seeding work, and implementation notes. It **duplicates no reasoning** — it indexes unfinished
work and cites this file for the rest.

---

## ✅ SITTING 5 IS COMPLETE — and with it the data-model interview

**Sittings 0–5, the ratification sweep and carried items C1–C4b are all closed.
20 entities · 37 edges · zero shells · zero soft decisions.**

| | Answered |
|---|---|
| **5.1** | five browse facets survive, at two grains |
| **5.2** | `refill` is a **model**; `refill_variant` holds tip size + colour; `colour` split in two |
| **5.3a** | a saved config is **a pen you own** |
| **5.3b(i)** | **(c)** the model **and** the exact one, as a constrained pair |
| **5.3b(ii)** | **(a)** nothing more, **and less entry** — the catalog pre-fills, written at save time |
| **5.4** | **separate rows always**, plus **`part_fitted`** |
| **5.5** | a **field**, not a log — and the layer is **pen + parts first** |
| **5.6a** | the **completeness gate** — you cannot own what the catalog does not fully have |
| **5.6** | **(a)** the front door is a **lookup** |
| **5.7** | **(a)** pens + refill **pages**; the faceted browse waits |
| **5.8** | **deferred** — not a schema question. → `.notes/open-items.md` |

**What Sitting 5 added to the schema:** `refill_variant`, `refill_variant.colour_family`'s
`blue_black`, `collection_item.installed_refill_variant_id`, `part_fitted`, and one rename
(`variant_id` → `product_variant_id`). **Everything else was answered by deleting a question.**

---

## ✅ THE COLLECTION LAYER IS COMPLETE — 5.3a · 5.3b(i) · 5.3b(ii) · 5.4 · 5.5 · 5.6a

Five questions, **two** new things: `installed_refill_variant_id` and `part_fitted`. Everything
else was answered by **deleting a question** — no nickname, no note, no quantity, no log, no
inventory columns, no `tip_variant`. Remaining in Sitting 5: **5.6** sequencing · **5.7** catalog
scope · **5.8** launch size, the last of which still needs **R-B**.

---

**Sitting 4 has no residual OPENs.** Schema delta for the day: **+2 entities** (`rebrand`,
`material`), **+1 enum value** (`retailer`), **1 column moved** (`ships_with_refill_id`),
**1 column retyped** (`material` → `material_id`). 18 entities · 32 edges.

---

## Open

- **✅ SITTING 4 COMPLETE** — 4.1, 4.1b, 4.3, 4.4, 4.4b, 4.5 all answered. **4.2 dissolved.**
- **✅ CLOSED (C4a) — the retailer gap in `claimed_by`.** Answered with a **fifth value,
  `retailer`**. Folding into `maker` overclaims; folding into `community` destroys the only trust
  signal `refill_dimension` has.
- **✅ CLOSED (C4b) — `ships_with_refill_id` MOVED to `tip_option`.** F3′ applied a third time.
- **✅ CLOSED (5.2 + grain) — the refill grain.** `refill` is a **model**; `tip_size` and `colour`
  moved to a new **`refill_variant`**, and `colour` split into `colour_name` (long tail, free text)
  + `colour_family` (coarse enum, drives the filter). Ninth axis-mix. **Also closes C1's
  `OPEN 5.2`** — a rebrand is model → model, and the grain is no longer fuzzy.
- **✅ CLOSED (5.3b(i)) — the model or the exact one? BOTH, answer (c).** `installed_refill_id`
  (model, every read path) + `installed_refill_variant_id` (exact, optional), constrained by a
  two-column FK plus a CHECK so they cannot disagree. **R-A killed the cold-start case** for
  model-only; nothing forcing `refill_variant` to be populated killed exact-only. Knock-on rename:
  `variant_id` → **`product_variant_id`** (trap 3, twice now inside our own schema).
- **✅ CLOSED (5.3b(ii)) — the collection residue: NOTHING MORE, AND LESS ENTRY.** No nickname, no
  note, **no new columns**. The four FKs **pre-fill from the stock config** and are **written at
  save time**, not resolved on read — so a curator's catalog edit can never rewrite a pen someone
  owns. Pre-fill rule: *fill what the catalog makes unambiguous, ask only where it branches.*
  **NEW DEPENDENCY:** the free-text resolver (*"copper TiBolt"* → `product_variant`) makes
  **variant seeding**, not just product seeding, a launch requirement — carry into **5.7**.
- **✅ CLOSED (C1) — rebranded refills.** A `rebrand` table with the 4.3 attribution shape.
- **✅ CLOSED (C2) — lookup tables vs TS enums.** Curated vocabularies stay `as const`;
  `product_variant.material` becomes an FK to the committed `materials` table.
- **✅ CLOSED (C3) — the two committed-schema collisions.** Both were misreadings; the scraper
  tables are inputs, are not corrected, and are not used by v2.
- **⚠️ PROMOTED BY 4.5 — measurement round 1 is a LAUNCH DEPENDENCY.** `tip_option.refill_style_id`
  is required, so no pen enters the catalog until its style exists — and the RB-space styles are
  still deliberately unnamed pending those measurements.
- **✅ RATIFICATION SWEEP COMPLETE (2026-08-13)** — S1 the `slot_option` → `part` merge · S2
  3.2b's tip-option override · S3 4.3's `source` split. All three confirmed as applied; no
  schema changed. **Zero soft decisions remain.**
- **Still on the table, carried from the Sitting 4 prompt:** **rebranded refills**
  (lexicon §2.7, C1) · **lookup tables vs TS enums** (lexicon §5.4, C2) · the two
  **committed-schema collisions** (lexicon §5.3, C3).
- **Still unanswered, factual, blocks nothing:** does the Modern Fuel aBAP need the spring/tip
  swap for a Parker? · is Autmog's 36 Clipless a different body or the same body without a
  clip? · Charpie cartridge · BigIDesign's pencil mechanism · Autmog's 2.5 mm · measurement
  round 1.
- **⚠️ FACTUAL, unanswered — does the Modern Fuel aBAP need the spring/tip swap for a Parker?**
  98 mm sits inside its published 89–116 window, and BVG's phrasing implies the swap is needed
  anyway. If so it is the clean real-world case for **negatives-only** that the withdrawn
  EnerGel example failed to be. BVG has the pen.
- **⚠️ `toggle` appears in BOTH 3.3's slot list and 3.5's action list.** If TT sells a toggle
  that *converts* a pen's actuation, then `product.action` has the same defect `socket_id` had
  under **F3′** — it would live on the part, not the product. **Unconfirmed**; check before 3.5.
- **Charpie cartridge — UNCONFIRMED.** Retailers say the Mark 22 ships with 3D-printed tools to
  gut a Sharpie; Fellhoelter's own page says only *"tools for assembly and disassembly."*
  Confirm before relying on `refill.form = harvested`. Chrome or a direct ask to Fellhoelter.
- **BigIDesign Bolt Action Pencil mechanism — UNCONFIRMED.** Copy says *"0.5, 0.7 and 0.9 mm
  mechanical pencil **systems**"* (Schmidt's own word) but never names Schmidt.
- **Autmog 2.5 mm** — **promoted: now a dependency, not a curiosity.** 2.7's geometry-negatives
  rule can't fire on Autmog until we know whether the number is the tip aperture or the body bore.
- **Rear-topology values** — `open` / `plugged` / `finned` is a first draft. Needs firming from
  actual refills before 2.4's axis can be seeded.
- **Trim-length display** — captured always; whether it surfaces to the consumer is deferred to
  the UI pass. *(BVG, Sitting 2)*
- **✅ Sitting 2 COMPLETE** — 2.1 through 2.7 all answered. Next: **Sitting 3** (product identity
  & slots), where **3.6 arrives pre-answered** by 2.5.
- **F4 needs rewriting** — the only Sitting 0 finding that didn't survive.
- **Measurement round 1** (Juice Up + Precise V5 RT, then EnerGel/Signo/Sarasa) — now the
  highest-value item; it places the provisional fracture line.
- **`schmidt-888`** — same cluster as 8120 (6.81) or its own?
- **Naming the RB-space sockets** — **deliberately deferred.** Rule 3 may make it three
  clusters, and one boundary is provisional; naming clusters whose edges move is wasted work.
  Aliases already settled (model-level, never brand-level).
- **Autmog 2.5 mm** — establish what it measures.
- ~~G1~~ resolved: skip (≈ A2, obsolete). ~~Lamy M22 vs Fisher PR~~ resolved: separate.
  ~~Socket shape~~ resolved: flat, disjoint, many-to-many. ~~`pilot-g2` scope~~ resolved by
  the observance rule.

### Accumulated leans into Sittings 2–5 (not yet asked)

| # | Lean | From |
|---|---|---|
| ~~2.2~~ | ~~five values plus a radial one plus a socket-conversion one~~ — **SUPERSEDED, answered: three values** (`tip kit` · `trim` · `spacer`). Radial moved to 2.6. | pass 2 → Sitting 2 |
| ~~2.3~~ | **ANSWERED** — amount + reference, both nullable; `from_which_end` dropped as a constant | pass 3 → Sitting 2 |
| ~~2.4~~ | ~~multi-axis, front and rear~~ — **ANSWERED, and pass 3 was wrong**: exactly **one** axis (rear topology). Those sources list what *varies*, not what needs modelling apart from measurement. | pass 3 → Sitting 2 |
| ~~2.5~~ | **ANSWERED (a′)** — scoped negatives, most specific wins. Settles **3.6** too. | Sitting 1 addendum → Sitting 2 |
| 2.6 | **STRENGTHENED** — radial slop was re-filed here out of `needs`, so `loose` is now the only home for it. Not cosmetic. | pass 2 → Sitting 2 |
| ~~2.7~~ | **ANSWERED (b′)** — add `bore_mm`, but *negatives only*. ~~"defines socket boundaries"~~ was a pen-side/refill-side conflation. | pass 1 → Sitting 2 |
| ~~4.2~~ | **DISSOLVED** by 2.1 — source belongs to the *part row*; the edge carries only `sourcing` (in-the-box vs buy) | pass 2 → Sitting 2 |
| ~~4.4~~ | **ANSWERED (d)** — verdict is DERIVED (#9); `disputed_note` is the staff override. And pass 3 was *half* wrong: the Unsharpen/Sarasa case is a claim-vs-**measurement** conflict, not two claims → split out as **4.4b**. | pass 3 → Sitting 4 |
| ~~4.4b~~ | **ANSWERED (c)** — no `disputed_note` here; `claimed_by` added (4.3's enum, reused whole) and **guard 3 on Rule 3**: a geometry negative fires only on an unconflicted `feature` or a `staff` row. Displayed measurement = **demotion #10**; a bad number is deleted, not annotated. | 4.4 → Sitting 4 |
| ~~4.5~~ | **ANSWERED (c)** — and the lean was answering the wrong question. ~~(a) importable structured data exists~~ is true but irrelevant: the fork is **two corpora**, catalog broad vs fit checks narrow, seeded **negatives-first**. Zero fit rows renders the **prior**, not "empty" (4th display state); coverage is **demotion #11**; `ships_with_refill_id` is a worklist, not a free positive. | pass 3 → Sitting 4 |
| R4 | **CORRECTED** — the `feature`-per-measurement requirement stands, but **not JSONB**: the repo reserves `jsonb` for `scraper.ts` and keeps curated data relational. → a **relational dimensions table** with `feature`, `value`, `unit`, `source`. *(`source` since split by 4.3 into `citation_url`/`citation_note`, and joined by `claimed_by` in 4.4b.)* | pass 3 → Sitting 2 |
