#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT

cat > "$test_dir/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

url="${*: -1}"
method=GET
previous=""
for argument in "$@"; do
  if [[ "$previous" == "--request" ]]; then
    method="$argument"
  fi
  previous="$argument"
done
printf '%s %s\n' "$method" "$url" >> "$CURL_LOG_FILE"

case "$url" in
  */branches\?*)
    if [[ -f "$CURL_STATE_FILE" ]]; then
      parent_id=br_development
      if [[ "$CURL_SCENARIO" == "ancestry-change" ]]; then
        parent_id=br_old
      fi
      printf '{"branches":[{"id":"br_development","name":"development","current_state":"ready"},{"id":"br_preview","name":"preview","current_state":"ready"},{"id":"br_target","name":"preview-pr-42","parent_id":"%s","current_state":"ready"}]}' "$parent_id"
    else
      printf '{"branches":[{"id":"br_development","name":"development","current_state":"ready"},{"id":"br_preview","name":"preview","current_state":"ready"}]}'
    fi
    ;;
  */branches)
    [[ "$method" == "POST" ]]
    [[ -f "$PREVIEW_BRANCH_OWNERSHIP_FILE" ]]
    touch "$CURL_STATE_FILE"
    if [[ "$CURL_SCENARIO" == "partial-create-failure" ]]; then
      exit 22
    fi
    printf '{}'
    ;;
  *branch_id=br_target*pooled=true*) printf '{"uri":"postgresql://user@ep-target-pooler.example.test/db"}' ;;
  *branch_id=br_target*pooled=false*) printf '{"uri":"postgresql://user@ep-target.example.test/db"}' ;;
  *branch_id=br_development*pooled=true*) printf '{"uri":"postgresql://user@ep-development-pooler.example.test/db"}' ;;
  *branch_id=br_development*pooled=false*) printf '{"uri":"postgresql://user@ep-development.example.test/db"}' ;;
  *branch_id=br_preview*pooled=true*) printf '{"uri":"postgresql://user@ep-preview-pooler.example.test/db"}' ;;
  *branch_id=br_preview*pooled=false*) printf '{"uri":"postgresql://user@ep-preview.example.test/db"}' ;;
  */branches/br_target)
    if [[ "$method" == "DELETE" ]]; then
      if [[ "$CURL_SCENARIO" == "cleanup-failure" || "$CURL_SCENARIO" == "preflight-cleanup-failure" ]]; then
        exit 22
      fi
      rm -f "$CURL_STATE_FILE"
    fi
    printf '{}'
    ;;
  *) exit 1 ;;
esac
EOF
chmod +x "$test_dir/curl"

cat > "$test_dir/preview-state" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$1" >> "$PREVIEW_STATE_LOG_FILE"
if [[ "${PREVIEW_STATE_SCENARIO:-}" == "migration-change" && "$1" == "check" ]]; then
  exit 10
fi
EOF
chmod +x "$test_dir/preview-state"

cat > "$test_dir/pnpm" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "$PNPM_LOG_FILE"
if [[ "$*" == *"scripts/seed.ts"* ]]; then
  printf 'BUNNY_IMAGE_FOLDER_PREFIX=%s\n' "$BUNNY_IMAGE_FOLDER_PREFIX" >> "$PNPM_LOG_FILE"
  printf 'BUNNY_RESOURCE_FOLDER_PREFIX=%s\n' "$BUNNY_RESOURCE_FOLDER_PREFIX" >> "$PNPM_LOG_FILE"
fi
if [[ "$CURL_SCENARIO" == "preflight-migration-failure" || "$CURL_SCENARIO" == "reused-preflight-failure" ]] && [[ "$*" == *"drizzle-kit migrate"* ]]; then
  exit 41
fi
if [[ "$CURL_SCENARIO" == "preflight-seed-failure" && "$*" == *"scripts/seed.ts"* ]]; then
  exit 42
fi
if [[ "$CURL_SCENARIO" == "preflight-cleanup-failure" && "$*" == *"drizzle-kit migrate"* ]]; then
  exit 43
fi
EOF
chmod +x "$test_dir/pnpm"

run_branch_command() {
  local scenario="$1"
  local command="$2"
  local output_file="$test_dir/${scenario}-output"
  local state_file="$test_dir/${scenario}-state"
  local curl_log_file="$test_dir/${scenario}-curl-log"
  local preview_state_log_file="$test_dir/${scenario}-preview-state-log"
  local pnpm_log_file="$test_dir/${scenario}-pnpm-log"

  : > "$output_file"
  : > "$curl_log_file"
  : > "$preview_state_log_file"
  : > "$pnpm_log_file"
  if [[ "$scenario" == "reuse" || "$scenario" == "reused-preflight-failure" || "$scenario" == "migration-change" || "$scenario" == "ancestry-change" || "$scenario" == "cleanup-failure" || "$scenario" == preflight-* ]]; then
    touch "$state_file"
  fi

  PATH="$test_dir:$PATH" \
    CURL_SCENARIO="$scenario" \
    CURL_STATE_FILE="$state_file" \
    CURL_LOG_FILE="$curl_log_file" \
    PREVIEW_STATE_COMMAND="$test_dir/preview-state" \
    PREVIEW_STATE_SCENARIO="$scenario" \
    PREVIEW_STATE_LOG_FILE="$preview_state_log_file" \
    PNPM_LOG_FILE="$pnpm_log_file" \
    NEON_API_BASE="https://neon.example.test" \
    NEON_API_KEY="test-key" \
    NEON_PROJECT_ID="test-project" \
    NEON_DATABASE_NAME="test-database" \
    NEON_DATABASE_USER="test-user" \
    ISOLATION_REQUIRED=true \
    PREVIEW_BASE_SHA=base-sha \
    BRANCH_NAME=preview-pr-42 \
    BRANCH_ID=br_target \
    DATABASE_URL=postgresql://user@ep-target.example.test/db \
    BUNNY_IMAGE_FOLDER_PREFIX=images/preview/pr-42 \
    BUNNY_RESOURCE_FOLDER_PREFIX=resources/preview/pr-42 \
    PREVIEW_BRANCH_OWNERSHIP_FILE="$test_dir/${scenario}-ownership" \
    PR_NUMBER=42 \
    GITHUB_OUTPUT="$output_file" \
    bash "$script_dir/neon-database-branch.sh" "$command"
}

# Existing branch URL behavior remains covered.
branch_url_output="$test_dir/branch-url-output"
: > "$branch_url_output"
: > "$test_dir/branch-url-curl-log"
PATH="$test_dir:$PATH" \
  CURL_SCENARIO=fresh \
  CURL_STATE_FILE="$test_dir/branch-url-state" \
  CURL_LOG_FILE="$test_dir/branch-url-curl-log" \
  NEON_API_BASE="https://neon.example.test" \
  NEON_API_KEY="test-key" \
  NEON_PROJECT_ID="test-project" \
  NEON_DATABASE_NAME="test-database" \
  NEON_DATABASE_USER="test-user" \
  BRANCH_NAME=development \
  GITHUB_OUTPUT="$branch_url_output" \
  bash "$script_dir/neon-database-branch.sh" branch-url > /dev/null
grep -Fx 'database_url=postgresql://user@ep-development-pooler.example.test/db' "$branch_url_output" > /dev/null
grep -Fx 'migration_database_url=postgresql://user@ep-development.example.test/db' "$branch_url_output" > /dev/null

# A fresh isolated preview is created from development.
run_branch_command fresh prepare-preview > /dev/null
grep -Fx 'can_deploy=true' "$test_dir/fresh-output" > /dev/null
grep -Fx 'branch_created=true' "$test_dir/fresh-output" > /dev/null
grep -F 'POST https://neon.example.test/projects/test-project/branches' "$test_dir/fresh-curl-log" > /dev/null

# A compatible branch is reused and only its expiration is refreshed.
run_branch_command reuse prepare-preview > /dev/null
grep -Fx 'branch_created=false' "$test_dir/reuse-output" > /dev/null
grep -Fx 'check' "$test_dir/reuse-preview-state-log" > /dev/null
grep -F 'PATCH https://neon.example.test/projects/test-project/branches/br_target' "$test_dir/reuse-curl-log" > /dev/null
! grep -F 'DELETE ' "$test_dir/reuse-curl-log" > /dev/null
! grep -F 'POST https://neon.example.test/projects/test-project/branches' "$test_dir/reuse-curl-log" > /dev/null

# Migration and base-ancestry mismatches both replace the stale branch.
run_branch_command migration-change prepare-preview > /dev/null
grep -Fx 'check' "$test_dir/migration-change-preview-state-log" > /dev/null
grep -F 'DELETE https://neon.example.test/projects/test-project/branches/br_target' "$test_dir/migration-change-curl-log" > /dev/null
grep -F 'POST https://neon.example.test/projects/test-project/branches' "$test_dir/migration-change-curl-log" > /dev/null

run_branch_command ancestry-change prepare-preview > /dev/null
[[ ! -s "$test_dir/ancestry-change-preview-state-log" ]]
grep -F 'DELETE https://neon.example.test/projects/test-project/branches/br_target' "$test_dir/ancestry-change-curl-log" > /dev/null
grep -F 'POST https://neon.example.test/projects/test-project/branches' "$test_dir/ancestry-change-curl-log" > /dev/null

# A partially created branch is cleaned up before the command reports failure.
if run_branch_command partial-create-failure prepare-preview > /dev/null 2>&1; then
  echo "Expected partial preview branch creation to fail." >&2
  exit 1
fi
grep -F 'DELETE https://neon.example.test/projects/test-project/branches/br_target' "$test_dir/partial-create-failure-curl-log" > /dev/null
[[ ! -f "$test_dir/partial-create-failure-state" ]]

# Cleanup failures stay visible and leave the branch recoverable for retry.
if run_branch_command cleanup-failure cleanup-preview > /dev/null 2>&1; then
  echo "Expected preview cleanup to fail." >&2
  exit 1
fi
[[ -f "$test_dir/cleanup-failure-state" ]]
grep -F 'DELETE https://neon.example.test/projects/test-project/branches/br_target' "$test_dir/cleanup-failure-curl-log" > /dev/null

# Migration or seed preflight failures stop deployment work and clean up the branch.
if run_branch_command preflight-migration-failure preflight-preview > /dev/null 2>&1; then
  echo "Expected migration preflight to fail." >&2
  exit 1
fi
grep -F 'drizzle-kit migrate' "$test_dir/preflight-migration-failure-pnpm-log" > /dev/null
! grep -F 'scripts/seed.ts' "$test_dir/preflight-migration-failure-pnpm-log" > /dev/null
grep -F 'DELETE https://neon.example.test/projects/test-project/branches/br_target' "$test_dir/preflight-migration-failure-curl-log" > /dev/null
[[ ! -f "$test_dir/preflight-migration-failure-state" ]]

if run_branch_command preflight-seed-failure preflight-preview > /dev/null 2>&1; then
  echo "Expected seed preflight to fail." >&2
  exit 1
fi
grep -F 'drizzle-kit migrate' "$test_dir/preflight-seed-failure-pnpm-log" > /dev/null
grep -F 'scripts/seed.ts' "$test_dir/preflight-seed-failure-pnpm-log" > /dev/null
grep -Fx 'BUNNY_IMAGE_FOLDER_PREFIX=images/preview/pr-42' "$test_dir/preflight-seed-failure-pnpm-log" > /dev/null
grep -Fx 'BUNNY_RESOURCE_FOLDER_PREFIX=resources/preview/pr-42' "$test_dir/preflight-seed-failure-pnpm-log" > /dev/null
! grep -Fx 'mark' "$test_dir/preflight-seed-failure-preview-state-log" > /dev/null
grep -F 'DELETE https://neon.example.test/projects/test-project/branches/br_target' "$test_dir/preflight-seed-failure-curl-log" > /dev/null
[[ ! -f "$test_dir/preflight-seed-failure-state" ]]

# A cleanup failure preserves the branch for an explicit retry and remains visible.
if run_branch_command preflight-cleanup-failure preflight-preview > /dev/null 2>&1; then
  echo "Expected preflight with failed cleanup to fail." >&2
  exit 1
fi
[[ -f "$test_dir/preflight-cleanup-failure-state" ]]
grep -F 'DELETE https://neon.example.test/projects/test-project/branches/br_target' "$test_dir/preflight-cleanup-failure-curl-log" > /dev/null

# Successful preflight migrates, seeds, and records the durable compatibility marker.
run_branch_command preflight-success preflight-preview > /dev/null
grep -F 'drizzle-kit migrate' "$test_dir/preflight-success-pnpm-log" > /dev/null
grep -F 'scripts/seed.ts' "$test_dir/preflight-success-pnpm-log" > /dev/null
grep -Fx 'BUNNY_IMAGE_FOLDER_PREFIX=images/preview/pr-42' "$test_dir/preflight-success-pnpm-log" > /dev/null
grep -Fx 'BUNNY_RESOURCE_FOLDER_PREFIX=resources/preview/pr-42' "$test_dir/preflight-success-pnpm-log" > /dev/null
grep -Fx 'mark' "$test_dir/preflight-success-preview-state-log" > /dev/null
[[ ! -f "$test_dir/preflight-success-ownership" ]]

# A successfully preflighted reused branch survives unrelated later cleanup.
run_branch_command reuse preflight-preview > /dev/null
[[ ! -f "$test_dir/reuse-ownership" ]]
run_branch_command reuse cleanup-owned-preview > /dev/null
! grep -F 'DELETE ' "$test_dir/reuse-curl-log" > /dev/null
[[ -f "$test_dir/reuse-state" ]]

# A reused branch with a failed mutating preflight is deleted, not reused again.
run_branch_command reused-preflight-failure prepare-preview > /dev/null
if run_branch_command reused-preflight-failure preflight-preview > /dev/null 2>&1; then
  echo "Expected reused branch preflight to fail." >&2
  exit 1
fi
grep -F 'DELETE https://neon.example.test/projects/test-project/branches/br_target' "$test_dir/reused-preflight-failure-curl-log" > /dev/null
[[ ! -f "$test_dir/reused-preflight-failure-state" ]]

# The branch limit blocks creation with an actionable output instead of failing.
MAX_NEON_BRANCHES=2 run_branch_command branch-limit prepare-preview > /dev/null
grep -Fx 'can_deploy=false' "$test_dir/branch-limit-output" > /dev/null
grep -Fx 'blocked_reason=branch_limit' "$test_dir/branch-limit-output" > /dev/null
! grep -F 'POST https://neon.example.test/projects/test-project/branches' "$test_dir/branch-limit-curl-log" > /dev/null
