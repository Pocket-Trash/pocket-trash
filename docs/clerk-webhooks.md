# Clerk User Synchronization

Clerk is the source of truth for usernames. Pocket Trash mirrors `username`
and Clerk's update timestamp in `users` for joins and display.

## Endpoints

- Production: `https://api.pocket-trash.app/api/v0/webhooks/clerk`
- Development: `https://dev-api.pocket-trash.app/api/v0/webhooks/clerk`
- Local: `http://localhost:4006/api/v0/webhooks/clerk/<initials>`

Both Clerk endpoints subscribe to `user.created` and `user.updated`. Every
handler verifies `CLERK_WEBHOOK_SIGNING_SECRET`; duplicate and stale events are
safe. Development forwards the exact signed payload to targets stored in the
`CLERK_WEBHOOK_TARGETS` KV namespace.

## Local development

Set `URL_INITIALS` in repository-root `.env.local` or `.env`, then run:

```sh
pnpm dev:web:webhooks
```

The stable development API must already be deployed so its
`CLERK_WEBHOOK_TARGETS` namespace is available.

The command starts `dev:web`, creates a temporary Clerk relay, registers
`target:local:<INITIALS>` for 24 hours, and removes it on normal termination.
It stops before creating the relay unless the Clerk CLI is linked to the app
and development instance identified by `APP_ID` and `INS_ID` in the Infisical
development `/local/clerk` path.

## Preview development

Add the exact `preview:webhooks` label to a pull request. The preview workflow
reconciles Clerk development users before registering
`target:preview:<pr-number>`. Removing the label or closing the pull request
removes the target.

## Reconciliation

Run `pnpm users:reconcile` through Infisical before enabling a Clerk endpoint
or to repair missed deliveries. It reports only aggregate counts and never
prints Clerk IDs or usernames.
