#!/bin/sh

set -eu

case "${1:-}" in
  tools) set -- --filter=pocket-trash.app... ;;
  # API preview orchestration also probes Redis through the queue package.
  api) set -- --filter=pocket-trash.app... --filter=@app/api... --filter=@package/queue... ;;
  scraper|discord-bot) set -- --filter=pocket-trash.app... "--filter=@app/$1..." ;;
  database) set -- --filter=pocket-trash.app... --filter=@package/database... ;;
  full) set -- ;;
  *) echo "Usage: $0 {tools|api|database|scraper|discord-bot|full}" >&2; exit 1 ;;
esac

exec "$(dirname "$0")/pnpm-install.sh" --frozen-lockfile --prefer-offline "$@"
