#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT

printf '%s\n' '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  'response_file=""' \
  'body=""' \
  'url=""' \
  'while (($#)); do' \
  '  case "$1" in' \
  '    --output) response_file="$2"; shift 2 ;;' \
  '    --data) body="$2"; shift 2 ;;' \
  '    http*) url="$1"; shift ;;' \
  '    *) shift ;;' \
  '  esac' \
  'done' \
  'if [[ "$url" == *"/v13/deployments?"* ]]; then' \
  '  jq -e '\''(.gitSource | .type == "github" and .ref == "test-branch" and .repoId == 123 and .sha == "abc123") and .meta.githubPrId == "42"'\'' <<< "$body" > /dev/null' \
  '  printf '\''{"id":"dpl_test","readyState":"QUEUED"}'\'' > "$response_file"' \
  'else' \
  '  printf '\''{"id":"dpl_test","readyState":"READY","url":"preview.example.test"}'\'' > "$response_file"' \
  'fi' \
  'printf 200' > "$test_dir/curl"
chmod +x "$test_dir/curl"

output_file="$test_dir/output"
PATH="$test_dir:$PATH" \
  VERCEL_API_BASE="https://vercel.example.test" \
  VERCEL_TOKEN="test-token" \
  VERCEL_ORG_ID="team_test" \
  VERCEL_PROJECT_ID="project_test" \
  BRANCH_NAME="test-branch" \
  COMMIT_SHA="abc123" \
  REPOSITORY_ID="123" \
  PR_NUMBER="42" \
  GITHUB_OUTPUT="$output_file" \
  bash "$script_dir/vercel-branch-database-url.sh" deploy-preview > /dev/null

grep -Fx 'deployment_id=dpl_test' "$output_file" > /dev/null
grep -Fx 'web_preview_url=https://preview.example.test' "$output_file" > /dev/null
