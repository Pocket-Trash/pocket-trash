# Database Package

`@package/database` owns the Drizzle connection factory, schema definitions, and generated SQL migrations for the Neon Postgres database.

## Folder Structure

```txt
packages/database/
├── drizzle.config.ts
├── eslint.config.mjs
├── package.json
├── tsconfig.json
├── drizzle/
│   ├── 0000_*.sql
│   └── meta/
│       ├── _journal.json
│       └── 0000_snapshot.json
└── src/
    ├── client.ts
    ├── index.ts
    └── schema/
        ├── enums.ts
        ├── index.ts
        ├── relations.ts
        └── table schema files
```

## Schema Files

- Table schema files define Drizzle table objects and inferred row types.
- `src/schema/scraper.ts` defines scraper-owned tables, including `makers`,
  `scraper_runs`, source-specific temporary product tables, `tmp_products`,
  `tmp_product_variations`, `tmp_images`, and version history tables.
- `src/schema/enums.ts` defines TypeScript constants and types for allowed setting values.
- `src/schema/relations.ts` defines Drizzle relationships between tables.
- `src/schema/index.ts` re-exports all schema objects for Drizzle config and package consumers.

## Runtime Connection

App code should not create Drizzle clients directly unless it needs a low-level database operation. Normal app usage should go through `@package/services`.

The database package exports:

```ts
import { createDb } from "@package/database";
import { serverEnv } from "@/env/server";

const db = createDb({
  databaseUrl: serverEnv.DATABASE_URL,
});
```

`DATABASE_URL` is stored in Infisical at `/apps/web` for web and migration commands. The web app keeps its deploy copy in `/apps/web`. The Railway scraper
app keeps its runtime copy in `/apps/scraper`, or receives the equivalent value
through Railway service configuration.

## Migrations

This repo uses a generate and migrate flow.

Generate SQL migrations after changing schema files:

```sh
pnpm db:generate
```

Apply generated migrations:

```sh
pnpm db:migrate
```

`pnpm db:migrate` runs through the Infisical runner so `DATABASE_URL` is loaded
from `/apps/web`. Personal developer overrides such as `DATABASE_URL_RA` are
looked up only from `/local/database`.

Generated migration files are committed under `packages/database/drizzle/`. Schema source of truth remains in `packages/database/src/schema/`.

CI runs:

```sh
pnpm --filter @package/database exec drizzle-kit check --config=drizzle.config.ts
```

This fails inconsistent Drizzle migration history before merge.

## Database Viewer

Run Drizzle Studio, Drizzle Lab Visualizer, and Drizzle View together:

```sh
pnpm db:view
```

The root command delegates to `@package/database`, where the individual viewer
commands live:

| Command | Purpose | Port |
| --- | --- | --- |
| `pnpm --filter @package/database db:studio` | Runs `drizzle-kit studio` from `packages/database` through the Infisical runner. | `4009` |
| `pnpm --filter @package/database db:visualizer` | Runs `drizzle-lab visualizer` against `packages/database/drizzle.config.ts`. | `4010` |
| `pnpm --filter @package/database db:view:shell` | Runs `drizzle-view` with Studio and Visualizer URLs wired in. | `4011` |

`pnpm db:view` starts Studio and Visualizer first, waits for both TCP ports with
`wait-on`, then starts the Drizzle View shell. Open
`http://127.0.0.1:4011` for the combined view.

Drizzle Studio's browser UI is loaded through
`https://local.drizzle.studio?port=4009`. Do not point Drizzle View at
`http://127.0.0.1:4009`; that port is the local Studio bridge endpoint and can
return an empty browser response.

The Drizzle View npm package downloads its platform binary from GitHub on first
run. The repo wrapper at `scripts/drizzle-view.mjs` removes incomplete zero-byte
downloads and fixes executable permissions before delegating to the pinned
`drizzle-view` CLI.

## Schema Docs

`pnpm db:generate` refreshes both Drizzle migration artifacts and generated
Markdown schema docs. The docs generator reads the latest committed Drizzle
snapshot metadata, combines it with the human-authored description map, and
writes one Markdown file per table under `docs/database-schema/`.

Drizzle supplies table names, column names, data types, nullability, defaults,
primary keys, foreign keys, indexes, and unique constraints. The metadata map
supplies the business meaning that cannot be inferred from SQL:

```txt
packages/database/src/schema/descriptions.ts
```

Metadata shape:

```ts
export const schemaDescriptions = {
  tmp_images: {
    description:
      "Temporary scraper image rows shared by all scraped products and variations.",
    columns: {
      id: {
        description: "Internal image row identifier.",
        example: 1000,
      },
      product_id: {
        description: "Generic temporary product row this image belongs to.",
        example: 1000,
      },
      product_variation_id: {
        description:
          "Generic temporary variation row this image belongs to, when present.",
        example: 1001,
      },
      source_hash: {
        description: "Stable hash of the source image identity used to dedupe image rows.",
        example: "sha256:db2ef0e97513c1dc9d75f55ee8c014c06fc31a459c1c25b12904696bf2ab1c55",
      },
      image_url: {
        description: "Optimized uploaded image URL.",
        example: "https://example.invalid/uploaded-image.webp",
      },
    },
  },
} as const;
```

Generated table docs include column metadata like this:

| Column | Type | Required | Key | Default | Relation | Description | Example |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `bigint` | yes | PK |  |  | Internal image row identifier. | `1000` |
| `product_id` | `bigint` | yes | FK |  | `tmp_products.id` | Generic temporary product row this image belongs to. | `1000` |
| `product_variation_id` | `bigint` | no | FK |  | `tmp_product_variations.id` | Generic temporary variation row this image belongs to, when present. | `1001` |
| `source_hash` | `text` | yes |  |  |  | Stable hash of the source image identity used to dedupe image rows. | `sha256:db2ef0e97513c1dc9d75f55ee8c014c06fc31a459c1c25b12904696bf2ab1c55` |
| `image_url` | `text` | no |  |  |  | Optimized uploaded image URL. | `https://example.invalid/uploaded-image.webp` |

Foreign-key relations should be generated from Drizzle snapshot metadata. For
example, `tmp_images.product_id` should render as a relation to
`tmp_products.id` without manually duplicating that relationship in the
description map.

Refresh only the Markdown schema docs without generating migrations:

```sh
pnpm --filter @package/database db:generate:docs
```

## Neon Branches

Use one Neon project with committed Drizzle migrations as the source of truth
for production:

| Branch | Lifetime | Parent | Purpose |
| --- | --- | --- | --- |
| `production` | permanent | root | Production data and schema. |
| `preview` | permanent | `production` | Shared non-production data for previews that do not change DB schema. |
| `dev-<name>` | permanent | `production` | Developer-owned local work branch. |
| `preview-pr-<number>` | ephemeral | `production` | Isolated PR database, created only for DB-changing PRs. |

Local development should use a developer branch. `drizzle-kit push` is allowed
only against developer branches for rapid iteration. Before opening or updating
a PR with schema changes, generate committed migrations with `pnpm db:generate`.

PR branches are disposable, but DB-changing PR updates reuse the existing
`preview-pr-<number>` branch when it already exists. The Deploy workflow creates
the branch from `production` only when missing, so the preview branch is
data-backed from production at branch creation time. Isolated PR branches get a
Neon expiration timestamp, defaulting to 14 days and configurable with
`NEON_PREVIEW_BRANCH_EXPIRES_DAYS`. Reused PR branches have that expiration
refreshed on each DB-changing deploy. It then runs committed migrations against
the branch and sets a branch-specific Vercel Preview `DATABASE_URL` for the web
preview branch. The same selected `DATABASE_URL` is also pushed into the Railway
scraper preview environment so scraper cron executions use the same database
branch as the web preview. See [Image CDN](./image-cdn.md) for the matching
preview image folder namespace.

When a PR has no DB changes, the workflow uses the shared `preview` branch and
removes stale `preview-pr-*` branches and stale Vercel branch database
overrides. The Railway scraper preview environment is updated to the selected
shared `preview` `DATABASE_URL` in that case. The close workflow remains the
primary cleanup path; Neon branch expiration is the backup path when a close
event or cleanup run is missed.

ENG-69 operational status: this repo change adds the backup expiration path, but
`preview-pr-63` was not deleted from this worktree. The blocker is that Neon
branch cleanup uses `NEON_API_KEY` and `NEON_PROJECT_ID` from Infisical
`tools/github/secrets`, not committed repo configuration. Run the
`Preview Infrastructure Cleanup` workflow for PR 63 or run
`.github/scripts/neon-database-branch.sh cleanup-preview` with `PR_NUMBER=63`
and the Neon secrets loaded.

## Neon Compute Caps

Compute cap changes are operational Neon API or Console changes, not repo
configuration. Editing compute size or autoscaling limits restarts the endpoint,
so production changes need a low-risk execution window.

Use these targets unless current Neon metrics show they are too small:

| Branch class | Autoscaling min CU | Autoscaling max CU | Scale to zero |
| --- | ---: | ---: | --- |
| `preview-pr-*` | `0.25` | `0.5` | enabled |
| `preview` | `0.25` | `0.5` | enabled |
| `dev-*` | `0.25` | `0.5` | enabled |
| `production` | `0.25` | `2` | keep current setting unless changed deliberately |

Production rollback value: restore the previous production max CU, currently
`8`, if API p95 latency or API error rate regresses for two consecutive
15-minute windows after the resize, or if scraper duration/failure rate regresses
during the next scheduled scraper run. Use Neon CPU, IO, and cache metrics only
to confirm cause when API or scraper signals regress.

ENG-70 operational status: this repo does not manage Neon endpoint sizes as code,
so the production max CU was not changed in git. No Neon metrics export is
committed here to justify retaining the current production cap. Execute the
resize through Neon during a low-risk window, then keep the previous cap `8` as
the rollback value for the monitoring window above.

Resize endpoint API shape:

```json
{
  "endpoint": {
    "autoscaling_limit_min_cu": 0.25,
    "autoscaling_limit_max_cu": 0.5
  }
}
```

## Scraper Run Retention

`scraper_runs` is operational history, not product data. The scraper prunes
rows older than 14 days when a real logged scraper command starts. Empty queue
processor cron ticks skip before creating a `scraper_runs` row, so idle cron
polling does not grow the table.

## Parallel DB PRs

Drizzle migration history is linear. Parallel DB PRs may preview independently,
but after one merges, the other DB PRs must rebase or merge latest `main`, remove
stale generated migration artifacts, and regenerate from the new mainline
history.

Print the Codex prompt for this repair flow with:

```sh
pnpm db:resolve-conflicts
```

The prompt uses the shared `$db-migration-conflicts` skill and instructs
Codex to preserve schema intent, preserve hand-written SQL, remove stale
generated artifacts, regenerate migrations, and run `drizzle-kit check`.
