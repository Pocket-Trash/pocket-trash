
# System Instructions
- Before changing code, read the [coding standards index](docs/coding-standards.md)
  and every reference relevant to the change.
- Pocket Trash repo skills come from `https://github.com/Pocket-Trash/skills` as the single source of truth for Codex and Claude Code. New worktrees install them automatically. Do not edit local skill copies directly; update the shared repo instead.
- Before changing frontend layouts or UI, read [UI design](docs/coding-standards-references/ui-design.md)
  and [accessibility](docs/coding-standards-references/accessibility.md).
- Follow [localization standards](docs/coding-standards-references/localization.md)
  for user-visible text and [JSDoc standards](docs/coding-standards-references/jsdoc.md)
  for stable named declarations.
- Follow [documentation placement](docs/coding-standards-references/documentation.md)
  for guides, research and accepted decisions.
- Before changing API endpoints, read [API contracts](docs/coding-standards-references/api-contracts.md).

- After implementing features or code changes, run focused checks while iterating.
  Before the final push:
  - Use `$pocket-trash logger` as a separate AI-only audit of logger usage,
    centralized logger messages/values, and forbidden `console.*` calls.
  - Create the required Changeset and commit every generated artifact so the
    worktree is clean.
  - Run `pnpm validate:pr` for a PR targeting `main`, or
    `pnpm validate:pr -- <base-ref>` for a stacked/non-main PR. This replaces
    the separate routine `format`, `test`, `lint`, and `typecheck` sequence.
- Run these additional checks only when the change can affect the covered surface:
  - `validate:pr` runs relevant Storybook tests and builds. Use `pnpm storybook`
    only for manual visual inspection. See [`docs/storybook.md`](docs/storybook.md).
  - After the preview deploys, run `E2E_BASE_URL=<preview-url> pnpm e2e` for
    changes to routes,
    authentication, web/API contracts, Playwright configuration, or important
    user-visible workflows. Skip it for documentation-only changes and code
    that cannot affect a browser workflow. The command excludes mutation tests;
    run those through the CI-local disposable app/API and Postgres environment.
    Add the `test:e2e` PR label when you need to force CI. If preview access or
    credentials are unavailable, report the skipped local check and verify the
    E2E CI result. See [`docs/e2e-testing.md`](docs/e2e-testing.md).
  - For database schema or migration changes, run
    `pnpm --filter @package/database db:check`. `validate:pr` also applies the
    complete chain to disposable PGlite and compares the selected personal
    Neon migration history without modifying it.
  - When adding, updating, or removing dependencies or changing the lockfile,
    run `pnpm security:audit`.
- If code changes touch `packages/logger/**`, also run `pnpm test:logger:axiom`
  when Infisical and Axiom credentials are available. If they are not available,
  report that the live logger test was skipped.
- Documentation-only changes follow the same Changeset, commit, and
  `validate:pr` final workflow; the domain plan skips unrelated code checks.
- If `pnpm lint` or `pnpm format` fail, determine whether the failure was caused by changes made during the current session. If so, fix those issues before finishing.
