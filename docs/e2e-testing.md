# End-to-End Testing

Pocket Trash runs Chromium Playwright tests from `apps/web/e2e` against a
deployed Vercel preview. The suite uses Clerk development users and keeps one
worker in CI.

## Test users

Store these values in the Infisical `preview` environment under `/apps/web`:

| Variable | Value |
| --- | --- |
| `E2E_CLERK_REGULAR_USER_EMAIL` | Email for a development user with the `user` role. |
| `E2E_CLERK_REGULAR_USER_ID` | Clerk user ID for the regular user. |
| `E2E_CLERK_EDITOR_USER_EMAIL` | Email for a development user with the `editor` role. |
| `E2E_CLERK_ADMIN_USER_EMAIL` | Email for a development user with the `admin` role. |
| `E2E_CLERK_DISPOSABLE_USER_EMAIL` | Email for a development user reserved for erasure tests. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel Protection Bypass for Automation secret. |

The same path must contain development `CLERK_PUBLISHABLE_KEY` and
`CLERK_SECRET_KEY` values. Clerk keys must start with `pk_test_` and `sk_test_`.
The suite signs each test into a fresh browser context and does not save shared
authentication state.

## Local non-mutating regressions

Run deterministic browser regressions against the current worktree:

```sh
pnpm e2e:local
```

Playwright starts a purpose-built local Vite app, waits for it, and always
stops it after the suite. The harness uses the production router, search-param
helpers, and responsive pagination component with in-memory fixtures. It does
not load Infisical, Clerk test users, a database, a deployed preview, or any
mutation-tagged test.

The shared change classifier selects this suite for local web-regression
domains during `pnpm validate:pr`. Deployed-preview smoke tests and guarded
mutation coverage remain separate after a push.

## Deployed smoke tests

Install Chromium once:

```sh
pnpm --filter @app/web exec playwright install chromium
```

Run the smoke suite against a Vercel preview:

```sh
E2E_BASE_URL=https://example.vercel.app pnpm e2e
```

The root command delegates to the web package's safe E2E suite. It reads Clerk
and test-user values from the web Infisical path and always excludes mutation
fixtures. Run mutation tests only through CI against isolated `preview-pr-*`
resources.

## CI

The Deploy workflow runs only for preview-relevant changes. Safe E2E runs for
web, API, and shared-service changes. Mutation-relevant changes create or reuse
`preview-pr-<number>`, configure the matching Vercel database override, and
assign both Bunny prefixes before Playwright starts. Database migrations are
one reason for mutation isolation, not a requirement for it.

The persistent `test:e2e` pull-request label forces both suites and isolated
resources for the current head and later commits until the label is removed.
Playwright runs in a separate E2E job after preview deployment, so rerunning a
failed E2E job reuses the successful preview deployment.

Before any mutation, the guard verifies these exact boundaries:

- The Vercel deployment API reports that the exact target URL is a preview.
- The Neon API reports that the `DATABASE_URL` host belongs to the exact PR
  branch.
- Clerk keys are development keys.
- `preview-pr-<number>`, `images/preview/pr-<number>`, and
  `resources/preview/pr-<number>` for the current pull request.

The fixtures create uniquely named catalog lookups, selectable finishes,
products, optional private collections, collection items, and one text object.
The collection mutation suites clear the dedicated regular user's collections,
then cover creation, editing, canonical-name rejection, selection, duplicate
warnings, linked-item moves, archiving, and permanent deletion through the
public UI. Cleanup removes every created row and object before the test exits.
The PR-close workflow removes the full Neon branch and Bunny prefixes if a
failed or canceled run leaves data behind.

Playwright keeps screenshots on failure. Anonymous tests keep traces only when
no Vercel bypass credential is present; authenticated, mutation, and protected
preview tests disable traces because traces record network traffic. CI uploads
the HTML report only when a test fails.
