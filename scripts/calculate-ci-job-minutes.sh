#!/usr/bin/env bash

set -euo pipefail

script_directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repository=${CI_COST_REPOSITORY:-Pocket-Trash/pocket-trash}

if [[ $# -eq 0 ]]; then
  manifest="$script_directory/ci-cost-baseline-runs.tsv"
  pull_request_count=4
elif [[ $# -eq 2 ]]; then
  manifest=$1
  pull_request_count=$2
else
  printf 'Usage: %s [<run-manifest.tsv> <pull-request-count>]\n' "$0" >&2
  exit 1
fi

if [[ ! -r "$manifest" ]]; then
  printf 'Run manifest is not readable: %s\n' "$manifest" >&2
  exit 1
fi

if [[ ! "$pull_request_count" =~ ^[1-9][0-9]*$ ]]; then
  printf 'Pull request count must be a positive integer: %s\n' "$pull_request_count" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  printf 'GitHub CLI is required to calculate CI job-minutes.\n' >&2
  exit 1
fi

while IFS=$'\t' read -r category run_id attempt _rest; do
  if [[ -z "$category" || "$category" == \#* ]]; then
    continue
  fi

  if [[ -z "$run_id" || -z "$attempt" || ! "$run_id" =~ ^[0-9]+$ || ! "$attempt" =~ ^[0-9]+$ ]]; then
    printf 'Invalid manifest row: %s\t%s\t%s\n' "$category" "$run_id" "$attempt" >&2
    exit 1
  fi

  case "$category" in
    code-push-ci | metadata-edit-ci | successful-deployment | failed-retried-deployment) ;;
    *)
      printf 'Unknown CI cost category: %s\n' "$category" >&2
      exit 1
      ;;
  esac

  job_rows=$(gh api --paginate \
    "repos/$repository/actions/runs/$run_id/attempts/$attempt/jobs?per_page=100" \
    --jq '.jobs[] | select(.conclusion != "skipped") | [.name, .started_at, .completed_at, ((.completed_at | fromdateiso8601) - (.started_at | fromdateiso8601))] | @tsv')

  while IFS=$'\t' read -r job started completed seconds; do
    if [[ -n "$job" ]]; then
      printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
        "$category" "$run_id" "$attempt" "$job" "$started" "$completed" "$seconds"
    fi
  done <<<"$job_rows"
done <"$manifest" | awk -F '\t' -v pull_request_count="$pull_request_count" '
  BEGIN {
    categories[1] = "code-push-ci"
    categories[2] = "metadata-edit-ci"
    categories[3] = "successful-deployment"
    categories[4] = "failed-retried-deployment"
    category_count = 4
  }
  {
    category = $1
    run_id = $2
    attempt = $3 + 0
    job_key = run_id FS $4 FS $5 FS $6

    if (!(job_key in attempt_by_job) || attempt < attempt_by_job[job_key]) {
      attempt_by_job[job_key] = attempt
      category_by_job[job_key] = category
      seconds_by_job[job_key] = $7
    } else if (attempt == attempt_by_job[job_key] && category != category_by_job[job_key]) {
      printf "Conflicting categories for run %s attempt %s job %s.\n", run_id, attempt, $4 > "/dev/stderr"
      invalid = 1
    }
  }
  END {
    if (invalid) exit 1

    for (job_key in seconds_by_job) {
      category = category_by_job[job_key]
      seconds_by_category[category] += seconds_by_job[job_key]
      total_seconds += seconds_by_job[job_key]
      job_count++
    }

    if (job_count == 0) {
      print "No runnable jobs were returned for the manifest." > "/dev/stderr"
      exit 1
    }

    print "category\trunner_job_minutes\tjob_minutes_per_code_changing_pr"
    for (position = 1; position <= category_count; position++) {
      category = categories[position]
      minutes = seconds_by_category[category] / 60
      printf "%s\t%.1f\t%.1f\n", category, minutes, minutes / pull_request_count
    }
    total_minutes = total_seconds / 60
    printf "total\t%.1f\t%.1f\n", total_minutes, total_minutes / pull_request_count
  }
'
