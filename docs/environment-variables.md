# Environment Variable Placement

Variable names, meanings, validation, and defaults are defined beside the code
that consumes them:

- [Web server environment](../apps/web/src/env/server.schema.ts)
- [Web browser environment](../apps/web/src/env/client.schema.ts)
- [API Worker bindings](../apps/api/src/app.ts)
- [Scraper environment](../apps/scraper/src/env.schema.ts)
- [Database package environment](../packages/database/src/env.schema.ts)
- [Web build-time aliases](../apps/web/vite.config.ts)

This document covers only where values live and constraints that cross runtime
boundaries.

## Runtime Ownership

Pocket Trash runs the web application on Vercel, the API on Cloudflare Workers,
and the scraper on Railway.

| Infisical path | Owner and destination |
| --- | --- |
| `/apps/web` | Web development, builds, tests, and database commands; deploy workflows copy required values to Vercel |
| `/apps/api` | Local API development and Cloudflare Worker deployment |
| `/apps/scraper` | Local scraper commands and Railway services |
| `/local/database` | Optional developer-specific database URLs |
| `/tools/package-manager` | Local package installation credentials |
| `/tools/logger-axiom-test` | Local live Axiom integration test |
| `/tools/github/logger-live` | Preview Axiom credentials used by Logger Live, plus the management token used by deployment map-field checks |
| `/tools/github/preview-cleanup` | Preview Bunny Storage credentials used by infrastructure cleanup |
| `tools/github/secrets` | GitHub Actions values fetched at runtime through OIDC |
| `tools/github/infisical-connection` | Bootstrap values synchronized into GitHub repository secrets |

Use the same path names in every Infisical environment that needs them. Values
remain environment-specific.

`AXIOM_MANAGEMENT_TOKEN` belongs only in `/tools/logger-axiom-test` and the
preview `/tools/github/logger-live` path. Deploy workflows fetch only that
secret from the logger tooling path to enforce the development, preview, and
production dataset map fields without placing it in an application runtime or
`tools/github/secrets`. Runtime `AXIOM_TOKEN` values remain limited to ingest,
plus query access where the logger live test requires it.

## Cross-Runtime Constraints

### Erasure subject secret

`ERASURE_HMAC_SECRET` must have the same value in `/apps/api` and
`/apps/web` within one environment because both applications create
erasure-subject identifiers. Use a different value in each environment.

Generate a 256-bit value with:

```sh
openssl rand -hex 32
```

Keep it stable until every receipt created with it has expired. Vercel must
receive the matching web value during deployment because a deployed build does
not read `/apps/web` directly.

### Local database override

The `dev` application paths provide the shared development database. To select
a personal Neon branch for local web, API, scraper, and database commands, store
its URL in `/local/database` as `DATABASE_URL_<INITIALS>` and set the
repository-root selector:

```dotenv
URL_INITIALS=RA
```

`.env.local` takes precedence over `.env`. A selector without a matching
Infisical secret fails before a database connection is attempted. See
[Database Operations](./database.md) for the workflow.

Neon connection strings may contain `sslmode=require`. The Infisical runner
promotes that value to `sslmode=verify-full` after selecting the final URL and
preserves `channel_binding=require` and all other connection details. Do not
add `uselibpqcompat=true`; that opts into weaker libpq `require` semantics.

### Web build values

Browser-visible values must reach Vercel at build time. Shared server values
are copied to their `VITE_` aliases only by
[`applyWebClientEnvAliases`](../apps/web/vite.config.ts); do not expose other
server secrets to the browser bundle.

Store `BUNNY_ASSET_FOLDER_PREFIX` directly in `/apps/web`. The build copies it
to the browser-facing `VITE_ASSET_FOLDER_PREFIX` alias.

### Font Awesome package token

`FONTAWESOME_PACKAGE_TOKEN` authenticates package installation and does not
belong to an application environment schema. Store it in these locations:

| Infisical path | Environment | Consumer |
| --- | --- | --- |
| `/tools/package-manager` | `dev` | Local pnpm installs |
| `tools/github/secrets` | `preview` and `prod` | GitHub Actions and Railway installs |
| `/apps/web` | `preview` | Vercel Git-based Preview installs |

`scripts/pnpm-install.sh` writes the token to a permission-restricted temporary
user config, binds it only to `npm.fontawesome.com`, and removes the file when
installation ends. Do not prefix the token with `VITE_` or expose it to browser
code. Vercel Production does not need the token because GitHub builds the
production artifact and deploys it with `vercel deploy --prebuilt`. The Deploy
workflow copies the token from Infisical into the Railway scraper service before
Railway installs the workspace. Keep the preview template initialized with the
same value so a new native PR build can authenticate before its workflow runs.

## Operational Runbooks

- [Complete Erasure](./complete-erasure.md)
- [Database Operations](./database.md)
- [End-to-End Testing](./e2e-testing.md)
- [Development Webhook Forwarding](./clerk-webhooks.md)
- [GitHub Infisical OIDC](./github-infisical.md)
- [Logger Operations](./logger.md)
- [Railway](./railway.md)
