# Railway

Railway hosts the scheduled scraper service and the shared Redis queue used by
the scraper and Discord bot. Postgres and Linear remain the durable sources of
truth for application and support-ticket data.

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
| Discord bot service | `discord-bot` in production only | One replica, zero-overlap deploys, `/health` readiness check |
| Redis | `pocket-trash-queue` | Railway Redis template with `redis-volume` |
| Legacy Redis during migration | `scraper-queue` | Retained until separately approved cleanup |

Railway may detect other deployable workspace apps during repository import.
Skip them: this project deploys only `apps/scraper` and `apps/discord-bot`.

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

For the production Discord bot service:

- Do not create a preview service. A second gateway process would consume the
  same Discord events and queue.
- Keep one replica and zero deployment overlap so only one process owns the
  gateway session and continuous worker.
- Use `/health`; it returns healthy only after the Discord gateway and worker
  start, the first Axiom history reconciliation completes, and Redis answers a
  live queue-count request. Custom-domain target ports must match Railway's
  injected `PORT` (currently `8080`); the local fallback `4009` does not override
  Railway's runtime port.
- Load application-owned values from Infisical `/apps/discord-bot`. Keep
  `REDIS_URL` as the Railway reference to `pocket-trash-queue`.

The root [`railpack.json`](../railpack.json) authenticates native installs before
GitHub Actions can configure a new PR environment. The root
[`.railwayignore`](../.railwayignore) keeps CLI uploads below Railway's source-upload
limit. It must include pnpm's referenced patches, the security audit script and
exception manifest, and workspace dependencies of the root manifest, scraper,
and Discord bot. CI and the production workflow run
`node scripts/check-railway-context.mjs` to reject missing, untracked, or excluded
build inputs before upload. When adding build inputs, update the allowlist and
the watched paths in `.railway/railway.ts` together.

Railway needs `FONTAWESOME_PACKAGE_TOKEN` while installing the workspace because
the supply-chain audit resolves the complete lockfile. The Deploy workflow copies
the token from Infisical into each PR environment and production before their
builds. Railpack runs `scripts/pnpm-install.sh` so credentials stay in a
permission-restricted temporary npm user config. Keep the preview template
initialized with the same non-production token so the first native PR build can
authenticate before GitHub Actions configures that PR environment. The token is
not used by scraper application code.

## Infrastructure changes

Keep one authoring file, [`.railway/railway.ts`](../.railway/railway.ts), and the
CLI-generated [`.railway/README.md`](../.railway/README.md). The file describes the
existing scraper, shared Redis queue, and Redis volume. Production uses `pocket-trash`;
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
no drift; `2` means changes are pending. Pull requests report pending changes as
a successful review plan, while scheduled and manually dispatched checks fail
until deployed configuration matches `main`. It never applies configuration. Native
PR environments inherit the preview template; the Deploy workflow still stages
each preview's database, image prefix, cron flag, and logging metadata. Keep
real scraping disabled on shared-database previews.

Automation that exports `RAILWAY_PROJECT_ID` must unset it after linking so the
CLI passes the saved project's name into the IaC context.

Railway does not read IaC during a source deployment. Apply reviewed configuration
changes explicitly before deploying code that depends on them. Production source
uploads still use the tag release workflow; applying a plan is not a release.

### Shared Redis migration

The checked-in cutover stage retains both Redis resources but explicitly points
the scraper and production bot at `pocket-trash-queue`. This is an additive
migration, not an in-place rename. The preview workflow also uses the new queue;
provision it in the preview template before running that workflow. Generate fresh
plans for both templates; never reuse earlier provisioning plans.

| Consumer | Production | Preview / PR environments | Development |
| --- | --- | --- | --- |
| Scraper and its checkpoint store | New queue's private `REDIS_URL` | Template's private URL; PR workflow hands off the environment-local `REDIS_PUBLIC_URL` | Configured `REDIS_URL`, otherwise isolated local Redis |
| Discord bot notifications, Axiom cursor, ticket state | New queue's private `REDIS_URL` | No bot service is provisioned | Its configured `REDIS_URL`; verify separately from production |
| API and web | HTTP logger forwarding, not Redis consumers | Same | Same |

The shared queue package accepts the caller's connection; it does not choose an
environment. Do not add Redis credentials to API or web. Keep BullMQ queue names
(`scraper-images`, `scraper-items`, `discord-notifications`) and job identities
unchanged. An old `REDIS` alias or an Infisical-imported URL must not override the
effective `REDIS_URL`; inspect targets without printing credentials.

Migration requires separate, explicitly approved stages:

1. Temporarily describe both Redis resources and provision
   `pocket-trash-queue` without deleting or detaching `scraper-queue` or
   `redis-volume`.
2. Enable RDB snapshots and AOF (`appendonly yes`, `appendfsync everysec`) on the
   new resource, then verify both persistence modes after a restart test. The
   shared queue uses the official `redis:8.2` image and a `/data` volume, not the
   helper's default image. On initial provisioning, generate a unique Redis
   password directly in the new environment's Railway `REDIS_PASSWORD` setting
   before starting Redis; `preserve()` retains it but does not generate it.
   Never reuse another environment's password or store it in source. IaC declares
   both private and public connection expressions; the public URL is required by
   the PR handoff. Verify the mounted path and authenticated ping, not only the
   deployment status.
3. Pause scraper cron and every producer/consumer using the old connection. Drain
   `scraper-images` and `scraper-items`; inspect active, waiting, delayed, paused,
   prioritized, repeatable, waiting-children, failed, and completed state. Reconcile
   checkpoints and deduplication records as well as any bot cursor/ticket state
   before switching. Completed jobs can carry job-ID deduplication history: an
   empty waiting list alone is not permission to discard Redis data. Preserve a
   recoverable snapshot and copy required state without flushing either database.
4. Switch the scraper and Discord bot `REDIS_URL` references, resume consumers,
   and verify queue processing, deduplication, the Axiom cursor, and ticket
   operations before resuming producers.
5. Observe at least one complete scraper schedule and the Discord health checks.
   If verification fails, pause producers again and reconcile any work accepted
   by the new queue before restoring old references under a separately approved
   rollback. Simply switching back can strand or duplicate work.
6. Remove `scraper-queue` and its obsolete data only in a later cleanup with
   separate user approval and a fresh plan proving the exact deletion.

Provisioning, switching, deployment, and cleanup are production actions. This
repository change records the desired state and plan result only; it authorizes
none of those actions.

Repeat the inventory for retained PR environments: existing snapshots do not
inherit template updates. Reconcile them or close them with approval; never point
a preview at production Redis. Verify a fresh PR queue deployment and E2E check,
one complete production scraper cycle, bot health and synthetic notification
deduplication, and persistence recovery. Paid inference and production ticket
activation are not part of this cutover. Record sanitized live evidence in
ENG-538; retain the legacy service and volume until ENG-539's separate deletion
approval, backup disposition, and post-removal checks are complete.

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
expressions in [`cron.ts`](../apps/scraper/src/cron.ts). Autmog and Grimsmo Saga
run every 30 minutes during Pens cutover verification; the three Grimsmo knife
sources remain hourly. Railway invokes the dispatcher with `*/5 * * * *`.
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

Provision Redis in Railway; applications must not provision it at runtime. Set
`REDIS_URL` on both the scraper and Discord bot as a Railway service reference:

```dotenv
REDIS_URL=${{pocket-trash-queue.REDIS_URL}}
```

Keep this reference in Railway rather than copying credentials into Infisical.
Both applications intentionally share credentials, the 5 GB `redis-volume`,
capacity, persistence, and outage scope. They use separate stable queue names:
`scraper-images`, `scraper-items`, and app-owned Discord notification queues.
Payload schemas remain owned by each app. Losing Redis must not delete scraper
history in Postgres or support tickets in Linear, but it can delay both workloads
and lose Redis-local reconciliation state.

RDB snapshots remain enabled with `save 60 1`. AOF is also enabled with
one-second flushing. A confirmed write can therefore lose up to roughly one
second during a host failure; AOF and RDB live on the same volume and are not
independent backups. Keep volume alerts at 80%, 95%, and 100%, inventory Railway
volume backups before storing new categories of personal data, and test restore
behavior before relying on a backup.

Notification delivery retains completed jobs for 24 hours, capped at 1,000, so
the delayed Axiom fallback still finds the direct-delivery job ID and cannot post
a duplicate. Failed notification jobs remain for 14 days. With a 64 KiB maximum
normalized notification payload, completed payloads consume at most about 64 MiB;
7,000 failures (the documented Axiom ceiling of 500 notifications/day for 14
days) consume about 448 MiB before BullMQ overhead. Reserve 1 GiB of the 5 GB
volume for Discord notification work and investigate before total volume usage
reaches 80%. Direct notifications are not rate-limited by Axiom, so sustained
error volume above that planning envelope is degraded operation, not permission
to shorten the 24-hour deduplication window.

The bot-local Axiom intake cursor advances only after a terminal intake result.
Ticket-operation records retain recovery state while a ticket is being created;
after Discord finalization, only thread-to-Linear mappings remain for 90 days.
These keys are operational state, not durable truth.

Secret ownership and non-Railway environment placement are documented in
[environment-variables.md](./environment-variables.md). Bunny provisioning and
preview namespaces are documented in [image-cdn.md](./image-cdn.md).

## Production deploys

Production scraper deploys are downstream of the release workflow's database
migrations. The current workflow:

1. Applies committed migrations to the production Neon branch.
2. Deploys and smoke-tests the production API.
3. Stages Railway production metadata with `--skip-deploys`.
4. Uploads the checked-out release source to Railway.
5. Waits for the Railway CLI deployment command to succeed.

That upload targets only `pocket-trash`; it does not deploy `discord-bot`.
Creating the bot service from the reviewed IaC plan and activating its source
deployment are separate production actions.

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
3. Redeploys the active queue from its configured image source so Redis is online.

The handoff and queue redeployment both target `pocket-trash-queue` in that PR's
environment. The preview template must already contain this service and its own
persistent volume before the workflow runs. Keep the legacy service until its
data and clients have been reconciled and its removal separately approved.

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
