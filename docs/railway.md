# Railway

Railway hosts the scheduled scraper service and its Redis queue. Postgres remains
the durable source of truth.

The deployment contract lives in [`railway.json`](../railway.json), and the
preview and production handoff lives in the
[`Deploy` workflow](../.github/workflows/deploy.yml). Scraper commands,
configuration defaults, sources, queues, and job identifiers belong in
[`apps/scraper/src`](../apps/scraper/src).

## Provisioning

Create these resources in the Pocket Trash Railway project:

| Resource | Railway name | Configuration |
| --- | --- | --- |
| Scraper cron service | `pocket-trash` in production; `pocket-trash (preview)` in previews | Repository root with `/railway.json` as the config path |
| Redis | `scraper-queue` | Railway Redis template |

Railway may detect other deployable workspace apps during repository import.
Skip them: this project deploys only `apps/scraper`.

For the production scraper service:

- Disable Railway's native GitHub auto-deploy. The tag-triggered `Deploy`
  workflow owns production releases.
- Do not configure a healthcheck. A cron deployment must run its command to
  completion and exit.

For the preview scraper service:

- Keep native GitHub auto-deploy enabled.
- Enable **Wait for CI** so the workflow can prepare its database and Redis
  variables before Railway builds the commit.
- Do not add a scraper `railway service redeploy --from-source` workflow step
  while native auto-deploy is enabled; that would create two builds per push.

The root [`.railwayignore`](../.railwayignore) keeps CLI uploads below Railway's
source-upload limit. Update it when the scraper gains a workspace dependency.

## Cron operation

[`railway.json`](../railway.json) owns the build command, start command, hourly
schedule, and no-restart policy. Railway cron services must exit after each
run. If a run is still active when the next schedule is due, Railway skips the
new run.

Railway config-as-code values do not populate every Settings form. Verify the
effective cron schedule in the deployment details; if operators also want the
form populated, set it to the same value as `deploy.cronSchedule`.

Preview runs are gated by `SCRAPER_CRON_ENABLED`. The deploy workflow enables
them only for database-changing PRs with an isolated Neon branch; other previews
share the preview database and keep cron disabled.

The cron task ordering and failure behavior are documented beside
[`runRailwayCronJob`](../apps/scraper/src/cron.ts). Runtime inputs and their
validated defaults are documented beside
[`createScraperJobEnv`](../apps/scraper/src/env.schema.ts).

## Redis

Provision Redis in Railway; the scraper must not provision it at runtime. Set
`REDIS_URL` on the scraper as a Railway service reference:

```dotenv
REDIS_URL=${{scraper-queue.REDIS_PUBLIC_URL}}
```

Use the actual Redis service name if it differs. Keep this reference in Railway
rather than copying a Railway URL into Infisical. Redis is a queue, not durable
history; losing it must not delete the persisted scraper state in Postgres.

Secret ownership and non-Railway environment placement are documented in
[environment-variables.md](./environment-variables.md). Bunny provisioning and
preview namespaces are documented in [image-cdn.md](./image-cdn.md).

## Production deploys

Production scraper deploys are downstream of the release workflow's database
migrations. The workflow:

1. Applies committed migrations to the production Neon branch.
2. Deploys and smoke-tests the production API.
3. Stages Railway production metadata with `--skip-deploys`.
4. Uploads the checked-out release source to Railway.
5. Waits for the Railway CLI deployment command to succeed.

Do not move Drizzle migrations into the Railway build, pre-deploy, start, or
cron command. That could run scraper code before the production schema is ready.

## Preview database and Redis handoff

Each preview uses the Railway environment
`pocket-trash-pr-<pull-request-number>`. Before Railway's native scraper deploy,
the workflow:

1. Selects the isolated `preview-pr-<number>` Neon branch for database-changing
   PRs, or the shared `preview` branch otherwise.
2. Stages the selected `DATABASE_URL`, Bunny image prefix, cron flag, deployment
   metadata, and the Redis service reference on `pocket-trash (preview)` with
   `--skip-deploys`.
3. Redeploys `scraper-queue` from its configured image source so Redis is online.

Only the external Neon URL is copied into Railway. Keep `REDIS_URL` as the
Railway service reference so it resolves inside the preview environment.

## Failure and rollback

- If a preview deploy fails, fix the workflow or configuration and rerun it;
  do not bypass the variable handoff with a manual scraper deployment.
- If a production scraper deploy fails after migrations, leave the failed
  deployment stopped and ship a forward fix. Do not roll back production
  migrations.
- Redeploy a prior scraper release only when its code is compatible with the
  current production schema. Otherwise disable the cron service until the
  forward fix is deployed.
- Before re-enabling cron, confirm `DATABASE_URL` and `REDIS_URL` resolve in the
  target Railway environment and inspect the failed deployment logs.
