# GitHub Infisical OIDC

GitHub Actions reads workflow secrets from Infisical at runtime with OIDC. GitHub
repository secrets only bootstrap that connection.

## Infisical Paths

| Path | Purpose |
| --- | --- |
| `tools/github/infisical-connection` | Secrets Sync source for GitHub repository bootstrap secrets. |
| `tools/github/secrets` | Runtime workflow values fetched by GitHub Actions through OIDC. |

Configure `tools/github/infisical-connection` in Infisical production and sync
these values to GitHub repository secrets:

- `INFISICAL_GITHUB_IDENTITY_ID`
- `INFISICAL_PROJECT_SLUG`
- optional `INFISICAL_DOMAIN`
- optional `INFISICAL_OIDC_AUDIENCE`

Store workflow runtime values in `tools/github/secrets` with normalized names in
each Infisical environment. Use `preview` for pull request, cleanup, refresh,
logger, and Discord jobs. Use `prod` for release and manual main deploy jobs.

| Value | Preview | Prod |
| --- | --- | --- |
| `AXIOM_DATASET` | Required | Required |
| `AXIOM_EDGE_DOMAIN` | Optional | Optional |
| `AXIOM_TOKEN` | Required | Required |
| `BUNNY_STORAGE_ACCESS_KEY` | Required | - |
| `BUNNY_STORAGE_ENDPOINT` | Required | - |
| `BUNNY_STORAGE_ZONE_NAME` | Required | - |
| `DISCORD_GITHUB_WEBHOOK_URL` | Required | - |
| `IMAGE_CDN_BASE_URL` | Required | - |
| `LOG_PROXY_CLIENT_KEY` | Required | - |
| `NEON_API_KEY` | Required | Required |
| `NEON_DATABASE_NAME` | Required | Required |
| `NEON_DATABASE_USER` | Required | Required |
| `NEON_PROJECT_ID` | Required | Required |
| `POCKET_TRASH_DB_PREVIEW_APP_CLIENT_ID` | Required | - |
| `POCKET_TRASH_DB_PREVIEW_APP_PRIVATE_KEY` | Required | - |
| `RAILWAY_API_TOKEN` | Required | Required |
| `RAILWAY_PROJECT_ID` | Required | Required |
| `VERCEL_PROJECT_ID` | Required | Required |
| `VERCEL_ORG_ID` | Required | Required |
| `VERCEL_TOKEN` | Required | Required |

## Machine Identity

Create one Infisical machine identity with GitHub OIDC auth for
`Pocket-Trash/pocket-trash`. Grant it read access to `tools/github/secrets` in
the `preview` and `prod` environments.

Restrict the OIDC subject to the contexts this repo uses:

- `repo:Pocket-Trash/pocket-trash:pull_request`
- `repo:Pocket-Trash/pocket-trash:ref:refs/heads/main`
- `repo:Pocket-Trash/pocket-trash:ref:refs/tags/v*`

Use `https://github.com/Pocket-Trash` as the audience unless
`INFISICAL_OIDC_AUDIENCE` is synced to GitHub.

## GitHub Cleanup

Before opening the PR, confirm both Infisical paths are populated and the
bootstrap sync has run. Then delete legacy provider secrets from GitHub so
workflow failures expose missing Infisical values immediately.

Keep only:

- `INFISICAL_GITHUB_IDENTITY_ID`
- `INFISICAL_PROJECT_SLUG`
- optional `INFISICAL_DOMAIN`
- optional `INFISICAL_OIDC_AUDIENCE`
