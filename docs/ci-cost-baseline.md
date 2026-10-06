# CI Cost Baseline

This document fixes the measurement contract for the
`Improve local validation and reduce CI cost` project. Use the same contract for
the post-rollout comparison so changes in pull request volume do not disguise
changes in GitHub Actions usage.

## Baseline cohort and window

The baseline is a paired cohort of four code-changing pull requests targeting
`main` on October 6, 2026. Each pull request had one code-push CI run, an
immediate full CI rerun caused only by editing pull request metadata, and a
deployment run with any failed-job reruns.

- Trigger window: `2026-10-06T16:30:14Z` through `2026-10-06T16:31:55Z`.
- Completion cutoff: `2026-10-06T17:08:03Z`, when the last included deployment
  attempt completed.
- Pull requests: #276 through #279 (ENG-344 through ENG-347).
- Workflows: `CI` and `Deploy` only. Changeset, notification, cleanup, scheduled,
  `main` push, and unrelated workflow runs are excluded.

The source run set is fixed below. Process a deployment's failed/retried
attempts before its final successful attempt so reused jobs are attributed to
the attempt where they actually ran.

| Pull request | Code-push CI | Metadata-edit CI | Successful deployment attempt | Failed/retried deployment attempts |
|---|---:|---:|---:|---:|
| #276 / ENG-344 | [37496210839](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496210839) | [37496418646](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496418646) | [37496211633 attempt 2](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496211633/attempts/2) | [attempt 1](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496211633/attempts/1) |
| #277 / ENG-345 | [37496209188](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496209188) | [37496422923](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496422923) | [37496209526 attempt 4](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496209526/attempts/4) | [attempt 1](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496209526/attempts/1), [attempt 2](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496209526/attempts/2), and [attempt 3](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496209526/attempts/3) |
| #278 / ENG-346 | [37496216789](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496216789) | [37496427330](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496427330) | [37496217339 attempt 2](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496217339/attempts/2) | [attempt 1](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496217339/attempts/1) |
| #279 / ENG-347 | [37496220239](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496220239) | [37496433108](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496433108) | [37496220493 attempt 2](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496220493/attempts/2) | [attempt 1](https://github.com/Pocket-Trash/pocket-trash/actions/runs/37496220493/attempts/1) |

## Measurement method

A runner job-minute is 60 seconds between a non-skipped job's `started_at` and
`completed_at` timestamps. Process attempts chronologically and count each job
execution once, using workflow run ID, job name, `started_at`, and `completed_at`
as the identity. GitHub copies successful jobs into later rerun snapshots with
their original timestamps; those copies are not new runner usage. Attribute a
job to the category containing its first occurrence. Sum the de-duplicated job
durations, then round category totals to one decimal place. Do not round
individual jobs or runs.

The following Bash script reproduces every category total from the GitHub API:

```bash
runs=(
  'code-push-ci:37496210839:1'
  'code-push-ci:37496209188:1'
  'code-push-ci:37496216789:1'
  'code-push-ci:37496220239:1'
  'metadata-edit-ci:37496418646:1'
  'metadata-edit-ci:37496422923:1'
  'metadata-edit-ci:37496427330:1'
  'metadata-edit-ci:37496433108:1'
  'failed-retried-deployment:37496211633:1'
  'failed-retried-deployment:37496209526:1'
  'failed-retried-deployment:37496209526:2'
  'failed-retried-deployment:37496209526:3'
  'failed-retried-deployment:37496217339:1'
  'failed-retried-deployment:37496220493:1'
  'successful-deployment:37496211633:2'
  'successful-deployment:37496209526:4'
  'successful-deployment:37496217339:2'
  'successful-deployment:37496220493:2'
)

for specification in "${runs[@]}"; do
  IFS=: read -r category run_id attempt <<<"$specification"
  while IFS=$'\t' read -r job started completed seconds; do
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
      "$category" "$run_id" "$job" "$started" "$completed" "$seconds"
  done < <(gh api \
    "repos/Pocket-Trash/pocket-trash/actions/runs/$run_id/attempts/$attempt/jobs?per_page=100" \
    --jq '.jobs[] | select(.conclusion != "skipped") | [.name, .started_at, .completed_at, ((.completed_at | fromdateiso8601) - (.started_at | fromdateiso8601))] | @tsv')
done | awk -F '\t' '
  {
    key = $2 FS $3 FS $4 FS $5
    if (!seen[key]++) totals[$1] += $6
  }
  END {
    for (category in totals) printf "%s\t%.1f\n", category, totals[category] / 60
  }
'
```

## Baseline

| Category | Runner job-minutes | Job-minutes per code-changing PR |
|---|---:|---:|
| Code-push CI | 98.8 | 24.7 |
| Metadata-edit CI reruns | 86.2 | 21.6 |
| Successful deployment attempts | 52.4 | 13.1 |
| Failed or retried deployment attempts | 32.5 | 8.1 |
| **Total** | **270.0** | **67.5** |

The normalized primary metric is total runner job-minutes divided by the four
distinct code-changing pull requests in the cohort. Category metrics use the
same denominator. Metadata-edit CI is reported separately even though it is
also included in the total.

## Target and post-rollout window

The project target is a **40% reduction** in total runner job-minutes per
code-changing pull request: from `67.5` to **no more than `40.5`**. The
metadata-edit category must also contain no full code CI reruns; any replacement
metadata-only validation remains measured in that category.

Measure the first 14 complete UTC days beginning at `00:00:00Z` on the day after
the final implementation pull request for ENG-370 through ENG-379 merges. End
the window at `23:59:59Z` on day 14. Include every code-changing pull request
targeting `main` with a code-push CI run in the window, and include all of its
CI metadata reruns and deployment runs triggered in the window. For every
included workflow run, include all rerun attempts through terminal completion,
even when an attempt finishes after day 14. Count each distinct pull request
once in the denominator. Record the exact dates, pull requests, run IDs,
attempts, and final completion cutoff in ENG-380 before calculating the result.

If the window contains fewer than four qualifying pull requests, report the
result as insufficient evidence and repeat the same fixed 14-day measurement
for the next complete window. Do not combine windows selectively.

## Exclusions

- Queue time is excluded because the calculation starts at each job's
  `started_at`, not the workflow or job creation time. Report queue time
  separately if a later project adds it.
- External-service usage and cost for Neon, Vercel, Railway, Clerk, Bunny,
  Infisical, and Axiom are excluded because GitHub job timing does not expose
  them. Report them separately if provider billing data becomes available.
- GitHub-hosted runner billing multipliers and per-job billing-minute rounding
  are excluded. This baseline uses raw elapsed job-minutes so it remains
  comparable when plan pricing changes.
