#!/bin/sh

set -eu

: "${FONTAWESOME_PACKAGE_TOKEN:?FONTAWESOME_PACKAGE_TOKEN is required}"

umask 077
fontawesome_npmrc="$(mktemp)"
trap 'rm -f "$fontawesome_npmrc"' EXIT HUP INT TERM

printf '%s\n' "//npm.fontawesome.com/:_authToken=$FONTAWESOME_PACKAGE_TOKEN" > "$fontawesome_npmrc"
NPM_CONFIG_USERCONFIG="$fontawesome_npmrc" pnpm install "$@"
