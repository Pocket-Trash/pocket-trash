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

## Local smoke tests

Install Chromium once:

```sh
pnpm --filter @app/web exec playwright install chromium
```

Run the smoke suite against a Vercel preview:

```sh
E2E_BASE_URL=https://example.vercel.app pnpm --filter @app/web test:e2e
```

The local command reads Clerk and test-user values from the web Infisical path.
Mutation fixtures stay disabled unless `E2E_RUN_MUTATIONS=true`.

## CI

For database-changing PRs, the Deploy workflow creates or reuses
`preview-pr-<number>`, configures the matching Vercel database override, and
assigns both Bunny prefixes before it runs Playwright. Other PRs use the shared
preview database and run only the read-only smoke suite. The mutation fixture
runs only after Neon reports an isolated branch.

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
