# Field Log — Data Model & Classification

> **⚠️ ARCHIVED (v1) — superseded by [`data-model-v2.md`](../data-model-v2.md).**
> Kept for reference. v2 re-centers this on Roy's video (Product/Collection framing,
> user-submitted products, a lighter backend). Read v2 for the current direction;
> this file documents the earlier "Catalog / Personal layer" reasoning.

> **Draft for discussion.** A proposed data model to align contributors before we
> build. This is the suggestion and the reasoning behind it — react and adjust.

## The shape in one picture

Field Log is two connected parts:

- **Catalog** — the shared, canonical library of products (pens, knives, fidgets,
  tools, …), populated by scrapers. Everyone sees the same items.
- **Personal layer** — what each user owns, carries, and logs. Private, per-user.

They connect by a stable **item slug**: a user's owned/carried row points at a
catalog item by `slug` (e.g. `pen/autmog-…`). A user can also log items that are
not in the catalog (custom entries).

| | Catalog | Personal layer |
|---|---|---|
| Purpose | Browse / filter products | Own, carry, log, collect |
| Origin | Scrapers | User picks a catalog item, or enters their own |
| Visibility | Public, shared | Private, per-user |
| Identity | One canonical row per product | Per-user rows |

## Suggested storage: Postgres as the source of truth

**Keep everything in Postgres — catalog and personal data in one database — and
generate a static snapshot of the catalog for fast public browsing and offline
use.**

Why:

- **The features are join-heavy.** Collections, daily carry, and stats
  ("most-carried blade steel", "my pens that take a Parker refill") all join user
  data to item data. One database makes these a single query; two stores make them
  an app-level join we maintain by hand.
- **The data is small.** The catalog's structured data is tiny (~0.6 MB of specs
  and text); images live in object storage / CDN, never the database. Cost and
  performance are non-issues.
- **One query layer.** We already run Postgres, Clerk, and a services layer for
  users — catalog tables sit beside them with real foreign keys and filtering.
- **Cheap static delivery is preserved.** A build step exports the public catalog
  to static JSON + a search index, so the public archive stays CDN-fast, SEO-able,
  and works offline (PWA) without touching the DB on anonymous page views.

In short: **Postgres is the source of truth; the static snapshot is a generated
read layer.** (A pure static-JSON catalog is simpler to start but pushes every
user×item join into app code and weakens filtering as the catalog grows — not worth
building the personal features against.)

### Tables

Personal layer:

```
owned_items(id, user_id, catalog_slug NULLABLE, item_type,
            custom_fields JSONB NULLABLE, status, purchase_price, current_value, notes, …)
log_entries(id, user_id, item_id, entry_type, entry_date, notes, condition)
            entry_type ∈ carried | maintenance | note | ink_change | config_change
collections(id, user_id, name, description)
item_collections(item_id, collection_id)
tags(id, user_id, name)   item_tags(item_id, tag_id)
```

Catalog:

```
catalog_items(slug PK, category, brand_id, name, description,
              price_amount, price_currency, release_date, availability,
              specs JSONB, source_url)
brands(id PK, name, slug)
materials(id PK, name)   item_materials(item_slug, material_id)
media(id, item_slug, url, kind, position)     ← images in object storage
```

**Dual-source items:** `owned_items.catalog_slug` points at a catalog item when one
exists; otherwise the user's entry lives in `custom_fields` with the same
`item_type` + specs shape. Real EDC users always have gear outside the catalog.

## Classification: a config-driven type registry

One registry describes every category — a shared **spine** of fields plus a
per-type **specs** block. The registry drives forms, validation, and filter facets
from a single source.

```ts
type ItemType = {
  type: string;            // "pen" | "knife" | "fidget" | ...
  label: string;
  specSections: {
    title: string;
    fields: {
      key: string;
      label: string;
      input: "text" | "number" | "picker" | "boolean" | "date" | "textarea";
      options?: string[];  // picker values → also the filter facet values
      unit?: string;
    }[];
  }[];
};
```

**Shared spine (every item):**

```
slug, category, brand, name, description, images[],
price { amount, currency }, materials[],
dimensions { length, width, thickness, weight },
releaseDate, availability, tags[], sourceUrl
```

**Per-type specs (examples):**

- **pen** — refill type, refill brand, tip size (mm), mechanism (click/twist/capped), clip
- **knife** — blade steel, blade length (mm), blade shape, grind, lock type, bearings, edge type
- **fidget** — fidget type (slider/spinner/…), bearing, magnet count/strength, buttons

Store `specs` as JSONB, validated by a **Zod schema per type** at scrape/build
time, with the handful of filtered facets promoted to indexed columns or a lookup
table (JSONB alone is weak at `WHERE specs.blade_steel = …`). Add a category only
when we have data for it — empty categories cost nothing.

## Carry / log model

- A **day's carry** = `log_entries` rows with `entry_type = 'carried'` sharing an
  `entry_date`; toggle per item per day. No separate "loadout" entity.
- The same table gives per-item history (maintenance, ink changes) and stats
  (most-carried, ink usage).
- **Collections act as a live filter** over the carry log, not just static groups.

## Conventions

- **Routes:** one plural prefix per category → `/pens`, `/knives`, `/fidgets`,
  `/refills`, `/journals`, `/tools`, each mapping to a `category`; plus a
  cross-category `/carry` view.
- **Canonical vocabularies:** brand, material, refill standard, blade steel, etc.
  are shared lookup lists the scrapers map raw values into — the real work of
  multi-brand, independent of storage.

## Prior art in the repo: `apps/field-log`

The `apps/field-log` app (an EDC logger) already demonstrates most of this pattern
and is worth mirroring:

- a config-driven `ITEM_TYPES` registry spanning ~23 categories,
- one `items` table + a JSON `specs` column (it replaced earlier per-type tables),
- a generic `log_entries` table where a carry is `carried` rows sharing a date,
- collections + tags as many-to-many groupings.

It stores data locally (SQLite) and syncs to Firestore. The suggestion above keeps
the same shapes on our Postgres + Clerk stack.

## Shared data layer (web + iOS)

The model above lets `apps/web` and `apps/field-log` share one data layer instead
of reimplementing collections / carry twice. Sharing happens at three levels:

- **Model** — the item-type registry (types + Zod schemas + TS types) lives in a
  shared package both apps import. Same categories, shapes, and validation
  everywhere. Free, and worth doing regardless.
- **Catalog** — Postgres is the source of truth; the generated static snapshot is
  consumed by both (web reads it or the API; iOS bundles / downloads it for offline
  browse). One canonical catalog.
- **Personal data** (collections / carry / log) — both clients read and write the
  same per-user data through one API.

**Recommended direction: converge on a single backend.** Route both apps through
`apps/api` (Hono) over Postgres, and standardize auth on **Clerk** (it has an Expo /
RN SDK). The monorepo already anticipates this — `apps/api` exists and the mobile
env carries `EXPO_PUBLIC_API_BASE_URL`.

For the iOS app this replaces its current local-first Firebase stack: Firebase Auth
→ Clerk, Firestore-sync → sync against `apps/api` / Postgres, while keeping a
**local SQLite cache + sync** so it stays offline-capable. Its screens, UI, and
item registry are unchanged — only the data + auth plumbing moves.

Target layout:

```
packages/registry   → item types + Zod + shared TS types      (both apps)
packages/database   → Drizzle schema (Postgres)               (server only)
packages/services   → data access over Postgres               (used by apps/api)
apps/api  (Hono)    → the shared data layer both clients call
apps/web            → calls apps/api + reads the catalog snapshot
apps/field-log      → calls apps/api + local SQLite cache / sync for offline
```

If the apps instead stay on separate backends, the Model and Catalog levels can
still be shared, but personal data lives in two places and never reconciles.

## Suggested build order

1. Catalog tables + personal tables (spine, owned / log / collections), with the
   static snapshot export.
2. One category — **Pen** — end to end with real (Autmog) data.
3. **Knife** as category #2, to prove the registry generalizes across a
   structurally different category.
4. Remaining categories as scrapers come online.

## Open questions for the team

1. **Daily carry — headline feature or secondary?**
2. **Custom / manual items at launch — yes, or catalog-only?**
3. **Variants** — a pen in 5 finishes as one item or many? Hard to change later.
4. **Catalog scale** — a few curated brands, or every maker? Sets how much search /
   indexing we need.
5. **Taxonomy ownership** — who curates the canonical brand / material / refill
   lists, and how do scrapers map raw values into them?
