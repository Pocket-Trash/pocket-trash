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
  - Run `pnpm e2e:local` for focused, non-mutating local browser regressions.
    `validate:pr` also selects this suite for relevant web changes; it needs no
    preview, credentials, or database. See [E2E operations](../e2e-testing.md).
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
  - Run `pnpm security:audit` when adding, updating, or removing dependencies,
    changing the lockfile or audit policy, and before builds or deployments.
    It validates reviewed vulnerability exceptions and fails on unapproved high
    or critical dependency findings. Root `build`, `build:ci`, and `release`
    commands already run it; `validate:pr` does not. Follow
    [release security governance](../release.md#dependency-security) for
    exceptions; do not bypass the audit.
- If code changes touch `packages/logger/**`, also run `pnpm test:logger:axiom`
  when Infisical and Axiom credentials are available. If they are not available,
  report that the live logger test was skipped.
- Documentation-only changes follow the same Changeset, commit, and
  `validate:pr` final workflow; the domain plan skips unrelated code checks.
- If `pnpm lint` or `pnpm format` fail, determine whether the failure was caused by changes made during the current session. If so, fix those issues before finishing.

## Focused checks and audits

Run these commands from the repository root while iterating on the covered area.
They complement the final `pnpm validate:pr` workflow.

| Command | Coverage and when to use it |
| --- | --- |
| `pnpm test:security` | Security audit policy, exception handling, and security glob regressions; use for audit script, policy, or exception changes. This tests the audit implementation; run `pnpm security:audit` separately for current dependency findings. |
| `pnpm test:workflows` | Developer commands, change classification, PR validation, release automation, and deployment workflow regressions. |
| `pnpm test:jsdoc` | Regression tests for the JSDoc checker; use when changing that checker. |
| `pnpm lint:jsdoc` | Enforces JSDoc coverage across tracked source. Included in `pnpm lint`. |
| `pnpm lint:openapi` | Compares API route registrations with the generated OpenAPI document. Included in `pnpm lint`; requires no credentials, database, or deployment. |
| `pnpm typecheck:railway` | Typechecks Railway tooling. Included in `pnpm typecheck`. |
| `pnpm db:validate:chain` / `pnpm db:validate:personal` | Applies migrations to disposable PGlite / compares the selected personal Neon migration history without modifying it. Selected by `validate:pr` for database changes; the personal check requires Infisical and a configured development database. |
| `pnpm bunny:audit` | Read-only Bunny service, usage, and billing inventory for infrastructure investigations. Requires the Infisical `dev` credential at `/local/bunny`; writes `bunny-audit/`. Review endpoint errors in the report, and keep raw JSON out of commits because responses can contain secrets. |

`pnpm test:ci` runs the security, workflow, and JSDoc regression suites above plus
workspace unit tests without Infisical injection. `pnpm test` adds the Infisical
authentication check and uses the packages' local test commands. `validate:pr`
selects `test:ci`, lint, and typecheck for validation-domain changes; the Bunny
inventory is a separate operational audit.

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
