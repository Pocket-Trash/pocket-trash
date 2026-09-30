# Pens, tips and refills

A proposal, not shipped. Twelve new tables that extend the catalog already in
`packages/database/src/schema/collection.ts` — same patterns, no changes to what exists.

The ERD is [`pen-refills.eraser`](./pen-refills.eraser); paste it into Eraser to read it.

## The question this answers

Someone holding a pen wants to know one thing: **will this refill work in it?**

Today nobody answers it well. Maker charts are partial and sometimes wrong, shops have no
reason to tell you something *doesn't* fit, and the rest is scattered across forum posts.

They should see one of four answers, in plain words:

| What they see | Where it comes from |
|---|---|
| **Fits** | the tip and the refill share a refill style |
| **Usually fits — worth checking** | same, but that style is marked `varies` |
| **Fits if you trim it**, and by how much | a fit row with `needs_trim` and a `trim_note` |
| **Doesn't fit** — *and why* | a fit row with `fits = false` and a reason |

No scores, no percentages, no confidence ratings. If we know, we say so; if a person tested
it rather than a maker claiming it, we say that too.

## The tip decides the refill, not the pen

This is the one thing the model has to get right. A pen body doesn't take a refill style — its
**tip** does, and plenty of makers sell more than one tip for the same body. Swap the tip and
the same pen takes a different refill.

It goes further. NTI's mini G2 tip is built for their mini body, and it also fits their
full-size Parker body — where G2 and EnerGel refills work, but need trimming. Same tip, two
bodies, two different answers.

So **the answer belongs to the body-and-tip pairing**, not to the body and not to the tip.
That pairing is `pen_tip_option`, and it is what fit rows point at. It also carries the
refill-length window, because that window is only true of a pairing: the mini body and the
full-size body give the same tip different room.

`native` marks the body a tip was designed for, so we can say "made for the Mini, also fits
this one" rather than presenting every pairing as equal.

## How it fits the shipped catalog

The catalog already types every product through `product_types` and puts per-type details in a
table sharing the product's primary key. Spinners work this way. Pens, tips and refills join as
three more of the same:

```
product_types ──< product ──┬── product_pen        new
                            ├── product_pen_tip    new
                            ├── product_refill     new
                            └── …                  the spinner subtypes, already shipped
```

`product_types` needs two new rows, `pen-tip` and `refill`. Pen, Slider and Fountain Pen are
already seeded in `packages/database/scripts/seed.ts` with no detail table yet — `product_pen`
is the first of those to land.

Tips and refills are products because people buy them, own them and photograph them. Making
them products means they inherit images, privacy, user submission and collection support with
no new work. And a pen with a swappable tip is the same shape as a spinner with a swappable
button, which already shipped — `product_spinner.compatible_button_id` is the precedent.

## The nine tables

**`mechanisms`** — already in the schema, wired only to `tmp_autmog_pens` today. Promoted to the
catalog and seeded `bolt`, `click`, `switch`, with more added as we work through them. A lookup
rather than an enum precisely because that list grows: a new mechanism is a row, not a migration.

**`refill_style`** — a lookup, like `finish`. The physical shape a refill has to be to seat:
Parker-style, Pilot G2, D1. `reliability` is `reliable` or `varies`, which is the difference
between "Fits" and "Usually fits". Slugs stay off brand names where possible, because "G2" is
used in the wild for two different shapes.

**`product_pen`** — the body. Measurements, plus the browse facets the archive already filters
on: `mechanism_id`, `clip_id` and the maker's own `size` designator. Deliberately **no** refill
style.

**`pen_milling`** and **`product_pen_milling`** — the milling on the body, at two grains. See
below.

**`clips`** — a lookup for clip kinds. Clips are `formed` or `milled`, and some pens have none
at all, so `clipless` is a row rather than a null — that way null means "not recorded yet"
instead of being ambiguous.

**`product_pen_tip`** — the tip, carrying `refill_style_id`, the body it was made for, and the
nose shape, which is a trait of the tip rather than of the body.

**`product_refill`** — the refill, carrying `refill_style_id`, an `ink_type` and its own
measurements.

**`pen_tip_option`** — which tips go on which bodies, and the length window for each pairing.

**`pen_refill_fit`** — the exceptions, and nothing else. See below.

**`collection_pen`**, **`collection_pen_tip`**, **`collection_refill`** — what someone owns:
which body-and-tip they're running, spare tips, and what refill is in it.

## Milling needs two grains, not one

Milling is what the archive stages as `body_details`, and it does **not** standardize across
makers. One maker's "grip ring" is another's custom pattern of overlapping rings — the same
words describing genuinely different machining. A single shared vocabulary would quietly
assert those are the same thing, and a filter built on it would return both as one result.

So `pen_milling` carries two things:

- **`name`** — the maker's own word, scoped to that maker. Free text, the full long tail, and
  what actually gets shown on the pen's page.
- **`kind`** — a coarse bucket that *does* hold across makers: `rings`, `lines`, `knurling`,
  `facets`, `flutes`, `smooth`.

**Cross-maker filtering happens on `kind` only, never on `name`.** `kind` is curated rather
than derived, for the same reason ink colour needs a curated bucket: no code turns "overlapping
ring grip" into `rings`. Start the list coarse and let it grow.

`product_pen_milling` is the link, because a pen has several — rings *and* facets.

This also retires the staged `grip` column. Milling and grip are the same fact, so there is one
home for it, not two.

## The rule that keeps this small

**Matching styles already mean it fits. A `pen_refill_fit` row only exists to say otherwise.**

So the table stays small on purpose. "EnerGel works in every G2 pen except the Ti2 TechLiner"
is one row, not fifty. A pairing with no rows is not unknown — it shows its style's answer,
which at launch is what most pens will show.

One consequence worth stating: if a refill turns out not to fit any tip of its own style, that
is a wrong style assignment, not fifty exception rows. Fix the style.

## What this leaves out

Named, so an absence reads as a decision rather than an oversight.

| Left out | Why |
|---|---|
| **Fountain pens** | A whole separate category. They take cartridges and converters, not refills, so `refill_style` doesn't describe them. Out of scope — they get their own subtype if and when |
| **Price** | Not needed. `tmp_autmog_pens` stages `price_min_cents` and `price_max_cents` if that changes |
| **What ships in the box** | Not worth a record |
| A variant layer for pens | `finish_option`, `product_material` and `collection_item.material_id` already shipped |
| A pen-size grouping | A tip that fits several bodies gets a row per body. Revisit if that duplication grows |
| Separate refill colours | Colour never affects fit. One row per refill model for now |
| Per-measurement sourcing | Measurements explain a failure, they don't decide one. A bad number gets fixed, not annotated |
| Adapters | A part that makes a style-A refill seat in a style-B tip. Real, and deferred |
| "Also sold as" | Schmidt supplies several brands under their own names. Real, and deferred |
| Style aliases | "Parker", "Euro", "DIN" all name one shape. Cheap, and worth adding early for search |
| Owner fit reports | Follow the admin review pattern from the notification centre rather than invent a second one |

The first three are left out because the catalog already answers them or because they can't
affect fit. The rest are deferred, and the ones most worth arguing about are adapters, "also
sold as" and aliases.

## Open questions

- `ink_type` as a text column with a check constraint, or a lookup table? Lookup only if the
  list grows at runtime, which it probably doesn't.
- Whether `pen_milling.kind` is worth being a lookup table rather than a checked text column.
  A lookup makes growing the bucket a row instead of a migration, at the cost of one more table.
- Whether the coarse `kind` list above is the right starting six.
- Whether `pen_tip_option` needs a per-pairing bore, or whether the tip's own bore is enough.
- Whether `refill_style.reliability` earns two values or wants a third.
