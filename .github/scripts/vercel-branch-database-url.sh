#!/usr/bin/env bash

set -euo pipefail

VERCEL_API_BASE="${VERCEL_API_BASE:-https://api.vercel.com}"

source "$(dirname "${BASH_SOURCE[0]}")/ci-log.sh"

trim_whitespace() {
  local value="$1"

  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

require_env() {
  local name="$1"
  local value

  value="$(trim_whitespace "${!name:-}")"
  printf -v "$name" '%s' "$value"

  if [[ -z "${!name:-}" ]]; then
    echo "$name is required." >&2
    exit 1
  fi
}

require_vercel_env() {
  require_env VERCEL_TOKEN
  require_env VERCEL_ORG_ID
  require_env VERCEL_PROJECT_ID
  require_env BRANCH_NAME
}

api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local response_file
  response_file="$(mktemp)"
  local status
  local curl_status

  set +e
  if [[ -n "$body" ]]; then
    status="$(curl --silent --show-error \
      --output "$response_file" \
      --write-out "%{http_code}" \
      --request "$method" \
      --header "Authorization: Bearer ${VERCEL_TOKEN}" \
      --header "content-type: application/json" \
      --data "$body" \
      "${VERCEL_API_BASE}${path}")"
  else
    status="$(curl --silent --show-error \
      --output "$response_file" \
      --write-out "%{http_code}" \
      --request "$method" \
      --header "Authorization: Bearer ${VERCEL_TOKEN}" \
      "${VERCEL_API_BASE}${path}")"
  fi
  curl_status=$?
  set -e
  status="${status:-000}"

  if [[ "$curl_status" -ne 0 || "$status" -lt 200 || "$status" -ge 300 ]]; then
    echo "Vercel API request failed: ${method} ${path} returned HTTP ${status}." >&2
    if [[ -s "$response_file" ]]; then
      echo "Vercel API response body omitted to avoid leaking environment variable values." >&2
    fi
    if [[ "$status" == "401" || "$status" == "403" ]]; then
      echo "Check that VERCEL_TOKEN was created for the Vercel org in VERCEL_ORG_ID and can access VERCEL_PROJECT_ID." >&2
      echo "Current Vercel identifiers: VERCEL_ORG_ID=${VERCEL_ORG_ID}, VERCEL_PROJECT_ID=${VERCEL_PROJECT_ID}." >&2
    fi
    rm -f "$response_file"
    return 22
  fi

  cat "$response_file"
  rm -f "$response_file"
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

team_query_prefix() {
  printf '?teamId=%s' "$(jq -rn --arg value "$VERCEL_ORG_ID" '$value | @uri')"
}

branch_query_value() {
  jq -rn --arg value "$BRANCH_NAME" '$value | @uri'
}

list_branch_env_vars() {
  local branch_query
  branch_query="$(branch_query_value)"

  api GET "/v10/projects/${VERCEL_PROJECT_ID}/env$(team_query_prefix)&target=preview&gitBranch=${branch_query}"
}

delete_existing_env_var() {
  local key="$1"
  local missing_message="$2"
  local removed_message="$3"
  local response
  response="$(list_branch_env_vars)"

  local ids
  ids="$(jq -r --arg branch "$BRANCH_NAME" --arg key "$key" \
    '.envs[]? | select(.key == $key and ((.gitBranch // "") == $branch)) | .id' \
    <<< "$response")"

  if [[ -z "$ids" ]]; then
    write_output removed false
    emit_ci_log info "$missing_message" "$(jq -n \
      --arg branch_name "$BRANCH_NAME" \
      --arg key "$key" \
      '{branchName: $branch_name, key: $key, target: "preview"}')"
    return
  fi

  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    api DELETE "/v9/projects/${VERCEL_PROJECT_ID}/env/${id}$(team_query_prefix)" > /dev/null
  done <<< "$ids"

  write_output removed true
  emit_ci_log info "$removed_message" "$(jq -n \
    --arg branch_name "$BRANCH_NAME" \
    --arg key "$key" \
    --arg ids "$ids" \
    '{
      branchName: $branch_name,
      key: $key,
      target: "preview",
      envVarIds: ($ids | split("\n") | map(select(. != "")))
    }')"
}

delete_existing_database_url() {
  delete_existing_env_var DATABASE_URL \
    "ci.vercel.preview.databaseOverride.missing" \
    "ci.vercel.preview.databaseOverride.removed"
}

set_branch_env_var() {
  local key="$1"
  local value="$2"
  local set_message="$3"
  local missing_message="$4"
  local removed_message="$5"

  printf '::add-mask::%s\n' "$value"
  delete_existing_env_var "$key" "$missing_message" "$removed_message"

  local body
  body="$(jq -n \
    --arg key "$key" \
    --arg value "$value" \
    --arg branch "$BRANCH_NAME" \
    '{key: $key, value: $value, type: "encrypted", target: ["preview"], gitBranch: $branch}')"

  api POST "/v10/projects/${VERCEL_PROJECT_ID}/env$(team_query_prefix)" "$body" > /dev/null
  write_output configured true
  emit_ci_log info "$set_message" "$(jq -n \
    --arg branch_name "$BRANCH_NAME" \
    --arg key "$key" \
    '{branchName: $branch_name, key: $key, target: "preview"}')"
}

set_database_url() {
  require_env DATABASE_URL
  set_branch_env_var DATABASE_URL "$DATABASE_URL" \
    "ci.vercel.preview.databaseOverride.set" \
    "ci.vercel.preview.databaseOverride.missing" \
    "ci.vercel.preview.databaseOverride.removed"
}

delete_existing_image_folder_prefix() {
  delete_existing_env_var IMAGE_FOLDER_PREFIX \
    "ci.vercel.preview.imageFolderPrefix.missing" \
    "ci.vercel.preview.imageFolderPrefix.removed"
}

set_image_folder_prefix() {
  require_env IMAGE_FOLDER_PREFIX
  set_branch_env_var IMAGE_FOLDER_PREFIX "$IMAGE_FOLDER_PREFIX" \
    "ci.vercel.preview.imageFolderPrefix.set" \
    "ci.vercel.preview.imageFolderPrefix.missing" \
    "ci.vercel.preview.imageFolderPrefix.removed"
}

latest_preview_url() {
  local branch_query
  branch_query="$(branch_query_value)"

  set +e
  local response
  response="$(api GET "/v6/deployments$(team_query_prefix)&projectId=${VERCEL_PROJECT_ID}&target=preview&gitSource.ref=${branch_query}&limit=1" 2>/dev/null)"
  local status=$?
  set -e

  if [[ "$status" -ne 0 ]]; then
    write_output web_preview_url ""
    emit_ci_log warn "ci.vercel.preview.latestDeployment.unavailable" "$(jq -n \
      --arg branch_name "$BRANCH_NAME" \
      --arg reason "api_request_failed" \
      '{branchName: $branch_name, reason: $reason}')"
    return
  fi

  local url
  url="$(jq -r '.deployments[0].url // ""' <<< "$response")"

  if [[ -n "$url" ]]; then
    write_output web_preview_url "https://${url}"
    emit_ci_log info "ci.vercel.preview.latestDeployment.resolved" "$(jq -n \
      --arg branch_name "$BRANCH_NAME" \
      --arg url "https://${url}" \
      '{branchName: $branch_name, webPreviewUrl: $url}')"
  else
    write_output web_preview_url ""
    emit_ci_log info "ci.vercel.preview.latestDeployment.unavailable" "$(jq -n \
      --arg branch_name "$BRANCH_NAME" \
      --arg reason "not_found" \
      '{branchName: $branch_name, reason: $reason}')"
  fi
}

require_vercel_env

case "${1:-}" in
  set)
    set_database_url
    latest_preview_url
    ;;
  remove)
    delete_existing_database_url
    latest_preview_url
    ;;
  set-image-folder-prefix)
    set_image_folder_prefix
    latest_preview_url
    ;;
  remove-image-folder-prefix)
    delete_existing_image_folder_prefix
    latest_preview_url
    ;;
  *)
    echo "Usage: $0 {set|remove|set-image-folder-prefix|remove-image-folder-prefix}" >&2
    exit 1
    ;;
esac
