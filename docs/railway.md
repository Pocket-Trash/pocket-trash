# Railway

Railway hosts the scheduled scraper service and its Redis queue. Postgres remains
the durable source of truth.

The deployment contract lives in [`.railway/railway.ts`](../.railway/railway.ts), and the
preview and production handoff lives in the
[`Deploy` workflow](../.github/workflows/deploy.yml). Scraper commands,
configuration defaults, sources, queues, and job identifiers belong in
[`apps/scraper/src`](../apps/scraper/src).

## Provisioning

Create these resources in the Pocket Trash Railway project:

| Resource | Railway name | Configuration |
| --- | --- | --- |
| Scraper cron service | `pocket-trash` in production; `pocket-trash (preview)` in previews | Project IaC with no legacy Config File setting |
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
source-upload limit. It must include pnpm's referenced patches, the security
audit script and exception manifest, and workspace dependencies of both the root
manifest and scraper. CI and the production workflow run
`node scripts/check-railway-context.mjs` to reject missing, untracked, or excluded
build inputs before upload. When adding build inputs, update the allowlist and
the watched paths in `.railway/railway.ts` together.

## Infrastructure changes

Keep one authoring file, [`.railway/railway.ts`](../.railway/railway.ts), and the
CLI-generated [`.railway/README.md`](../.railway/README.md). The file describes the
existing scraper, Redis queue, and Redis volume. Production uses `pocket-trash`;
the `preview` template uses `pocket-trash (preview)`. Native PR environments
inherit the preview template rather than being planned individually. Secrets,
Redis references, cron enablement, database URLs, and deployment metadata stay
Railway-managed through `preserve()`. Do not inline values, UUIDs, or generated
domains. Existing GitHub sources and preview triggers remain unchanged.

Use the repository's pinned CLI (5.62.1), not an older global installation.
Install the locked SDK with `pnpm install --frozen-lockfile`.

1. Link the intended project and environment with
   `pnpm exec railway link --project "Pocket Trash" --environment production`.
   Use `preview` when reviewing the preview template.
2. Save the full plan outside `.railway/`:
   `pnpm exec railway config plan --out /tmp/railway-plan.json`.
3. Review every change. Reject unexpected resource creation/deletion, variable
   replacement, domain changes, source changes, or volume changes. Plan artifacts
   can contain secrets; never commit or publish them.
4. Apply that exact plan with
   `pnpm exec railway config apply --plan /tmp/railway-plan.json --yes`.
   Changed source or remote state invalidates the artifact; generate and review a
   new plan. Do not add `--confirm-destructive` without reviewing that impact.
5. Read back the settings, observe a scheduled execution, and check drift with
   `pnpm exec railway config plan --detailed-exit-code`. Repeat for `preview`.

The [Railway Configuration workflow](../.github/workflows/railway-config.yml)
checks production and the preview template daily, on demand, and on IaC PRs. It
uses the existing Infisical GitHub secrets and skips fork PRs. Exit code `0` means
no drift; `2` means changes are pending. It never applies configuration. Native
PR environments inherit the preview template; the Deploy workflow still stages
each preview's database, image prefix, cron flag, and logging metadata. Keep
real scraping disabled on shared-database previews.

Railway does not read IaC during a source deployment. Apply reviewed configuration
changes explicitly before deploying code that depends on them. Production source
uploads still use the tag release workflow; applying a plan is not a release.

### Legacy cutover

The production service and preview template must have an empty Railway Config
File setting. Railway's planner rejects a service still owned by legacy Config
as Code. First copy its effective legacy build/start commands, watched paths,
cron, and restart policy into service settings and verify them. Then clear its
legacy Config File setting, review and apply the IaC plan, and verify a scheduled
execution before deleting the legacy file. Do not overwrite the project import
with `config migrate --apply`: its generated migration can omit settings, and it
clears ownership before applying the IaC plan.

PR environments created before the cutover retain their existing snapshots until
they close; new PR environments inherit the migrated preview template. Do not
apply the template's IaC directly to a PR environment: its source branch and
workflow-managed variables belong to the native preview deployment.

See Railway's [IaC workflow](https://docs.railway.com/infrastructure-as-code) and
[authoring reference](https://docs.railway.com/infrastructure-as-code/reference).

## Cron operation

[`.railway/railway.ts`](../.railway/railway.ts) owns the build command, start command, five-minute
dispatcher schedule, and no-restart policy. Railway cron services must exit after each
run. If a run is still active when the next schedule is due, Railway skips the
new run.

Verify the five-minute schedule and `NEVER` restart policy in both the service
settings and deployment details after applying infrastructure changes.

Preview runs are gated by `SCRAPER_CRON_ENABLED`. The deploy workflow enables
them only for database-changing PRs with an isolated Neon branch; other previews
share the preview database and keep cron disabled.

Source schedules are a complete, reviewed registry of standard five-field UTC
expressions in [`cron.ts`](../apps/scraper/src/cron.ts). All five current sources
remain hourly (`0 * * * *`); Railway invokes the dispatcher with `*/5 * * * *`.
The complete registry is validated before any Redis or task side effects. One
invocation-wide timestamp determines every source's latest scheduled occurrence.

Each source stores its last attempted slot at
`scraper:cron:last-attempted-slot:<source>` in Redis without a TTL. A newer slot
runs one catch-up attempt, collapsing multiple missed occurrences into the latest.
Missing, malformed, or future-dated state runs only when that occurrence belongs
to the current five-minute tick; otherwise the dispatcher saves a baseline and
skips the producer. A first run at 12:55 therefore waits until 13:00. Losing Redis
resets this baseline without deleting persisted scraper history in Postgres.

The dispatcher records the slot before running a producer. Redis failures skip
that producer; producer failures wait for the next committed slot without a
five-minute retry. Both failures remain inside the per-task boundary, so later
sources and the queue still run and the command exits successfully after logging
its aggregate result. Normal not-due skips appear only in the aggregate log.
Manual `scrape <source>` commands do not touch dispatcher state.

Producers run sequentially in registry order, followed by one queue-processing
pass on every five-minute invocation, even when no producer is due. Queue batch
sizes, concurrency, retries, and the empty-queue fast path remain unchanged.
Railway skips a tick when the preceding invocation is still active: as sources
increase, runs longer than five minutes can skip dispatcher ticks. No additional
Redis lock is used; the existing active-run database constraint remains in place.

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

- Mutation-relevant PRs use the isolated `preview-pr-<number>` branch;
  DB-changing PRs also apply committed migrations before deployment.
- Other PRs use the shared `preview` branch.
- The selected `DATABASE_URL` is upserted into the Railway scraper preview
  service through the Railway CLI.
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
