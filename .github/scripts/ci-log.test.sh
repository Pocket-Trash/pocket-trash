#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/ci-log.sh"

export GITHUB_ACTIONS=true
export GITHUB_WORKFLOW="Deploy"
export GITHUB_RUN_ID="123"
export GITHUB_HEAD_REF="feature/test"
export GITHUB_SHA="abc123"
export CI_JOB_NAME="Preview"
export PR_NUMBER="42"
unset AXIOM_TOKEN
unset AXIOM_DATASET

event="$(emit_ci_log info "ci.database.preview.branch.created" "$(jq -n \
  --arg branch_name "preview-pr-42" \
  --arg branch_id "br_test" \
  --arg database_url "postgres://user:password@example.com/db" \
  '{branchName: $branch_name, branchId: $branch_id, databaseUrl: $database_url}')")"

jq -e '
  (keys | sort) == ["app", "attributes", "environment", "level", "message", "timestamp"] and
  .app == "ci" and
  .environment == "github-actions" and
  .level == "info" and
  .message == "ci.database.preview.branch.created" and
  .attributes.workflowName == "Deploy" and
  .attributes.runId == "123" and
  .attributes.jobName == "Preview" and
  .attributes.pullRequestNumber == "42" and
  .attributes.gitBranch == "feature/test" and
  .attributes.commitSha == "abc123" and
  .attributes.branchName == "preview-pr-42" and
  .attributes.branchId == "br_test" and
  .attributes.databaseUrl == "[REDACTED]"
' <<< "$event" > /dev/null
