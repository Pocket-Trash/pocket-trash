# Development Webhook Forwarding

Clerk is the source of truth for usernames. Pocket Trash mirrors `username`
and Clerk's update timestamp in `users` for joins and display.

## Endpoints

| Provider | Production | Development |
| --- | --- | --- |
| Clerk | `https://api.pocket-trash.app/api/v0/webhooks/clerk` | `https://dev-api.pocket-trash.app/api/v0/webhooks/clerk` |
| Linear | `https://api.pocket-trash.app/api/v0/webhooks/linear` | `https://dev-api.pocket-trash.app/api/v0/webhooks/linear` |

Both Clerk endpoints subscribe to `user.created`, `user.updated`, and
`user.deleted`. Every
handler verifies `CLERK_WEBHOOK_SIGNING_SECRET`; duplicate and stale events are
safe. Expected deletions resume an approved erasure request. Unexpected
deletions hide user content and create a `needs_attention` request without
erasing local data. Development forwards the exact signed payload to targets
stored in the `CLERK_WEBHOOK_TARGETS` KV namespace.

Linear uses one workspace with separate production and development webhooks.
Both subscribe only to Issue and Project data changes. Production handles its
events without forwarding. Stable development handles matching records in its
own database, then forwards the exact signed request to preview and local
targets stored in the same KV namespace under `linear-target:` keys. Receivers
acknowledge events for Linear UUIDs that do not exist in their database.

Store `LINEAR_WEBHOOK_SIGNING_SECRET` at `/apps/api` in Infisical. The `prod`
environment uses the production webhook secret. The `dev` and `preview`
environments use the development webhook secret, which is also injected into
local API runs.

## Local development

Set `URL_INITIALS` in repository-root `.env.local` or `.env`, then run:

```sh
pnpm dev:web:webhooks
```

The stable development API must already be deployed so its
`CLERK_WEBHOOK_TARGETS` namespace is available.

Before the feature reaches `main`, run the `Deploy` GitHub Actions workflow
from the feature branch with the `development` target.

The command requires both the Clerk CLI and `cloudflared`. It first reconciles
existing Clerk users, then starts `dev:web`, creates temporary Clerk and
Cloudflare relays, and registers `target:local:<INITIALS>` and
`linear-target:local:<INITIALS>` for 24 hours. Both targets are removed on
normal termination. The local destinations include the initials so only the
matching local API accepts them.
It stops before creating the relay unless the Clerk CLI is linked to the app
and development instance identified by `APP_ID` and `INS_ID` in the Infisical
development `/local/clerk` path.

## Preview development

Add the exact `preview:webhooks` label to a pull request. The preview workflow
reconciles Clerk development users before registering
`target:preview:<pr-number>` and `linear-target:preview:<pr-number>`. Removing
the label or closing the pull request removes both targets. Preview receivers
use the development Linear signing secret.

## Reconciliation

Run `pnpm users:reconcile` through Infisical before enabling a Clerk endpoint
or to repair missed deliveries. It reports only aggregate counts and never
prints Clerk IDs or usernames.
