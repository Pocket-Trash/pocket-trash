# Testing and Storybook

- Put `.stories.tsx` beside components; retain `UI/` and `Components/` categories unless scope needs another. Reuse nearby patterns/providers/fixtures/mocks; add global setup/addons only when repeated stories prove the need. Use args/argTypes for inputs, decorators for required wrappers, beforeEach for mocks, play for visible behavior and `storybook/test` utilities.
- Use `withThemePanels` for light/dark visual stories; keep interaction/portal stories single-theme unless testing themes.
- Keep play tests focused on one user-observable behavior. Use `userEvent`, accessible role/label/name queries, visible assertions and document-body queries for portals. Follow [accessibility](accessibility.md); violations fail tests.
- Run focused checks while iterating. Before publishing, include a Changeset, commit generated artifacts, require a clean worktree and run `pnpm validate:pr` against the PR base.
- Follow [Storybook setup](#storybook-setup) and [E2E operations](../e2e-testing.md). Preview smoke tests exclude mutations; mutation E2E uses the guarded CI-local disposable app/API and Postgres environment. Preserve all identity checks and cleanup.

## Validation and publication

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
    only for manual visual inspection. See [Storybook setup](#storybook-setup).
  - After the preview deploys, run `E2E_BASE_URL=<preview-url> pnpm e2e` for
    changes to routes,
    authentication, web/API contracts, Playwright configuration, or important
    user-visible workflows. Skip it for documentation-only changes and code
    that cannot affect a browser workflow. The command excludes mutation tests;
    run those through the CI-local disposable app/API and Postgres environment.
    Add the `test:e2e` PR label when you need to force CI. If preview access or
    credentials are unavailable, report the skipped local check and verify the
    E2E CI result. See [E2E operations](../e2e-testing.md).
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

## Storybook setup

Storybook for Pocket Trash lives in `apps/web`.

Run it from the repo root:

```sh
pnpm storybook
```

The root command starts Storybook without opening a browser. Open
`http://localhost:6006` in whichever browser you want to use.

Or run the app package directly:

```sh
pnpm --filter @app/web storybook
```

The app package command uses Storybook's default browser behavior.

Build and test the Storybook project with:

```sh
pnpm --filter @app/web build-storybook
pnpm --filter @app/web test-storybook
```

Install the browser once per machine if `test-storybook` needs it:

```sh
pnpm --filter @app/web exec playwright install chromium
```
