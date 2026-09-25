# Environment Variables

Pocket Trash runs `apps/web` on Vercel, `apps/api` on Cloudflare Workers, and
the scraper on Railway. Browser logs are forwarded to Axiom through the API.

## Local Secret Paths

| Path | Used by |
| --- | --- |
| `/apps/api` | Local API Worker development. |
| `/apps/web` | Web dev/build/test and database migration commands. |
| `/apps/scraper` | Scraper cron and queue commands. |
| `/local/database` | Optional developer-specific `DATABASE_URL_<INITIALS>` values. |
| `/local/bunny` | Bunny account audits. |
| `/tools/logger-axiom-test` | Live logger integration test. |
| `tools/github/secrets` | GitHub Actions runtime values fetched with OIDC. |
| `tools/github/infisical-connection` | GitHub repository bootstrap secrets synced from Infisical. |

## Web

| Variable | Scope | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Server | Postgres connection string. |
| `CLERK_SECRET_KEY` | Server | Clerk server API key. |
| `CLERK_PUBLISHABLE_KEY` | Build/client | Aliased to `VITE_CLERK_PUBLISHABLE_KEY` for Vite. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Client | Clerk browser key. |
| `VITE_CLERK_SIGN_IN_URL` | Client | Sign-in route. |
| `VITE_CLERK_SIGN_UP_URL` | Client | Sign-up route. |
| `AXIOM_TOKEN` | Server | Enables Axiom transport when paired with `AXIOM_DATASET`. |
| `AXIOM_DATASET` | Server | Axiom dataset name. |
| `AXIOM_EDGE_DOMAIN` | Server | Optional Axiom ingest domain. |
| `LOGGER` | Server | `compact` or `verbose` console mode. |
| `LOG_LEVEL` | Server | `trace`, `debug`, `verbose`, `info`, `warn`, `error`, or `fatal`. |
| `LOG_PROXY_CLIENT_KEY` | Server/build | Optional browser log ingestion key. Aliased to `VITE_LOG_PROXY_CLIENT_KEY`. |
| `VITE_LOG_PROXY_CLIENT_KEY` | Client | Optional key sent as `x-log-client-key`. |
| `LOG_DEPLOYMENT_ID` | Server/build | Optional deployment id. Aliased to `VITE_LOG_DEPLOYMENT_ID`. |
| `LOG_DEPLOYMENT_TARGET` | Server/build | Optional deployment target. Aliased to `VITE_LOG_DEPLOYMENT_TARGET`. |
| `BUNNY_IMAGE_FOLDER_PREFIX` | Server | Image folder prefix for preview isolation. |
| `ASSET_FOLDER_PREFIX` | Server/build | Static asset namespace; always `assets`. |
| `BUNNY_CDN_BASE_URL` | Server | Public Bunny resource delivery origin. |
| `BUNNY_CDN_TOKEN_KEY` | Secret | Signs short-lived Bunny resource URLs. |
| `BUNNY_RESOURCE_FOLDER_PREFIX` | Server | Resource namespace: `resources/files`, `resources/dev`, `resources/preview`, or `resources/preview/pr-<number>`. |
| `BUNNY_STORAGE_ACCESS_KEY` | Server | Resource Storage Zone password. |
| `BUNNY_STORAGE_ENDPOINT` | Server | Regional Bunny Storage API origin. |
| `BUNNY_STORAGE_ZONE_NAME` | Server | Shared `pocket-trash-storage` Storage Zone name. |
| `API_URL` | Build/client | Aliased to `VITE_API_URL` for Vite. |
| `VITE_API_URL` | Client | API origin used for resource upload sessions. |
| `SITE_URL` | Server | Public site origin when needed. |

### Local Database Override

The Infisical `dev` value for `DATABASE_URL` is the shared default and points to
the `development` Neon branch. To opt into a personal branch, store its URL in
Infisical `/local/database` as `DATABASE_URL_<INITIALS>`, then add its initials
to `.env.local` or `.env` at the repository root (`.env.local` takes
precedence):

```dotenv
URL_INITIALS=RA
```

The runner promotes the matching injected value (`DATABASE_URL_RA` in this
example) to `DATABASE_URL` for local web, API, scraper, and database commands.
If neither root file contains a selector, the shared Infisical value remains
active. A configured selector with no matching secret fails explicitly. The
runner exposes the normalized `URL_INITIALS` to child processes.

## API

| Variable | Scope | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Secret | Neon Postgres connection string. GitHub Actions resolves the deployment-specific branch URL. |
| `CLERK_SECRET_KEY` | Secret | Verifies Clerk bearer tokens. |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Secret | Verifies Clerk `user.created` and `user.updated` webhooks. |
| `URL_INITIALS` | Local server | Normalized developer selector exposed by the Infisical runner. |
| `BUNNY_CDN_BASE_URL` | Worker | Public Bunny delivery origin. |
| `BUNNY_RESOURCE_FOLDER_PREFIX` | Worker | Resource namespace selected for the deployment. |
| `BUNNY_STORAGE_ACCESS_KEY` | Secret | Bunny Storage Zone password. |
| `BUNNY_STORAGE_ENDPOINT` | Worker | Regional Bunny Storage API origin. |
| `BUNNY_STORAGE_ZONE_NAME` | Worker | Shared `pocket-trash-storage` Storage Zone name. |
| `AXIOM_TOKEN`, `AXIOM_DATASET`, `AXIOM_EDGE_DOMAIN`, `LOG_LEVEL`, `LOGGER` | Worker | Shared logger configuration. |

Production Clerk sends webhooks to
`https://api.pocket-trash.app/api/v0/webhooks/clerk`; development Clerk sends
them to `https://dev-api.pocket-trash.app/api/v0/webhooks/clerk`. Run
`pnpm dev:web:webhooks` to register a 24-hour local relay target. PR previews
receive development events only while labeled `preview:webhooks`.

## Scraper

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. |
| `REDIS_URL` | Queue backend. |
| `SCRAPER_CRON_ENABLED` | Enables scheduled scraping on Railway. |
| `BUNNY_IMAGE_FOLDER_PREFIX` | Required at scraper startup, including dry runs. Complete image namespace: `images`, `images/dev`, `images/preview`, or `images/preview/pr-<number>`. Missing or invalid values fail startup; there is no default. |
| `AXIOM_TOKEN`, `AXIOM_DATASET`, `AXIOM_EDGE_DOMAIN`, `LOG_LEVEL`, `LOGGER` | Shared logger configuration. |

## Hosting

GitHub Actions hosting credentials are stored in Infisical. See
[GitHub Infisical OIDC](./github-infisical.md) for the exact paths and
inventory.
