# Database Operations

Database APIs, schema contracts, and row types are documented in
[`packages/database/src`](../packages/database/src) beside their
implementations. This runbook covers repository and Neon operations.

## Migrations

After changing a Drizzle schema declaration, generate migration artifacts:

```sh
pnpm db:generate
```

Review and commit the generated SQL, journal, and snapshot changes under
`packages/database/drizzle/`. Apply committed migrations with:

```sh
pnpm db:migrate
```

The migrate command loads `DATABASE_URL` through the Infisical runner. CI
checks migration-history consistency with:

```sh
pnpm --filter @package/database db:check
```

Do not edit Drizzle snapshots or the journal by hand to resolve a parallel
migration conflict; use the recovery workflow below.

## Local Database Selection

Local database commands use the shared development URL unless a personal
Infisical secret is selected. Store the personal branch connection string in
`/local/database` as `DATABASE_URL_<INITIALS>`, then add the selector to the
repository-root `.env.local`:

```dotenv
URL_INITIALS=RA
```

`.env.local` takes precedence over `.env`. If a selector is present but the
matching secret is missing, the command fails before accessing a database.
See [Local Database Override](./environment-variables.md#local-database-override)
for the complete selection contract.

## Database Viewer

Start Drizzle Studio, Drizzle Lab Visualizer, and Drizzle View together:

```sh
pnpm db:view
```

Open `http://127.0.0.1:4011` for the combined view.

| Component | Command | Port |
| --- | --- | ---: |
| Studio | `pnpm --filter @package/database db:studio` | 4009 |
| Visualizer | `pnpm --filter @package/database db:visualizer` | 4010 |
| Drizzle View | `pnpm --filter @package/database db:view:shell` | 4011 |

Drizzle Studio exposes its browser UI through
`https://local.drizzle.studio?port=4009`. Port 4009 itself is the local bridge,
so configuring Drizzle View with `http://127.0.0.1:4009` can produce an empty
response.

Drizzle View downloads its platform binary on first use. The repository wrapper
at [`scripts/drizzle-view.mjs`](../scripts/drizzle-view.mjs) removes incomplete
zero-byte downloads and repairs executable permissions before starting it.

## Neon Branch Lifecycle

Committed Drizzle migrations are the source of truth for the production schema.

| Branch | Lifetime | Parent | Purpose |
| --- | --- | --- | --- |
| `production` | Permanent | Root | Production data and schema |
| `development` | Permanent | Root | Shared non-production baseline |
| `preview` | Permanent | `development` | Shared previews without database changes |
| Developer branch | Permanent | `development` | Optional personal local work |
| `preview-pr-<number>` | Ephemeral | `development` | Isolated database-changing PR |

Database-changing PRs use an isolated `preview-pr-<number>` branch. The Deploy
workflow creates it from `development`, runs committed migrations, and sends
the same branch-specific `DATABASE_URL` to the Vercel web preview and Railway
scraper preview. Production data never enters preview branches.

PR updates reuse the branch and refresh its expiration. The default lifetime is
14 days; `NEON_PREVIEW_BRANCH_EXPIRES_DAYS` may set 1–30 days. Closing the PR
is the primary cleanup path and expiration is the fallback.

PRs without database changes use the shared `preview` branch and skip
Playwright mutation fixtures. See [Image CDN](./image-cdn.md) for the matching
preview storage namespace.

## Neon Compute Caps

Compute sizing is managed through Neon, not repository configuration. Verify
the current values in Neon before changing them. Resizing an endpoint restarts
it, so schedule production changes for a low-risk window.

Recommended targets, subject to current Neon metrics:

| Branch class | Target minimum CU | Target maximum CU | Scale to zero |
| --- | ---: | ---: | --- |
| `preview-pr-*` | 0.25 | 0.5 | Enabled |
| `preview` | 0.25 | 0.5 | Enabled |
| Developer branches | 0.25 | 0.5 | Enabled |
| `production` | 0.25 | 2 | Preserve the current setting unless deliberately changed |

For a production resize, retain the prior maximum as the rollback value. Roll
back when API p95 latency or error rate regresses for two consecutive 15-minute
windows, or when the next scheduled scraper run regresses. Use Neon CPU, IO, and
cache metrics to confirm the cause.

## Parallel Migration Recovery

Drizzle migration history is linear. When another database PR merges first,
update from `main`, remove only the stale generated artifacts from the current
branch, and regenerate against the new mainline history.

Print the repository-specific recovery instructions with:

```sh
pnpm db:resolve-conflicts
```

The command prints instructions for Codex to use the shared
`$pocket-trash db-migration-conflicts` workflow. That workflow preserves
schema intent and hand-written SQL, regenerates migration artifacts, and runs
the Drizzle consistency check.
