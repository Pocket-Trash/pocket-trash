# Environment Variables

Pocket Trash runs `apps/web` on Vercel, `apps/api` on Cloudflare Workers, and
the scraper on Railway. Browser logs are forwarded to Axiom through the API.

## Local Secret Paths

| Path | Used by |
| --- | --- |
| `/apps/web` | Web dev/build/test, database-backed server code, and local API Worker development. |
| `/apps/scraper` | Scraper cron and queue commands. |
| `/local/database` | Optional developer-specific `DATABASE_URL_<INITIALS>` overrides. |
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
| `IMAGE_FOLDER_PREFIX` | Server | Image folder prefix for preview isolation. |
| `ASSET_FOLDER_PREFIX` | Server/build | Static asset namespace; always `assets`. |
| `RESOURCE_CDN_BASE_URL` | Server | Public Bunny resource delivery origin. |
| `RESOURCE_CDN_TOKEN_KEY` | Secret | Signs short-lived Bunny resource URLs. |
| `RESOURCE_FOLDER_PREFIX` | Server | Resource namespace: `resources/files`, `resources/dev`, `resources/preview`, or `resources/preview/pr-<number>`. |
| `RESOURCE_STORAGE_ACCESS_KEY` | Server | Resource Storage Zone password. |
| `RESOURCE_STORAGE_ENDPOINT` | Server | Regional Bunny Storage API origin. |
| `RESOURCE_STORAGE_ZONE_NAME` | Server | Shared `pocket-trash-storage` Storage Zone name. |
| `RESOURCE_API_BASE_URL` | Build/client | Aliased to `VITE_RESOURCE_API_BASE_URL` for Vite. |
| `VITE_RESOURCE_API_BASE_URL` | Client | API origin used for resource upload sessions. |
| `SITE_URL` | Server | Public site origin when needed. |

## API

| Variable | Scope | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Secret | Neon Postgres connection string. GitHub Actions resolves the deployment-specific branch URL. |
| `CLERK_SECRET_KEY` | Secret | Verifies Clerk bearer tokens. |
| `RESOURCE_CDN_BASE_URL` | Worker | Public Bunny delivery origin. |
| `RESOURCE_FOLDER_PREFIX` | Worker | Resource namespace selected for the deployment. |
| `RESOURCE_STORAGE_ACCESS_KEY` | Secret | Bunny Storage Zone password. |
| `RESOURCE_STORAGE_ENDPOINT` | Worker | Regional Bunny Storage API origin. |
| `RESOURCE_STORAGE_ZONE_NAME` | Worker | Shared `pocket-trash-storage` Storage Zone name. |
| `AXIOM_TOKEN`, `AXIOM_DATASET`, `AXIOM_EDGE_DOMAIN`, `LOG_LEVEL`, `LOGGER` | Worker | Shared logger configuration. |

## Scraper

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. |
| `REDIS_URL` | Queue backend. |
| `SCRAPER_CRON_ENABLED` | Enables scheduled scraping on Railway. |
| `IMAGE_FOLDER_PREFIX` | Complete image namespace such as `images`, `images/dev`, or `images/preview`. |
| `AXIOM_TOKEN`, `AXIOM_DATASET`, `AXIOM_EDGE_DOMAIN`, `LOG_LEVEL`, `LOGGER` | Shared logger configuration. |

## Hosting

GitHub Actions hosting credentials are stored in Infisical. See
[GitHub Infisical OIDC](./github-infisical.md) for the exact paths and
inventory.
