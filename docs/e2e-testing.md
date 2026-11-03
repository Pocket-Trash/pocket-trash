# End-to-End Testing

Pocket Trash runs Chromium Playwright smoke tests against deployed Vercel previews
and mutation tests against the local app/API and disposable Postgres in CI.
Both suites use Clerk development users and one worker in CI.

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
fixtures. CI runs mutation fixtures separately against disposable local infrastructure.

## CI

The Deploy workflow keeps deployed smoke tests separate from mutation tests.
The Mutation E2E job depends only on change classification, so unavailable preview
capacity or a failed preview deployment cannot skip required write coverage.
The `test:e2e` label forces both suites without requesting a Neon branch.

Mutation tests start the real Vite app, local Wrangler API, Postgres 17, and a
restricted WebSocket proxy using `scripts/e2e-mutations.sh`. The proxy retains
the application Neon driver's transaction behavior. CI applies the complete
migration chain, seeds catalog lookups, and mirrors the configured Clerk test
users into the disposable database. It does not change Clerk users or roles.
The database and proxy are removed on success, failure, or termination. Fixture
cleanup removes created storage objects; PR-close cleanup remains the fallback
for canceled runs. Local tests use a per-run folder below the PR's guarded Bunny prefixes,
so retries and deployed previews cannot share mutable objects.

The local mutation guard accepts only `http://localhost:4005`, the API at
`http://127.0.0.1:4006`, and the `pocket_trash_e2e` database through the proxy at
`127.0.0.1:54330`. Playwright starts fresh servers rather than reusing existing
processes. Both local and deployed mutation guards require development Clerk
keys and the current PR's image/resource prefixes. Existing deployed-target
verification still checks Vercel and Neon ownership if that mode is used.

For schema/seed changes, previews still use `preview-pr-<number>`. Add the
`preview:isolated` label to request the same isolation for manual write testing.
The `preview-db` label reports that preview requirement; it no longer reports
CI mutation-test selection. Directory-only and editor changes avoid mutation
fixtures; shared files containing write actions retain their coverage.

To reproduce a mutation run with preview web credentials injected, build workspace
dependencies, install Playwright Chromium, and run:

```sh
E2E_PR_NUMBER=<pr-number> bash scripts/e2e-mutations.sh
```

Pass specific `e2e/*.spec.ts` paths to run a subset. Docker Compose and free ports
4005, 4006, 54329, and 54330 are required. Use the dedicated test accounts; the
collection fixtures clear their collections in the disposable database.

Local mutation tests cover database persistence and the local Workers runtime.
They do not verify deployed Vercel/Cloudflare routing, protection, or environment
bindings. Deployed read-only smoke tests retain that integration coverage.

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
