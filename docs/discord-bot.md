# Discord Bot Operations

The Pocket Trash Discord bot uses separate development and production Discord
applications. Runtime authorization and routing use Discord IDs, never names.
Environment-specific values live in Infisical at `/apps/discord-bot`.

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
| `DISCORD_AXIOM_INTAKE_WEBHOOK_ID` | Only trusted Axiom intake webhook |
| `DISCORD_SUPPORT_FORUM_ID` | Support forum parent channel |
| `DISCORD_BUG_TAG_ID` | Pre-provisioned `Bug` forum tag |
| `DISCORD_FEATURE_REQUEST_TAG_ID` | Pre-provisioned `Feature Request` forum tag |

`AXIOM_INTAKE_WEBHOOK_URL` is secret. The other Discord IDs are stable routing
or authorization inputs, but remain environment-specific configuration.

Railway owns `REDIS_URL` as a reference to `pocket-trash-queue`; do not copy its
password or public endpoint into Infisical.

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

Do not start a local process with the production token. Keep the Railway service
at one replica with zero deployment overlap, and obtain separate approval before
any production deployment.
