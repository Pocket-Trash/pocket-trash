# Discord Bot Operations

The Pocket Trash Discord bot uses separate development and production Discord
applications. Runtime authorization and routing use Discord IDs, never names.
Environment-specific values live in Infisical at `/apps/discord-bot`.
Discord/logger service-owned values live at `/services/pocket-trash/discord-bot`
and are imported into the matching `dev` or `prod` application path. The
production application path is synchronized into Railway's production bot
service. Do not require a separate webhook-ID secret: derive its identity from
`AXIOM_INTAKE_WEBHOOK_URL`.

## Local development

Prerequisites: the repository's Node/pnpm versions, `infisical login`, matching
development Discord/Linear credentials in **dev** `/apps/discord-bot`, and
Docker/OrbStack running. Run `pnpm dev:all` for all apps, or
`pnpm --filter @app/discord-bot dev` for the bot alone. The scraper-only
`pnpm dev:scraper` command remains supported.

When `REDIS_URL` is absent, bot and scraper development commands reuse the
existing local Redis manager. It creates or starts `pocket-trash-scraper-redis`,
checks its port mapping, and waits for PING before starting the app. New containers
bind only `127.0.0.1:4008` and use Redis AOF persistence in their Docker data
volume. Existing containers are not recreated or reconfigured. Ctrl+C stops the
application, not Redis; `docker stop pocket-trash-scraper-redis` safely stops it
later. Do not remove the container/volume to resolve a port conflict if you need
its data.

An explicit `REDIS_URL` from the shell takes precedence over the dev Infisical
value; a dev Infisical value takes precedence over the localhost default. An
explicit URL is treated as externally managed: the launcher only checks PING,
and never starts/stops Docker for it. Use only isolated **non-production** Redis;
never copy production credentials. Malformed URLs, Railway expressions and
private `.railway.internal` hosts fail with redacted errors. URL validation in
the production bot is unchanged.

No Infisical changes are necessary for the default local setup. Keep `REDIS_URL`
absent from dev `/apps/discord-bot` to use it; production remains Railway-owned.
If you choose a hosted development endpoint later, it needs a reachable public
TCP URL and separate development credentials, not a private Railway reference.
Do not store this override in tracked files or command history with credentials.

Both apps share the local container intentionally, using separate scraper queue
and Discord notification/cursor/ticket namespaces. Two worktrees using that
container also share their development state; do not run two bots for the same
guild simultaneously. For concurrent independent worktrees, provide distinct
externally managed Redis URLs (and development Discord applications). Setting
`SCRAPER_REDIS_PORT` selects the managed container's expected host port, but
cannot remap an existing container; mismatches fail rather than delete data.

The bot listens on port `4009` by default. `GET http://localhost:4009/health`
returns `200` only after Discord, Linear and Redis readiness checks pass.
Ticket enablement remains whatever dev Infisical specifies; this startup fix
does not change `DISCORD_TICKETS_ENABLED` or authorize paid inference.

## Application setup

For each application, enable **Message Content Intent** under **Bot > Privileged
Gateway Intents**. Install the application to only its matching guild with the
`bot` and `applications.commands` scopes. Discord does not provide a bot-install
permission named **Use Application Commands**.

Grant the bot only the channel permissions it needs:

- Destination text channels: **View Channel**, **Send Messages**, and **Read
  Message History**.
- Support forum: **View Channel**, **Send Messages in Threads**, **Read Message
  History**, and **Manage Threads**.
- Private Axiom intake: **View Channel** and **Read Message History**.

Keep the Axiom intake private from `@everyone`. Add the bot user directly to its
channel permissions, and bind the Axiom webhook only to that intake channel.
The visible logger channel is a destination, not an intake channel.

After commands are registered, configure their visibility under **Server
Settings > Integrations**. Restrict staff commands and ticket actions to the
Owners role; allow the Owners and Moderator roles to use `/help-link`. These
settings improve visibility but do not replace the bot's runtime role checks.

## Staff help links

`/help-link topic:<choice> user:<optional member>` posts the English help title
and its visible canonical URL publicly. Only the configured Owners and Moderator
roles may invoke it; server administrator status alone does not grant access.
The optional member is the only allowed mention in the response.

Startup bulk-registers the command in the configured guild. Topic choices come
from the installed localization package's English MDX documents, not a network
request or arbitrary user input. After updating that package, run
`pnpm --filter @app/discord-bot generate:help` and commit the generated topic
list. Builds and type checks reject missing metadata, stale generated choices,
or more than Discord's 25 choices. This does not deploy or register commands in
production until the bot is released by the operator.

## Required configuration

Store these values in both the `dev` and `prod` Infisical environments:

| Variable | Meaning |
| --- | --- |
| `DISCORD_APPLICATION_ID` | Application and bot user ID |
| `DISCORD_GUILD_ID` | Installed guild ID |
| `DISCORD_TOKEN` | Bot token |
| `DISCORD_OWNER_ROLE_ID` | Owners role used by runtime authorization |
| `DISCORD_MODERATOR_ROLE_ID` | Moderator role used by `/help-link` |
| `DISCORD_GITHUB_CHANNEL_ID` | Normal GitHub notification destination |
| `DISCORD_GITHUB_ERRORS_CHANNEL_ID` | GitHub workflow error/status destination |
| `DISCORD_LOGGER_CHANNEL_ID` | Logger and Axiom notification destination |
| `DISCORD_AXIOM_INTAKE_CHANNEL_ID` | Private Axiom fallback intake channel |
| `AXIOM_INTAKE_WEBHOOK_URL` | Secret URL for the trusted Axiom intake webhook |
| `DISCORD_SUPPORT_FORUM_ID` | Support forum parent channel |
| `DISCORD_BUG_TAG_ID` | Pre-provisioned `Bug` forum tag |
| `DISCORD_FEATURE_REQUEST_TAG_ID` | Pre-provisioned `Feature Request` forum tag |
| `GITHUB_WEBHOOK_SECRET` | Random secret shared only with the GitHub repository webhook |
| `LOGGER_NOTIFICATION_API_TOKEN` | Bearer token accepted only for API logger events |
| `LOGGER_NOTIFICATION_SCRAPER_TOKEN` | Bearer token accepted only for scraper logger events |
| `LOGGER_NOTIFICATION_WEB_TOKEN` | Bearer token accepted only for web logger events |

The Discord webhook URL is secret. The Discord IDs are stable routing or
authorization inputs, but remain environment-specific configuration.

Railway owns `REDIS_URL` as a reference to `pocket-trash-queue`; do not copy its
password or public endpoint into Infisical.

## GitHub webhook

After the bot version containing the native intake is deployed, create one
repository webhook in `Pocket-Trash/pocket-trash`:

- Payload URL: the public Discord bot service URL followed by
  `/webhooks/github`
- Content type: `application/json`
- Secret: the exact `GITHUB_WEBHOOK_SECRET` value stored in the matching bot
  environment
- SSL verification: enabled
- Events: pull requests, pull request reviews, and workflow runs. Manually
  dispatched Actions workflows also emit workflow-run events; GitHub does not
  offer a separate Workflow dispatches checkbox for repository webhooks.

The bot accepts only the configured pull-request actions, failed `CI` and
`Logger Live` runs, and manual tests. It ignores successful workflows and
fork-origin events. GitHub's `X-GitHub-Delivery` value is the queue job ID, so a
redelivery cannot create a second notification while the retained job exists.
Delivery retries five times with exponential backoff starting at 30 seconds.
Completed jobs are retained for 24 hours (up to 100,000), and exhausted jobs are
retained for 14 days and logged as structured errors without creating another
Discord notification.

Do not enable the repository webhook before this version is live. A successful
accepted delivery returns `202`; an intentionally ignored event returns `204`;
invalid signatures return `401`; and unavailable queue storage returns `503` so
GitHub can redeliver it.

## Direct logger webhook

The API, web server, and scraper post selected production `error` and `fatal`
events to `/webhooks/logger`. Each app has a distinct bearer token, and the bot
rejects payloads whose `app` does not match that token. Accepted events return
`202` only after Redis accepts the stable `eventId`; filtered preview or lower-
severity events return `204`, invalid authentication returns `401`, malformed
or oversized payloads return `400`, and unavailable queue storage returns
`503`. Queue payloads exclude raw payloads, console options, stacks, causes,
and authentication headers.

## Axiom Discord fallback

The trusted source is the exact private intake channel and webhook identity
derived from `AXIOM_INTAKE_WEBHOOK_URL`. Own-bot messages and other sources are
rejected before inspecting content. Webhook-authored messages also have Discord's
`author.bot` flag, so that flag alone must not reject the trusted notifier.

The live-calibrated contract is empty message content and exactly one embed whose
description contains a triple-backtick-fenced JSON object. No alternative content
or embed-field layouts are guessed. The projection maps `errorName` and
`errorMessage` back to the safe notification error object. It validates the full
shape before applying the same production rules as the direct transport, then
enqueues under the same `eventId`. Invalid trusted messages always enqueue a
parser-health notification under `axiom-parser-error:<message-id>`, even when a
direct copy already exists. Raw Discord content and secrets are not echoed.
Physical BullMQ IDs are URI-escaped because BullMQ rejects colon-containing IDs;
the delivery envelope retains the original stable identity.

History reconciliation runs at startup, every five minutes, on gateway resume or
new readiness, on new intake messages, and when Redis reconnects. Each trigger
uses the same serialized history scan. Pages are read newest-first and processed
oldest-first. A cursor advances only after successful durable enqueue, retained
duplicate acceptance, intentional policy exclusion, untrusted-source rejection,
or durable parser-health reporting. Redis failure stops progress; replay uses the
same queue identities. `/health` stays unready until the first scan completes.

The cursor key is
`discord-bot:axiom-cursor:<guild-id>:<intake-channel-id>`. Its JSON contains only
`messageId` and `checkedAt` (Unix milliseconds). It has no expiration, so downtime
beyond 24 hours remains detectable. A stale cursor queues an operational warning
and stops automatic recovery. After manual review of source messages and queue
retention, an operator may reset that exact cursor to an explicitly reviewed
message ID and current `checkedAt`; do not clear it blindly or replay older data.
Individual events older than the retained identity window are also reported
instead of automatically delivered again.

[Axiom match monitors](https://axiom.co/docs/monitor-data/match-monitors.md) allow
10 notifications per minute and 500 per day. Every candidate consumes the limit,
including copies of directly delivered events. Review volume approaching either
limit as degraded fallback coverage and revise filtering, polling, or paid
webhook delivery before relying on it. Discord embed-size truncation is also a
parser-health failure, never a partial logger event.

The reproducible live calibration tool is
`apps/discord-bot/integration/calibrate-axiom.mjs`. It emits two clearly labeled
production synthetic events through the logger's Axiom transport, opens a
temporary gateway observer, and asserts every projected field through the finished
parser. It also verifies HTTP 202 and final Discord delivery for one direct event.
Run it only as a deliberate live test with the production API Axiom ingestion
credential and production bot environment injected; it does not change monitors,
notifiers, secrets, or deployments. Build the bot first. The observer never starts
the bot worker or dispatches interactions. Captured content is represented by the
redacted fixture in `src/fixtures/axiom-match.json`.

## Synthetic ticket-summary evaluation

The evaluation tool never reads Discord conversations. Its five checked-in
synthetic cases cover a text bug, a feature request with an adversarial text
attachment, an image, a text PDF with corrected counts, and a scanned PDF with
adversarial instructions. The model must return the exact structured schema,
preserve required evidence, and leave unsupported facts unknown. Review every
output for invented claims and useful open questions; keyword checks alone are
not a quality decision.

Run offline fixture validation with:

```sh
node apps/discord-bot/integration/evaluate-summary.mjs --check
```

With the existing development credential, run an explicitly selected model:

```sh
infisical run --env dev --path /services/cheaper-inference -- \
  node apps/discord-bot/integration/evaluate-summary.mjs gemma-3-4b-it
```

It uses `AI_PROVIDER=cheaper-inference`, configurable `AI_MODEL` (when no model
argument is given), and `AI_BASE_URL=https://api.cheaperinference.com/v1`.
The tool restricts the route to that provider host, requires the current ZDR
vision catalog, sends `zdr: true`, validates confirmed ZDR billing, and never
retries through a non-ZDR route or another provider. JSONL output records quoted
prices, actual billed usage, latency, structured results, and failures; failed
models must not be silently accepted. Inference is a paid manual test, not CI.

The gateway has no verified raw-PDF contract. This evaluation uses local
`pdftotext` and rendered PNG pages through its tested image input. Regenerate
fixtures using `integration/generate-summary-fixtures.py` from the bot
directory with ReportLab and Poppler installed. These tools are evaluation
prerequisites; the runtime attachment pipeline is described below. Actual support
processing remains gated on the processor/retention review in the complete-
erasure inventory and the model decision recorded in ENG-504.

## Synthetic request-classification evaluation

Jev is adopted for advisory classification, separately from the title/summary
model. See the [accepted decision](../decisions/product/p-eng-30-advisory-support-classification.md)
for staff-control, failure, privacy, and integration requirements. Runtime
integration belongs to ENG-506 and is not shipped by the evaluation tools.
The fixed corpus in
`integration/evaluate-classification.mjs` contains 20 synthetic requests with
prewritten labels for bug/feature/question/other, ticket readiness, and suggested
bug priority. It includes corrections, resolved bugs, injection attempts, missing
attachment evidence, multilingual requests, outages, data loss, and privacy
incidents. It sends text only; it does not read Discord or inspect attachments.

```sh
node apps/discord-bot/integration/evaluate-classification.mjs --check
infisical run --env dev --path /services/cheaper-inference -- \
  node apps/discord-bot/integration/evaluate-classification.mjs --live
```

Only `--live` permits paid requests: two rounds, 40 calls, with no automatic
retries. The tool checks current catalog prices, sends `zdr: true` to
`/v1/decisions`, requires each settled receipt to confirm ZDR, and stops before
another call when accumulated batch charges reach USD 0.01. That local stop is
not an account-wide spending limit or an exact final-charge cap. Offline checks
and CI never make inference calls. JSONL records labels, full probabilities,
latency, actual billing and request IDs; readiness uses a fixed 0.5 threshold.

The default catalog quotes non-ZDR pricing; `GET /models?zdr=true` explicitly
selects the ZDR pricing scope. The harness requires that scope and checks each
receipt rather than interpreting the default listing as ZDR availability.
See ENG-504's evaluation document for results and limitations. Classification
remains advisory: buttons stay visible,
staff choose the ticket type and bug priority, and features receive no priority.
This evaluation does not implement a runtime classifier or change production
configuration.

## Recoverable ticket persistence

`src/tickets/runtime.ts` composes the Discord reader, bot-local Redis store,
dedicated-member Linear adapter and ZDR-only structured summarizer. Construction
does not connect Redis, register controls, or invoke inference. ENG-506 owns the
forum controls and lifecycle integration described below; the engine alone does not enable
production ticket creation. Linear headings and transcript metadata are English,
as directed by the owner; they do not use Discord interface localization.

Call `connect()` before serving ticket actions and `close()` during shutdown.
Only invoke `persist()` after the Owners role guard; the first durable staff
intent wins. Repeated calls resume its stable issue/comment UUIDs. Call
`finalize()` only after Discord buttons, tag and issue link have been repaired.
`lookup()` never creates an issue. Redis leases fence stale state writes and
allow interrupted operations to resume without exposing the queue transport.

## Forum controls and activation

`DISCORD_TICKETS_ENABLED` defaults to `false`; enabling it requires
`CHEAPERINFERENCE_API_KEY` on the bot. Optional
`DISCORD_TICKET_SUMMARY_PROVIDER`, `DISCORD_TICKET_SUMMARY_MODEL` and
`DISCORD_TICKET_INFERENCE_BASE_URL` configure the existing reviewed summary
boundary. Defaults remain Cheaper Inference / `gpt-6-luna` / its reviewed HTTPS
endpoint; Jev stays fixed to `jev-1.13` Decisions. No Infisical or deployment
changes are made by this implementation. Activation still requires owner
approval and the existing processor, erasure and backup/restore launch gates.

New active public support-forum threads receive a bounded V2 container with both
ticket buttons. Only Owners may open or submit modals; moderators do not suffice.
Discord-only copy explicitly uses English catalog keys; Linear uses English
directly. Bug priority is a select including `No priority`; features always use
priority zero. Modal opening uses only cached advice, without a network lookup.
Submission defers privately before reading modal values or running persistence.
The first durable staff request wins on every retry.

Finalization preserves unrelated tags, applies the ticket tag, disables both
buttons and publishes the Linear URL in the control message. A full five-tag
thread fails rather than dropping unrelated tags. Partial Discord failures leave
Redis uncompacted for startup, shard-resume or five-minute repair scans. Recovery
never creates issues, classifies history, fetches archived threads or reopens
them. Control-history pages contain at most 100 messages, capped at 10,000 total.

Human thread activity triggers ten-second-debounced advisory precomputation.
Edits/deletions invalidate hints immediately. Jev receives only the latest
16,000 characters of human text, with URL tokens removed: no attachment metadata,
bytes or private modal notes. Up to 500 threads retain only revision hashes and
advisory values for 15 minutes. Unchanged revisions reuse results, including
unavailable results. Only an already cached priority may prefill a bug modal;
later advice cannot overwrite opened or submitted forms. Type and readiness
never hide buttons or authorize/block actions.

The classifier permits two concurrent calls and 60 calls/hour/process, with a
15-second timeout, no retries and no provider/non-ZDR fallback. This is not an
account-wide dollar cap and resets on restart. Accepted responses require
settled ZDR billing, typed answers, complete unique option sets and normalized
probability distributions. Failure leaves manual controls available. All routine
tests mock inference and spend no credits. Protocol references:
[Discord components](https://docs.discord.com/developers/components/reference)
and [Cheaper Inference Decisions](https://api.cheaperinference.com/docs).

## Runtime attachment bounds

Canonical transcripts exclude bots and webhooks, fetch at most 100 messages per
page, and are bounded to 10,000 examined messages / 8 MB of snapshot data. They
do not retain signed URLs. Each download refetches the source attachment and
checks its original name, size, type and authorized CDN path. Allowed types are
PNG/JPEG/WebP/GIF, PDF and UTF-8 text/log/Markdown/CSV/JSON; active SVG, executables
and archives are rejected. File limits are decimal 10 MB each and 25 MB total.
Rejected uploads leave explicit omission metadata rather than losing the ticket.
Every allocated asset attempt is discoverable for erasure through the completed
source attachment's metadata; no duplicate visible file link is added.

AI input is separately bounded. Images are limited to 40 million decoded pixels
and normalized to 1280-pixel JPEGs; PDF analysis covers the first 10 pages using
Poppler text extraction and rendered pages. Text evidence is capped at 100,000
characters per attachment. Unreadable, truncated or context-budget-excluded
evidence is explicitly identified to the model. Original allowed files are still
uploaded to Linear. Temporary PDF files are removed after every attempt.
The request body is capped below the gateway's 4.5 MB wire limit, output at 8,000
tokens and the inference call at 60 seconds. Missing ZDR confirmation, refusal,
truncated output or schema failure rejects the attempt without a provider retry.

The shared root `railpack.json` includes runtime `poppler-utils`; it therefore
adds these tools to all services using that config on their next approved build.
CI installs Poppler beside its disposable Redis test server. Local tests need
both tools. This change does not apply Railway configuration or deploy services.
For privacy and backup launch requirements, see
[complete erasure](complete-erasure.md#recoverable-discord-ticket-operations).

## Verification

Before a release, verify each environment independently:

1. Connect with `Guilds`, `GuildMessages`, and `MessageContent`. Gateway close
   code `4014` means Message Content Intent is not enabled.
2. Fetch every configured role, destination channel, forum, tag, intake channel,
   and webhook by its exact ID.
3. Confirm effective bot permissions on each resource.
4. Post a controlled webhook message to the private intake and confirm the
   gateway event exposes its content and embeds.
5. Fetch the same message from channel history and remove the test message.

Do not start the local application/worker with the production token. Keep the Railway service
at one replica with zero deployment overlap, and obtain separate approval before
any production deployment.
