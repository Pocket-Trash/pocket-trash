#!/usr/bin/env bash

set -euo pipefail

changed_files="$(git diff --name-only "$BASE_SHA...$HEAD_SHA")"
database=false

if grep -Eq '^(packages/database/src/schema/|packages/database/drizzle/|packages/database/drizzle\.config\.ts$)' <<< "$changed_files"; then
  database=true
fi

echo "database=$database" >> "$GITHUB_OUTPUT"
{
  echo "changed_files<<EOF"
  printf '%s\n' "$changed_files"
  echo "EOF"
} >> "$GITHUB_OUTPUT"

source .github/scripts/ci-log.sh
emit_ci_log info "ci.database.preview.changeDetection.completed" "$(jq -n \
  --argjson database "$database" \
  --arg changed_files "$changed_files" \
  '{
    databaseChanged: $database,
    changedFiles: ($changed_files | split("\n") | map(select(. != "")))
  }')"
