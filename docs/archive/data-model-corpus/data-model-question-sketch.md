# Question sketch — pen/refill data model

> **Superseded 2026-08-10.** The research pass ran; findings are in
> `.notes/data-model-research-findings.md` and the tight question set is in
> `.notes/data-model-questions.md`. Kept for provenance — it records what we thought to
> ask *before* the facts came back, and several of its assumptions turned out wrong
> (notably: three archetypes don't cover the field, and fit isn't two axes).

**Status: rough scaffold, not the question set.** Purpose is to feed a deep-research
pass; research gathers the facts, then these get rewritten into a tight, answerable set.

Companion to `.notes/data-model-refills-and-products.md`. Local scratch, git-excluded.

Drafted: 2026-08-10.

---

## The governing rule

**Don't ask BVG anything research can look up.** Maker specs, socket dimensions, model
rosters, which refills exist — all findable. Burn the question budget on the things
only a collector knows:

- **tacit fit knowledge** — what actually works in hand vs what the maker claims
- **judgment calls** — where to draw a line the data doesn't draw for us
- **priorities** — what matters enough to build first

Every section below is split accordingly: what **research** should bring back, and what
**only BVG** can answer once it has.

---

## A. Maker roster & archetype placement

Feeds: whether the three-archetype model actually covers the field, or needs a fourth.

- Research: enumerate machined-pen makers in scope. For each — do they publish refill
  compatibility, do they offer tip options, do they ship spacers/adjusters?
- BVG: does every maker land cleanly in hyper-specific / semi-general / universal, or
  are there pens that don't fit any of the three?
- BVG: which makers matter enough to model correctly at launch vs "get to eventually"?
- BVG: any maker where the *body* is the swappable part rather than the tip?

## B. Sockets — is the seed list right?

Feeds: `refill_standard` rows. We seeded 5 (parker-style, pilot-g2, pilot-g2-mini,
energel, d1).

- Research: what other formats have pens *built around* them — Schmidt 888? Fisher
  Space Pen (PR)? Uni Jetstream? Zebra F? Hi-Tec-C / Juice? Rollerball formats?
- Research: nominal dimensions per format, and how much real spread exists within each.
- BVG: which of those earn a socket (pens designed for it) vs stay a refill mapped to a
  nearest socket? This is the rule we set — sockets are defined by pens.
- BVG: is `pilot-g2-mini` a distinct socket or a length variant of `pilot-g2`?
- BVG: how bad is Parker's variance in practice — enough to need per-refill tolerancing
  on non-Autmog pens too, or is Autmog the only maker that cares?

## C. Tips & bore

Feeds: tip slot options, `bore_class`, what the compat edge hangs off.

- Research: for FH, NTI, and other tip-swapping makers — what tips are actually sold,
  what does each accept, are they sold separately or only with a pen?
- BVG: is `precision / standard / wide` the right three-way split, or does bore need
  more resolution?
- BVG: on universal pens, is a single wide bore genuinely "takes everything," or are
  there refills it still rejects?
- BVG: can a tip from maker X go on a body from maker Y? (If yes, tips are a
  cross-maker catalog, not a per-product slot — that's a real schema change.)
- BVG: does nose *shape* (round / conical / step) ever affect fit, or is it purely
  cosmetic and separable from bore?

## D. Length adjustment

Feeds: `length_adjustment` on the body, `needs` on the compat edge.

- Research: which makers ship spacers, internal screws, or screw-on extenders (Spoke
  named already). Maker-supplied or aftermarket? Included or sold separately?
- BVG: is `none | spacer | internal_screw | extender` the complete vocabulary?
- BVG: is an adjustment range meaningful (a screw covering a span) or is it discrete
  (this spacer, that spacer)? Determines a number vs a lookup.
- BVG: are spacers cross-compatible between makers, or strictly in-house?
- BVG: does adjustment ever affect anything a buyer cares about besides fit — balance,
  weight, rattle?

## E. Fit grades — do they survive contact with reality?

Feeds: the graded output (`designed_for / native / maker_part / trim / loose`), which is
the site's headline feature.

- BVG: are five grades the right granularity, or would owners collapse some?
- BVG: is **trimming** mainstream for FH/NTI owners or a niche hack? Changes whether it
  ships at launch or hides behind a toggle.
- BVG: is **wiggle** a dealbreaker or a shrug? If collectors won't accept it, `loose`
  may need to read as a warning rather than a pass.
- BVG: are there fit failures the two axes don't explain — refills that pass bore and
  length but still don't work (mech clearance, spring, knock geometry)?
- BVG: is there a "fits but you shouldn't" case worth a separate grade (damages the
  pen, voids something)?

## F. Product identity per maker

Feeds: the "Product = the body" rule. Verified for Autmog only; that's the weakest part
of the model right now.

- Research: for 5–6 makers beyond Autmog — how do they name and list models? Does one
  milling ship in multiple body sizes? Named sizes or measurements?
- BVG: does "size is identity, milling is a slot" hold outside Autmog? Where does it
  break?
- BVG: is **clipless** an action sub-type or a clip slot with a `none` value?
  (Carried over unanswered from the model doc — Autmog's naming argues one way, physical
  reality the other.)
- BVG: complete action vocabulary — click, bolt, twist, capped, others?
- BVG: are limited drops / collabs (Autmog "x KVR Finishing") separate Products, a
  finish slot option, or an edition attribute on a collection item?

## G. Slots & binding time

Feeds: `product_slot.binding` (configured vs swappable) and the slot vocabulary.

- Research: across makers, what parts are genuinely offered as choices — body, tip, cap,
  bolt, clip, finish, grip, hardware?
- BVG: is the slot list complete, and is any of it cross-category (would a knife or
  flashlight reuse the same slot kinds)?
- BVG: any slot that's *sometimes* swappable — swappable in principle but requires
  tools, or a service the maker performs?
- BVG: do owners actually swap parts between their own pens? (If yes, a collection item
  may need to own parts independently of the pen — bigger change than it looks.)

## H. Refill catalog scope

Feeds: refill Products at tier 2 + options.

- Research: the realistic refill universe per socket — brands, models, tip sizes, ink
  types, colors.
- BVG: which refill attributes are worth filtering on — tip size, ink type, color,
  archival, water resistance, dry time?
- BVG: how deep on color? Is "black / blue / other" enough, or do people care about the
  long tail?
- BVG: are there refills you'd want tracked as *consumed* (usage/replacement), which is
  the thread back to whether carry logging is in scope?

## I. Provenance & curation

Feeds: `source` and `verified` on the compat edge. Matters *because* fit is declared,
not derived.

- Research: what compatibility knowledge already exists publicly — maker charts, forum
  threads, Discord pins, spreadsheets, review videos. Is any of it structured?
- BVG: who's allowed to assert a fit — you only, trusted contributors, anyone?
- BVG: what does `verified` mean concretely — you physically tried it? Two reports?
  Maker confirmed?
- BVG: do unverified community reports show up at all, and if so how are they marked?
- BVG: when the maker says no and owners say yes, which is displayed?

## J. Collection layer

Feeds: `collection_item`. Barely explored — mostly inherited from the v2 doc.

- BVG: what do you personally record about a pen that isn't in the spec — drop number,
  serial, acquisition date/source, condition, what you paid vs current value?
- BVG: do you track which refill is loaded today? Does it change often enough to want
  history?
- BVG: multiples — do you own two of the same pen, and do they need separate rows?
- BVG: what's the one thing your current tracking (spreadsheet, notes, whatever) does
  that we'd better not lose?

## K. Launch scope

Feeds: sequencing, and how much of the above is actually needed for v1.

- BVG: what's the single question the site must answer on day one? ("what refill fits
  my X" vs "what pens exist" vs "what do I own")
- BVG: pens only at launch, or pens + refills as browsable catalogs?
- BVG: how many makers is a credible launch?

---

## Sources for the research pass

Rough starting list — worth expanding before kicking off:

- Maker sites and product copy (already have Autmog + Grimsmo scraped)
- Maker FAQ / compatibility charts, spec sheets
- Refill manufacturer spec sheets (Schmidt, Pentel, Pilot, Uni, OHTO, Fisher)
- ISO 12757 and related format standards
- Collector forums, subreddits, maker Discords — for the tacit fit knowledge
- Existing community compatibility spreadsheets, if any
- Reviewer content where fit and wiggle actually get discussed

---

## Question hygiene (for the rewrite)

Notes to self when turning this into the real set:

- Lead each question with the schema decision it unblocks — makes it obvious why it's
  being asked and lets BVG skip ones that don't matter yet.
- Prefer forced choice with a concrete example over open-ended. "Autmog does X, NTI does
  Y — which is the rule?" beats "how should we handle tips?"
- Flag which are **blocking** (schema can't be drawn without it) vs **shaping** (changes
  quality, not structure). B, C, F, G are mostly blocking. H, I, J, K mostly shaping.
- Batch by section so it's answerable in sittings, not one wall of questions.
- Anything research answers cleanly should be *stated as a finding to confirm*, not
  asked as an open question.
