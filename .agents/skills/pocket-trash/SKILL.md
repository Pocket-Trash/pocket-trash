---
name: pocket-trash
description:
  Pocket Trash router for listing or running repo workflow subcommands.
---

# Pocket Trash

Route Pocket Trash repo workflow requests to the matching subcommand.

If the user invokes `$pocket-trash` or `/pocket-trash` without a subcommand,
list the available subcommands with one-line descriptions and tell them to use
`$pocket-trash <subcommand>`.

## Subcommands

- `commit`: create a Pocket Trash conventional git commit. Read
  [references/commit.md](references/commit.md).
- `pr-create`: create a Pocket Trash GitHub PR. Read
  [references/pr-create.md](references/pr-create.md).
- `pr-update`: update the current branch's Pocket Trash GitHub PR. Read
  [references/pr-update.md](references/pr-update.md).
- `pr-review`: review a Pocket Trash PR and run repo checks. Read
  [references/pr-review.md](references/pr-review.md).
- `implement-linear-ticket`: read and implement a Pocket Trash Linear ticket.
  Read
  [references/implement-linear-ticket.md](references/implement-linear-ticket.md).
- `update-scopes`: suggest Pocket Trash commitlint scope updates. Read
  [references/update-scopes.md](references/update-scopes.md).
- `grill-me`: stress-test a Pocket Trash plan with focused questions. Read
  [references/grill-me.md](references/grill-me.md).
- `logger`: audit Pocket Trash logger and `console.*` usage. Read
  [references/logger.md](references/logger.md).
- `db-migration-conflicts`: resolve Pocket Trash Drizzle migration history
  conflicts. Read
  [references/db-migration-conflicts.md](references/db-migration-conflicts.md).
- `figjam`: read Pocket Trash FigJam/Figma context or prepare bridge payloads.
  Read [references/figjam.md](references/figjam.md).
- `bunny-audit`: audit Pocket Trash Bunny account services, billing, and usage.
  Read [references/bunny-audit.md](references/bunny-audit.md).

Match obvious aliases to the same subcommands, for example `pr`, `pull request`,
`review`, `linear`, `ticket`, `database conflicts`, `migrations`, `figma`,
`figjam`, `bunny`, and `logging`.

## Repo Scope

The `logger`, `db-migration-conflicts`, `figjam`, and `bunny-audit` subcommands
are only intended for the `Pocket-Trash/pocket-trash` repo.

Before using one of those subcommands, check the current repo:

1. Run `git remote get-url origin`.
2. If that does not identify `Pocket-Trash/pocket-trash`, run
   `git rev-parse --show-toplevel` and inspect the root `package.json` if it
   exists.
3. Treat the repo as Pocket Trash only when the origin is
   `Pocket-Trash/pocket-trash` or the root package name is `pocket-trash.app`.

If the current repo is not Pocket Trash, stop before running commands or making
changes. Tell the user the selected subcommand is only supposed to be used in
the Pocket Trash repo, name the repo you detected when possible, and ask whether
they truly want to continue even though it might not work.

If the request does not map to a listed subcommand, explain that `$pocket-trash`
only covers the listed Pocket Trash workflows and ask for the intended
subcommand.
