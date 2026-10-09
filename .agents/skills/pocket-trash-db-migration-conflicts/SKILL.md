---
name: pocket-trash-db-migration-conflicts
description: Resolve Pocket Trash Drizzle migration history conflicts.
---

# DB Migration Conflicts

This workflow is only intended for the `Pocket-Trash/pocket-trash` repo. Before
using it, confirm the current repo with `git remote get-url origin`. If that
does not identify `Pocket-Trash/pocket-trash`, inspect the root `package.json`;
treat it as Pocket Trash only when the package name is `pocket-trash.app`.

If the current repo is not Pocket Trash, stop before running commands or making
changes. Tell the user this database migration conflict workflow is only
supposed to be used in the Pocket Trash repo, name the repo you detected when
possible, and ask whether they truly want to continue even though it might not
work.

Use this workflow for the repository's Drizzle v1 timestamp-folder history.
Compatible independently generated migrations can coexist without regeneration.
If the checkout still uses numbered SQL and `meta/_journal.json`, stop: this
workflow requires the fresh-baseline upgrade. Do not convert snapshots or mix
both history formats to resolve a conflict.

## Workflow

1. Inspect branch state:
   - Run `git status --short`.
   - Review complete folders under `packages/database/drizzle/**`, containing
     `migration.sql` and `snapshot.json`.
   - Review source schema changes under `packages/database/src/schema/**`.
   - Identify current mainline and distinguish its artifacts from artifacts
     introduced by this branch. Preserve unrelated worktree changes.
2. Preserve intent:
   - Keep TypeScript schema source changes that represent the developer's
     intended schema.
   - Inspect `migration.sql` for custom SQL or data migration logic before
     deleting generated files.
   - If hand-written SQL exists, save the relevant statements in notes before
     regenerating.
3. Check coexistence first:
   - Resolve source conflicts and integrate current mainline through the normal
     repository workflow. Retain both complete sibling migration folders.
   - Run `pnpm --filter @package/database db:check`.
   - If changes commute and replay passes, keep both histories unchanged. There
     is no shared journal to restore and no need to renumber folders.
4. Regenerate only a confirmed incompatible, never-applied branch migration:
   - Establish whether either conflicting migration has been applied to any
     adopting database. Inspect migration names and hashes read-only; do not
     infer this from timestamps or the absence of a production deployment.
   - If applied status is unknown or either conflicting migration is applied,
     stop and ask for a coordinated corrective-migration plan. Do not rewrite
     files or ledger rows. This workflow does not authorize a database reset.
   - Preserve current mainline artifacts and remove only this branch's confirmed
     never-applied conflicting folders, after saving their custom SQL intent.
   - Regenerate from current mainline with `pnpm db:generate`, keeping the
     intended TypeScript schema changes. Carry reviewed custom SQL into a custom
     migration after its dependencies, not into generated snapshots.
   - Generate against the unchanged schema again and require no unexplained DDL.
5. Validate:
   - Run `pnpm --filter @package/database db:check` and
     `pnpm db:validate:chain`.
   - Run the repo validation commands requested by `AGENTS.md` before finishing
     if code changed.
6. Report:
   - List retained compatible folders and removed never-applied conflicts.
   - List regenerated migration files.
   - Note any hand-written SQL carried forward.
   - Note validation commands and results.

## Guardrails

- Do not delete or rewrite schema source files to make migration conflicts
  disappear.
- Do not run migrations against production while resolving conflicts.
- Never rewrite applied SQL, generated snapshots, or database ledger rows.
- Native history is identified by migration names and hashes, not an ordered
  prefix or highest applied timestamp.
- Do not silently drop custom SQL/data migration intent from stale generated
  migration files.
- If the branch has unresolved non-database conflicts, report them separately
  and avoid broad conflict cleanup outside `packages/database`.
