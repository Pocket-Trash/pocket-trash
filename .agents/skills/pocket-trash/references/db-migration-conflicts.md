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

Use this workflow to preserve intended schema changes while replacing stale
generated Drizzle artifacts with a clean migration from current mainline
history.

## Workflow

1. Inspect branch state:
   - Run `git status --short`.
   - Review conflicts under `packages/database/drizzle/**`, especially
     `packages/database/drizzle/meta/_journal.json`.
   - Review source schema changes under `packages/database/src/schema/**`.
2. Preserve intent:
   - Keep TypeScript schema source changes that represent the developer's
     intended schema.
   - Inspect conflicted SQL files for hand-written SQL or data migration logic
     before deleting generated files.
   - If hand-written SQL exists, save the relevant statements in notes before
     regenerating.
3. Reset generated migration artifacts to mainline:
   - Remove stale generated SQL files and snapshot files from the current branch
     only after preserving any custom SQL.
   - Restore `packages/database/drizzle/meta/_journal.json` to the current
     mainline version.
   - Do not discard source schema changes in `packages/database/src/schema/**`.
4. Regenerate:
   - Run `pnpm db:generate`.
   - Reapply preserved hand-written SQL to the newly generated migration if
     needed.
5. Validate:
   - Run
     `pnpm --filter @package/database exec drizzle-kit check --config=drizzle.config.ts`.
   - Run the repo validation commands requested by `AGENTS.md` before finishing
     if code changed.
6. Report:
   - List removed stale generated artifacts.
   - List regenerated migration files.
   - Note any hand-written SQL carried forward.
   - Note validation commands and results.

## Guardrails

- Do not delete or rewrite schema source files to make migration conflicts
  disappear.
- Do not run migrations against production while resolving conflicts.
- Do not silently drop custom SQL/data migration intent from stale generated
  migration files.
- If the branch has unresolved non-database conflicts, report them separately
  and avoid broad conflict cleanup outside `packages/database`.
