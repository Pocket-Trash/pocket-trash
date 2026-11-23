# Field Log — Product & Collection Data Model

How we model products and collections. Three parts: what we're building, what's still
open, and who owns what.

## The idea

Two layers that lean on each other.

A **Product** is the model itself. One Inventery X-ray, described once: maker,
mechanism, dimensions, the materials, patterns, and tips it ships in. Shared, so
everyone sees the same X-ray.

A **collection item** is *your* X-ray. It points at the Product, inherits its specs,
and you add what's yours: finish, price paid, the material you chose, your photos.

```
Product — "Inventery X-ray"   (one row, shared)
  maker · mech · length · diameter · weight · materials · patterns · tips
     ├─ your X-ray     → Ti, stonewash, $180, your photos
     ├─ Roy's X-ray    → Zirc, blasted, $240
     └─ ...
```

Why it matters: without the shared layer, 50 people who own the same Q3D each type the
same specs from scratch. Fifty rows that don't line up, so "most-owned pen" is
unanswerable. Describe the model once; each owner records only what's different.

## What we're building

Treat this half as decided.

**Products are the shared spine.** Scrapers seed them from the maker sites. Users can
also submit a Product for a model we never scraped, and it's available to everyone.

**One Product per model, kept loose.** A pen in five finishes is one Product with five
finish options, not five Products. Same for tips and patterns. Split by material only
when it earns its keep. Separate entries per nose type (Parker vs. G2) just make the
catalog unsearchable.

**Most fields optional.** The shape has to cover a Q3D (swappable tip, body, cap,
bolt, clip) and an Autmog Op (tip is part of the body, no choices). The Op leaves
everything blank, so adding one is nearly one tap.

**Fields can be locked.** Flag a Product field as fixed and it drops off the
collection form. An Autmog Op never asks for a tip material, because the model has no
such choice.

**Collection items inherit, then add.** Pick the Product, it carries the core specs,
you add finish, color, price, current value, material, notes, photos. Same data, two
views: a Product view (no owner info, what a stranger browses) and your Collection
view (that plus your details).

**One registry drives categories.** A single config file defines every category and
its fields, and drives the forms, validation, and filters. Brownie's app already does
this across ~23 types. Collection fields build on the model's, so a knife Product
carries steel and lock type and you don't retype them.

**Vocabularies are shared lists.** Maker, mechanism, fill type, lock, nib, grind,
material: searchable dropdowns backed by tables, not free text. Add a maker inline if
it's missing. Normalized values (one "Titanium," not forty spellings) are what make
filtering and stats work.

**Payoffs.** Per person: "24 of my 51 fountain pens are medium nib." Site-wide and
anonymized: most-owned maker, average titanium-pen spend, average collection value.
Plus public sharing of an item or a whole collection, and a light admin view over new
Products to catch junk (not an approval gate).

## Data model (proposed shape)

Concrete enough to react to. Roy owns the final schema; this is a starting shape —
relational, on Postgres + Clerk, with a config registry both apps share.

**Shared catalog**

```
products(
  id, slug, category, maker_id → makers, name,
  mechanism_id, length_mm, diameter_mm, weight_g,
  description, source_url,
  submitted_by → users,   -- null = scraped
  status,                 -- pending | published (the admin overview)
  locked_fields,          -- field keys this model fixes (hidden on the add form)
  specs JSONB             -- per-category fields, validated by the registry
)
product_options(product_id, kind, value_id)   -- the materials / patterns / tips it comes in
media(id, product_id, collection_item_id, url, kind, position)   -- stock + user photos
```

**Lookup tables — the shared vocabularies**

```
makers(id, name, slug)
materials(id, name)
lookups(id, kind, value)   -- mechanism, fill_type, lock, nib, grind, driver, ...
```

One row per real value, referenced by id. The inline "add" inserts here.

**Personal layer**

```
collection_items(
  id, user_id → users, product_id → products,   -- product_id null = custom item
  price_paid, current_value, notes, is_public,
  specs JSONB               -- the owner's picks: finish, body/tip material, pattern, own weight
)
collections(id, user_id, name)                   -- work / home / ...
collection_memberships(collection_item_id, collection_id)
```

A collection item layers the owner's picks in `specs` over the product's specs.
Keeping it a JSONB, not fixed columns, is what lets a Q3D carry body, tip, cap, and
bolt materials (plus the owner's own weight) while an Op carries almost nothing. Custom
items skip `product_id` and put the whole spec there. Image files sit in object storage
/ CDN; `media` holds only the URLs. Daily carry, if it's in scope (open #4), adds a
`log_entries(user_id, item_id, type, date)` table.

**The registry — config both apps import**

```ts
type ItemType = {
  type: string            // "pen" | "knife" | "fidget"
  label: string
  fields: {
    key: string
    label: string
    input: "text" | "number" | "picker" | "boolean" | "date"
    lookup?: string       // picker values come from lookups.kind
    unit?: string
  }[]
}
```

One file drives the forms, validation, and filter facets, and lives in a shared
package so pen and knife definitions match on web and mobile.

**One backend for both apps.** `apps/web` and Brownie's app call the same API
(`apps/api` over Postgres) and import that registry. Auth is Clerk, so `user_id` is the
same everywhere; field-log keeps a local cache for offline and syncs against the API.

## UI / screens

Layout is ours to decide and builds on the existing `apps/web` and the design system;
the visual arrangement is wide open. The model implies a handful of screens:

- **Browse, per category** — all pens, all knives, product side, no owner info. The
  current archive grid already covers most of this.
- **Product detail** — images, specs, the options it comes in. Arrangement open — say
  images one side, specs the other, title across the top.
- **Collection detail** — the same page plus the owner's finish, price, photos, notes.
- **Submit a Product** — a form mirroring the Product fields, with repeatable inputs
  (add a material, add another tip) and a per-field "not customizable" checkbox that
  greys the field out and drops it from the add form.
- **Add to collection** — pick a Product, it prefills the shared specs, you fill in
  what's yours.

Two interactions I want to get right:

- **Searchable picker with inline add** — maker, material, etc. are typeahead dropdowns
  with a search box; if the value isn't there, an "add" button creates it on the spot.
- **Photos** (open #3) — product vs. user images, mixed or in separate rows.

All of it has to work on the compact mobile layout too (sheets, bottom toolbar) — see
`mobile-native-experience.md`. Stats and sharing get their own views later.

## What's still open

Real decisions, no defaults yet. Lean noted where I have one.

**1. Which categories launch.** Sort Brownie's ~20 types into launch / later / never.
I'd start narrow.

**2. Custom (non-catalog) items at launch?**
- **Yes** — log gear that isn't in the catalog from day one. Every EDC owner has some.
- **Not yet** — catalog-only, add custom later. Less to build.

  Lean yes, but it's real work.

**3. Photos on a collection item.** When the owner uploads their own:
- Their photos only.
- Theirs plus stock, mixed.
- Both, in separate rows.

  Product view always shows stock; an item with no photo falls back to it. Lean toward
  separate rows.

**4. Daily carry — headline or secondary?** It's the core of Brownie's app, so this
sets how much we build around the carry log up front.

**5. Sub-collections.** Work vs. home carry, etc. Ship at launch or later, and what do
we call it? "Collection" is overloaded.

**6. Fidget granularity.** Slider, spinner, worry stone, haptic coin: separate
categories or one? Depends how differently they're spec'd.

**7. Taxonomy mapping.** Who curates the canonical maker / material / refill lists,
and how scrapers fold raw scraped values into them (one "Titanium," not "Ti /
titanium / TITANIUM"). Mostly Roy's side, but it needs an owner.

## Who owns what

**Roy** — database, lookup tables, admin/stats plumbing, the data layer both apps
call. Storage is his call.

**Brownie and me** — the product/collection design. Our side, concretely:

1. **Enumerate the item types** (start from Brownie's ~20-type list) and sort each into
   launch / later / never — open #1.
2. **Define the fields per type, twice:** the Product template and the Collection item.
   Collection fields build on the model's, so don't repeat the Product's specs. Note
   which fields are free text and which are pickers (dropdowns off a shared list).
3. **Set the flexibility per type** — how many options one Product holds (materials,
   patterns, tips) and which fields lock as "not customizable."
4. **Handle material-dependent attributes** — weight differs Ti vs. Zirc, so decide
   whether a field takes a range or ties to the chosen material.
5. **Settle the open calls that are ours** — photos (#3) and fidget granularity (#6).

## Loose ends (not yet owned)

- **Migrating Brownie's data.** His collections already live in Firebase/SQLite;
  moving them onto Postgres + Clerk is real work with no owner yet.
- **Product edits vs. re-scrapes.** Once users submit and edit Products, decide what
  wins when the scraper re-runs a model or two people edit the same one — ties into the
  admin overview.
- **Share mechanics.** `is_public` is in the schema; still to define how a share works
  (public URL, what a stranger sees).

## Where to start

1. **Pens** end to end on real Autmog data — Product, Collection, inherit step.
2. **Knives** next; different enough (steel, lock, grind) to prove the registry
   generalizes.
3. Everything else as scrapers and field lists come online.
