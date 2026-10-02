# ENG-212: Drizzle PGlite migrator evaluation

## Conclusion

Do not replace the manual runners without first repairing migration `0028`. The
official `drizzle-orm/pglite/migrator` is available in the repository's pinned
`drizzle-orm@0.45.3`, but it fails against the current migration history because
three breakpoint-delimited chunks in `0028_tidy_luke_cage.sql` contain multiple
SQL commands. PGlite's prepared-query path accepts one statement, while the
manual runners use `PGlite.exec()`, which runs one or more statements and suits
migration scripts.

Adding three missing `--> statement-breakpoint` markers to `0028` made the
official migrator apply all 52 migrations in a temporary copy. If
changing an already-deployed migration is acceptable, the official migrator is
a reasonable replacement for the full-history runners. Keep the staged and
single-migration tests manual because they insert fixtures between
migrations or execute one migration in isolation.

## Compatibility with this repository

- The repository pins `drizzle-orm` to `0.45.3`
  (`package.json:83-86`) and uses PGlite `0.5.8` in the relevant package dev
  dependencies. The official Node entry point is a thin wrapper that reads the
  migration files and delegates to the PostgreSQL dialect
  ([Drizzle source](https://github.com/drizzle-team/drizzle-orm/blob/15454dbe49d827c6081f3d0231e2e7985e517295/drizzle-orm/src/pglite/migrator.ts#L5-L10)).
- Drizzle requires `meta/_journal.json`, follows its entry order, reads the
  corresponding tagged SQL files, splits only on the exact
  `--> statement-breakpoint` marker, and hashes each complete file
  ([Drizzle source](https://github.com/drizzle-team/drizzle-orm/blob/15454dbe49d827c6081f3d0231e2e7985e517295/drizzle-orm/src/migrator.ts#L22-L60)).
  The current journal and directory contain the same 52 migrations in the same
  order, so both runners use the same discovery order.
- Migration `0028` is not valid input for that prepared-query execution model.
  Commands lack separators between the statements at
  `packages/database/drizzle/0028_tidy_luke_cage.sql:241-243`,
  `:371-373`, and `:382-384`. On the first pair, the official migrator fails
  with PostgreSQL error `42601`, `cannot insert multiple commands into a prepared
  statement`. PGlite documents `query()` as single-statement extended protocol
  and `exec()` as multi-statement simple protocol suitable for migrations
  ([PGlite API](https://pglite.dev/docs/api#exec)).
- The repeated full-history runner strips every breakpoint and passes one whole
  file at a time to `exec()`; one representative is
  `apps/scraper/src/db/scraper-runs.integration.test.ts:161-173`. Equivalent
  helpers exist in 13 integration-test files, plus an inline copy in
  `packages/services/src/db/catalog/index.integration.test.ts:18-30`, for 33
  full-history setup call sites.
- `packages/services/src/db/catalog/collection-approval.integration.test.ts:20-56`
  runs migrations before and after inserting a legacy row. The
  targeted tests under `packages/database/test/*migration.test.ts` likewise
  exercise individual migration behavior. The all-history API cannot replace
  either pattern without weakening those tests.

## Maintainability

The official migrator would remove the repeated file discovery, sorting,
reading, and breakpoint stripping from 14 full-history runner copies. Each test
would still need to construct a Drizzle database and resolve the migration
folder unless the repository added a shared test helper.

Adoption would also make every migration depend on correct breakpoint markers.
The current history already violates that requirement in three places, and the
staged and single-migration tests would keep their manual paths. The repository
would maintain two migration-test patterns plus the extra breakpoint contract.
That trade does not justify editing a deployed migration or adding a shared
helper now.

## Correctness differences

| Behavior | Manual runner | Official migrator |
| --- | --- | --- |
| Discovery | Lexically sorted `*.sql`; ignores the journal | Journal entries only, in journal order |
| Missing/untracked files | Missing journal-listed files are not noticed; any stray SQL file runs | Missing listed file fails; unjournaled SQL is ignored |
| Repeat call | Re-executes all SQL | Applies only entries newer than the greatest recorded journal timestamp |
| Tracking | None | Creates `drizzle.__drizzle_migrations` and records hash/timestamp |
| Failure | No transaction spanning files; earlier files can remain applied | All pending SQL and history inserts roll back together |

The official implementation creates the tracking schema/table, reads only the
latest `created_at`, and applies all newer migrations in one transaction
([Drizzle source](https://github.com/drizzle-team/drizzle-orm/blob/15454dbe49d827c6081f3d0231e2e7985e517295/drizzle-orm/src/pg-core/dialect.ts#L73-L112)).
The stored hash is not compared, so it does not detect an edited applied
migration or a gap below the newest timestamp. PGlite commits the callback on
success and rolls it back on rejection
([PGlite source](https://github.com/electric-sql/pglite/blob/ae182ff8bd5ba4acb887d6c925d607a1498aa0b5/packages/pglite/src/base.ts#L448-L529)).
In a failure check against the unmodified repository history, the tracking table
remained because setup occurs before the transaction, but it had zero rows and
the `public` schema had zero tables.

Adding the three separator comments changes migration `0028`'s stored SHA-256.
With Drizzle `0.45.3`, existing databases would still skip it by timestamp
rather than hash, while new databases would record the new hash. The SQL stays
the same. This historical-artifact change should pass the
repository's `drizzle-kit check` requirement (`docs/database.md:86-94`).

## Representative integration tests

The current manual runner passed both selected tests:

| Test | Test duration |
| --- | ---: |
| `packages/services/src/db/users/index.integration.test.ts` | 908 ms |
| `apps/scraper/src/db/scraper-runs.integration.test.ts` | 782 ms |

The same tests passed after a temporary change added the three separators and
replaced each local runner with `drizzle-orm/pglite/migrator`:

| Test | Test duration |
| --- | ---: |
| `packages/services/src/db/users/index.integration.test.ts` | 848 ms |
| `apps/scraper/src/db/scraper-runs.integration.test.ts` | 807 ms |

These single runs validate the two test paths, not performance. The benchmark
below alternated both runners in one process to reduce ordering and warm-up
effects. The temporary source changes were restored after the tests.

## Runtime implications

The current history has 578 breakpoints: 630 prepared-query chunks before the
three required repairs, versus 52 `exec()` calls in the manual runner. The
official path uses synchronous file reads and hashes all 52 files on every
call, including a no-op repeat, then issues one tracking insert per newly
applied migration. This follows from the loader and dialect sources above.

An eight-run warmed, alternating local benchmark using the repository's pinned
dependencies and a temporary history with the three separator repairs measured:

| Runner | Median | Mean |
| --- | ---: | ---: |
| Manual, 52 `exec()` calls | 517 ms | 521 ms |
| Official, 633 chunks plus tracking | 579 ms | 577 ms |

That is about 11-12% (roughly 60 ms) slower per fresh full-history setup on this
machine. Treat the numbers as directional because PGlite/WASM startup and test
parallelism vary; correctness compatibility, not runtime, is the blocking issue.

## Recommendation

Keep the manual execution path for now unless ENG-212 permits editing
the deployed `0028` artifact. If it does, add only the three missing separators,
verify `drizzle-kit check`, then use the official migrator for full-history test
setup. Do not force the staged or single-migration tests through the all-history
API.
