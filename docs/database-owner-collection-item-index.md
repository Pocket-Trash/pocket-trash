# Owner collection-item index evaluation

Observed Neon project `square-credit-33103602`, branch `production`, database
`neondb` at 2026-10-01 01:25 UTC. Production was read only. Index experiments
ran on the disposable production clone
`test-eng-241-owner-index-20261001`, which was deleted after testing.

## Production shape

Production was running PostgreSQL 18.6. The `collection_item` relation had not
yet been analyzed, so its catalog estimate was `-1`; the actual count was two
rows. Both rows were owned by one user and belonged to one collection.

| Measure | Value |
| --- | ---: |
| Heap size | 8 kB |
| Existing index size | 32 kB |
| Total relation size | 48 kB |
| Live / dead tuples | 2 / 10 |
| Sequential scans / tuples read | 104 / 145 |
| Index scans | 158 |
| Inserts / updates / deletes | 2 / 10 / 0 |
| HOT updates | 8 |

The one owner had two owned items (minimum, median, p95, and maximum were all
two). No column statistics or automatic-analyze timestamp existed yet.

Existing indexes were:

| Index | Definition | Size | Scans |
| --- | --- | ---: | ---: |
| `collection_item_pkey` | unique `(id)` | 16 kB | 38 |
| `collection_item_collection_visibility_idx` | `(collection_id, owner_id, is_private)` | 16 kB | 120 |

`pg_stat_statements` reset when the suspended compute resumed at
2026-10-01 01:25:37 UTC, immediately before this measurement. Its query sample
was therefore too young to use as workload-frequency evidence.

## Plan comparison

The clone was analyzed before comparison. Both read shapes used
`EXPLAIN (ANALYZE, BUFFERS, PREFETCH, FILECACHE)` with the owner having the
most items:

1. The service's owner-and-owned product count, including its spinner and
   button joins and grouping.
2. The owner-and-owned item scan ordered by `updated_at desc`, projected to the
   driving table columns relevant to the candidate index.

The proposed index was:

```sql
create index test_collection_item_owner_owned_updated_idx
  on collection_item (owner_id, owned, updated_at desc);
```

| Query | Existing indexes | With candidate | Buffers |
| --- | ---: | ---: | --- |
| Product count | 0.178 ms | 0.187 ms | 6 shared hits in both |
| Ordered items | 0.054 ms | 0.049 ms | 4 shared hits in both |

These sub-millisecond differences are noise. The planner retained the
one-page sequential scan for both queries, and the candidate recorded zero
scans. Forcing an index plan for the ordered read increased execution to
0.096 ms and required one index-page read.

## Cost and decision

The candidate occupied 16 kB: 50% more index storage and 33% more total
relation storage at the current size. A rolled-back update to `updated_at`
produced five WAL records / 369 bytes with the candidate versus two records /
145 bytes without it. Because `updated_at` is an index key, the index would
also prevent HOT updates for that common change; eight of the ten observed
production updates were HOT without it.

Do not add the index. Current reads are already sub-millisecond, the planner
does not select the candidate, and its measured write cost is larger than its
unmeasurable read benefit. Re-evaluate after `collection_item` grows beyond a
single heap page and a representative `pg_stat_statements` window shows these
owner-scoped queries consuming meaningful time. No migration ticket is needed
from this evaluation.
