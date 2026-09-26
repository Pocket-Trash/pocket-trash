---
name: pocket-trash-db-diagnostics
description: >-
  Inspect Pocket Trash's Neon production database for the SQL with the most
  calls and cumulative execution time. Use for pg_stat_statements results, Neon
  query usage, slow or frequent SQL, and database performance checks.
---

# Pocket Trash DB Diagnostics

Run read-only diagnostics against these defaults unless the user names another
target:

- project: `square-credit-33103602`
- branch: `production`
- database: `neondb`

Resolve the branch and repeat the exact target before querying. Do not install
extensions, reset statistics, expose connection strings, or run mutating SQL.

## Top SQL

Prefer the Neon MCP server:

1. Resolve `production` to its branch ID.
2. Run `inspect_database` with `check: calls`, `limit: 20`.
3. Run `inspect_database` with `check: outliers`, `limit: 20`.
4. Run this read-only statement with `run_sql` to establish the observation
   window:

   ```sql
   SELECT stats_reset, dealloc FROM pg_stat_statements_info;
   ```

If the Neon MCP server is unavailable or unauthenticated, use the installed Neon
CLI:

```bash
neon inspect db calls --project-id square-credit-33103602 --branch production --database-name neondb
neon inspect db outliers --project-id square-credit-33103602 --branch production --database-name neondb
neon psql production --project-id square-credit-33103602 --database-name neondb -- -X -c 'SELECT stats_reset, dealloc FROM pg_stat_statements_info;'
```

The CLI inspection commands return up to 25 rows; report only the first 20 from
each already-sorted result.

Report two compact tables: top SQL by calls, then top SQL by cumulative
execution time. Include rank, calls, total execution time, share of execution
time, and normalized query text. State the statistics reset time prominently.
These figures are cumulative since that reset, not a time-bounded sample.

If the sample contains only diagnostic or connection-management statements, or
has not accumulated normal scraper/API traffic, report that it is insufficient
for optimization and say when to rerun it. Do not present an empty or young
sample as evidence that production is healthy.

## Broader Health Check

Only when the user asks for broader performance or issue checks, run these
read-only Neon MCP `inspect_database` checks sequentially:

1. `stalled-queries`; run `locks` next only when a stall or blocking symptom
   needs explanation.
2. `vacuum-stats` and `bloat` for dead tuples and maintenance pressure.
3. `seq-scans` for tables to correlate with costly queries; a high count alone
   does not prove an index is missing.
4. `lfc-hit-rate` and `working-set` for cache pressure when the `neon` extension
   is already installed. If it is absent, report the gap and ask before any
   installation.

Run `unused-indexes` only after representative traffic has accumulated. Treat
its output as candidates for investigation, never authorization to drop an
index. Do not run independent diagnostics in parallel with `locks`, because
their own queries can appear as harmless short-lived locks.

Read [references/performance-checks.md](references/performance-checks.md) when
interpreting a broader health check or recommending follow-up work.
