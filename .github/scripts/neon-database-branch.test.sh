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
if [[ "${CURL_SCENARIO:-}" == "database-change" ]]; then
  case "$url" in
    */branches\?*)
      if [[ -f "$CURL_STATE_FILE" ]]; then
        printf '{"branches":[{"id":"br_development","name":"development","current_state":"ready"},{"id":"br_preview","name":"preview","current_state":"ready"},{"id":"br_target","name":"preview-pr-42","current_state":"ready"}]}'
      else
        printf '{"branches":[{"id":"br_development","name":"development","current_state":"ready"},{"id":"br_preview","name":"preview","current_state":"ready"}]}'
      fi
      ;;
    */branches)
      [[ "$method" == "POST" ]]
      touch "$CURL_STATE_FILE"
      printf '{}'
      ;;
    *branch_id=br_target*pooled=true*) printf '{"uri":"postgresql://user@ep-target-pooler.example.test/db"}' ;;
    *branch_id=br_target*pooled=false*) printf '{"uri":"postgresql://user@ep-target.example.test/db"}' ;;
    */branches/br_target*) printf '{}' ;;
    *) exit 1 ;;
  esac
  exit
fi

case "$url" in
  */branches*) printf '{"branches":[{"id":"br_test","name":"development"}]}' ;;
  *pooled=true*) printf '{"uri":"postgresql://user@ep-test-pooler.example.test/db"}' ;;
  *pooled=false*) printf '{"uri":"postgresql://user@ep-test.example.test/db"}' ;;
  *) exit 1 ;;
esac
EOF
chmod +x "$test_dir/curl"

output_file="$test_dir/output"
PATH="$test_dir:$PATH" \
  NEON_API_BASE="https://neon.example.test" \
  NEON_API_KEY="test-key" \
  NEON_PROJECT_ID="test-project" \
  NEON_DATABASE_NAME="test-database" \
  NEON_DATABASE_USER="test-user" \
  BRANCH_NAME="development" \
  GITHUB_OUTPUT="$output_file" \
  bash "$script_dir/neon-database-branch.sh" branch-url > /dev/null

grep -Fx 'database_url=postgresql://user@ep-test-pooler.example.test/db' "$output_file" > /dev/null
grep -Fx 'migration_database_url=postgresql://user@ep-test.example.test/db' "$output_file" > /dev/null

database_change_output_file="$test_dir/database-change-output"
database_change_state_file="$test_dir/database-change-state"
PATH="$test_dir:$PATH" \
  CURL_SCENARIO=database-change \
  CURL_STATE_FILE="$database_change_state_file" \
  NEON_API_BASE="https://neon.example.test" \
  NEON_API_KEY="test-key" \
  NEON_PROJECT_ID="test-project" \
  NEON_DATABASE_NAME="test-database" \
  NEON_DATABASE_USER="test-user" \
  DB_CHANGING=true \
  PR_NUMBER=42 \
  GITHUB_OUTPUT="$database_change_output_file" \
  bash "$script_dir/neon-database-branch.sh" prepare-preview > /dev/null

grep -Fx 'isolated=true' "$database_change_output_file" > /dev/null
grep -Fx 'branch_name=preview-pr-42' "$database_change_output_file" > /dev/null
