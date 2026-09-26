# Neon/Postgres performance checks

## Recommendation

Use Neon's existing read-only diagnostics instead of maintaining custom catalog
SQL. The Neon MCP `inspect_database` tool exposes the same 15 checks as
`neon inspect db`; prefer MCP and fall back to the CLI. For the requested
report, run `outliers` and `calls`, then keep the first 20 rows from each
result. Both checks return 25 rows: `outliers` ranks cumulative execution time
and `calls` ranks execution count.
([Neon MCP diagnostics](https://neon.com/docs/ai/neon-mcp-server#database-diagnostics),
[Neon CLI inspect](https://neon.com/docs/cli/inspect#db-outliers))

## Ranked checks

### 1. Establish the measurement window and query workload

Always report `pg_stat_statements_info.stats_reset`, `dealloc`, and, when
available, each row's `stats_since`. The counters are cumulative, and Neon
discards them whenever the compute suspends or restarts, including scale to
zero. Do not reset production statistics automatically. A high `dealloc` count
means least-executed entries have been discarded because
`pg_stat_statements.max` was exceeded.
([Neon data persistence](https://neon.com/docs/extensions/pg_stat_statements#data-persistence),
[PostgreSQL `pg_stat_statements`](https://www.postgresql.org/docs/current/pgstatstatements.html))

Interpret the two rankings differently: high `total_exec_time` identifies
cumulative load, high `mean_exec_time` identifies expensive individual calls,
and high `calls` identifies hot paths. Include `rows` (and preferably rows per
call), `max_exec_time`, and `stddev_exec_time` so a high total is not mistaken
for high per-request latency and variable/tail behavior is visible. PostgreSQL
defines these fields as aggregate execution statistics, not latency percentiles.
([PostgreSQL `pg_stat_statements` columns](https://www.postgresql.org/docs/current/pgstatstatements.html#PGSTATSTATEMENTS-COLUMNS))

Treat each row as a normalized query shape. Literal constants are generally
replaced with parameters, and the representative text is only one statement for
the `queryid`; use `queryid` with `dbid` and `userid` rather than query text as
the identity within a server/version. SQL text and `queryid` for other users
require superuser or `pg_read_all_stats`; otherwise the skill may see statistics
but not the identifying text.
([PostgreSQL normalization and visibility](https://www.postgresql.org/docs/current/pgstatstatements.html))

Report relevant collection settings with the result: `pg_stat_statements.track`
defaults to `top` (`all` also records nested statements), planning time is zero
unless `track_planning` is enabled, and block I/O timing is zero unless
`track_io_timing` is enabled. Do not enable planning or I/O timing
automatically: both can add overhead.
([PostgreSQL extension settings](https://www.postgresql.org/docs/current/pgstatstatements.html#PGSTATSTATEMENTS-CONFIG-PARAMS),
[PostgreSQL runtime statistics](https://www.postgresql.org/docs/current/runtime-config-statistics.html))

### 2. During an incident, check current waits before historical aggregates

Run `stalled-queries`, then `long-running-queries`, then `locks`. Neon's stalled
check finds active queries over 30 seconds and includes waits, blockers,
parallel workers, query IDs, and SQL; the long-running check uses a five-minute
threshold. `pg_stat_activity` supplies query/transaction start times, state, and
wait events; an active backend with a non-null `wait_event` is executing but
blocked somewhere. Include old `idle in transaction` sessions because their
transaction age is distinct from query age.
([Neon stalled queries](https://neon.com/docs/cli/inspect#db-stalled-queries),
[PostgreSQL `pg_stat_activity`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY))

Use `pg_blocking_pids()` to identify blockers rather than self-joining
`pg_locks`; PostgreSQL explicitly recommends it because lock-mode conflicts,
wait queues, and parallel workers make the join difficult to get right. Avoid
polling it aggressively because it briefly needs exclusive access to
lock-manager state.
([PostgreSQL `pg_locks`](https://www.postgresql.org/docs/current/view-pg-locks.html),
[PostgreSQL `pg_blocking_pids`](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-INFO-SESSION))

As a compact database-wide error signal, also inspect `pg_stat_database` for
rollbacks, `temp_files`/`temp_bytes`, deadlocks, block I/O time, connections,
and its `stats_reset`. Except for current backend count, these are accumulated
values since reset, so present rates or the observation window rather than raw
totals alone.
([PostgreSQL `pg_stat_database`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-DATABASE))

### 3. Separate query I/O from Neon cache/compute pressure

For suspect query shapes, include shared/local/temp blocks read, hit, dirtied,
and written. Temp blocks expose spill-heavy sorts or hashes;
`shared_blk_*_time`, `local_blk_*_time`, and `temp_blk_*_time` only have meaning
when `track_io_timing` covered the observation window. For write-heavy
workloads, add `wal_bytes`, `wal_records`, `wal_fpi`, and `wal_buffers_full` to
find statements that dominate WAL generation; keep WAL out of the default
display when writes are not the issue.
([PostgreSQL `pg_stat_statements` columns](https://www.postgresql.org/docs/current/pgstatstatements.html#PGSTATSTATEMENTS-COLUMNS),
[PostgreSQL I/O timing caveat](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-IO-VIEW))

On Neon, run `lfc-hit-rate` and `working-set` after representative traffic. Neon
advises investigating a file-cache hit ratio below 99%, and the working-set
check compares recent hot data with compute-cache capacity. These counters reset
with the compute, so a newly resumed compute is not representative. On fixed
computes of 18 CU or more, the working cache is in `shared_buffers`; LFC
diagnostics can be empty or misleading, so use the Console Compute cache hit
rate graph or `SHOW shared_buffers` instead.
([Neon cache guidance](https://neon.com/docs/postgresql/query-performance#cache-your-data),
[Neon CLI cache checks](https://neon.com/docs/cli/inspect#db-lfc-hit-rate))

Also compare current connections with the compute's limit when saturation is
plausible. Neon compute size controls cache capacity and maximum simultaneous
connections, so query tuning alone will not explain a branch pinned at its
connection or compute ceiling.
([Neon compute sizing](https://neon.com/docs/manage/endpoints/))

### 4. Check table maintenance and access paths

Run `vacuum-stats`, then `bloat`, then `seq-scans` and `unused-indexes`.
Prioritize large tables with a high dead-to-live tuple ratio, many modifications
since analyze, or stale `last_autovacuum`/`last_autoanalyze`. PostgreSQL exposes
those estimates in `pg_stat_user_tables`; routine vacuuming reuses dead-row
space, refreshes planner statistics and the visibility map, and prevents
transaction-ID wraparound. Do not automate `VACUUM FULL`: it is slower and takes
an `ACCESS EXCLUSIVE` lock.
([Neon vacuum check](https://neon.com/docs/cli/inspect#db-vacuum-stats),
[PostgreSQL table statistics](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES),
[PostgreSQL routine vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html))

Treat sequential scans as candidates, not failures. Rank by table size and
`seq_tup_read`, then connect the table back to an expensive query before
recommending an index. PostgreSQL can correctly prefer a sequential scan for
small tables or queries that read many rows; confirm with `EXPLAIN` on a safe
copy or with non-mutating `EXPLAIN` before changing indexes.
([PostgreSQL table scan counters](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES),
[PostgreSQL `EXPLAIN`](https://www.postgresql.org/docs/current/using-explain.html))

### 5. Check replication only when it exists

Run `replication-slots` and `subscriptions` only when the branch has
slots/subscriptions or the issue concerns CDC/replication. An inactive or
lagging slot can retain old tuples through `xmin` and WAL through `restart_lsn`;
inspect `active`, retained WAL distance, `wal_status`, and `safe_wal_size`. This
is irrelevant overhead for a branch with no replication configuration.
([PostgreSQL replication slots](https://www.postgresql.org/docs/current/view-pg-replication-slots.html),
[Neon replication checks](https://neon.com/docs/cli/inspect#db-replication-slots))

## Minimal reusable skill flow

1. Run MCP `inspect_database` checks `outliers` and `calls`; fall back to
   `neon inspect db outliers` and `neon inspect db calls`; return 20 from each.
2. Add the statistics window, reset/deallocation caveats, and
   collection/visibility settings.
3. If diagnosing an active incident, add stalled queries/locks and Neon
   cache/working-set checks.
4. If the workload evidence points to table access or churn, add
   vacuum/bloat/scan checks.
5. Add WAL or replication checks only when writes, CDC, slots, or subscriptions
   make them relevant.
