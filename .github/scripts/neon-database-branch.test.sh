#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT

cat > "$test_dir/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

url="${*: -1}"
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
