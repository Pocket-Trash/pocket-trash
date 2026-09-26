# Data model working notes — Product / Collection + Refills

Local scratch, deliberately git-excluded (`.git/info/exclude`). Not on GitHub, not
part of PRs, survives pulls/merges/branch-switches. Move it fully outside the repo if
you ever want it further from `git clean`.

Greenfield thinking. We are NOT matching the current scraper/staging tables
(`tmp_products`, etc.) — this is designed from what each maker and category actually
needs. Companion to the tracked `docs/data-model-v2.md`, but that one is not the driver here.

Scope of this pass: **ballpoint pens only.** Fountain pens (ink + fill system) are a
fully separate conversation, not a deferred sub-case of this one.

Last worked: 2026-08-10.

---

## The spine: two shapes per item

Every item lives in two places, so two data shapes:

- **Product** — the model itself, described once, shared by everyone who owns one.
  What a stranger browses. Seeded by scrapers or user submissions.
- **Collection item** — *your* copy. Points at the Product, inherits its specs, and
  adds your build + ownership (finish, price paid, current value, photos, notes).

## Configurability is data, not schema

The Q3D → Autmog spectrum is NOT different tables. A Product declares its
**configurable slots** (the parts a buyer chooses):

- **Q3D** (least restrictive): body, tip, cap, bolt, clip, finish — "pick every part"
- **Tibolt / Billetspin** (middle): some parts + finishing
- **Autmog Op** (most restrictive): zero slots, tip is part of the body, no choices

Restrictiveness = how many slot rows the product has. One schema, every maker; the
difference is row count. The collection item records one pick per slot.

## Product identity = the body  *(resolves the old milling/size fork)*

> **The Product is the body. Everything chosen or swapped onto it is a slot.**

- **Identity** — what can't change without it being a different pen: body dimensions
  (size), and action (click / bolt / twist).
- **Slots** — tip/nose, body material, milling, clip, finish.

**Size is identity, milling is a slot.** They're different kinds of attribute, which
is why the old fork stalled by treating them as the same question. Size is
*dimensional* — it changes length, weight, diameter, it's how makers name models and
how buyers shop. Milling is *cosmetic* — same dimensions, different surface pattern,
so it behaves like material or finish.

Consequence: a maker with 6 sizes gets 6 Product rows. "Show me every Sunburst" is
still one filter, because milling is a slot option rather than a name fragment.

### Grounding — the Autmog scrape (141 pen products)

Every product stem is size-prefixed and **no stem ever spans two sizes**:

```
36 Click Pen · 36 Clipless Click Pen · 37 Click Pen · 38 Click Pen
38 Twist Action · 40 Click Pen · 42/44/45/47 Click Pen · 55 Clipless Twist Pen
```

`size` = hundredths of an inch of body diameter (36 = 0.36″) and matches `diameter_in`
on every clean row. Everything after the size in the title is configuration: material,
refill, nose, clip material, ball material, grip detail. So 141 listings collapse to
~12 bodies. Size isn't a variant axis for this maker — it's the model name.

### Size label vs measurement — store both

Not a fork; it's maker-specific. Autmog uses a raw measurement *as* a name; others use
named sizes (Standard / Mini). Cross-maker comparison is the point of the site, so:

- `size_label` — the maker's own term ("36", "Standard", "Mini"), for identity/display
- `diameter_mm` — canonical numeric, for filtering and comparing across makers

A pen can have **two diameters** — Autmog ships a *"40 Grip - 38 Mechanism"*. Canonical
`diameter_mm` = grip diameter; body diameter optional and separate.

⚠️ **Scraper data quality (for Roy).** `diameter_mm` in the current scrape is unusable
— 0.36″ pens variously read 9.14, 20.0, 22.8, 23.0, 32.3, 33.4, 34.1, 40.0, mixing in
length and tip bore. `diameter_in` is clean except two rows reading `0.101` (a tip
bore). These are descriptive/browse fields only (see "declared, not derived" below),
but they're wrong today.

## Category is the template; sub-types ride inside it

- **Category** (pen / knife / slider / flashlight) defines the descriptive fields for
  that shape and which slot kinds are legal.
- **Sub-types are a field within the category**, not separate categories. **Settled.**
  For ballpoints the live axis is **action** — the Autmog data shows Click / Clipless
  Click / Twist Action / Clipless Twist. As separate categories these fragment "all
  pens" and break the single browse; as a field it's a free filter facet.

---

## Refills

### Match on the socket/format, never the brand

"Parker-style G2" (ISO 12757, ~98mm x 5.8mm) is the dominant machined-pen ballpoint
format; dozens of branded refills conform to it (Schmidt EasyFlow 9000, Monteverde,
Parker Quinkflow…). So model pen -> format and refill -> format, and compatibility is
the join. Never store pen x brand pairs. Add a new brand tomorrow = one row, and it
instantly works with every pen of that format.

### Sockets are defined by pens; refills fold into them

A `refill_standard` (socket) earns a row only when pens are *built around* it.
Everything else is a refill that maps to the nearest socket it natively drops into.
Keeps sockets few and stable; the refill list grows forever without touching the pen side.

Seed sockets (from BVG's list):

```
refill_standard (sockets — few, defined by pens)
  parker-style   aliases: Parker G2, ISO 12757, G2 ballpoint   (ballpoint/hybrid)
  pilot-g2       aliases: G2, G2 gel                            (gel, full length)
  pilot-g2-mini  aliases: G2 mini, G2 short                     (gel, short)
  energel        aliases: Pentel EnerGel, LR7, needle-tip gel   (gel)
  d1             aliases: mini, multipen                        (mini)
```

"Sarasa fits Energel" needs zero new structure — Zebra Sarasa is a refill that maps to
the `energel` socket. One row.

**The socket is nominal, not exact.** Parker-sized refills have real dimensional
spread, which is why a pen can accept `parker-style` generally *and* still be
toleranced for one specific refill product. Sockets carry a `variance_note`.

### The G2 naming trap

Two different "G2"s: **Parker-style G2** (ballpoint format for machined pens) vs
**Pilot G2** (office gel pen, does NOT fit bolt-action pens). Canonical socket names
sidestep it (`parker-style`, `pilot-g2`); the **aliases** carry the messy spellings so
search still resolves "G2" to the right one.

### Compatibility attaches to the TIP, not the pen

This is the correction that makes every maker fit one model. Earlier sketches hung the
compat edge off the product; it belongs one level down.

> **Refill compatibility is a property of the tip/nose slot option, falling back to the
> product only when the product declares no tip options.**

### The three maker archetypes

| | tip bore | body length adjustment | result |
|---|---|---|---|
| **Autmog** — hyper-specific | precision, targeted at one refill *product* | none | one refill, zero wiggle |
| **Fellhoelter / NTI** — semi-general | swappable per socket (mini-G2, Parker) | spacer / trim | socket-flexible |
| **Universal** | wide bore, accepts everything | internal screw / spacer / screw-on extender (Spoke) | everything, with wiggle |

Autmog isn't targeting a socket, it's targeting *one refill* — the product copy reads
`2.3mm for the needle nose`, `0.100"+0.001"`, `2.5mm (0.0984") specifically for the
Pilot G2`, `tolerance of just 25 micron`. Its own scraper output can't tell sockets
from brands: `Pilot G2` 44 · `ISO G2 (Parker)` 42 · `Pentel EnerGel` 38 · `Schmidt` 8
· `Uni-Ball` 3 · `OHTO` 2. **Scraper fix for Roy:** normalize into two fields —
socket, plus optional specific refill product — or Schmidt and Parker keep landing in
the same bucket as if they were alternatives.

### Fit is two axes, solved by two different parts

A socket like `parker-style` is really a **bundle of (bore Ø + length)**, and it stops
being atomic the moment either axis is adjustable:

| axis | question | determined by | adjusted by |
|---|---|---|---|
| **bore Ø** | does the point pass, how much wiggle? | the **tip** | swap the tip, or run a wide bore and accept wiggle |
| **internal length** | does it sit at the right protrusion? | the **body cavity** | spacer, internal screw, screw-on extender, or trim the refill |

Worked example: the NTI G2 body is *longer* than Parker. A Parker refill passes on bore
but fails on length — so you fit the Parker tip and a spacer makes up the difference.
Two problems, two parts.

### Declared, not derived  **(load-bearing)**

We do **not** compute fit. Makers publish external dimensions (length, diameter,
weight) but never internal ID or cavity length, so the inputs simply don't exist.

Worse, external dimensions are actively *misleading* as a fit signal: two makers both
ship a 5.5″ pen where one takes Parker and the other fits an EnerGel, purely because of
how the mech is designed. So the UI must never let a user infer compatibility from
dimensions, and "pens of similar size take similar refills" is not a valid shortcut
anywhere in the product.

Therefore: **external dimensions are descriptive/browse fields only** (filter by
length, weight, diameter), and the two-axis model above survives as *vocabulary on a
declared edge* rather than as arithmetic. We don't calculate "needs a spacer" — we
record it.

### The compat edge

```
tip_option → refill_standard          -- declared: this tip takes this socket
  fit            native | loose        -- loose = wide bore, expect wiggle
  needs          none | spacer | extender | trim
  toleranced_for → refill product?     -- Autmog's "bored for exactly this"
  source         maker | curator | community
  verified       bool
```

Body-level capability, user-visible and explanatory but **not** a computation input:

```
product (pen body)
  length_adjustment    none | spacer | internal_screw | extender
```

**Provenance earns its keep precisely because fit can't be derived** — the assertions
*are* the product. "Parker tip + spacer reaches G2 length on an NTI" is knowledge that
currently exists only in owners' heads, and surfacing it is the reason to build this.

The output is a **graded answer, not a yes/no** — the thing this site can do better
than a forum thread:

```
✅ Perfect — designed for this refill
✅ Drops in
⚙️ Fits with the maker's spacer
✂️ Fits if trimmed to length
〰️ Fits, expect some wiggle
```

Schema supports all five grades now. **Curation depth** — how exhaustively each pair
gets verified — is a separate call that can scale over time.

### Slot binding time — `configured` vs `swappable`

An Autmog tip is chosen at purchase and permanent. An NTI tip changes on a whim. Same
slot, different lifetime — and it changes the site's headline answer:

- **Product view** — "what can this *model* take?" = union of all tip options
- **Collection view** — "what fits **my** pen?" = my tip's socket only if `configured`;
  the union if `swappable`

Without the flag we'd tell an Autmog owner their pen takes Parker because *some* 36
Click Pen does. Wrong answer for their pen.

### A refill IS a Product

BVG will do real entries per refill with manufacturer specs/info — manufacturer + model
+ specs + media, the same spine a pen has. So refills fold into the unified Product
model as **`category = refill`**, not a bespoke table. The socket is the hub, related
from both sides:

```
                    refill_standard  (the socket — small vocab, nominal envelope)
                    parker-style · pilot-g2 · g2-mini · energel · d1
                      ▲                                   ▲
            accepts   │                                   │   fits
         (via a tip)  │                                   │
        product (pen) ┘                                   └ product (refill)
        category = pen                                      category = refill
```

Payoffs:

- **Refill search = product search** filtered to `category = refill`. Same machinery.
- **Refill ownership is free** — "I've got 5 EasyFlow black" is just a collection item.
- **A pen's installed refill points at a refill Product** — no separate concept.
- **Tip size + color reuse the pen pattern** — an EnerGel is *one loose Product with
  tip-size + color options*, not 30 rows. Same "one Product, kept loose" call.
- **Schmidt and Q3D share one brand table** — a brand is any entity that makes things.

**Catalog depth: settled at tier 2 + options.** Formats-only makes compatibility work
but "search for a refill" impossible; per-variant rows explode the catalog. So: real
refill Products, with tip size / ink color / ink type as *options on those rows*.

**Installed refill: a plain field, for now.** `collection_item.installed_refill →
refill product` answers "what's in it right now," which is what the detail page needs.
A `refill_change` log event also gives history and consumption, but only pays off if
daily-carry / maintenance logging is in scope at all — still open in the v2 doc.
Adding the log later doesn't invalidate the field; it just becomes a denormalized
"latest."

---

## Table sketch

Shared vocab: `brand/maker`, `category`, `material`, `finish`, `lookup(kind,value)`,
`refill_standard(+aliases, nominal dims, variance_note)`.

Catalog:

```
product              maker, category, name, size_label, diameter_mm, action/sub_type,
                     length_adjustment, common specs + specs JSONB, status, submitted_by
product_slot         kind (tip | body_material | milling | clip | finish),
                     binding: configured | swappable
product_slot_option  the pickable values; tip options carry bore_class
tip_refill_compat    tip_option → refill_standard, fit, needs, toleranced_for,
                     source, verified
refill_fits_standard refill product → refill_standard
media
```

Personal:

```
collection_item      user, product, price_paid, current_value, condition, notes,
                     is_public, installed_refill → refill product
collection_selection one pick per slot
collection + membership   (sub-collections, optional)
```

---

## Still open

1. **Config storage fork** — relational slot/option tables vs JSONB config blobs.
   Leaning relational for selectable parts (filtering, stats, data-driven forms), JSONB
   for flat descriptive specs. **Parked by decision** — not needed to start; we want
   the basics defined first for a group review of how the pieces fit.
2. **Is "clipless" an action sub-type or a clip slot?** Autmog names it into the model
   ("36 Clipless Click Pen"), but a clip is physically an option elsewhere. Lean: clip
   is a slot with "none" as a valid value, and it does *not* fragment the model.
   Autmog's naming argues the other way. **BVG's call.**
3. **Curation depth + provenance workflow** — who asserts a fit, what "verified" means,
   whether community reports are surfaced before verification.
4. **Product edits vs re-scrapes** — what wins when the scraper re-runs a model a user
   has edited.
5. **Migrating Brownie's data** off Firebase/SQLite. No owner.

## Out of scope (this pass)

- **Fountain pens** — ink + fill system (cartridge/converter/piston), not refills. A
  separate conversation, not a variant of this one.
- **Non-pen categories** — knives, sliders, flashlights. The model is built to
  generalize (category = template, sub-type = field), but pens are the proving ground.

## Where to start

1. **Pens end to end on real Autmog + Grimsmo data** — Product, Collection, inherit.
   Note Autmog is the *least* representative maker (hyper-specific, zero slots); make
   sure a Fellhoelter/NTI-shaped pen is modelled before calling the shape proven.
2. Knives next; different enough (steel, lock, grind) to prove the registry generalizes.
