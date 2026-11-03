#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

: "${E2E_PR_NUMBER:?E2E_PR_NUMBER is required}"
[[ "$E2E_PR_NUMBER" =~ ^[1-9][0-9]*$ ]] || exit 1
export E2E_TARGET=local E2E_RUN_MUTATIONS=true
export E2E_BASE_URL=http://localhost:4005 API_URL=http://127.0.0.1:4006
export VITE_API_URL="$API_URL"
export DATABASE_URL=postgresql://e2e:e2e@127.0.0.1:54330/pocket_trash_e2e
export E2E_RUN_ID="${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}"
export BUNNY_IMAGE_FOLDER_PREFIX="images/preview/pr-${E2E_PR_NUMBER}/run-${E2E_RUN_ID}"
export BUNNY_RESOURCE_FOLDER_PREFIX="resources/preview/pr-${E2E_PR_NUMBER}/run-${E2E_RUN_ID}"
export VITE_CLERK_PUBLISHABLE_KEY="${CLERK_PUBLISHABLE_KEY:?Development Clerk key is required}"
export VITE_CLERK_SIGN_IN_URL=/sign-in VITE_CLERK_SIGN_UP_URL=/sign-up
export WRANGLER_SEND_METRICS=false
export E2E_API_ENV_FILE
E2E_API_ENV_FILE="$(mktemp)"
compose=(docker compose -p "pocket-trash-e2e-${E2E_PR_NUMBER}-${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}" -f scripts/e2e-postgres.compose.yml)
cleanup() {
  local status=$?
  rm -f "$E2E_API_ENV_FILE"
  "${compose[@]}" down --volumes --remove-orphans || status=$?
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
"${compose[@]}" up -d --wait
DATABASE_URL=postgresql://e2e:e2e@127.0.0.1:54329/pocket_trash_e2e pnpm --filter @package/database db:migrate:direct
pnpm exec tsx apps/web/e2e/prepare-local.ts
if [[ $# -eq 0 ]]; then
  mutation_specs=()
  while IFS= read -r spec; do mutation_specs+=("$spec"); done < <(node --input-type=module -e 'import {allMutationE2eSpecs} from "./scripts/classify-changes.mjs"; process.stdout.write(allMutationE2eSpecs.join("\n") + "\n")')
  set -- "${mutation_specs[@]}"
fi
pnpm --filter @app/web exec playwright test "$@" --grep @mutation
