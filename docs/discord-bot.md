# Discord Bot Operations

The Pocket Trash Discord bot uses separate development and production Discord
applications. Runtime authorization and routing use Discord IDs, never names.
Environment-specific values live in Infisical at `/apps/discord-bot`.
Discord/logger service-owned values live at `/services/pocket-trash/discord-bot`
and are imported into the matching `dev` or `prod` application path. The
production application path is synchronized into Railway's production bot
service. Do not require a separate webhook-ID secret: derive its identity from
`AXIOM_INTAKE_WEBHOOK_URL`.

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
