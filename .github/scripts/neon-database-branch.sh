#!/usr/bin/env bash

set -euo pipefail

NEON_API_BASE="${NEON_API_BASE:-https://console.neon.tech/api/v2}"
MAX_NEON_BRANCHES="${MAX_NEON_BRANCHES:-10}"
NEON_PREVIEW_BRANCH_EXPIRES_DAYS="${NEON_PREVIEW_BRANCH_EXPIRES_DAYS:-14}"
DEVELOPMENT_BRANCH_NAME="${DEVELOPMENT_BRANCH_NAME:-development}"
PREVIEW_BRANCH_NAME="${PREVIEW_BRANCH_NAME:-preview}"
PREVIEW_STATE_MISMATCH_EXIT_CODE=10
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PREVIEW_BRANCH_OWNERSHIP_FILE="${PREVIEW_BRANCH_OWNERSHIP_FILE:-${RUNNER_TEMP:-/tmp}/pocket-trash-preview-branch-${PR_NUMBER:-unknown}.owned}"

source "$(dirname "${BASH_SOURCE[0]}")/ci-log.sh"

require_env() {
  local name="$1"

  if [[ -z "${!name:-}" ]]; then
    echo "$name is required." >&2
    exit 1
  fi
}

require_neon_env() {
  require_env NEON_API_KEY
  require_env NEON_PROJECT_ID
  require_env NEON_DATABASE_NAME
  require_env NEON_DATABASE_USER
}

api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  if [[ -n "$body" ]]; then
    curl --fail --silent --show-error \
      --request "$method" \
      --header "Authorization: Bearer ${NEON_API_KEY}" \
      --header "content-type: application/json" \
      --data "$body" \
      "${NEON_API_BASE}${path}"
  else
    curl --fail --silent --show-error \
      --request "$method" \
      --header "Authorization: Bearer ${NEON_API_KEY}" \
      "${NEON_API_BASE}${path}"
  fi
}

url_encode() {
  jq -rn --arg value "$1" '$value | @uri'
}

write_output() {
  local key="$1"
  local value="$2"

  if [[ -z "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s=%s\n' "$key" "$value"
    return
  fi

  printf '%s=%s\n' "$key" "$value" >> "$GITHUB_OUTPUT"
}

write_multiline_output() {
  local key="$1"
  local value="$2"

  if [[ -z "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s<<EOF\n%s\nEOF\n' "$key" "$value"
    return
  fi

  {
    printf '%s<<EOF\n' "$key"
    printf '%s\n' "$value"
    printf 'EOF\n'
  } >> "$GITHUB_OUTPUT"
}

list_branches() {
  api GET "/projects/${NEON_PROJECT_ID}/branches?limit=10000&sort_by=name&sort_order=asc"
}

branch_id_from_list() {
  local branches_json="$1"
  local branch_name="$2"

  jq -r --arg name "$branch_name" \
    '.branches[] | select(.name == $name) | .id' <<< "$branches_json" | head -n 1
}

branch_parent_id_from_list() {
  local branches_json="$1"
  local branch_name="$2"

  jq -r --arg name "$branch_name" \
    '.branches[] | select(.name == $name) | .parent_id // empty' \
    <<< "$branches_json" | head -n 1
}

run_preview_state() {
  local command="$1"

  if [[ -n "${PREVIEW_STATE_COMMAND:-}" ]]; then
    "$PREVIEW_STATE_COMMAND" "$command"
    return
  fi

  pnpm --dir "$REPO_ROOT/packages/database" exec tsx scripts/preview-state.ts "$command"
}

claim_preview_branch_ownership() {
  : > "$PREVIEW_BRANCH_OWNERSHIP_FILE"
  write_output branch_owned_by_run true
}

release_preview_branch_ownership() {
  rm -f "$PREVIEW_BRANCH_OWNERSHIP_FILE"
}

report_preflight_failure() {
  local failure_step="$1"
  local failure_status="$2"

  emit_ci_log error "ci.database.preview.preflight.failed" "$(jq -n \
    --arg branch_name "$BRANCH_NAME" \
    --arg branch_id "$BRANCH_ID" \
    --arg failure_step "$failure_step" \
    --arg failure_status "$failure_status" \
    '{
      branchName: $branch_name,
      branchId: $branch_id,
      failureStep: $failure_step,
      failureStatus: ($failure_status | tonumber)
    }')"

  set +e
  bash "${BASH_SOURCE[0]}" cleanup-owned-preview
  local cleanup_status=$?
  set -e
  if [[ "$cleanup_status" -ne 0 ]]; then
    emit_ci_log error "ci.database.preview.preflightCleanup.failed" "$(jq -n \
      --arg branch_name "$BRANCH_NAME" \
      --arg branch_id "$BRANCH_ID" \
      --arg cleanup_status "$cleanup_status" \
      '{
        branchName: $branch_name,
        branchId: $branch_id,
        cleanupStatus: ($cleanup_status | tonumber)
      }')"
    echo "Preview preflight failed during ${failure_step}; automatic cleanup also failed. Retry cleanup-preview for preview-pr-${PR_NUMBER}." >&2
  fi

  return "$failure_status"
}

run_preflight_step() {
  local failure_step="$1"
  shift

  set +e
  "$@"
  local failure_status=$?
  set -e
  if [[ "$failure_status" -ne 0 ]]; then
    report_preflight_failure "$failure_step" "$failure_status"
    return "$failure_status"
  fi
}

branch_count_from_list() {
  local branches_json="$1"

  jq -r '.branches | length' <<< "$branches_json"
}

branch_names_from_list() {
  local branches_json="$1"

  jq -r '.branches[].name' <<< "$branches_json"
}

preview_branch_expires_at() {
  if ! [[ "$NEON_PREVIEW_BRANCH_EXPIRES_DAYS" =~ ^[0-9]+$ ]] || [[ "$NEON_PREVIEW_BRANCH_EXPIRES_DAYS" -lt 1 || "$NEON_PREVIEW_BRANCH_EXPIRES_DAYS" -gt 30 ]]; then
    echo "NEON_PREVIEW_BRANCH_EXPIRES_DAYS must be an integer from 1 to 30." >&2
    exit 1
  fi

  if date -u -d "+${NEON_PREVIEW_BRANCH_EXPIRES_DAYS} days" +"%Y-%m-%dT%H:%M:%SZ" > /dev/null 2>&1; then
    date -u -d "+${NEON_PREVIEW_BRANCH_EXPIRES_DAYS} days" +"%Y-%m-%dT%H:%M:%SZ"
    return
  fi

  date -u -v+"${NEON_PREVIEW_BRANCH_EXPIRES_DAYS}"d +"%Y-%m-%dT%H:%M:%SZ"
}

connection_uri() {
  local branch_id="$1"
  local pooled="$2"
  local database_name
  database_name="$(url_encode "$NEON_DATABASE_NAME")"
  local role_name
  role_name="$(url_encode "$NEON_DATABASE_USER")"

  api GET "/projects/${NEON_PROJECT_ID}/connection_uri?branch_id=${branch_id}&database_name=${database_name}&role_name=${role_name}&pooled=${pooled}" |
    jq -r '.uri'
}

mask_and_output_database_urls() {
  local branch_id="$1"
  local database_url
  database_url="$(connection_uri "$branch_id" true)"
  local migration_database_url
  migration_database_url="$(connection_uri "$branch_id" false)"

  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    printf '::add-mask::%s\n' "$database_url"
    printf '::add-mask::%s\n' "$migration_database_url"
  fi
  write_output database_url "$database_url"
  write_output migration_database_url "$migration_database_url"
}

wait_for_branch_ready() {
  local branch_name="$1"
  local attempts="${2:-60}"

  for _ in $(seq 1 "$attempts"); do
    local branches_json
    branches_json="$(list_branches)"

    local state
    state="$(jq -r --arg name "$branch_name" \
      '.branches[] | select(.name == $name) | .current_state // empty' \
      <<< "$branches_json" | head -n 1)"

    if [[ "$state" == "ready" ]]; then
      branch_id_from_list "$branches_json" "$branch_name"
      return
    fi

    sleep 5
  done

  echo "Timed out waiting for Neon branch ${branch_name} to become ready." >&2
  exit 1
}

wait_for_branch_absent() {
  local branch_name="$1"
  local attempts="${2:-60}"

  for _ in $(seq 1 "$attempts"); do
    local branches_json
    branches_json="$(list_branches)"

    local branch_id
    branch_id="$(branch_id_from_list "$branches_json" "$branch_name")"

    if [[ -z "$branch_id" ]]; then
      return
    fi

    sleep 5
  done

  echo "Timed out waiting for Neon branch ${branch_name} to be deleted." >&2
  exit 1
}

delete_branch_if_exists() {
  local branch_name="$1"
  local branches_json="$2"

  local branch_id
  branch_id="$(branch_id_from_list "$branches_json" "$branch_name")"

  if [[ -z "$branch_id" ]]; then
    write_output cleanup_performed false
    emit_ci_log info "ci.database.preview.branchCleanup.skipped" "$(jq -n \
      --arg branch_name "$branch_name" \
      '{branchName: $branch_name, reason: "not_found"}')"
    return
  fi

  api DELETE "/projects/${NEON_PROJECT_ID}/branches/${branch_id}" > /dev/null
  wait_for_branch_absent "$branch_name"
  write_output cleanup_performed true
  emit_ci_log info "ci.database.preview.branch.deleted" "$(jq -n \
    --arg branch_name "$branch_name" \
    --arg branch_id "$branch_id" \
    '{branchName: $branch_name, branchId: $branch_id}')"
}

create_branch_from_parent() {
  local branch_name="$1"
  local parent_branch_id="$2"
  local expires_at="$3"

  local body
  body="$(jq -n \
    --arg name "$branch_name" \
    --arg parent_id "$parent_branch_id" \
    --arg expires_at "$expires_at" \
    '{endpoints: [{type: "read_write"}], branch: {name: $name, parent_id: $parent_id, expires_at: $expires_at}}')"

  if ! api POST "/projects/${NEON_PROJECT_ID}/branches" "$body" > /dev/null; then
    echo "Failed to create Neon branch ${branch_name}." >&2
    return 1
  fi
  wait_for_branch_ready "$branch_name"
}

set_branch_expiration() {
  local branch_name="$1"
  local branch_id="$2"
  local expires_at="$3"

  local body
  body="$(jq -n --arg expires_at "$expires_at" '{branch: {expires_at: $expires_at}}')"

  api PATCH "/projects/${NEON_PROJECT_ID}/branches/${branch_id}" "$body" > /dev/null
  emit_ci_log info "ci.database.preview.branch.expiration.set" "$(jq -n \
    --arg branch_name "$branch_name" \
    --arg branch_id "$branch_id" \
    --arg expires_at "$expires_at" \
    '{branchName: $branch_name, branchId: $branch_id, expiresAt: $expires_at}')"
}

write_branch_metadata() {
  local branch_name="$1"
  local branch_id="$2"
  local parent_branch="${3:-}"

  write_output branch_name "$branch_name"
  write_output branch_id "$branch_id"
  write_output branch_url "https://console.neon.tech/app/projects/${NEON_PROJECT_ID}/branches/${branch_id}"

  if [[ -n "$parent_branch" ]]; then
    write_output parent_branch "$parent_branch"
  fi
}

prepare_preview() {
  require_neon_env
  require_env PR_NUMBER
  require_env ISOLATION_REQUIRED

  if [[ "$ISOLATION_REQUIRED" != "true" && "$ISOLATION_REQUIRED" != "false" ]]; then
    echo "ISOLATION_REQUIRED must be true or false." >&2
    exit 1
  fi

  if ! [[ "$MAX_NEON_BRANCHES" =~ ^[0-9]+$ ]]; then
    echo "MAX_NEON_BRANCHES must be a non-negative integer." >&2
    exit 1
  fi

  local target_branch="preview-pr-${PR_NUMBER}"
  local branches_json
  branches_json="$(list_branches)"

  local branch_count
  branch_count="$(branch_count_from_list "$branches_json")"
  if ! [[ "$branch_count" =~ ^[0-9]+$ ]]; then
    echo "Neon branch count must be a non-negative integer." >&2
    exit 1
  fi
  local branch_names
  branch_names="$(branch_names_from_list "$branches_json")"
  local development_branch_id
  development_branch_id="$(branch_id_from_list "$branches_json" "$DEVELOPMENT_BRANCH_NAME")"
  local preview_branch_id
  preview_branch_id="$(branch_id_from_list "$branches_json" "$PREVIEW_BRANCH_NAME")"
  local target_branch_id
  target_branch_id="$(branch_id_from_list "$branches_json" "$target_branch")"

  if [[ -z "$development_branch_id" ]]; then
    echo "Neon branch ${DEVELOPMENT_BRANCH_NAME} was not found." >&2
    exit 1
  fi

  if [[ -z "$preview_branch_id" ]]; then
    echo "Neon branch ${PREVIEW_BRANCH_NAME} was not found." >&2
    exit 1
  fi

  write_output branch_count "$branch_count"
  write_multiline_output branch_names "$branch_names"
  write_output target_branch "$target_branch"
  write_output development_branch_id "$development_branch_id"
  write_output preview_branch_id "$preview_branch_id"
  write_output branch_created false
  write_output branch_owned_by_run false
  release_preview_branch_ownership

  if [[ "$ISOLATION_REQUIRED" != "true" ]]; then
    emit_ci_log info "ci.database.preview.noPrBranch.needed" "$(jq -n \
      --arg pr_number "$PR_NUMBER" \
      --arg target_branch "$target_branch" \
      '{pullRequestNumber: $pr_number, targetBranch: $target_branch}')"
    delete_branch_if_exists "$target_branch" "$branches_json"
    write_output can_deploy true
    write_output isolated false
    write_branch_metadata "$PREVIEW_BRANCH_NAME" "$preview_branch_id" "$DEVELOPMENT_BRANCH_NAME"
    emit_ci_log info "ci.database.preview.sharedDatabase.selected" "$(jq -n \
      --arg branch_name "$PREVIEW_BRANCH_NAME" \
      --arg branch_id "$preview_branch_id" \
      --arg parent_branch "$DEVELOPMENT_BRANCH_NAME" \
      '{branchName: $branch_name, branchId: $branch_id, parentBranch: $parent_branch}')"
    mask_and_output_database_urls "$preview_branch_id"
    return
  fi

  write_output isolated true
  require_env PREVIEW_BASE_SHA
  local target_branch_expires_at
  target_branch_expires_at="$(preview_branch_expires_at)"
  write_output branch_expires_at "$target_branch_expires_at"

  if [[ -z "$target_branch_id" && "$branch_count" -ge "$MAX_NEON_BRANCHES" ]]; then
    write_output can_deploy false
    write_output blocked_reason branch_limit
    emit_ci_log warn "ci.database.preview.branchLimit.reached" "$(jq -n \
      --arg pr_number "$PR_NUMBER" \
      --arg target_branch "$target_branch" \
      --arg branch_count "$branch_count" \
      --arg max_branches "$MAX_NEON_BRANCHES" \
      --arg branch_names "$branch_names" \
      '{
        pullRequestNumber: $pr_number,
        targetBranch: $target_branch,
        branchCount: ($branch_count | tonumber),
        maxBranches: ($max_branches | tonumber),
        branchNames: ($branch_names | split("\n") | map(select(. != "")))
      }')"
    return
  fi

  if [[ -n "$target_branch_id" ]]; then
    local target_parent_id
    target_parent_id="$(branch_parent_id_from_list "$branches_json" "$target_branch")"
    local stale_reason=""
    if [[ "$target_parent_id" != "$development_branch_id" ]]; then
      stale_reason="base_ancestry"
    else
      local target_migration_database_url
      target_migration_database_url="$(connection_uri "$target_branch_id" false)"
      set +e
      DATABASE_URL="$target_migration_database_url" \
        PREVIEW_BASE_SHA="$PREVIEW_BASE_SHA" \
        run_preview_state check > /dev/null
      local state_status=$?
      set -e
      if [[ "$state_status" -eq "$PREVIEW_STATE_MISMATCH_EXIT_CODE" ]]; then
        stale_reason="migration_or_base"
      elif [[ "$state_status" -ne 0 ]]; then
        echo "Failed to inspect preview state for ${target_branch}." >&2
        exit "$state_status"
      fi
    fi

    if [[ -z "$stale_reason" ]]; then
      set_branch_expiration "$target_branch" "$target_branch_id" "$target_branch_expires_at"
      write_output can_deploy true
      write_output cleanup_performed false
      write_branch_metadata "$target_branch" "$target_branch_id" "$DEVELOPMENT_BRANCH_NAME"
      emit_ci_log info "ci.database.preview.prBranch.reused" "$(jq -n \
        --arg branch_name "$target_branch" \
        --arg branch_id "$target_branch_id" \
        --arg parent_branch "$DEVELOPMENT_BRANCH_NAME" \
        '{branchName: $branch_name, branchId: $branch_id, parentBranch: $parent_branch}')"
      mask_and_output_database_urls "$target_branch_id"
      return
    fi

    emit_ci_log info "ci.database.preview.prBranch.stale" "$(jq -n \
      --arg branch_name "$target_branch" \
      --arg branch_id "$target_branch_id" \
      --arg reason "$stale_reason" \
      '{branchName: $branch_name, branchId: $branch_id, reason: $reason}')"
    claim_preview_branch_ownership
    delete_branch_if_exists "$target_branch" "$branches_json"
    target_branch_id=""
  else
    write_output cleanup_performed false
  fi

  claim_preview_branch_ownership
  local cleanup_target_on_error=true
  cleanup_target_branch_on_error() {
    local exit_code=$?

    if [[ "$cleanup_target_on_error" == "true" ]]; then
      set +e
      cleanup_owned_preview
      set -e
    fi

    exit "$exit_code"
  }
  trap cleanup_target_branch_on_error ERR

  local created_branch_id
  created_branch_id="$(create_branch_from_parent "$target_branch" "$development_branch_id" "$target_branch_expires_at")"
  cleanup_target_on_error=false
  trap - ERR

  write_output can_deploy true
  write_output branch_created true
  write_branch_metadata "$target_branch" "$created_branch_id" "$DEVELOPMENT_BRANCH_NAME"
  emit_ci_log info "ci.database.preview.branch.created" "$(jq -n \
    --arg branch_name "$target_branch" \
    --arg branch_id "$created_branch_id" \
    --arg parent_branch "$DEVELOPMENT_BRANCH_NAME" \
    '{branchName: $branch_name, branchId: $branch_id, parentBranch: $parent_branch}')"
  mask_and_output_database_urls "$created_branch_id"
}

preflight_preview() {
  require_neon_env
  require_env PR_NUMBER
  require_env BRANCH_NAME
  require_env BRANCH_ID
  require_env BUNNY_IMAGE_FOLDER_PREFIX
  require_env BUNNY_RESOURCE_FOLDER_PREFIX
  require_env DATABASE_URL
  require_env PREVIEW_BASE_SHA

  claim_preview_branch_ownership
  run_preflight_step "drizzle-kit migrate" \
    pnpm --dir "$REPO_ROOT/packages/database" exec drizzle-kit migrate --config=drizzle.config.ts || return $?
  run_preflight_step "seed" \
    pnpm --dir "$REPO_ROOT/packages/database" exec tsx scripts/seed.ts || return $?
  run_preflight_step "preview-state mark" run_preview_state mark || return $?
  release_preview_branch_ownership

  emit_ci_log info "ci.database.preview.preflight.passed" "$(jq -n \
    --arg branch_name "$BRANCH_NAME" \
    --arg branch_id "$BRANCH_ID" \
    '{branchName: $branch_name, branchId: $branch_id}')"
}

cleanup_preview() {
  require_neon_env
  require_env PR_NUMBER

  local target_branch="preview-pr-${PR_NUMBER}"
  local branches_json
  branches_json="$(list_branches)"

  delete_branch_if_exists "$target_branch" "$branches_json"
  write_output target_branch "$target_branch"
}

cleanup_owned_preview() {
  require_neon_env
  require_env PR_NUMBER

  if [[ ! -f "$PREVIEW_BRANCH_OWNERSHIP_FILE" ]]; then
    write_output cleanup_performed false
    emit_ci_log info "ci.database.preview.branchCleanup.skipped" "$(jq -n \
      --arg branch_name "preview-pr-${PR_NUMBER}" \
      '{branchName: $branch_name, reason: "not_owned_by_run"}')"
    return
  fi

  cleanup_preview
  release_preview_branch_ownership
}

branch_url() {
  require_neon_env
  require_env BRANCH_NAME

  local branches_json
  branches_json="$(list_branches)"

  local branch_id
  branch_id="$(branch_id_from_list "$branches_json" "$BRANCH_NAME")"

  if [[ -z "$branch_id" ]]; then
    echo "Neon branch ${BRANCH_NAME} was not found." >&2
    exit 1
  fi

  write_branch_metadata "$BRANCH_NAME" "$branch_id"
  local event_message="ci.database.production.database.selected"
  if [[ "$BRANCH_NAME" == "$PREVIEW_BRANCH_NAME" ]]; then
    event_message="ci.database.preview.database.selected"
  fi

  emit_ci_log info "$event_message" "$(jq -n \
    --arg branch_name "$BRANCH_NAME" \
    --arg branch_id "$branch_id" \
    '{branchName: $branch_name, branchId: $branch_id}')"
  mask_and_output_database_urls "$branch_id"
}

refresh_preview() {
  require_neon_env

  local branches_json
  branches_json="$(list_branches)"

  local development_branch_id
  development_branch_id="$(branch_id_from_list "$branches_json" "$DEVELOPMENT_BRANCH_NAME")"
  local preview_branch_id
  preview_branch_id="$(branch_id_from_list "$branches_json" "$PREVIEW_BRANCH_NAME")"

  if [[ -z "$development_branch_id" ]]; then
    echo "Neon branch ${DEVELOPMENT_BRANCH_NAME} was not found." >&2
    exit 1
  fi

  if [[ -z "$preview_branch_id" ]]; then
    echo "Neon branch ${PREVIEW_BRANCH_NAME} was not found." >&2
    exit 1
  fi

  local body
  body="$(jq -n --arg source_branch_id "$development_branch_id" '{source_branch_id: $source_branch_id}')"

  emit_ci_log info "ci.database.preview.reset" "$(jq -n \
    --arg branch_name "$PREVIEW_BRANCH_NAME" \
    --arg branch_id "$preview_branch_id" \
    --arg source_branch "$DEVELOPMENT_BRANCH_NAME" \
    --arg source_branch_id "$development_branch_id" \
    '{
      branchName: $branch_name,
      branchId: $branch_id,
      sourceBranch: $source_branch,
      sourceBranchId: $source_branch_id
    }')"
  api POST "/projects/${NEON_PROJECT_ID}/branches/${preview_branch_id}/restore" "$body" > /dev/null
  wait_for_branch_ready "$PREVIEW_BRANCH_NAME"

  write_branch_metadata "$PREVIEW_BRANCH_NAME" "$preview_branch_id" "$DEVELOPMENT_BRANCH_NAME"
  emit_ci_log info "ci.database.preview.database.selected" "$(jq -n \
    --arg branch_name "$PREVIEW_BRANCH_NAME" \
    --arg branch_id "$preview_branch_id" \
    --arg parent_branch "$DEVELOPMENT_BRANCH_NAME" \
    '{branchName: $branch_name, branchId: $branch_id, parentBranch: $parent_branch}')"
  mask_and_output_database_urls "$preview_branch_id"
}

case "${1:-}" in
  prepare-preview)
    prepare_preview
    ;;
  cleanup-preview)
    cleanup_preview
    ;;
  cleanup-owned-preview)
    cleanup_owned_preview
    ;;
  preflight-preview)
    preflight_preview
    ;;
  branch-url)
    branch_url
    ;;
  refresh-preview)
    refresh_preview
    ;;
  *)
    echo "Usage: $0 {prepare-preview|cleanup-preview|cleanup-owned-preview|preflight-preview|branch-url|refresh-preview}" >&2
    exit 1
    ;;
esac
