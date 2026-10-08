#!/usr/bin/env bash

set -euo pipefail

changed_files="$(git diff --name-only "$BASE_SHA...$HEAD_SHA")"
database=false

if grep -Eq '^(packages/database/src/schema/|packages/database/drizzle/|packages/database/seed-data/|packages/database/drizzle\.config\.ts$|packages/database/scripts/seed\.ts$)' <<< "$changed_files"; then
  database=true
fi

echo "database_content_changed=$database" >> "$GITHUB_OUTPUT"
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
    databaseContentChanged: $database,
    changedFiles: ($changed_files | split("\n") | map(select(. != "")))
  }')"
