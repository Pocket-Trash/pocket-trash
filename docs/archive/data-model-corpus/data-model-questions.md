# Pen/refill data model — the question set

Supersedes `.notes/data-model-question-sketch.md` (the scaffold). Backed by
`.notes/data-model-research-findings.md` — every claim below is sourced there.

Local scratch, git-excluded. Drafted: 2026-08-10.

**Legend** — 🔴 blocking (schema can't be drawn without it) · 🔵 shaping (changes quality,
not structure). Owner in brackets. Each question leads with the decision it unblocks.

**How to answer:** pick a letter, or write the third thing. Five sittings, ~25 min each.
Sitting 0 is 10 minutes of yes/no and unblocks the rest.

---

## Sitting 0 — Findings to confirm  *(not questions — corrections wanted)*

Research settled these. Say "yes" or correct me; don't re-derive.

| # | Finding | Owner |
|---|---|---|
| F1 | **Trimming is mainstream**, not a hack — Tactile Turn publishes an official trim guide, NTI instructs it, EnerGel-needs-trim is documented across 4+ makers. It ships at launch, unhidden. | BVG |
| F2 | **Three archetypes don't cover the field.** Add **clamped** (BigIDesign collet: universal *and* zero wiggle) and **near-standard** (Bastion: declares Parker, rejects some Parker refills). | BVG |
| F3 | **Archetype is per-body, not per-maker.** Tactile Turn's Standard is semi-general; its Mini takes Pilot G2 Mini only. Fellhoelter's Full Size TiBolt is Schmidt-only, the G2 TiBolt is Pilot G2 Mini-only. Same maker, two archetypes. | BVG / Roy |
| F4 | **Parker-style really does span 98–99 mm**, and failures are specific (end fins, tip threads), not fuzzy. Autmog is not the only maker where per-refill tolerancing matters — just the only one publishing the number. | BVG |
| F5 | **No comprehensive crowdsourced pen↔refill database exists.** Closest: BigIDesign's 800-row sheet (one pen), NTI/Tactile Turn charts (one maker), one blog's hack list. The gap is the product. | BVG |
| F6 | **A competitor derives fit from dimensions** — incoherency.co.uk scores matches on length × Ø. It can't know about rear-hole geometry or magnets. Our "declared, not derived" call stands; the moat is the assertion corpus. | BVG / Roy |

---

## Sitting 1 — Sockets  🔴  *(the vocabulary everything else hangs off)*

**1.1 — unblocks: the `refill_standard` seed rows.** [BVG]
What we seeded as `pilot-g2` behaves in every maker chart as the ~110 mm euro/gel-rollerball
socket — Schmidt 888/5888, EnerGel, Signo and Pilot G2 all live in it. Naming it after one
brand rebuilds the exact trap the aliases exist to defuse.
 (a) Rename to `euro-rollerball-110`, Pilot G2 becomes an alias.
 (b) Keep `pilot-g2` — it's what buyers say, the alias list handles the rest.

**1.2 — unblocks: whether `energel` is a socket row or a refill.** [BVG]
Our rule is "a socket earns a row when pens are built around it." EnerGel groups
dimensionally into the 110 mm family. The only pen built *specifically* for it is Autmog's
0.5 mm needle body — which is `toleranced_for` behaviour, not a socket.
 (a) Drop `energel` as a socket; it's a refill in the 110 mm socket, toleranced by Autmog.
 (b) Keep it — enough pens target it that it's a real socket.

**1.3 — unblocks: three new `refill_standard` rows.** [BVG]
These earn a socket under our own rule: **Hi-Tec-C** (CW&T Pen Type-A built around it),
**Fisher Space Pen PR** (Fellhoelter TiNyBolt, KeySmart Tactiv), **Lamy M22** (Fellhoelter
TiNyBolt). Fisher PR and Lamy M22 may be the same socket.
 (a) Add all three, Fisher and M22 separate.
 (b) Add all three, Fisher + M22 merged as one socket with aliases.
 (c) Add Fisher + Hi-Tec-C only; M22 is too niche to model.

**1.4 — unblocks: whether one nominal envelope can hold two sockets.** [BVG]
Japanese refills in the 110 mm family are documented as *not* interchangeable with European
ones despite matching length — tight interior clearance. Same envelope, real boundary.
 (a) Split into two sockets.
 (b) One socket, carry it in `variance_note` and let the compat edges say no.

**1.5 — unblocks: `pilot-g2-mini` as row vs variant.** [BVG]
Carried over unanswered. Evidence for distinct: dedicated Mini *bodies* exist — Tactile Turn
Mini, Fellhoelter's G2 TiBolt — and they take the Mini refill and nothing else.
 (a) Distinct socket — pens are built around it, so it earns a row.
 (b) Length variant of the 110 mm socket.

---

## Sitting 2 — Fit vocabulary & failure modes  🔴  *(the biggest change)*

> **Premise, from BVG (2026-08-10):** exotic workarounds — sanding a collar, plugging a rear
> hole, magnet seating, washers — are out of scope; don't model them. But the *back plastic
> plug* is a confirmed real failure cause: **Juice Up and Pilot Precise don't work in a
> general G2 pen because of it**, despite being the right socket. That's an incompatibility
> within a socket, not a workaround — which is what 2.4 and 2.5 are about. Expect manual
> curation for these.

**2.1 — unblocks: `needs` cardinality.** [BVG / Roy]
NTI's actual instruction for G2-in-Parker: *swap the spring, swap the tip, and trim the
cartridge.* Three needs on one edge. Our `needs` is a single enum.
 (a) `needs` becomes a **set**.
 (b) Single enum, plus a free-text `needs_note` for the compound cases.

**2.2 — unblocks: the `needs` vocabulary.** [BVG]
Exotic techniques cut per the premise above. What's left, all maker-supported and recurring:
**spacer**, **trim**, **adapter** (changes socket, not length), **tip swap**, **spring swap**.
Tip and spring almost always ship together as one kit (NTI, Fellhoelter).
 (a) Those five, and tip+spring collapse to one value — `tip kit`. So four.
 (b) Those five, kept distinct.
 (c) Those five as structured `needs`, plus a free-text `technique` field for the rare stuff
     so it's readable without being a filter facet.

**2.3 — unblocks: whether `trim` carries data.** [BVG]
Real instructions are "trim 1–2 mm", "about 2 mm off the top", "trim to Parker length",
"trim to Hi-Tec-C length" — an amount *and* a reference, from which end.
 (a) `trim` gets amount + from-which-end + optional "trim to match <refill>".
 (b) `trim` stays boolean; the detail lives in the note.

**2.4 — unblocks: whether fit gets a third axis.** 🔴 [BVG / Roy]
The back plastic plug is confirmed real and it's independent of bore Ø and length — Juice Up
and Pilot Precise are correct-socket refills that still fail. Karas Retrakt is the same story
from the pen side (refills with an open rear instead of a plug won't work the click mech), so
it's a *pen mechanism × refill rear-end* interaction, not a one-off.
 (a) Third named axis — **rear/nock geometry** — alongside bore Ø and length. The pen declares
     what rear end its mechanism needs; the refill declares what rear end it has.
 (b) No third axis. It's just a reason attached to a negative compat edge (see 2.5), curated
     per refill.
 (c) No axis and no field — it lives in free-text notes only.

**2.5 — unblocks: whether we store *negative* assertions at all.** 🔴 [BVG / Roy]
"Juice Up is a Pilot G2 refill that does **not** work in a general G2 pen" is knowledge the
socket join actively gets wrong. Today the model only records what fits, so the socket join
would silently say yes.
 (a) Store negative edges — a refill can be excluded from a pen/tip it would otherwise inherit,
     with a reason. Exclusions beat socket inheritance.
 (b) Store the exclusion once on the **refill**, socket-wide ("Juice Up doesn't drop into
     general G2 pens"), and let per-pen overrides re-allow it.
 (c) No negatives — only assert positives, and accept that unlisted ≠ incompatible.

**2.6 — unblocks: whether `loose` reads as pass or warning.** [BVG]
Wiggle is a marketing battleground — BigIDesign leads with "no tip-wiggle", Autmog with 25 µm.
 (a) `loose` is a warning tier, styled distinctly from the passes.
 (b) `loose` is a pass with a note — owners shrug at wiggle.

**2.7 — unblocks: `bore_class` resolution.** [BVG]
`precision / standard / wide` can't distinguish Autmog's 0.001″ tiers, and can't explain Ti2's
9.5 mm body excluding refills a 10.9 mm body takes.
 (a) Keep the 3-way — it's a browse facet, fit comes from the declared edge anyway.
 (b) Add a numeric `bore_mm` alongside it, populated when the maker publishes it.

---

## Sitting 3 — Product identity & slots  🔴

**3.1 — unblocks: whether "Product = the body" survives.** 🔴 [BVG]
Schon DSGN's Machined Pen v2 accepts Pocket Six **fountain pen and rollerball sections** — the
buyer swaps a section and the same body becomes a fountain pen, a rollerball, or a ballpoint.
A slot pick changes the **category**, and category is meant to decide which slots are legal.
NTI's Parker Mid-Size converts to a **mechanical pencil** and back.
 (a) Product = the body; category is derived from the installed section. (Big change.)
 (b) Product = body + section as a unit; a Schon fountain config is a different Product.
 (c) Out of scope — Schon and the pencil kit are edge cases we don't model at launch.

**3.2 — unblocks: where slot options live.** 🔴 [Roy / BVG]
Tactile Turn sells clips, bolts, springs, back pieces and o-rings as "universally
interchangeable across their pen lines." Per-product options duplicate every clip in the catalog.
 (a) Slot options are scoped to the **maker**, products reference them.
 (b) Per-product, accept the duplication.

**3.3 — unblocks: the slot vocabulary.** [BVG]
Our list is tip / body_material / milling / clip / finish. Actually sold as SKUs: **spring**,
**back piece**, **o-ring**, **toggle switch**, **grip/section**, **bolt**, **adapter**,
**conversion kit**.
 (a) Add spring, back piece, bolt, grip/section, toggle. (o-ring = consumable, not a slot.)
 (b) Add only what a buyer *chooses at purchase*; wear parts aren't slots.

**3.4 — unblocks: `clipless` as action sub-type vs clip slot.** [BVG]
Third time asked. Autmog names it into the model ("36 Clipless Click Pen"); Tactile Turn sells
clips as a universal spare part, which argues clip is a slot with a `none` value.
 (a) Clip is a slot; `none` is a valid value. Autmog's naming is a display concern.
 (b) It's an action sub-type — the maker's naming is the identity.

**3.5 — unblocks: the action vocabulary.** [BVG]
Observed: click, bolt, twist, cam (BilletSpin CamPen), side-click, toggle/switch (Tactile Turn),
capped.
 (a) That list, complete.
 (b) That list minus cam/toggle — too rare to be facets.

**3.6 — unblocks: compat-list storage.** 🔴 [Roy]
Tactile Turn publishes one list for Standard and defines Slim as *that list minus the ones
marked `**`*. Flat per-tip-option edges duplicate ~40 rows per body variant.
 (a) Support inheritance + exceptions (a variant points at a base list plus overrides).
 (b) Flat rows; generate the duplicates and accept the write cost.

**3.7 — unblocks: limited drops / collabs.** [BVG]
Autmog "x KVR Finishing".
 (a) A finish slot option.
 (b) A separate Product.
 (c) An edition attribute on the collection item.

---

## Sitting 4 — Provenance & curation  🔵

**4.1 — unblocks: `verified` semantics.** [BVG]
NTI publishes "OEM (recommended)" vs "also compatible" *plus* a disclaimer: "NTI doesn't
guarantee all listed inks match OEM precision." So the maker already ships a confidence tier.
 (a) `verified` = you physically tried it. Maker claims are `source=maker, verified=false`.
 (b) Maker claims count as verified; `verified` means "not an unreviewed community report."

**4.2 — unblocks: whether `source` needs a fourth value.** [BVG]
A **3D-printed community adapter** enables D1 in Tactile Turn Minis — an aftermarket fit part
nobody sells. Source applies to the *part* as well as the assertion.
 (a) Add `aftermarket` as a source, and let a `needs` part have its own source.
 (b) One source field on the edge; the part's origin goes in the note.

**4.3 — unblocks: who can assert.** [BVG]
 (a) You only at launch; contributors later.
 (b) You + a named trusted set from day one.
 (c) Anyone, with unverified reports visibly marked.

**4.4 — unblocks: conflict display.** [BVG]
Bastion declares Parker-style; owners report not all Parker refills fit. The halffull survey
author *corrected* an entry after community feedback.
 (a) Show both, labelled — "maker says X, owners report Y."
 (b) Owner reports win once verified; maker claim is demoted to a footnote.

**4.5 — unblocks: seeding strategy.** 🔵 [BVG / Roy]
Importable structured data exists today: BigIDesign's 800-row sheet, NTI's per-body chart,
Tactile Turn's per-length lists with trim amounts, one blog's per-pen hack list.
 (a) Import all of it as `source=maker/community, verified=false`, verify over time.
 (b) Hand-curate only; a wrong seeded row costs more than an empty one.

---

## Sitting 5 — Refills, collection, launch  🔵

**5.1 — unblocks: refill filter facets.** [BVG]
Available everywhere: brand, model, tip size (0.38/0.5/0.7/1.0), ink colour, ink type
(ballpoint / gel / hybrid / rollerball / **pressurized**). Hybrid is the one that broke the Ti2
magnet case, so ink type is functional, not cosmetic.
 (a) All five are facets.
 (b) All but colour, which is a display-only attribute.

**5.2 — unblocks: colour depth.** [BVG]
 (a) Full long tail — refills ship in 20+ colours and collectors care.
 (b) Black / blue / red / other.

**5.3 — unblocks: `collection_item` columns.** [BVG / Brownie]
What do you record about a pen that isn't in the spec? Rank what must exist at launch:
drop number · serial · acquisition date · acquisition source · price paid · current value ·
condition · notes · photos · installed refill.

**5.4 — unblocks: multiples.** [BVG / Brownie]
Do you own two of the same pen in different configs, and do they need separate rows?
 (a) Yes — separate rows, always.
 (b) Quantity field is enough.

**5.5 — unblocks: whether `refill_change` is a log or a field.** [BVG / Brownie]
 (a) Plain `installed_refill` field now; the log only if daily-carry logging is in scope.
 (b) Log from day one — consumption history is a feature.

**5.6 — unblocks: sequencing.** 🔵 [BVG]
The single question the site must answer on day one:
 (a) "What refill fits my X?"
 (b) "What pens exist?" (browsable catalog)
 (c) "What do I own?" (collection)

**5.7 — unblocks: launch catalog scope.** [BVG]
 (a) Pens only.
 (b) Pens + refills, both browsable.

**5.8 — unblocks: credible launch size.** [BVG]
How many makers? Research covered ~25; the 8 with published compat data are Autmog,
Fellhoelter, NTI, Tactile Turn, Karas, BigIDesign, Grimsmo, Spoke.

---

## Also for Roy (not BVG's call)

- **R1** — `diameter_mm` in the Autmog scrape is unusable (0.36″ pens reading 9.14 → 40.0,
  mixing in length and tip bore). `diameter_in` is clean except two rows reading a tip bore.
- **R2** — the scraper's refill field mixes sockets and brands in one bucket (`Pilot G2` 44 ·
  `ISO G2 (Parker)` 42 · `Pentel EnerGel` 38 · `Schmidt` 8). Needs splitting into socket +
  optional specific refill product.
- **R3** — Autmog's compat/tolerance copy is **inconsistent listing-to-listing** and lives in
  free-text prose, not a field. It has to be extracted, not mapped.
- **R4** — config storage fork (relational slot tables vs JSONB) is still parked by decision.
- **R5** — product edits vs re-scrapes: what wins. Still unowned.

## Owner index

- **BVG** — all of Sitting 0–2, 3.1/3.3/3.4/3.5/3.7, all of 4, all of 5.
- **Roy** — 2.1, 2.4, 2.5, 3.2, 3.6, 4.5, plus R1–R5.
- **Brownie** — 5.3, 5.4, 5.5 (the collection layer is his app's centre of gravity).
