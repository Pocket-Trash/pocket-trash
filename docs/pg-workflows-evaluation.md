# pg-workflows evaluation

Date: 2026-10-01

Issue: ENG-300

Evaluated package: [`pg-workflows` 0.16.0](https://www.npmjs.com/package/pg-workflows)

## Recommendation

**Do not adopt pg-workflows for Pocket Trash now.** Keep the existing Postgres-backed audit and account-erasure processors and the Railway/BullMQ scraper.

pg-workflows is a credible small TypeScript workflow engine, but its strongest benefits are already present in the current workflows: durable state, leases, bounded retries, resumable completed steps, idempotent starts, operational status, and scheduled processing. Replacing those implementations would move working policy-specific behavior into a young general-purpose dependency without removing the need for Pocket Trash's idempotency, privacy, verification, and reconciliation code.

The scraper is the only candidate that could remove infrastructure (Railway Redis), but that change would replace a purpose-built queue with an always-running Postgres worker, add load to Neon, and rewrite mature BullMQ behavior. The engine hard-codes queue polling every 0.5 seconds for both its main and dead-letter workers, which is incompatible with the intended economics of Neon's scale-to-zero computes ([engine source](https://github.com/SokratisVidros/pg-workflows/blob/a0ae4a9d8a26c9e99be5301457955b770ad75ce4/packages/pg-workflows/src/engine.ts#L231-L257); [Neon scale-to-zero](https://neon.com/docs/introduction/scale-to-zero)).

Reconsider a narrow pilot only when Pocket Trash has a new workflow that needs durable human/event waits, timers spanning hours or days, or parent/child orchestration. Do not use account erasure as the pilot.

## What pg-workflows is

pg-workflows is an MIT-licensed Node.js library built on `pg-boss`. It stores run state and step results in `public.workflow_runs` and queue state in a dedicated `pgboss_v12_pgworkflow` schema. It provides a lightweight client for starting/querying runs and an engine process that registers handlers, polls for jobs, executes steps, retries failures, and registers schedules ([configuration](https://pgworkflows.dev/docs/reference/configuration); [architecture](https://pgworkflows.dev/docs/architectures)).

The execution model is replay-based. A handler starts from the top on a retry or resume; completed step outputs are read from a JSONB timeline and skipped. Paused runs hold no worker or database connection. The package also provides events, delays, polling, child workflows, priorities, singleton runs, idempotency keys, run queries, a separate React dashboard, and a separate OpenTelemetry plugin ([workflow model](https://pgworkflows.dev/docs/concepts/workflows); [API reference](https://pgworkflows.dev/docs/reference/api); [tracing](https://pgworkflows.dev/docs/observability/tracing)).

It is not an ORM and does not replace Drizzle. It is also not a Neon service: Neon supplies the PostgreSQL compute, storage, branching, restore, pooling, and scaling behavior on which pg-workflows runs.

## Value beyond Neon and Drizzle

| pg-workflows value proposition | Beyond Neon | Beyond Drizzle | Pocket Trash value |
| --- | --- | --- | --- |
| Durable steps and replay | Neon durably stores ordinary Postgres rows but does not interpret a TypeScript function as resumable steps. | Drizzle provides queries and transactions, not persisted execution checkpoints. | Useful in principle, but account erasure already persists each step and skips completed steps. BullMQ already persists scraper jobs. |
| Queue, worker leasing, retries, heartbeat recovery, and dead-letter handling | Neon is the database host, not a job worker. | Drizzle can implement queue tables but supplies no worker loop or retry policy. | Real functionality, but all three current candidates already have leases/retries or BullMQ delivery. |
| Event waits, delays, polling, pause/resume, and child workflows | Neon has no equivalent orchestration state machine. | Drizzle can persist state but does not resume application code from it. | The clearest net-new capability. No evaluated current workflow needs arbitrary event waits or child workflows. |
| Recurring schedules | Neon hosts the state, while pg-workflows/pg-boss creates and fires schedules when an engine is running. | Drizzle has no scheduler. | Pocket Trash already has Cloudflare Cron Triggers and Railway cron. This would replace managed schedules with a resident worker, not eliminate scheduling operations. |
| Idempotent starts, singleton runs, resource scoping, and priorities | Neon can enforce the underlying unique indexes but does not define these workflow semantics. | Drizzle can model the same constraints, but they must be designed and operated by the application. | Convenient defaults. Current code already uses unique delivery keys, subject HMAC uniqueness/advisory locks, deterministic BullMQ job IDs, and Railway overlap prevention. |
| Run history, progress queries, dashboard, and tracing | Neon exposes database metrics, not application workflow timelines. | Drizzle lets the app query its own status tables but has no generic workflow UI. | Potential operator convenience, but the generic dashboard still needs Pocket Trash authorization and workflow-specific safety. The OTel plugin currently emits traces only: no metrics, cross-resume trace linking, caller propagation, or final dead-letter transition span ([tracing limitations](https://pgworkflows.dev/docs/observability/tracing#not-supported-yet)). |
| “No Redis” | Neon can hold both queue and application data, so pg-workflows removes a separate broker. | Drizzle remains the application data layer; pg-workflows owns its own SQL and queue schema. | Relevant only to the scraper. Railway is still required for long-running fetch/image work, and Neon's compute becomes an always-polled queue host. |

Drizzle remains the repository's source of truth for application schema and migrations. Its documented responsibilities are TypeScript schema declaration, SQL/query construction, transactions, and migration generation/application, not job execution ([schema](https://orm.drizzle.team/docs/sql-schema-declaration), [transactions](https://orm.drizzle.team/docs/transactions), [migrations](https://orm.drizzle.team/docs/migrations)).

## Current Pocket Trash baseline

### Audit delivery

Audit delivery is already a transactional outbox tailored to the audit contract. A source mutation calls `enqueue` with the caller's Drizzle transaction; `audit_delivery.delivery_key` deduplicates the durable enqueue. The processor claims the oldest due record using `FOR UPDATE SKIP LOCKED`, writes the audit event and deletes the delivery in one transaction, retries with exponential backoff, and exposes terminal `needs_attention` failures. The Cloudflare scheduled handler drains at most 25 deliveries per hourly invocation ([enqueue and processing](../packages/services/src/db/audit/index.ts#L772-L807), [claiming](../packages/services/src/db/audit/index.ts#L1537-L1570), [scheduled drain](../apps/api/src/audit.ts#L3-L16)).

### Account erasure

Account erasure already implements a six-step durable workflow (`snapshot`, `inaccessible`, `storage`, `database`, `providers`, `verify`). It persists per-step completion, skips completed steps, leases work with `FOR UPDATE SKIP LOCKED`, retries with bounded exponential backoff, transitions irrecoverable/old failures to `needs_attention`, records audit events, clears the raw Clerk ID at completion, and purges receipts only after the approved retention deadline ([step processing](../packages/services/src/db/erasure/index.ts#L580-L648), [claiming and completion](../packages/services/src/db/erasure/index.ts#L765-L856), [failure classification](../packages/services/src/db/erasure/index.ts#L860-L915)). External operations already treat an absent Clerk user as success and perform explicit post-deletion verification ([operations](../apps/api/src/erasure.ts#L16-L106)).

The hourly production-only Cloudflare handler drains audit deliveries, then erasure requests, checks Clerk orphans daily, and purges expired data ([scheduled handler](../apps/api/src/worker.ts#L229-L284)).

### Scraper

The scraper is an hourly Railway cron process. It runs source producers sequentially, drains item and image BullMQ queues, and exits. Railway Redis is the queue; Neon Postgres is the durable catalog and run-history store ([Railway architecture](./railway.md#railway), [cron implementation](../apps/scraper/src/cron.ts#L25-L107)).

BullMQ jobs have five attempts, exponential backoff, bounded retention, and deterministic IDs. Item/image processing has configurable batch sizes and concurrency, a five-minute drain bound, graceful/forced shutdown, and dead-letter tooling ([queue defaults](../apps/scraper/src/queue/queues.ts#L9-L85), [bounded processor](../apps/scraper/src/queue/processor.ts#L1468-L1605), [queue design](./railway.md#queue-design)). These handlers are intentionally at-least-once and idempotent.

## Candidate-by-candidate decision

### 1. Audit delivery: reject

What pg-workflows adds: a generic queue worker, standard retry status, run queries, and optional dashboard/traces.

Why it is worse here:

- The important property is not generic orchestration; it is atomicity between the source mutation and audit enqueue. The current service accepts the caller's transaction. `WorkflowClient.startWorkflow` atomically creates its own `workflow_runs` and pg-boss job, but its public API does not accept Pocket Trash's existing Drizzle transaction ([client transaction source](https://github.com/SokratisVidros/pg-workflows/blob/a0ae4a9d8a26c9e99be5301457955b770ad75ce4/packages/pg-workflows/src/client.ts#L208-L252)). Replacing the outbox would introduce a source-write/workflow-start dual-write gap.
- Delivery is one small database transaction, not a multi-step workflow. The current implementation already owns the correct deduplication, retry ceiling, sanitized error code, and operator state.
- A resident workflow engine would replace a bounded hourly drain with constant polling.

Decision: keep the current audit outbox.

### 2. Account erasure: reject

What pg-workflows adds: declarative step syntax, generic progress/history APIs, standard retries, and a generic UI.

Why it is not enough:

- Every difficult part remains application-specific: identity verification, advisory locking, making content inaccessible, Bunny target snapshots/deletion/purge, database erasure and negative checks, Clerk deletion, retention exceptions, receipt minimization, auditing, and operator retry authorization.
- The existing implementation already has durable step results, replay skipping, leases, backoff, terminal attention state, receipts, admin status, and completion verification. Migration would mostly rename working mechanisms.
- A generic `workflow_runs.input` and timeline would create a second durable location for the Clerk ID and step outputs. pg-workflows' documented public API has no run deletion or TTL operation ([API reference](https://pgworkflows.dev/docs/reference/api#runs)). Pocket Trash would need separate redaction and purge code synchronized with the existing 30-day/exception-aware receipt policy.
- The generic dashboard exposes pause, resume, cancel, fast-forward, and event actions. Those are not automatically safe account-erasure controls and would require the same permission and audit rules as the current admin surface.
- The engine's generic workflow `timeout` is recorded but not enforced; only wait timeouts and pg-boss job expiry bound execution ([retry and timeout docs](https://pgworkflows.dev/docs/concepts/retries-and-timeouts)).

Decision: keep the current erasure workflow. It is already the smaller and more privacy-aware implementation.

### 3. Railway scraper and BullMQ: reject

What pg-workflows adds: Postgres-backed queueing, step-level progress, schedules, and the possibility of deleting Railway Redis.

Why the trade is unfavorable:

- Railway remains necessary because scraping and image processing can exceed web-request limits. To get prompt retries and schedules from pg-workflows, the current exit-after-cron service would become an always-running worker.
- pg-workflows has one shared workflow-run queue and global worker count, whereas the scraper has distinct item/image queues with their own batch bounds, deterministic job identities, dead-letter tooling, and controlled concurrency.
- Producers currently use queue-oriented fan-out and bulk enqueue. Modeling each item/image as a workflow adds one `workflow_runs` row plus pg-boss rows; modeling a batch as one workflow grows a single JSONB timeline and serializes step updates behind a row lock. Neither is an obvious improvement over BullMQ.
- The external side effects (upstream fetches and Bunny uploads/deletes) still need idempotency. pg-workflows explicitly says a step can run again after a mid-step crash, so it does not strengthen those guarantees ([step semantics](https://pgworkflows.dev/docs/concepts/workflows#steps)).
- Constant 0.5-second queue polling adds Neon queries even when there is no work and can prevent the preview/development computes from reaching their configured five-minute inactivity window.
- Removing Redis saves one small managed service but makes application database latency, queue latency, and workflow availability share a failure and capacity domain.

Decision: keep BullMQ unless measured Redis cost or operational failures become material. If that happens, compare a focused Postgres job queue against BullMQ before adopting a full workflow engine.

### 4. Cloudflare scheduled housekeeping: reject

The cleanup/orphan checks are short bounded tasks already triggered by Cloudflare. Moving them to pg-workflows replaces one managed cron event with a resident Node worker and adds no meaningful durable composition. Keep the trigger and handlers.

### 5. Future long-lived event-driven workflow: conditional pilot

This is the one plausible fit. A workflow that pauses for human review or an external event, sleeps for days, invokes child workflows, and needs a generic timeline would gain real functionality beyond Neon and Drizzle. The package pauses such runs without holding a worker or connection and resumes them by replaying cached steps ([events](https://pgworkflows.dev/docs/concepts/events), [child workflows](https://pgworkflows.dev/docs/concepts/child-workflows)).

Pilot only after all adoption gates below pass, with non-sensitive input, idempotent side effects, a dedicated Railway worker, and no migration of existing workflows.

## Delivery semantics: not exactly once

pg-workflows makes completed step *results* durable. It cannot atomically commit an arbitrary external API call and the subsequent timeline write. Its own documentation is explicit: if the process crashes after a step's side effect but before saving the result, the step may run again and the external operation must be idempotent ([workflow docs](https://pgworkflows.dev/docs/concepts/workflows#steps)).

The source confirms the failure window. `runStep` opens a Postgres transaction and row lock, awaits the application handler, then writes the output to the timeline ([source](https://github.com/SokratisVidros/pg-workflows/blob/a0ae4a9d8a26c9e99be5301457955b770ad75ce4/packages/pg-workflows/src/engine.ts#L1704-L1808)). Therefore:

1. An external call can succeed.
2. The worker can crash, lose its database connection, or fail the timeline update.
3. Recovery replays the step because no output was saved.
4. **The external side effect may happen again.**

The same applies to a Drizzle transaction started inside a step: it is separate from pg-workflows' internal transaction. A committed application mutation can be replayed if the workflow checkpoint fails. Use provider idempotency keys, unique database constraints/upserts, read-before-write reconciliation, and explicit postcondition checks. Never rely on the marketing shorthand that a step “runs once.”

The implementation also keeps its transaction and `workflow_runs` row lock open while the handler awaits external work. Long Clerk/Bunny/Shopify calls would occupy a Postgres connection and transaction for their duration. This needs load testing on Neon before any production use.

## Neon-specific risks

### Branches clone queue and workflow state

A Neon branch is a copy-on-write clone containing its parent's schema and data at the branch point ([Neon branching](https://neon.com/docs/introduction/branching)). That includes `workflow_runs`, `workflow_schema_version`, and every pg-boss table. If a pg-workflows engine starts against the child, cloned pending/running jobs can execute independently of their originals and repeat external effects.

Pocket Trash currently creates PR branches from non-production `development`, not production, which prevents production user data from entering previews. However, preview Railway cron can be enabled for database-changing PRs and uses the same child branch ([branch workflow](./database.md#neon-branches)). Bundling a pg-workflows engine into that process without clearing or fencing cloned workflow state would replay development jobs against preview-configured or shared external providers.

Required control: workers must be disabled on all Neon child branches by default. If preview workflow execution is later needed, create fresh empty workflow/pg-boss state after branch creation, use isolated provider namespaces, and require an environment identity check before `engine.start()`.

### Point-in-time restore can replay effects

Neon instant restore overwrites all Postgres data and schema on the branch with the selected historical state; it is not a merge, and connections are briefly interrupted ([Neon instant restore](https://neon.com/docs/introduction/branch-restore)). External systems such as Clerk and Bunny are not rewound with Postgres.

If a restore point predates a recorded step result or job completion, the restored queue/timeline may say work is pending even though the external effect already happened. When workers reconnect, the effect may repeat. A restore can also resurrect sensitive workflow inputs that had been scrubbed or deleted later.

Required runbook before adoption:

1. Stop all workflow workers before restoring.
2. Record the restore timestamp and preserve the automatic pre-restore backup branch.
3. Compare workflow and pg-boss state on both sides of the restore.
4. Reconcile every nonterminal run against external providers and application postconditions.
5. Cancel, repair, or re-enqueue deliberately; do not restart the worker without reconciliation.
6. Verify privacy erasure/redaction again for data resurrected by the restore.

### Scale to zero and connection load

Neon suspends an inactive compute after five minutes by default; background queries and frequent connection requests keep it active ([scale-to-zero docs](https://neon.com/docs/introduction/scale-to-zero); [compute troubleshooting](https://neon.com/docs/manage/endpoints/)). pg-workflows hard-codes 0.5-second polling for each main-queue worker and its dead-letter worker. This makes a running engine effectively an always-on Neon workload even when there are no workflows.

The package creates its own `pg.Pool`, separate from Pocket Trash's current Drizzle `@neondatabase/serverless` client ([Pocket Trash client](../packages/database/src/client.ts), [pg-workflows client source](https://github.com/SokratisVidros/pg-workflows/blob/a0ae4a9d8a26c9e99be5301457955b770ad75ce4/packages/pg-workflows/src/client.ts#L75-L104)). A production design must budget pool connections per worker replica and validate pooled versus direct Neon URLs. Neon's guidance is pooled connections for application traffic and direct connections for migrations/session-dependent operations ([connection pooling](https://neon.com/docs/connect/connection-pooling)).

## Schema and deployment risks

- `engine.start()` and `WorkflowClient.start()` run package-owned migrations automatically. They create `public.workflow_runs`, `public.workflow_schema_version`, indexes, and a versioned pg-boss schema ([configuration](https://pgworkflows.dev/docs/reference/configuration#database-objects); [migration source](https://github.com/SokratisVidros/pg-workflows/blob/a0ae4a9d8a26c9e99be5301457955b770ad75ce4/packages/pg-workflows/src/db/migration.ts#L1-L169)).
- Pocket Trash currently requires committed Drizzle migrations to run before deploying application code. Runtime-owned DDL would bypass that review/order model and create schema objects absent from the Drizzle schema docs.
- Upgrading the npm package can therefore apply database changes on process start. Rollback compatibility is not guaranteed merely by rolling back application code.
- Incompatible edits to long-lived workflow handlers are an application concern. The persisted run records a workflow ID and step IDs, not an immutable handler version. Use a new workflow ID for an incompatible graph or step-semantic change and keep old handlers until their runs finish.
- The engine uses one shared default queue. A worker that receives a run whose definition it did not register fails it. Pocket Trash would need one worker deployment containing every registered handler, or deliberate separate pg-boss instances/schemas with tested routing.

Any pilot should pin exact package versions, apply and inspect upstream DDL in a Neon branch before deployment, document the package-owned objects, and block runtime schema creation in production by pre-starting the pinned version during the release migration phase.

## Privacy and security risks

- Workflow input, output, errors, resource IDs, and every step output are durable database fields. Treat them as a new data inventory, not ephemeral logs ([run type](https://pgworkflows.dev/docs/reference/api#workflowrun)).
- The public API documents query/cancel controls but no deletion, TTL, or field-redaction API. Pocket Trash must implement retention and erasure for `workflow_runs` plus pg-boss archives before storing any account-linked data.
- Neon branches copy those rows by default, and point-in-time restore can resurrect deleted rows. Existing production/non-production branch boundaries must remain strict.
- `step.waitFor` accepts a schema for TypeScript typing but the docs state event data is not runtime-validated. Any webhook/admin event must be validated before `triggerEvent` ([event docs](https://pgworkflows.dev/docs/concepts/events)).
- The optional dashboard is an operational control plane. Its API must sit behind Pocket Trash admin authorization, CSRF/origin protection, audit logging, and workflow-specific restrictions. The standalone CLI should not point at production: its own docs warn that it starts queue workers without registered workflow definitions, which can fail jobs ([UI reference](https://pgworkflows.dev/docs/ui/reference)).
- Error messages and timeline outputs must not include provider payloads, object paths, tokens, direct identity, or other data prohibited by the erasure/audit contracts.

## Operational and maturity assessment

As of this evaluation, the npm package is pre-1.0 (`0.16.0`) and the GitHub repository shows a small footprint (61 stars, 9 forks, and a contributor history dominated by one maintainer) ([npm](https://www.npmjs.com/package/pg-workflows), [GitHub](https://github.com/SokratisVidros/pg-workflows)). This does not make the package unusable, but Pocket Trash should assume API/schema churn and own an exit path.

Positive maturity signals:

- MIT license and readable TypeScript source.
- Unit and Postgres integration tests.
- Transactional workflow-row/job creation.
- Heartbeat/dead-letter recovery and recent fixes for stuck runs.
- Isolated pg-boss schema, migration locking, input validation, idempotency keys, and singleton indexes.
- Separate client/worker APIs and documented architecture.

Material gaps for Pocket Trash:

- No exactly-once external effects; crash replay is expected.
- No documented run retention/deletion/redaction facility.
- No workflow definition versioning.
- Hard-coded 0.5-second worker polling.
- Runtime-owned schema migrations.
- Workflow timeout metadata is not enforced.
- Generic logger defaults and trace-only observability require adapters to Pocket Trash logging/alerting.
- No documented Neon-specific branch, restore, scale-to-zero, or pooled-connection guidance.

## Adoption gates

Do not add the dependency until one candidate passes every applicable gate.

1. **Need gate:** demonstrate a current workflow need that is not already satisfied by the audit/erasure processors, BullMQ, Cloudflare cron, or Railway cron. “Use one less Redis” needs a measured cost/reliability case.
2. **Semantics gate:** document an idempotency or reconciliation strategy for every database and external side effect, including the crash-after-effect/before-checkpoint window.
3. **Branch gate:** prove that no worker starts on cloned Neon child branches unless queue state is freshly initialized and provider targets are isolated.
4. **Restore gate:** approve and exercise the stop/reconcile/restart runbook against a Neon restore in a non-production environment.
5. **Privacy gate:** define allowed input/timeline fields, retention, erasure, branch exposure, restore behavior, and negative verification. Do not put a raw Clerk ID in generic workflow history without a tested scrub path.
6. **Migration gate:** pin an exact version, inspect its DDL, integrate package-owned migrations with the release sequence, and test forward and application rollback paths.
7. **Neon gate:** load-test connection count, transaction duration, query volume, pooled/direct URLs, compute utilization, and the loss of scale-to-zero caused by 0.5-second polling.
8. **Runtime gate:** run the engine in a dedicated long-lived Railway worker. Use the client only from request handlers. Do not attempt to run the resident engine inside Cloudflare scheduled/request invocations.
9. **Deployment gate:** define workflow-version compatibility rules; incompatible changes receive new workflow and step IDs, with old handlers retained until no old runs remain.
10. **Operations gate:** provide Pocket Trash logger integration, alerts for failed/stuck/dead-letter runs, a retention job, queue-depth/age metrics, and a least-privilege admin surface. OpenTelemetry traces alone are insufficient.
11. **Maturity gate:** complete a small non-sensitive pilot, pin the package, review upstream changes before every upgrade, and retain a documented path back to a simple application-owned queue.

## Decision summary

| Candidate | Incremental benefit | Migration/operational cost | Decision |
| --- | --- | --- | --- |
| Audit delivery | Low | Loses caller-transaction outbox atomicity; adds resident worker and generic history | Keep current |
| Account erasure | Low | Duplicates existing orchestration; adds privacy/retention and replay surfaces | Keep current |
| Scraper/BullMQ | Medium (remove Redis) | Large rewrite; always-on Neon polling; worse queue specialization; external effects still at-least-once | Keep current |
| Scheduled housekeeping | Very low | Replaces managed cron with resident polling | Keep current |
| Future human/event-driven, multi-stage workflow | High if the need appears | Manageable as an isolated pilot after gates pass | Re-evaluate then |

Keep the three existing mechanisms. Adopt pg-workflows only when its event/timer/child-workflow model removes more bespoke code than its worker, schema, replay, branch, restore, retention, and operational obligations add.
