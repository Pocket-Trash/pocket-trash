# Database Operations

Database APIs, schema contracts, and row types are documented in
[`packages/database/src`](../packages/database/src) beside their
implementations. This runbook covers repository and Neon operations.

## Product detail table names

Catalog product-type detail tables use the reserved `product_detail_*` prefix,
and collection-item product-type detail tables use `collection_detail_*`.
`product` and `collection_item` remain the shared-ID base tables. Supporting
entities, lookups, options, images, aliases, and relationships do not use either
detail prefix.

## Migrations

After changing a Drizzle schema declaration, generate migration artifacts:

```sh
pnpm db:generate
```

Review and commit each generated timestamp folder under
`packages/database/drizzle/<YYYYMMDDHHmmss>_<name>/`, including `migration.sql`
and `snapshot.json`. There is no numbered SQL file or shared journal. Apply
committed migrations with:

```sh
pnpm db:migrate
```

The migrate command loads `DATABASE_URL` through the Infisical runner. CI
checks migration-history consistency with:

```sh
pnpm --filter @package/database db:check
```

Drizzle records applied migration names, timestamps, and SQL hashes in
`drizzle.__drizzle_migrations`. Validation compares named sets, not a highest
timestamp or an ordered prefix. Never edit applied SQL, snapshots, or ledger rows.
Functions and triggers unsupported by schema generation belong in a custom
migration after their dependent tables:

```sh
pnpm --filter @package/database db:generate --custom --name=database_protections
```

After adding custom SQL, unchanged schema generation must still emit no DDL.
Use `pnpm db:validate:chain` to replay native migrations twice on disposable
PGlite, and `pnpm db:validate:personal` to compare the selected personal Neon
history read-only.

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

Start Drizzle Studio for the selected local database:

```sh
pnpm db:studio
```

Drizzle Studio exposes its browser UI through
`https://local.drizzle.studio?port=4009`. Port 4009 is its local database bridge.

## Neon Branch Lifecycle

Committed Drizzle migrations are the source of truth for the production schema.

| Branch | Lifetime | Parent | Purpose |
| --- | --- | --- | --- |
| `production` | Permanent | Root | Production data and schema |
| `development` | Permanent | Root | Shared non-production baseline |
| `preview` | Permanent | `development` | Shared previews without database changes |
| Developer branch | Permanent | `development` | Optional personal local work |
| `preview-pr-<number>` | Ephemeral | `development` | Isolated mutation-relevant PR |

Database-changing PRs use an isolated `preview-pr-<number>` branch. The Deploy
workflow creates it from `development`, runs committed migrations, and sends
the same branch-specific `DATABASE_URL` to the Vercel web preview and Railway
scraper preview. Production data never enters preview branches.

PR updates reuse the branch and refresh its expiration only when its Neon
parent, pull-request base commit, and ordered migration fingerprint match the
last successful preflight. A mismatch deletes and recreates the branch from
`development`. The preview-state CLI uses exit code `10` only for this expected
compatibility mismatch; other nonzero exits mean the state could not be read.

Migration and seed preflight finishes before API, Vercel, or Railway scraper
deployment begins. While a branch is being created or recreated, the workflow
records that it owns the branch lifecycle. Preflight also claims a reused
branch while migrations and seed data are being verified. Failed preflight and
cancellation cleanup delete only a branch actively owned by that run,
including partial creation, while successfully preflighted reused branches
survive unrelated deployment failures. Ownership ends after successful
preflight. A
branch-limit result blocks deployment without deleting another branch. Cleanup
errors remain visible so `cleanup-preview` can be retried safely.

The default lifetime is 14 days; `NEON_PREVIEW_BRANCH_EXPIRES_DAYS` may set
1–30 days. Closing the PR is the primary cleanup path and expiration is the
fallback.

PRs without mutation-relevant changes use the shared `preview` branch and skip
Playwright mutation fixtures. Database-changing PRs also run committed
migrations. See [Image CDN](./image-cdn.md) for the matching preview storage
namespace.

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

Independently generated timestamp-folder migrations can coexist when their
changes commute. Update from `main`, preserve both complete folders, and run
`db:check` before regenerating anything. A check failure means the histories
need review; it is not permission to delete mainline or applied migrations.
For an incompatible change, retain the TypeScript intent and custom SQL, then
regenerate only the current branch's never-applied conflicting artifacts against
the latest mainline schema. Coordinate if either history has been applied.

Print the repository-specific recovery instructions with:

```sh
pnpm db:resolve-conflicts
```

The command prints instructions for Codex to use the shared
`$pocket-trash db-migration-conflicts` workflow. That workflow preserves
schema intent and hand-written SQL, retains compatible sibling migrations, and
regenerates only confirmed unapplied conflicts before consistency and replay checks.

## Fresh-baseline maintenance

This history is for empty or already rebuilt targets. It cannot be applied over
an old schema or ledger. Production receives schema, custom protections, and
migration records only; deployment does not seed or reconcile Clerk users.
Development and preview use the existing non-production fixtures.

Maintenance bypasses personal-selector wrappers: the Infisical runner can replace
an explicitly supplied `DATABASE_URL` with the selected personal secret. Securely
inject a nonempty direct URL into the following unwrapped commands; never paste
credentials into a shell command or report:

```sh
pnpm --filter @package/database db:migrate:direct
pnpm --filter @package/database exec tsx scripts/seed.ts
pnpm --filter @package/database exec tsx scripts/preview-state.ts mark
```

Before DDL, verify the project, branch ID, parent, endpoint, protection, database
`neondb`, and role against the live Neon inventory and `current_database()` /
`current_user` on that connection. Confirm the destructive procedure separately.
Stop on unexpected branches, databases, consumers, or dependencies. Verify the
native ledger on the same target after migration. Seeding also requires the
environment's Bunny credentials and namespace; never run it on production.

For the one-time upgrade PR, pause Deploy and drain preparation before pushing
or opening the PR—even a draft triggers deployment. Resolve only its owned
`preview-pr-<number>` branch, empty only its identity-checked application target,
apply the committed history, and seed with `images/preview/pr-<number>` and
`resources/preview/pr-<number>`. Set `PREVIEW_BASE_SHA` to the exact PR base SHA,
write and verify the new migration fingerprint with `preview-state.ts mark` /
`check`, then resume Deploy and trigger its supported PR event. Re-bootstrap
under a pause if the branch, base SHA, or migration artifacts change. There is
no general automatic reset exception.

Merge and shared rebuild remain a separate maintenance operation: freeze Deploy,
Preview Refresh, writers, queues/webhooks, scraper schedules, local writers,
main pushes, and release tags; drain old runs; merge the verified integration PR
and record its actual SHA. Remove its owned preview branch and require zero PR
branches before resetting shared databases. Rebuild production and development
in place, reset preview from rebuilt seeded development, replace the old personal
branch, verify credentials, and deploy only the recorded main SHA. Restore
production protection before resuming traffic. No recovery dumps are retained
under the approved cutover policy; reverting code does not recover removed data.
The authoritative target/credential checklist is in [ENG-422](https://linear.app/pocket-trash/issue/ENG-422/cut-over-every-database-and-retire-the-temporary-drizzle-setup).

## Preview classification contract

The classifier and database labels answer different questions:

- `database_validation` selects database checks for changes to the database or
  shared foundation. It does not indicate schema changes or require a PR branch.
- `database_content_changed` detects schema, migrations, Drizzle configuration,
  and seed scripts/data. It alone controls the `db-change` label and development
  database refresh. Dependency-only changes do not receive that label.
- `mutation_e2e` selects mutation fixtures and requires an isolated Neon PR
  branch. Schema/seed changes and the explicit `test:e2e` label require isolation;
  other runtime changes may also require it without changing database content.
  The `preview-db` label follows this isolation decision, including `test:e2e`,
  even when `db-change` is absent. It is removed when isolation is no longer
  required during preview preparation, and both labels are removed on PR close.

For dependency policy or lockfile changes, the classifier compares both committed
pnpm lockfiles and traverses resolved dependencies, optional dependencies,
workspace links, and package integrity metadata. Known build entrypoints (Vite,
TypeScript, Tailwind's Vite plugin, and TanStack build plugins) stay in the build
graph even when declared as runtime dependencies. Runtime consumers retain their
normal mutation domains; build-only consumers receive build/preview/safe E2E
checks without mutation isolation. Unchanged graphs select validation only.
Unreadable or unsupported graphs retain conservative full checks and isolation.
Release-age policy changes alone select validation only. Other workspace policy
changes retain conservative isolation; root and workspace manifest script/engine changes select build
and smoke checks. A manifest path alone never requests mutation tests when the
dependency graph is known: dependency changes follow affected runtime consumers;
package name/version-only changes select validation. Lint policy and skill lockfiles select validation only; Railway configuration
selects scraper checks and a preview. Unknown paths and workflows remain
conservative. Deployment summaries show content changes and mutation isolation
separately; removing isolation also removes stale PR branches and overrides.


### Standalone script classification

Reviewed script paths use the following checks. These rules apply to a script-only
change; runtime source changes and explicit `test:e2e` labels add their normal checks.

| Script under `scripts/` | Checks | Reason |
| --- | --- | --- |
| `audit-bunny-services.mjs` | Validation only | Read-only management API audit and local report output |
| `change-classification.test.mjs` | Validation only | Isolated tooling/contract tests |
| `check-changelog-reminder.mjs` | Validation only | Changelog advisory checking |
| `check-changelog-reminder.test.mjs` | Validation only | Isolated tooling/contract tests |
| `check-jsdoc.mjs` | Validation only | Source documentation checking |
| `check-jsdoc.test.mjs` | Validation only | Isolated tooling/contract tests |
| `check-pr-changeset.mjs` | Validation only | Release marker checking |
| `check-pr-changeset.test.mjs` | Validation only | Isolated tooling/contract tests |
| `classify-changes.mjs` | Validation only | Validation-domain policy; covered by classification tests |
| `database-change-detection.test.mjs` | Validation only | Isolated tooling/contract tests |
| `database-schema-diagram.template.html` | Validation only | Documentation template |
| `dependency-changes.mjs` | Validation only | Committed dependency graph comparison; covered by classification tests |
| `developer-commands.test.mjs` | Validation only | Isolated tooling/contract tests |
| `e2e-local-contract.test.mjs` | Validation only | Isolated tooling/contract tests |
| `generate-database-schema-diagram.mjs` | Validation only | Drizzle schema metadata reading and documentation output |
| `generate-infrastructure-diagram.mjs` | Validation only | Local source/metadata scanning and documentation output |
| `release.mjs` | Validation only | Release preparation and publishing; covered by release tests |
| `release.test.mjs` | Validation only | Isolated tooling/contract tests |
| `security-audit.mjs` | Validation only | Dependency policy checking; covered by security tests |
| `security-policy.test.mjs` | Validation only | Isolated tooling/contract tests |
| `validate-pr.mjs` | Validation only | Local validation orchestration; covered by validation-plan tests |
| `validate-pr.test.mjs` | Validation only | Isolated tooling/contract tests |
| `check-railway-context.mjs` | Scraper and validation | Scraper build-context checking or local scraper orchestration |
| `dev-scraper.mjs` | Scraper and validation | Scraper build-context checking or local scraper orchestration |
| `scraper-command.mjs` | Scraper and validation | Scraper build-context checking or local scraper orchestration |
| `scraper-redis.mjs` | Scraper and validation | Scraper build-context checking or local scraper orchestration |
| `workspace-packages.mjs` | Scraper and validation | Scraper build-context checking or local scraper orchestration |
| `dev-webhooks.mjs` | API, preview, safe E2E, mutation E2E, and validation | Registers webhook targets and runs the local API/web workflow |

New, unreviewed scripts retain full conservative checks. Add a reviewed explicit
path rule rather than making the entire `scripts/` directory validation-only.
