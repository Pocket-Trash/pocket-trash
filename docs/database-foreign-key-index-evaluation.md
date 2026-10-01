# Foreign-key index evaluation

Observed Neon project `square-credit-33103602`, branch `production`, database
`neondb` at 2026-10-01 15:57 UTC. Production was read only. Plan comparisons
ran on the disposable production clone `test-eng-242-fk-indexes-20261001`,
which was deleted after testing.

## Method

The schema review identified 18 foreign-key columns without a leading index.
Since that review, `collection_spinner.installed_button_id` gained the unique
leading index `collection_spinner_installed_button_unique`; the other 17
columns remain uncovered.

The clone was analyzed before testing. For every candidate, the comparison
used:

1. `EXPLAIN (ANALYZE, BUFFERS)` for a representative child-to-parent join.
2. `EXPLAIN (ANALYZE, BUFFERS)` for the child lookup predicate PostgreSQL's
   foreign-key trigger would use for a parent delete.
3. Plain `EXPLAIN DELETE` for the parent-row lookup. No delete was executed.
4. The same read plans after adding a single-column comparison index on each
   uncovered child column.

All joins, child probes, and parent-delete lookups used sequential scans. The
relations fit in one heap page, so PostgreSQL correctly rejected every
comparison index. Execution-time differences below are sub-millisecond noise.

## Production relation shape

Most candidate tables had never been analyzed, so their production
`reltuples` estimate was `-1`. Actual counts were measured separately without
changing production.

| Child relation | Actual / estimate / live rows | Heap / total size | Seq scans / tuples | Index scans | Inserts / updates / deletes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `collection_item` | 2 / -1 / 2 | 8 / 48 kB | 115 / 167 | 160 | 2 / 10 / 0 |
| `collection_spinner` | 1 / 1 / 1 | 8 / 48 kB | 67 / 65 | 85 | 1 / 2 / 0 |
| `collection_spinner_button` | 1 / -1 / 1 | 8 / 24 kB | 46 / 24 | 112 | 1 / 0 / 0 |
| `feature_flag_user_overrides` | 0 / -1 / 0 | 0 / 24 kB | 8 / 0 | 2 | 0 / 0 / 0 |
| `feedback_notifications` | 0 / -1 / 0 | 0 / 24 kB | 8 / 0 | 0 | 0 / 0 / 0 |
| `finish_option` | 5 / -1 / 5 | 8 / 56 kB | 9 / 6 | 253 | 7 / 1 / 2 |
| `finish_option_color` | 0 / -1 / 0 | 0 / 16 kB | 4 / 0 | 147 | 0 / 0 / 0 |
| `finish_option_finish` | 7 / -1 / 7 | 8 / 40 kB | 4 / 0 | 197 | 10 / 0 / 3 |
| `product` | 2 / -1 / 2 | 8 / 80 kB | 137 / 213 | 351 | 3 / 2 / 1 |
| `product_material` | 4 / -1 / 4 | 8 / 24 kB | 3 / 0 | 86 | 7 / 0 / 3 |
| `product_spinner` | 1 / -1 / 1 | 8 / 32 kB | 14 / 11 | 88 | 1 / 1 / 0 |
| `resource_notifications` | 2 / -1 / 2 | 8 / 48 kB | 9 / 10 | 0 | 2 / 0 / 0 |

`pg_stat_database.stats_reset` was null, so the cumulative tuple counters have
no explicit reset time and cannot be converted into reliable rates.
`pg_stat_statements` had reset at 2026-10-01 15:36:58 UTC, only 21 minutes
before observation, and contained zero insert, update, or delete calls for all
candidate child tables. That sample is too young to establish long-term write
rates; it only confirms there was no write activity during the sample.

## Candidate evidence

`Rows` is child rows / non-null values / distinct values / maximum children for
one parent. Join and probe values are baseline milliseconds to comparison-index
milliseconds. Every displayed plan was a sequential scan; parent deletes were
planned only, with the listed referential action, and were not executed.

| Candidate | Rows | Existing leading index | Join ms | FK probe ms | Parent delete | Decision |
| --- | ---: | --- | ---: | ---: | --- | --- |
| `collection_item.owner_id` | 2 / 2 / 1 / 2 | none | 0.048 → 0.046 | 0.050 → 0.062 | `users`; cascade | No change |
| `collection_item.material_id` | 2 / 2 / 2 / 1 | none | 0.040 → 0.044 | 0.098 → 0.061 | `materials`; restrict | No change |
| `collection_item.purchased_from_user_id` | 2 / 0 / 0 / 0 | none | 0.039 → 0.038 | 0.050 → 0.054 | `users`; set null | No change |
| `collection_item.sold_to_user_id` | 2 / 0 / 0 / 0 | none | 0.041 → 0.037 | 0.044 → 0.044 | `users`; set null | No change |
| `collection_spinner.product_spinner_id` | 1 / 1 / 1 / 1 | none | 0.043 → 0.043 | 0.058 → 0.058 | `product_spinner`; restrict | No change |
| `collection_spinner.installed_button_id` | 1 / 1 / 1 / 1 | `collection_spinner_installed_button_unique` | 0.087 → 0.042 | 0.059 → 0.061 | `collection_spinner_button`; set null | Already covered |
| `collection_spinner_button.product_spinner_button_id` | 1 / 1 / 1 / 1 | none | 0.045 → 0.043 | 0.062 → 0.057 | `product_spinner_button`; restrict | No change |
| `feature_flag_user_overrides.user_id` | 0 / 0 / 0 / 0 | none | 0.033 → 0.034 | 0.034 → 0.038 | `users`; cascade | No change |
| `feedback_notifications.feedback_id` | 0 / 0 / 0 / 0 | none | 0.038 → 0.048 | 0.035 → 0.031 | `feedback`; cascade | No change |
| `finish_option.source_product_finish_option_id` | 5 / 1 / 1 / 1 | none | 0.041 → 0.042 | 0.066 → 0.057 | `finish_option`; set null | No change |
| `finish_option.color_effect_id` | 5 / 0 / 0 / 0 | none | 0.041 → 0.038 | 0.044 → 0.042 | `color_effect`; restrict | No change |
| `finish_option_color.color_id` | 0 / 0 / 0 / 0 | none | 0.036 → 0.033 | 0.039 → 0.047 | `color`; restrict | No change |
| `finish_option_finish.finish_id` | 7 / 7 / 3 / 3 | none | 0.051 → 0.043 | 0.060 → 0.052 | `finish`; restrict | No change |
| `product.maker_id` | 2 / 2 / 2 / 1 | none | 0.050 → 0.044 | 0.044 → 0.056 | `makers`; restrict | No change |
| `product_material.material_id` | 4 / 4 / 4 / 1 | none | 0.044 → 0.044 | 0.057 → 0.057 | `materials`; restrict | No change |
| `product_spinner.compatible_button_id` | 1 / 0 / 0 / 0 | none | 0.041 → 0.039 | 0.043 → 0.041 | `product_spinner_button`; set null | No change |
| `resource_notifications.resource_id` | 2 / 2 / 1 / 2 | none | 0.052 → 0.041 | 0.057 → 0.058 | `resources`; cascade | No change |
| `resource_notifications.category_id` | 2 / 1 / 1 / 1 | none | 0.048 → 0.043 | 0.057 → 0.057 | `resource_categories`; restrict | No change |

The 17 comparison indexes occupied 248 kB in total while the 12 child tables
used 72 kB of heap storage. None was selected for a join or foreign-key probe.

## Decision

Do not add an index for any uncovered candidate. The largest child relation is
seven rows, every lookup is already sub-millisecond, and comparison indexes
increased storage without changing a plan. Keep the existing
`collection_spinner_installed_button_unique` index.

Re-evaluate an individual column only after its child relation grows beyond a
single heap page and a representative `pg_stat_statements` window shows that
its joins or parent-side deletes consume meaningful time. No migration
follow-up is warranted from the current evidence.
